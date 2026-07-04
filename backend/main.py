"""
main.py
FastAPI application entry point.

Startup strategy:
  - Load admin@retail.com precomputed artifacts if they exist
  - Otherwise, run the pipeline on the sample retail dataset if it exists
"""

import json
import logging
import os
import threading
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sklearn.preprocessing import MinMaxScaler

from api_layer import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR           = Path(__file__).resolve().parent
ARTIFACTS_DIR_BASE = BASE_DIR / "artifacts"
DATASET_PATH       = BASE_DIR / "data" / "online_retail.xlsx"

REQUIRED_ARTIFACTS = [
    "rfm_features.parquet",
    "rfm_scaled.parquet",
    "cleaned_data.parquet",
    "personas.json",
]

user_data = {}
pipeline_status = {}

app = FastAPI(
    title="Retail Customer Segmentation API",
    description="RFM + K-Means clustering results exposed via REST API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


def load_user_artifacts(email: str) -> dict:
    """Load all precomputed ML artifacts from disk for a specific user."""
    from pipelines.clustering_engine import run_clustering
    from pipelines.evaluation import evaluate_models

    user_dir = ARTIFACTS_DIR_BASE / email
    if not all((user_dir / f).exists() for f in REQUIRED_ARTIFACTS):
        return None

    try:
        logger.info(f"Loading precomputed artifacts from disk for {email}...")

        rfm_raw    = pd.read_parquet(user_dir / "rfm_features.parquet")
        rfm_scaled = pd.read_parquet(user_dir / "rfm_scaled.parquet")

        cleaned_data = pd.read_parquet(user_dir / "cleaned_data.parquet")
        cleaned_data["InvoiceDate"] = pd.to_datetime(cleaned_data["InvoiceDate"])

        with open(user_dir / "personas.json") as f:
            all_personas = json.load(f)

        k_vals = list(range(3, 7))
        clustering_results = run_clustering(rfm_scaled, k_values=k_vals)
        best_k, silhouette_scores = evaluate_models(rfm_scaled, clustering_results)

        feature_cols = ["Recency", "Frequency", "Monetary"]
        scaler = MinMaxScaler()
        scaler.fit(np.log1p(rfm_raw[feature_cols].values))

        logger.info(f"✅ Loaded {email} artifacts: {len(rfm_raw)} customers | Best K={best_k}")
        return {
            "rfm_raw": rfm_raw,
            "rfm_scaled": rfm_scaled,
            "cleaned_data": cleaned_data,
            "clustering_results": clustering_results,
            "best_k": best_k,
            "silhouette_scores": silhouette_scores,
            "all_personas": all_personas,
            "scaler": scaler,
        }
    except Exception as e:
        logger.error(f"❌ Failed to load artifacts for {email}: {e}")
        return None


def get_user_data(email: str) -> dict:
    """Get loaded data for a user, or try loading it from disk."""
    if email not in user_data:
        ud = load_user_artifacts(email)
        if ud:
            user_data[email] = ud
    return user_data.get(email)


def run_user_pipeline_task(email: str, df: pd.DataFrame):
    """Run full ML pipeline for a user and cache the results."""
    from pipelines.data_cleaning     import clean_data
    from pipelines.feature_engineering import engineer_features
    from pipelines.clustering_engine import run_clustering, save_best_model
    from pipelines.evaluation        import evaluate_models
    from pipelines.persona_generator import generate_personas

    user_dir = ARTIFACTS_DIR_BASE / email
    user_dir.mkdir(parents=True, exist_ok=True)

    try:
        pipeline_status[email] = {
            "status": "running",
            "step": "Cleaning data...",
            "progress": 20,
            "error": None,
        }

        clean_df, cleaning_summary = clean_data(df, output_dir=user_dir)
        pipeline_status[email]["step"] = "Computing RFM features..."
        pipeline_status[email]["progress"] = 40
        pipeline_status[email]["cleaning_summary"] = cleaning_summary

        rfm_raw, rfm_scaled = engineer_features(clean_df, output_dir=user_dir)
        pipeline_status[email]["step"] = "Finding optimal clusters..."
        pipeline_status[email]["progress"] = 60

        k_vals = list(range(3, 7))
        clustering_results = run_clustering(rfm_scaled, k_values=k_vals)
        best_k, silhouette_scores = evaluate_models(rfm_scaled, clustering_results)
        
        inertia_vals = [clustering_results[k]["inertia"] for k in k_vals]
        silhouette_vals = [silhouette_scores[k] for k in k_vals]
        
        pipeline_status[email]["inertia_values"] = inertia_vals
        pipeline_status[email]["silhouette_values"] = silhouette_vals
        pipeline_status[email]["optimal_k"] = best_k

        pipeline_status[email]["step"] = "Training K-Means model..."
        pipeline_status[email]["progress"] = 80
        save_best_model(clustering_results, best_k, output_dir=user_dir)

        pipeline_status[email]["step"] = "Generating personas..."
        pipeline_status[email]["progress"] = 90
        generate_personas(rfm_raw, clustering_results, best_k, output_dir=user_dir)

        with open(user_dir / "personas.json") as f:
            all_personas = json.load(f)

        feature_cols = ["Recency", "Frequency", "Monetary"]
        scaler = MinMaxScaler()
        scaler.fit(np.log1p(rfm_raw[feature_cols].values))

        user_data[email] = {
            "rfm_raw": rfm_raw,
            "rfm_scaled": rfm_scaled,
            "cleaned_data": clean_df,
            "clustering_results": clustering_results,
            "best_k": best_k,
            "silhouette_scores": silhouette_scores,
            "all_personas": all_personas,
            "scaler": scaler,
        }

        pipeline_status[email]["status"] = "complete"
        pipeline_status[email]["step"] = "Analysis complete!"
        pipeline_status[email]["progress"] = 100

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"❌ Error running pipeline for {email}: {e}\n{tb}")
        pipeline_status[email] = {
            "status": "error",
            "step": "Error during pipeline run",
            "progress": 0,
            "error": str(e),
        }


@app.on_event("startup")
def startup_event():
    logger.info("=== RetailIQ Backend Starting ===")

    admin_data = load_user_artifacts("admin@retail.com")
    if admin_data:
        user_data["admin@retail.com"] = admin_data
        logger.info("✅ Preloaded admin@retail.com artifacts.")
    else:
        logger.warning("admin@retail.com artifacts not found.")
        if DATASET_PATH.exists():
            logger.info(f"Running pipeline synchronously for admin@retail.com using: {DATASET_PATH}")
            try:
                if DATASET_PATH.suffix == ".xlsx":
                    df = pd.read_excel(DATASET_PATH)
                else:
                    df = pd.read_csv(DATASET_PATH)
                run_user_pipeline_task("admin@retail.com", df)
            except Exception as e:
                logger.error(f"❌ Failed to run startup pipeline: {e}")
        else:
            logger.warning("No default dataset found. Admin dashboard will start empty.")
