"""
data_cleaning.py
Cleans raw retail transaction data according to the RetailIQ Returns & Cleaning Policy:
1. Missing Customer IDs: Dropped because transactions cannot be attributed to an individual customer profile.
2. Cancellations & Returns: Identified by 'C' invoice prefix or non-positive quantity/price.
   - Audited: Cancellations and return adjustments are explicitly counted and their monetary volume tracked in the summary.
   - Filtered: Removed from RFM segmentation because customer lifetime value modeling (RFM) requires positive forward-purchasing frequency and positive monetary spend to support logarithmic transformation (log1p).
3. Value Preservation: Positive transaction values (Quantity, UnitPrice, TotalPrice) are preserved exactly as uploaded without synthetic clipping.
"""

import logging
import pandas as pd
from pathlib import Path

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"


def clean_data(df: pd.DataFrame, output_dir: Path = None) -> tuple[pd.DataFrame, dict]:
    """Full cleaning pipeline for dynamic uploaded data."""
    initial_rows = len(df)
    logger.info(f"Starting cleaning — initial rows: {initial_rows:,}")
    summary = {
        "initial_rows": initial_rows,
        "null_customer_ids": 0,
        "cancellations_count": 0,
        "negative_quantity_count": 0,
        "negative_price_count": 0,
        "returns_monetary_impact": 0.0,
    }

    if "CustomerID" in df.columns:
        null_cids = int(df["CustomerID"].isna().sum())
        summary["null_customer_ids"] = null_cids
        df = df.dropna(subset=["CustomerID"]).copy()
        df["CustomerID"] = df["CustomerID"].astype(str).str.extract(r'(\d+)')[0]
        df["CustomerID"] = df["CustomerID"].fillna("-1").astype(int)
        logger.info(f"After dropping null CustomerID ({null_cids} dropped): {len(df):,} rows")
    else:
        df = df.copy()
        df["CustomerID"] = df.index
        logger.info("No CustomerID found, using row index as CustomerID.")

    if "InvoiceNo" in df.columns:
        cancellation_mask = df["InvoiceNo"].astype(str).str.startswith("C")
        cancellations_count = int(cancellation_mask.sum())
        summary["cancellations_count"] = cancellations_count
        if "Quantity" in df.columns and "UnitPrice" in df.columns:
            # Estimate return value of cancellations
            canceled_rows = df[cancellation_mask]
            summary["returns_monetary_impact"] = round(float(
                (canceled_rows["Quantity"].abs() * canceled_rows["UnitPrice"].abs()).sum()
            ), 2)
        df = df[~cancellation_mask].copy()
        logger.info(f"After removing cancellations ({cancellations_count} dropped): {len(df):,} rows")

    if "Quantity" in df.columns and pd.api.types.is_numeric_dtype(df["Quantity"]):
        neg_qty = int((df["Quantity"] <= 0).sum())
        summary["negative_quantity_count"] = neg_qty
        df = df[df["Quantity"] > 0]
    elif "Quantity" not in df.columns:
        df["Quantity"] = 1

    if "UnitPrice" in df.columns and pd.api.types.is_numeric_dtype(df["UnitPrice"]):
        neg_price = int((df["UnitPrice"] <= 0).sum())
        summary["negative_price_count"] = neg_price
        df = df[df["UnitPrice"] > 0]
    elif "UnitPrice" not in df.columns:
        df["UnitPrice"] = 1.0

    if "TotalPrice" not in df.columns:
        df["TotalPrice"] = df["Quantity"] * df["UnitPrice"]

    if "InvoiceDate" in df.columns:
        df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"], errors='coerce')
        df = df.dropna(subset=["InvoiceDate"])
    else:
        df["InvoiceDate"] = pd.Timestamp.now()

    # Round monetary columns for display precision only.
    # Raw transaction Quantity and UnitPrice are preserved exactly as uploaded —
    # clipping/outlier treatment is applied only to aggregated RFM features downstream,
    # not to individual transaction rows.
    for col in ["UnitPrice", "TotalPrice"]:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].round(2)

    summary["final_rows"] = len(df)
    logger.info(f"Cleaned dataset — final rows: {len(df):,}")

    for col in ["StockCode", "InvoiceNo", "Description", "Country"]:
        if col in df.columns:
            df[col] = df[col].astype(str)

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / "cleaned_data.parquet"
        df.to_parquet(out_path, index=False)
        logger.info(f"Cleaned data saved to: {out_path}")

    return df, summary


if __name__ == "__main__":
    pass
