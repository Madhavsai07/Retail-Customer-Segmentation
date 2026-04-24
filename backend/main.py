"""
main.py
FastAPI application entry point.
Loads the pre-computed ML artifacts (RFM data, clustering results, personas)
once at startup and makes them available to all API routes.
"""

import json
import logging
from pathlib import Path


import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sklearn.preprocessing import MinMaxScaler

from api_layer import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Path to the pre-computed ML artifacts
ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts" / "admin@retail.com"

# ── Global data store (loaded once on startup) ──────────────────────────────
# This dictionary holds all the ML results that the API endpoints will serve.
data = {}

# ── FastAPI app setup ────────────────────────────────────────────────────────
app = FastAPI(
    title="Retail Customer Segmentation API",
    description="RFM + K-Means clustering results exposed via REST API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


# ── Startup: load all artifacts into memory ──────────────────────────────────
@app.on_event("startup")
def startup_event():
    logger.info("=== Loading ML artifacts... ===")

    try:
        # Load RFM feature tables
        rfm_raw = pd.read_parquet(ARTIFACTS_DIR / "rfm_features.parquet")
        rfm_scaled = pd.read_parquet(ARTIFACTS_DIR / "rfm_scaled.parquet")

        # Load full cleaned transaction-level data for purchase history
        cleaned_data = pd.read_parquet(ARTIFACTS_DIR / "cleaned_data.parquet")
        cleaned_data["InvoiceDate"] = pd.to_datetime(cleaned_data["InvoiceDate"])

        # Load persona definitions
        with open(ARTIFACTS_DIR / "personas.json") as f:
            all_personas = json.load(f)

        # Run clustering in memory for k=3,4,5
        from pipelines.clustering_engine import run_clustering
        from pipelines.evaluation import evaluate_models

        clustering_results = run_clustering(rfm_scaled)
        best_k, silhouette_scores = evaluate_models(rfm_scaled, clustering_results)

        # Build scaler (same log + MinMax used during training)
        feature_cols = ["Recency", "Frequency", "Monetary"]
        scaler = MinMaxScaler()
        scaler.fit(np.log1p(rfm_raw[feature_cols].values))

        # Store everything in the global data dict
        data["rfm_raw"] = rfm_raw
        data["rfm_scaled"] = rfm_scaled
        data["cleaned_data"] = cleaned_data
        data["clustering_results"] = clustering_results
        data["best_k"] = best_k
        data["silhouette_scores"] = silhouette_scores
        data["all_personas"] = all_personas
        data["scaler"] = scaler

        logger.info(f"✅ Loaded {len(rfm_raw)} customers | Best K={best_k}")

    except Exception as e:
        logger.error(f"❌ Failed to load artifacts: {e}")
