"""
api_layer.py
All REST API routes for the Retail Customer Segmentation app.
"""

import io
import json
import logging
import threading
from pathlib import Path
import pandas as pd
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from fastapi.responses import StreamingResponse
import auth

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"

logger = logging.getLogger(__name__)
router = APIRouter()


def get_user_data(email: str):
    from main import get_user_data
    return get_user_data(email)


@router.get("/health", tags=["system"])
def health_check():
    """Check if the backend and default admin data are ready."""
    d = get_user_data("admin@retail.com")
    return {
        "status": "ok",
        "dataset_status": "ready" if d else "loading",
        "pipeline_ready": bool(d),
    }


@router.get("/analysis/status", tags=["system"])
def get_analysis_status(user: dict = Depends(auth.get_current_user)):
    """Check if the current user has completed analysis files."""
    email = user["email"]
    d = get_user_data(email)
    if d is not None:
        return {
            "has_analysis": True,
            "customer_count": int(len(d["rfm_raw"])),
        }
    return {
        "has_analysis": False,
        "customer_count": 0,
    }


@router.post("/upload", tags=["pipeline"])
async def upload_dataset(
    file: UploadFile = File(...),
    user: dict = Depends(auth.get_current_user)
):
    """Upload a new CSV/XLSX dataset and start the ML pipeline in the background."""
    email = user["email"]
    filename = file.filename.lower()

    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a CSV or Excel file."
        )

    try:
        contents = await file.read()
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        logger.error(f"Failed to read file: {e}")
        raise HTTPException(
            status_code=400,
            detail="Failed to parse the file. Please ensure it is a valid CSV or Excel file."
        )

    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    required_cols = ["CustomerID", "InvoiceDate", "Quantity", "UnitPrice"]
    col_map = {c.lower(): c for c in df.columns}
    missing_cols = []
    for req in required_cols:
        if req.lower() not in col_map:
            missing_cols.append(req)

    if missing_cols:
        missing_str = "\n".join([f"- {col}" for col in missing_cols])
        expected_str = "\n".join([f"- {col}" for col in required_cols])
        error_detail = (
            f"Dataset Validation Failed\n\n"
            f"Missing Required Columns:\n{missing_str}\n\n"
            f"Expected Columns:\n{expected_str}\n\n"
            f"Please upload a valid retail transaction dataset."
        )
        raise HTTPException(status_code=400, detail=error_detail)

    col_mapping = {}
    for col in df.columns:
        cl = col.lower()
        if cl == "customerid":
            col_mapping[col] = "CustomerID"
        elif cl == "invoicedate":
            col_mapping[col] = "InvoiceDate"
        elif cl == "quantity":
            col_mapping[col] = "Quantity"
        elif cl == "unitprice":
            col_mapping[col] = "UnitPrice"
        elif cl == "invoiceno":
            col_mapping[col] = "InvoiceNo"
        elif cl == "stockcode":
            col_mapping[col] = "StockCode"
        elif cl == "description":
            col_mapping[col] = "Description"
        elif cl == "country":
            col_mapping[col] = "Country"

    df = df.rename(columns=col_mapping)

    from main import run_user_pipeline_task
    threading.Thread(target=run_user_pipeline_task, args=(email, df)).start()

    return {"message": "Upload successful. ML pipeline started in the background."}


@router.get("/pipeline/status", tags=["pipeline"])
def get_pipeline_status(user: dict = Depends(auth.get_current_user)):
    """Get the current running status of the ML pipeline for the user."""
    from main import pipeline_status
    email = user["email"]
    status = pipeline_status.get(email)
    if status is None:
        return {
            "status": "idle",
            "step": "No active pipeline",
            "progress": 0,
            "error": None,
        }
    return status


@router.get("/download/{file_type}", tags=["pipeline"])
def download_analysis_file(
    file_type: str,
    user: dict = Depends(auth.get_current_user)
):
    """Download various analysis output files as CSV."""
    email = user["email"]
    d = get_user_data(email)
    if d is None:
        raise HTTPException(status_code=404, detail="No completed analysis found to download.")

    best_k = d["best_k"]
    rfm = d["rfm_raw"].copy()
    rfm["Cluster"] = d["clustering_results"][best_k]["labels"]

    user_dir = ARTIFACTS_DIR / email
    personas_path = user_dir / "personas.json"
    if personas_path.exists():
        try:
            with open(personas_path) as f:
                all_personas = json.load(f)
            personas_list = all_personas.get(str(best_k), [])
            cluster_map = {p["cluster_id"]: p["persona_name"] for p in personas_list}
            if cluster_map:
                rfm["Cluster"] = rfm["Cluster"].map(cluster_map).fillna(rfm["Cluster"])
        except Exception as e:
            logger.error(f"Failed to map personas: {e}")

    if file_type == "clustered_csv":
        cleaned = d["cleaned_data"].copy()
        clustered_tx = cleaned.merge(rfm[["CustomerID", "Cluster"]], on="CustomerID", how="left")
        clustered_tx = clustered_tx.sort_values(by="CustomerID", ascending=True)
        clustered_tx = clustered_tx.round(2)
        
        summary_df = rfm.groupby("Cluster").agg(
            customer_count=("CustomerID", "count"),
            avg_recency=("Recency", "mean"),
            avg_frequency=("Frequency", "mean"),
            avg_monetary=("Monetary", "mean"),
            total_monetary=("Monetary", "sum")
        ).reset_index().round(2)

        stream = io.StringIO()
        stream.write("CLUSTER SUMMARY STATISTICS\n")
        summary_df.to_csv(stream, index=False)
        stream.write("\n")
        stream.write("TRANSACTIONS DATA\n")
        clustered_tx.to_csv(stream, index=False)
        
        stream.seek(0)
        return StreamingResponse(
            io.BytesIO(stream.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=clustered_transactions_k{best_k}.csv"}
        )

    elif file_type == "rfm_table":
        rfm_export = rfm.round(2)
        stream = io.StringIO()
        rfm_export.to_csv(stream, index=False)
        stream.seek(0)
        return StreamingResponse(
            io.BytesIO(stream.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=rfm_features_k{best_k}.csv"}
        )

    elif file_type == "cluster_summary":
        summary_df = rfm.groupby("Cluster").agg(
            customer_count=("CustomerID", "count"),
            avg_recency=("Recency", "mean"),
            avg_frequency=("Frequency", "mean"),
            avg_monetary=("Monetary", "mean"),
            total_monetary=("Monetary", "sum")
        ).reset_index().round(2)

        stream = io.StringIO()
        summary_df.to_csv(stream, index=False)
        stream.seek(0)
        return StreamingResponse(
            io.BytesIO(stream.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=cluster_summary_k{best_k}.csv"}
        )

    else:
        raise HTTPException(status_code=400, detail="Invalid file type requested.")


@router.get("/metrics", tags=["analytics"])
def get_metrics(user: dict = Depends(auth.get_current_user)):
    """Return top-level KPI numbers (customer count, recency, frequency, revenue)."""
    email = user["email"]
    d = get_user_data(email)
    if d is None:
        raise HTTPException(status_code=503, detail="Analysis not ready for this user")

    rfm = d.get("rfm_raw")
    if rfm is None:
        raise HTTPException(status_code=503, detail="Data not loaded yet")

    return {
        "total_customers": int(len(rfm)),
        "avg_recency": round(float(rfm["Recency"].mean()), 1),
        "avg_frequency": round(float(rfm["Frequency"].mean()), 1),
        "total_revenue": round(float(rfm["Monetary"].sum()), 2),
        "best_k": d.get("best_k", 4),
        "silhouette_scores": d.get("silhouette_scores", {}),
    }


@router.get("/segment", tags=["analytics"])
def get_segments(k: int = 4, user: dict = Depends(auth.get_current_user)):
    """Return customer RFM data with their cluster labels for a given K."""
    email = user["email"]
    d = get_user_data(email)
    if d is None:
        raise HTTPException(status_code=503, detail="Analysis not ready for this user")

    rfm = d.get("rfm_raw")
    clustering_results = d.get("clustering_results", {})

    if rfm is None or k not in clustering_results:
        raise HTTPException(status_code=400, detail=f"k={k} not available")

    labels = clustering_results[k]["labels"]
    df = rfm.copy()
    df["Cluster"] = labels

    cluster_summary = (
        df.groupby("Cluster")
        .agg(
            count=("CustomerID", "count"),
            avg_recency=("Recency", "mean"),
            avg_frequency=("Frequency", "mean"),
            avg_monetary=("Monetary", "mean"),
        )
        .reset_index()
        .round(2)
        .to_dict(orient="records")
    )

    sample = df.sample(min(500, len(df)), random_state=42)
    scatter_data = sample[["CustomerID", "Recency", "Frequency", "Monetary", "Cluster"]].to_dict(orient="records")

    return {
        "k": k,
        "cluster_summary": cluster_summary,
        "scatter_data": scatter_data,
    }


@router.get("/personas", tags=["analytics"])
def get_personas(k: int = 4, user: dict = Depends(auth.get_current_user)):
    """Return persona cards (name, description, recommendations) for each cluster."""
    email = user["email"]
    d = get_user_data(email)
    if d is None:
        raise HTTPException(status_code=503, detail="Analysis not ready for this user")

    all_personas = d.get("all_personas", {})
    if str(k) not in all_personas:
        raise HTTPException(status_code=400, detail=f"Personas for k={k} not found")
    return {"k": k, "personas": all_personas[str(k)]}


@router.get("/customer/{customer_id}", tags=["analytics"])
def get_customer(customer_id: int, k: int = 4, user: dict = Depends(auth.get_current_user)):
    """Look up a specific customer's RFM metrics, cluster, and recommendations."""
    email = user["email"]
    d = get_user_data(email)
    if d is None:
        raise HTTPException(status_code=503, detail="Analysis not ready for this user")

    rfm = d.get("rfm_raw")
    clustering_results = d.get("clustering_results", {})
    all_personas = d.get("all_personas", {})

    if rfm is None or k not in clustering_results:
        raise HTTPException(status_code=503, detail="Data not loaded")

    # Handle float/int types in matching CustomerID
    customer_row = rfm[rfm["CustomerID"].astype(str) == str(customer_id)]
    if customer_row.empty:
        raise HTTPException(status_code=404, detail="Customer not found")

    idx = customer_row.index[0]
    cluster_id = int(clustering_results[k]["labels"][idx])

    personas = all_personas.get(str(k), [])
    persona = next((p for p in personas if p["cluster_id"] == cluster_id), None)

    df = rfm.copy()
    df["Cluster"] = clustering_results[k]["labels"]
    cluster_avg = df[df["Cluster"] == cluster_id][["Recency", "Frequency", "Monetary"]].mean()

    return {
        "customer_id": customer_id,
        "cluster_id": cluster_id,
        "persona_name": persona["persona_name"] if persona else "Unknown",
        "recommendations": persona.get("recommendations", []) if persona else [],
        "metrics": {
            "recency": round(float(customer_row["Recency"].iloc[0]), 1),
            "frequency": round(float(customer_row["Frequency"].iloc[0]), 1),
            "monetary": round(float(customer_row["Monetary"].iloc[0]), 2),
        },
        "cluster_averages": {
            "recency": round(float(cluster_avg["Recency"]), 1),
            "frequency": round(float(cluster_avg["Frequency"]), 1),
            "monetary": round(float(cluster_avg["Monetary"]), 2),
        },
    }


@router.get("/cluster/{cluster_id}/customers", tags=["analytics"])
def get_cluster_customers(cluster_id: int, k: int = 4, user: dict = Depends(auth.get_current_user)):
    """Return a list of all customers belonging to a specific cluster."""
    email = user["email"]
    d = get_user_data(email)
    if d is None:
        raise HTTPException(status_code=503, detail="Analysis not ready for this user")

    rfm = d.get("rfm_raw")
    clustering_results = d.get("clustering_results", {})

    if k not in clustering_results:
        raise HTTPException(status_code=400, detail=f"No clustering results for k={k}")

    df = rfm.copy()
    df["Cluster"] = clustering_results[k]["labels"]
    df["Cluster"] = df["Cluster"].astype(int)

    cluster_df = df[df["Cluster"] == int(cluster_id)]
    if cluster_df.empty:
        raise HTTPException(status_code=404, detail="Cluster not found or is empty")

    cluster_df = cluster_df.sort_values(by="Monetary", ascending=False)
    customers = cluster_df[["CustomerID", "Recency", "Frequency", "Monetary"]].to_dict(orient="records")
    return {"cluster_id": cluster_id, "k": k, "count": len(customers), "customers": customers}


@router.get("/customer/{customer_id}/transactions", tags=["analytics"])
def get_customer_transactions(customer_id: int, user: dict = Depends(auth.get_current_user)):
    """Return the full purchase history for a specific customer, sorted newest-first."""
    email = user["email"]
    d = get_user_data(email)
    if d is None:
        raise HTTPException(status_code=503, detail="Analysis not ready for this user")

    cleaned = d.get("cleaned_data")
    if cleaned is None:
        raise HTTPException(status_code=503, detail="Transaction data not loaded yet")

    customer_df = cleaned[cleaned["CustomerID"].astype(str) == str(customer_id)]
    if customer_df.empty:
        raise HTTPException(status_code=404, detail="No transactions found for this customer")

    customer_df = customer_df.sort_values("InvoiceDate", ascending=False)

    transactions = []
    for _, row in customer_df[["InvoiceDate", "Description", "Quantity", "UnitPrice", "TotalPrice"]].iterrows():
        desc = row.get("Description", "No Description")
        desc_str = str(desc) if not pd.isna(desc) else "No Description"
        
        transactions.append({
            "InvoiceDate": row["InvoiceDate"].strftime("%Y-%m-%d %H:%M") if hasattr(row["InvoiceDate"], "strftime") else str(row["InvoiceDate"]),
            "Description": desc_str,
            "Quantity": int(row.get("Quantity", 1)),
            "UnitPrice": round(float(row.get("UnitPrice", 0.0)), 2),
            "TotalPrice": round(float(row.get("TotalPrice", 0.0)), 2),
        })

    top_products_list = []
    if "Description" in customer_df.columns:
        top_products = (
            customer_df.groupby("Description")["Quantity"]
            .sum()
            .sort_values(ascending=False)
            .head(5)
            .reset_index()
            .rename(columns={"Description": "product", "Quantity": "total_qty"})
        )
        top_products_list = [
            {"product": str(r["product"]), "total_qty": int(r["total_qty"])}
            for _, r in top_products.iterrows()
        ]

    return {
        "customer_id": customer_id,
        "total_transactions": len(transactions),
        "transactions": transactions,
        "top_products": top_products_list,
    }
