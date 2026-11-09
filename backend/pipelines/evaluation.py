"""
evaluation.py
Computes Silhouette and Davies-Bouldin scores for each fitted K-Means model
and returns the best k (highest silhouette) and all scores.
"""

import logging
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics import silhouette_score, davies_bouldin_score

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"


def evaluate_models(rfm_scaled: pd.DataFrame, results: dict) -> tuple[int, dict]:
    """
    Compute Silhouette and Davies-Bouldin scores for each k.

    Returns:
        best_k: k with highest silhouette score
        scores: {k: silhouette_score}  (used by the rest of the app)
    """
    feature_cols = ["Recency", "Frequency", "Monetary"]
    X = np.ascontiguousarray(rfm_scaled[feature_cols].values, dtype=np.float64)

    scores = {}
    for k, data in results.items():
        labels = data["labels"]
        n_unique = len(np.unique(labels))
        if n_unique < 2 or n_unique >= len(X):
            sil = 0.0
            db = 0.0
        else:
            sil = silhouette_score(X, labels, sample_size=min(5000, len(X)), random_state=42)
            db  = davies_bouldin_score(X, labels)
        scores[k] = round(float(sil), 4)
        logger.info(f"k={k} → Silhouette={scores[k]:.4f} | Davies-Bouldin={db:.4f}")

    best_k = max(scores, key=scores.get)
    logger.info(f"Best k selected: {best_k} (silhouette={scores[best_k]})")
    return best_k, scores


if __name__ == "__main__":
    try:
        from clustering_engine import run_clustering
    except ImportError:
        from pipelines.clustering_engine import run_clustering

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
