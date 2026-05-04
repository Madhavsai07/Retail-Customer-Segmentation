"""
feature_engineering.py
Computes RFM (Recency, Frequency, Monetary) features, applies log1p transform
and MinMaxScaler, then saves the feature matrix to Parquet.
"""

import logging
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.preprocessing import MinMaxScaler

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"


def compute_rfm(df: pd.DataFrame) -> pd.DataFrame:
    """Compute raw RFM from cleaned transaction data."""
    snapshot_date = df["InvoiceDate"].max() + pd.Timedelta(days=1)
    logger.info(f"Snapshot date for recency: {snapshot_date.date()}")

    rfm = (
        df.groupby("CustomerID")
        .agg(
            Recency=("InvoiceDate", lambda x: (snapshot_date - x.max()).days),
            Frequency=("InvoiceNo", "nunique"),
            Monetary=("TotalPrice", "sum"),
        )
        .reset_index()
    )

    logger.info(f"RFM computed for {len(rfm):,} customers")
    return rfm


def engineer_features(df: pd.DataFrame, output_dir: Path = None) -> tuple[pd.DataFrame, pd.DataFrame]:

    rfm_raw = compute_rfm(df)

    # Log1p transform to reduce skew
    rfm_scaled = rfm_raw.copy()
    for col in ["Recency", "Frequency", "Monetary"]:
        rfm_scaled[col] = np.log1p(rfm_scaled[col])

    # MinMax scale to [0, 1]
    scaler = MinMaxScaler()
    feature_cols = ["Recency", "Frequency", "Monetary"]
    rfm_scaled[feature_cols] = scaler.fit_transform(rfm_scaled[feature_cols])

    # Save both
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        rfm_raw.to_parquet(output_dir / "rfm_features.parquet", index=False)
        rfm_scaled.to_parquet(output_dir / "rfm_scaled.parquet", index=False)
        logger.info(f"RFM features saved to {output_dir}")

    return rfm_raw, rfm_scaled


if __name__ == "__main__":
    from data_ingestion import load_data
    from data_cleaning import clean_data

    # Try to find a user folder (e.g., admin@retail.com) in artifacts for output
    user_dirs = [d for d in ARTIFACTS_DIR.iterdir() if d.is_dir()]
    target_dir = user_dirs[0] if user_dirs else ARTIFACTS_DIR
    
    raw = load_data()
    clean = clean_data(raw)
    rfm_raw, rfm_scaled = engineer_features(clean, output_dir=target_dir)
    print(rfm_raw.describe())
