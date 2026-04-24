"""
persona_generator.py
Maps each cluster to a named customer persona based on RFM centroid profile,
generates actionable recommendations, and saves personas.json.
"""

import json
import logging
import numpy as np
import pandas as pd
from pathlib import Path

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"

# Persona definitions: ranked order by desirability
PERSONA_CATALOG = [
    {
        "name": "Champions",
        "color": "#6366f1",
        "description": "High-Value & Highly Engaged Customers",
        "recommendations": [
            "Invite to private beta launches and VIP events",
            "Offer premium tier customer service",
            "Request User Generated Content (UGC) and referrals",
        ],
    },
    {
        "name": "Loyal Customers",
        "color": "#06b6d4",
        "description": "Frequent & Consistent Customers",
        "recommendations": [
            "Recommend high-margin complementary products (Cross-sell)",
            "Offer auto-replenishment subscriptions",
            "Provide early access to major seasonal sales",
        ],
    },
    {
        "name": "Occasional Buyers",
        "color": "#10b981",
        "description": "Low-Frequency, Moderate-Value Customers",
        "recommendations": [
            "Trigger automated reminders based on past purchase cycles",
            "Send personalized recommendations based on browsing history",
            "Offer limited-time bundle deals to increase basket size",
        ],
    },
    {
        "name": "At Risk",
        "color": "#f59e0b",
        "description": "High-Recency, Low-Engagement Customers",
        "recommendations": [
            "Send targeted 'We miss you' emails with high discount codes",
            "Promote top-rated trending items to spark renewed interest",
            "Request feedback with an incentive for survey completion",
        ],
    },
    {
        "name": "Bargain Hunters",
        "color": "#ef4444",
        "description": "Low recency, low frequency, low spend.",
        "recommendations": [
            "Send notifications for clearance and end-of-season sales",
            "Implement free shipping thresholds to increase AOV",
            "Highlight product bundles to maximize inventory turnover",
        ],
    },
]


def _rank_clusters(rfm_raw: pd.DataFrame, labels: list[int], k: int) -> dict:
    """
    Assign a ranking to each cluster based on composite RFM score.
    Rank 0 = best (low recency, high freq, high monetary).
    """
    rfm_raw = rfm_raw.copy()
    rfm_raw["Cluster"] = labels

    summary = rfm_raw.groupby("Cluster").agg(
        avg_recency=("Recency", "mean"),
        avg_frequency=("Frequency", "mean"),
        avg_monetary=("Monetary", "mean"),
        cluster_size=("CustomerID", "count"),
    )

    # Composite score: high freq + high monetary − recency (lower recency = better)
    r_max = summary["avg_recency"].max()
    summary["score"] = (
        (r_max - summary["avg_recency"]) / r_max
        + summary["avg_frequency"] / summary["avg_frequency"].max()
        + summary["avg_monetary"] / summary["avg_monetary"].max()
    )

    ranking = summary["score"].rank(ascending=False).astype(int) - 1  # 0-indexed
    return summary, ranking


def generate_personas(rfm_raw: pd.DataFrame, clustering_results: dict, best_k: int, output_dir: Path = None) -> list[dict]:
    """
    Build persona list for every k in clustering_results.
    Saves personas.json to output_dir if provided.
    Returns list of persona dicts for best_k.
    """
    all_personas = {}

    for k, data in clustering_results.items():
        labels = data["labels"]
        summary, ranking = _rank_clusters(rfm_raw, labels, k)
        personas = []

        for cluster_id in sorted(summary.index):
            rank = int(ranking[cluster_id])
            persona_def = PERSONA_CATALOG[min(rank, len(PERSONA_CATALOG) - 1)]
            row = summary.loc[cluster_id]

            personas.append({
                "cluster_id": int(cluster_id),
                "persona_name": persona_def["name"],
                "color": persona_def["color"],
                "description": persona_def["description"],
                "cluster_size": int(row["cluster_size"]),
                "avg_recency": round(float(row["avg_recency"]), 1),
                "avg_frequency": round(float(row["avg_frequency"]), 1),
                "avg_monetary": round(float(row["avg_monetary"]), 2),
                "recommendations": persona_def["recommendations"],
            })

        all_personas[str(k)] = personas

    # Save
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / "personas.json"
        with open(out_path, "w") as f:
            json.dump(all_personas, f, indent=2)
        logger.info(f"Personas saved to {out_path}")

    return all_personas[str(best_k)]


if __name__ == "__main__":
    # To run this script directly:
    # Set PYTHONPATH=.. or run as 'python pipelines/persona_generator.py' from backend/
    try:
        from clustering_engine import run_clustering
        from evaluation import evaluate_models
    except ImportError:
        from pipelines.clustering_engine import run_clustering
        from pipelines.evaluation import evaluate_models

    # Try to find a user folder (e.g., admin@retail.com) in artifacts
    user_dirs = [d for d in ARTIFACTS_DIR.iterdir() if d.is_dir()]
    target_dir = user_dirs[0] if user_dirs else ARTIFACTS_DIR
    
    rfm_raw_path = target_dir / "rfm_features.parquet"
    rfm_scaled_path = target_dir / "rfm_scaled.parquet"
    
    if not (rfm_raw_path.exists() and rfm_scaled_path.exists()):
        print(f"Error: Could not find required artifacts in {target_dir}")
        print("Please ensure the pipeline has been run at least once.")
    else:
        rfm_raw = pd.read_parquet(rfm_raw_path)
        rfm_scaled = pd.read_parquet(rfm_scaled_path)
        results = run_clustering(rfm_scaled)
        best_k, scores = evaluate_models(rfm_scaled, results)
        personas = generate_personas(rfm_raw, results, best_k, output_dir=target_dir)
        print(f"Generated {len(personas)} personas for k={best_k}")
        for p in personas:
            print(f"  - {p['persona_name']} ({p['cluster_size']} customers)")
