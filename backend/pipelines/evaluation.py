"""
evaluation.py
Computes silhouette scores for each fitted K-Means model
and returns the best k and scores dict.
"""

import logging
import pandas as pd
from pathlib import Path
from sklearn.metrics import silhouette_score

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"


def evaluate_models(rfm_scaled: pd.DataFrame, results: dict) -> tuple[int, dict]:
    """
    Compute silhouette scores for each k.

    Returns:
        best_k: k with highest silhouette score
        scores: {k: silhouette_score}
    """
    feature_cols = ["Recency", "Frequency", "Monetary"]
    X = rfm_scaled[feature_cols].values

    scores = {}
    for k, data in results.items():
        labels = data["labels"]
        score = silhouette_score(X, labels, sample_size=min(5000, len(X)), random_state=42)
        scores[k] = round(float(score), 4)
        logger.info(f"k={k} → silhouette score = {scores[k]}")

    best_k = max(scores, key=scores.get)
    logger.info(f"Best k selected: {best_k} (score={scores[best_k]})")
    return best_k, scores


if __name__ == "__main__":
    # To run this script directly:
    # Set PYTHONPATH=.. (if in pipelines/) or run as 'python pipelines/evaluation.py' from backend/
    try:
        from clustering_engine import run_clustering
    except ImportError:
        from pipelines.clustering_engine import run_clustering

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
        best_k, scores = evaluate_models(rfm_scaled, results)
        print(f"Silhouette scores: {scores}")
        print(f"Best k: {best_k}")
