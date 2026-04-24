"""
main.py
FastAPI application entry point.

Startup strategy:
  - IF precomputed artifacts exist → load them directly (fast, no dataset needed)
  - IF artifacts are missing → run the full ML pipeline from the raw dataset
  - IF artifacts are missing AND dataset is missing → warn and start with empty state
"""

import json
import logging
import os
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sklearn.preprocessing import MinMaxScaler

from api_layer import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).resolve().parent
ARTIFACTS_DIR = BASE_DIR / "artifacts" / "admin@retail.com"
DATASET_PATH  = BASE_DIR / "data" / "online_retail.xlsx"

# Required artifact files for a "pre-loaded" startup
REQUIRED_ARTIFACTS = [
    "rfm_features.parquet",
    "rfm_scaled.parquet",
    "cleaned_data.parquet",
    "personas.json",
]

# ── Global data store ─────────────────────────────────────────────────────────
data = {}

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Retail Customer Segmentation API",
    description="RFM + K-Means clustering results exposed via REST API",
    version="1.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allowing all origins for now so the Vercel frontend can reach this backend.
# To restrict later, set ALLOWED_ORIGINS env var and replace "*" with the list.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(router)


# ── Helper: check if all artifacts exist ──────────────────────────────────────
def artifacts_exist() -> bool:
    """Return True only when every required artifact file is present on disk."""
    return all((ARTIFACTS_DIR / f).exists() for f in REQUIRED_ARTIFACTS)


# ── Helper: load precomputed artifacts into memory ────────────────────────────
def load_artifacts() -> None:
    """
    Load all precomputed ML artifacts from disk into the global `data` dict.
    Runs K-Means and silhouette scoring in-memory (fast, uses parquet inputs).
    """
    from pipelines.clustering_engine import run_clustering
    from pipelines.evaluation import evaluate_models

    logger.info("Loading precomputed artifacts from disk...")

    rfm_raw    = pd.read_parquet(ARTIFACTS_DIR / "rfm_features.parquet")
    rfm_scaled = pd.read_parquet(ARTIFACTS_DIR / "rfm_scaled.parquet")

    cleaned_data = pd.read_parquet(ARTIFACTS_DIR / "cleaned_data.parquet")
    cleaned_data["InvoiceDate"] = pd.to_datetime(cleaned_data["InvoiceDate"])

    with open(ARTIFACTS_DIR / "personas.json") as f:
        all_personas = json.load(f)

    clustering_results        = run_clustering(rfm_scaled)
    best_k, silhouette_scores = evaluate_models(rfm_scaled, clustering_results)

    feature_cols = ["Recency", "Frequency", "Monetary"]
    scaler = MinMaxScaler()
    scaler.fit(np.log1p(rfm_raw[feature_cols].values))

    data["rfm_raw"]            = rfm_raw
    data["rfm_scaled"]         = rfm_scaled
    data["cleaned_data"]       = cleaned_data
    data["clustering_results"] = clustering_results
    data["best_k"]             = best_k
    data["silhouette_scores"]  = silhouette_scores
    data["all_personas"]       = all_personas
    data["scaler"]             = scaler

    logger.info(f"✅ Artifacts loaded successfully — {len(rfm_raw)} customers | Best K={best_k}")


# ── Helper: run full ML pipeline and save artifacts ───────────────────────────
def run_pipeline() -> None:
    """
    Execute the full ML pipeline from the raw dataset.
    Saves every artifact to disk so the next startup uses load_artifacts() instead.
    """
    from pipelines.data_ingestion    import load_data
    from pipelines.data_cleaning     import clean_data
    from pipelines.feature_engineering import engineer_features
    from pipelines.clustering_engine import run_clustering, save_best_model
    from pipelines.evaluation        import evaluate_models
    from pipelines.persona_generator import generate_personas

    logger.info("Running full ML pipeline...")

    raw_df    = load_data(DATASET_PATH)
    clean_df  = clean_data(raw_df, output_dir=ARTIFACTS_DIR)

    rfm_raw, rfm_scaled = engineer_features(clean_df, output_dir=ARTIFACTS_DIR)

    clustering_results        = run_clustering(rfm_scaled)
    best_k, silhouette_scores = evaluate_models(rfm_scaled, clustering_results)

    save_best_model(clustering_results, best_k, output_dir=ARTIFACTS_DIR)

    # generate_personas saves personas.json and returns list for best_k
    all_personas_best = generate_personas(
        rfm_raw, clustering_results, best_k, output_dir=ARTIFACTS_DIR
    )

    # Re-build the full dict keyed by k (load from newly saved file)
    with open(ARTIFACTS_DIR / "personas.json") as f:
        all_personas = json.load(f)

    feature_cols = ["Recency", "Frequency", "Monetary"]
    scaler = MinMaxScaler()
    scaler.fit(np.log1p(rfm_raw[feature_cols].values))

    data["rfm_raw"]            = rfm_raw
    data["rfm_scaled"]         = rfm_scaled
    data["cleaned_data"]       = clean_df
    data["clustering_results"] = clustering_results
    data["best_k"]             = best_k
    data["silhouette_scores"]  = silhouette_scores
    data["all_personas"]       = all_personas
    data["scaler"]             = scaler

    logger.info(f"✅ Pipeline executed successfully — {len(rfm_raw)} customers | Best K={best_k}")


# ── Startup event ─────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    logger.info("=== RetailIQ Backend Starting ===")

    if artifacts_exist():
        # Fast path: artifacts already on disk
        logger.info("Precomputed artifacts found. Skipping pipeline...")
        try:
            load_artifacts()
        except Exception as e:
            logger.error(f"❌ Failed to load artifacts: {e}")

    else:
        # Slow path: need to build artifacts from dataset
        logger.warning("Artifacts not found. Attempting to run ML pipeline...")

        if not DATASET_PATH.exists():
            logger.warning(
                f"⚠️  Dataset missing at: {DATASET_PATH}. "
                "Cannot run pipeline. Backend will start with empty state — "
                "APIs will return 503 until artifacts are provided."
            )
            return  # Start anyway, don't crash

        try:
            run_pipeline()
        except Exception as e:
            logger.error(f"❌ Pipeline execution failed: {e}")
