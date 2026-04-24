"""
clustering_engine.py
Runs K-Means clustering for k in {3, 4, 5}, stores all results,
saves the best model (highest silhouette score) as a pickle artifact.
"""

import logging
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.cluster import KMeans

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"
RANDOM_STATE = 42


def run_clustering(rfm_scaled: pd.DataFrame, k_values: list[int] = [3, 4, 5]) -> dict:
    """
    Fit K-Means for each k in k_values.

    Returns:
        results: dict keyed by k with {'labels', 'centroids', 'inertia', 'model'}
    """
    feature_cols = ["Recency", "Frequency", "Monetary"]
    X = rfm_scaled[feature_cols].values

    results = {}
    for k in k_values:
        logger.info(f"Fitting K-Means with k={k} ...")
        km = KMeans(n_clusters=k, n_init=10, random_state=RANDOM_STATE)
        labels = km.fit_predict(X)
        results[k] = {
            "labels": labels.tolist(),
            "centroids": km.cluster_centers_.tolist(),
            "inertia": float(km.inertia_),
            "model": km,
        }
        logger.info(f"  k={k} inertia={km.inertia_:.2f}")

    return results


def save_best_model(results: dict, best_k: int, output_dir: Path = None) -> None:
    """Save the best K-Means model to output_dir."""
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        model_path = output_dir / "kmeans_model.pkl"
        joblib.dump(results[best_k]["model"], model_path)
        logger.info(f"Best model (k={best_k}) saved to {model_path}")


if __name__ == "__main__":
    # Try to find a user folder (e.g., admin@retail.com) in artifacts
    user_dirs = [d for d in ARTIFACTS_DIR.iterdir() if d.is_dir()]
    target_dir = user_dirs[0] if user_dirs else ARTIFACTS_DIR
    
    parquet_path = target_dir / "rfm_scaled.parquet"
    
    if not parquet_path.exists():
        print(f"Error: Could not find {parquet_path}")
        print("Please ensure the pipeline has been run at least once.")
    else:
        rfm_scaled = pd.read_parquet(parquet_path)
        results = run_clustering(rfm_scaled)
        for k, v in results.items():
            print(f"k={k} | inertia={v['inertia']:.2f} | unique labels={set(v['labels'])}")
