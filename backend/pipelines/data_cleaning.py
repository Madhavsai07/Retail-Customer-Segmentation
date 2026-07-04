"""
data_cleaning.py

"""

import logging
import numpy as np
import pandas as pd
from pathlib import Path

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"


def clean_data(df: pd.DataFrame, output_dir: Path = None) -> tuple[pd.DataFrame, dict]:
    """Full cleaning pipeline for dynamic uploaded data."""
    initial_rows = len(df)
    logger.info(f"Starting cleaning — initial rows: {initial_rows:,}")
    summary = {"initial_rows": initial_rows}

    if "CustomerID" in df.columns:
        df = df.dropna(subset=["CustomerID"])
        df["CustomerID"] = df["CustomerID"].astype(str).str.extract(r'(\d+)')[0]
        df["CustomerID"] = df["CustomerID"].fillna("-1").astype(int)
        logger.info(f"After dropping null CustomerID: {len(df):,} rows")
    else:
        df["CustomerID"] = df.index
        logger.info("No CustomerID found, using row index as CustomerID.")

    if "InvoiceNo" in df.columns:
        df = df[~df["InvoiceNo"].astype(str).str.startswith("C")]
        logger.info(f"After removing cancellations: {len(df):,} rows")

    if "Quantity" in df.columns and pd.api.types.is_numeric_dtype(df["Quantity"]):
        df = df[df["Quantity"] > 0]
    elif "Quantity" not in df.columns:
        df["Quantity"] = 1

    if "UnitPrice" in df.columns and pd.api.types.is_numeric_dtype(df["UnitPrice"]):
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

    for col in ["Quantity", "UnitPrice", "TotalPrice"]:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            df[f"{col}_log"] = np.log1p(df[col])
            cap = df[f"{col}_log"].quantile(0.99)
            if not np.isnan(cap):
                df[col] = df[col].clip(upper=np.expm1(cap))
            
    df = df.drop(columns=[c for c in df.columns if c.endswith("_log")])

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
