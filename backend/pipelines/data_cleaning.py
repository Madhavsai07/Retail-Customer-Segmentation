"""
data_cleaning.py

"""

import logging
import numpy as np
import pandas as pd
from pathlib import Path

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"


def clean_data(df: pd.DataFrame, output_dir: Path = None) -> pd.DataFrame:
    """Full cleaning pipeline for Online Retail data."""
    initial_rows = len(df)
    logger.info(f"Starting cleaning — initial rows: {initial_rows:,}")

    # 1. Drop missing CustomerID
    df = df.dropna(subset=["CustomerID"])
    logger.info(f"After dropping null CustomerID: {len(df):,} rows")

    # 2. Remove cancellations (InvoiceNo starts with 'C')
    df = df[~df["InvoiceNo"].astype(str).str.startswith("C")]
    logger.info(f"After removing cancellations: {len(df):,} rows")

    # 3. Remove non-positive Quantity and UnitPrice
    df = df[df["Quantity"] > 0]
    df = df[df["UnitPrice"] > 0]
    logger.info(f"After removing invalid Quantity/UnitPrice: {len(df):,} rows")

    # 4. TotalPrice feature
    df["TotalPrice"] = df["Quantity"] * df["UnitPrice"]

    # 5. Parse InvoiceDate
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"])

    # 6. CustomerID as integer
    df["CustomerID"] = df["CustomerID"].astype(int)

    # 7. Outlier treatment via log1p then cap at 99th percentile
    for col in ["Quantity", "UnitPrice", "TotalPrice"]:
        df[f"{col}_log"] = np.log1p(df[col])
        cap = df[f"{col}_log"].quantile(0.99)
        df[col] = df[col].clip(upper=np.expm1(cap))

    df = df.drop(columns=[c for c in df.columns if c.endswith("_log")])

    logger.info(f"Cleaned dataset — final rows: {len(df):,}")

    # Cast mixed-type columns to string for Parquet compatibility
    for col in ["StockCode", "InvoiceNo", "Description", "Country"]:
        if col in df.columns:
            df[col] = df[col].astype(str)

    # 8. Save artifact
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / "cleaned_data.parquet"
        df.to_parquet(out_path, index=False)
        logger.info(f"Cleaned data saved to: {out_path}")

    return df


if __name__ == "__main__":
    from data_ingestion import load_data
    raw = load_data()
    cleaned = clean_data(raw)
    print(cleaned.dtypes)
    print(cleaned.head())
