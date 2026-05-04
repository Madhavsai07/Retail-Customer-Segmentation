"""
api_layer.py
All REST API routes for the Retail Customer Segmentation app.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
import auth

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helper: get the global ML data from main.py ──────────────────────────────
def get_data():
    from main import data
    return data


# ── Public endpoints (no authentication required) ────────────────────────────

@router.get("/health", tags=["system"])
def health_check():
    """Check if the backend and data are ready."""
    d = get_data()
    return {
        "status": "ok",
        "dataset_status": "ready" if d else "loading",
        "pipeline_ready": bool(d),
    }


@router.get("/metrics", tags=["analytics"])
def get_metrics():
    """Return top-level KPI numbers (customer count, recency, frequency, revenue)."""
    d = get_data()
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
def get_segments(k: int = 4):
    """Return customer RFM data with their cluster labels for a given K."""
    d = get_data()
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


# ── Protected endpoints (Supabase JWT required) ──────────────────────────────

@router.get("/personas", tags=["analytics"])
def get_personas(k: int = 4, user: dict = Depends(auth.get_current_user)):
    """Return persona cards (name, description, recommendations) for each cluster."""
    d = get_data()
    all_personas = d.get("all_personas", {})
    if str(k) not in all_personas:
        raise HTTPException(status_code=400, detail=f"Personas for k={k} not found")
    return {"k": k, "personas": all_personas[str(k)]}


@router.get("/customer/{customer_id}", tags=["analytics"])
def get_customer(customer_id: int, k: int = 4, user: dict = Depends(auth.get_current_user)):
    """Look up a specific customer's RFM metrics, cluster, and recommendations."""
    d = get_data()
    rfm = d.get("rfm_raw")
    clustering_results = d.get("clustering_results", {})
    all_personas = d.get("all_personas", {})

    if rfm is None or k not in clustering_results:
        raise HTTPException(status_code=503, detail="Data not loaded")

    customer_row = rfm[rfm["CustomerID"] == customer_id]
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
    d = get_data()
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
    d = get_data()
    cleaned = d.get("cleaned_data")

    if cleaned is None:
        raise HTTPException(status_code=503, detail="Transaction data not loaded yet")

    customer_df = cleaned[cleaned["CustomerID"] == customer_id]
    if customer_df.empty:
        raise HTTPException(status_code=404, detail="No transactions found for this customer")

    customer_df = customer_df.sort_values("InvoiceDate", ascending=False)

    transactions = []
    for _, row in customer_df[["InvoiceDate", "Description", "Quantity", "UnitPrice", "TotalPrice"]].iterrows():
        transactions.append({
            "InvoiceDate": row["InvoiceDate"].strftime("%Y-%m-%d %H:%M"),
            "Description": str(row["Description"]),
            "Quantity": int(row["Quantity"]),
            "UnitPrice": round(float(row["UnitPrice"]), 2),
            "TotalPrice": round(float(row["TotalPrice"]), 2),
        })

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
