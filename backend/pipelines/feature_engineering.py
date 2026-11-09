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

    df_rfm = df.copy()
    if "InvoiceNo" not in df_rfm.columns:
        logger.info("InvoiceNo column missing; grouping by CustomerID and InvoiceDate date to generate frequency.")
        dates = pd.to_datetime(df_rfm["InvoiceDate"]).dt.date
        df_rfm["InvoiceNo"] = df_rfm.groupby(["CustomerID", dates]).ngroup().astype(str)

    rfm = (
        df_rfm.groupby("CustomerID")
        .agg(
            Recency=("InvoiceDate", lambda x: (snapshot_date - x.max()).days),
            Frequency=("InvoiceNo", "nunique"),
            Monetary=("TotalPrice", "sum"),
        )
        .reset_index()
    )

    if "Monetary" in rfm.columns:
        rfm["Monetary"] = rfm["Monetary"].round(2)

    logger.info(f"RFM computed for {len(rfm):,} customers")
    return rfm


def engineer_features(df: pd.DataFrame, output_dir: Path = None) -> tuple[pd.DataFrame, pd.DataFrame]:

    rfm_raw = compute_rfm(df)

    rfm_scaled = rfm_raw.copy()
    # Log1p requires non-negative values. If any net returns resulted in Monetary <= 0,
    # clip to 0 to prevent NaN or domain errors.
    rfm_scaled["Monetary"] = np.clip(rfm_scaled["Monetary"], a_min=0, a_max=None)
    rfm_scaled["Recency"] = np.clip(rfm_scaled["Recency"], a_min=0, a_max=None)
    rfm_scaled["Frequency"] = np.clip(rfm_scaled["Frequency"], a_min=0, a_max=None)

    for col in ["Recency", "Frequency", "Monetary"]:
        rfm_scaled[col] = np.log1p(rfm_scaled[col])

    scaler = MinMaxScaler()
    feature_cols = ["Recency", "Frequency", "Monetary"]
    rfm_scaled[feature_cols] = scaler.fit_transform(rfm_scaled[feature_cols])

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        rfm_raw.to_parquet(output_dir / "rfm_features.parquet", index=False)
        rfm_scaled.to_parquet(output_dir / "rfm_scaled.parquet", index=False)
        logger.info(f"RFM features saved to {output_dir}")

    return rfm_raw, rfm_scaled


if __name__ == "__main__":
    pass
