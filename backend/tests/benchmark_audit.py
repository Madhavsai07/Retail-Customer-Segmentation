import sys
import time
import os
import platform
import resource
import statistics
import json
from pathlib import Path
import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

def get_peak_rss_mb():
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if sys.platform == "darwin":
        return raw / (1024 * 1024)
    return raw / 1024

def stats_summary(times_list):
    return {
        "median_ms": round(statistics.median(times_list), 2),
        "mean_ms": round(statistics.mean(times_list), 2),
        "min_ms": round(min(times_list), 2),
        "max_ms": round(max(times_list), 2),
        "stdev_ms": round(statistics.stdev(times_list) if len(times_list) > 1 else 0.0, 2),
        "repetitions": len(times_list),
    }

def run_benchmarks(repetitions=10, warmup=3):
    from main import app, startup_event, get_user_data
    from fastapi.testclient import TestClient
    from pipelines.data_cleaning import clean_data
    from pipelines.feature_engineering import engineer_features
    from pipelines.clustering_engine import run_clustering
    from pipelines.evaluation import evaluate_models
    from pipelines.persona_generator import generate_personas
    import auth

    system_info = {
        "os": f"{platform.system()} {platform.release()}",
        "machine": platform.machine(),
        "processor": platform.processor(),
        "python_version": platform.python_version(),
        "cpu_count": os.cpu_count(),
    }

    # Warmup
    for _ in range(warmup):
        startup_event()

    # Measure startup
    startup_times = []
    for _ in range(repetitions):
        t0 = time.perf_counter()
        startup_event()
        startup_times.append((time.perf_counter() - t0) * 1000)

    peak_rss = get_peak_rss_mb()

    # Dataset pipelines
    sample_csv = BACKEND_DIR.parent / "retail small dataset.csv"
    if not sample_csv.exists():
        sample_csv = BACKEND_DIR / "data" / "online_retail.xlsx"

    clean_times, rfm_times, km_times, eval_times, persona_times = [], [], [], [], []

    if sample_csv.exists():
        raw_df = pd.read_csv(sample_csv) if sample_csv.suffix == ".csv" else pd.read_excel(sample_csv)
        
        # Warmup pipeline
        for _ in range(warmup):
            c_df, _ = clean_data(raw_df)
            r_raw, r_sc = engineer_features(c_df)
            res = run_clustering(r_sc, k_values=[3, 4, 5])
            bk, _ = evaluate_models(r_sc, res)
            generate_personas(r_raw, res, bk)

        for _ in range(repetitions):
            t0 = time.perf_counter()
            c_df, _ = clean_data(raw_df)
            clean_times.append((time.perf_counter() - t0) * 1000)

            t0 = time.perf_counter()
            r_raw, r_sc = engineer_features(c_df)
            rfm_times.append((time.perf_counter() - t0) * 1000)

            t0 = time.perf_counter()
            res = run_clustering(r_sc, k_values=[3, 4, 5])
            km_times.append((time.perf_counter() - t0) * 1000)

            t0 = time.perf_counter()
            bk, _ = evaluate_models(r_sc, res)
            eval_times.append((time.perf_counter() - t0) * 1000)

            t0 = time.perf_counter()
            generate_personas(r_raw, res, bk)
            persona_times.append((time.perf_counter() - t0) * 1000)

    # API Endpoints
    app.dependency_overrides[auth.get_current_user] = lambda: {"email": "admin@retail.com"}
    client = TestClient(app)

    endpoints = [
        ("GET /health", "/health"),
        ("GET /metrics", "/metrics"),
        ("GET /segment?k=4", "/segment?k=4"),
        ("GET /personas?k=4", "/personas?k=4"),
        ("GET /customer/17850?k=4", "/customer/17850?k=4"),
        ("GET /customer/17850/transactions", "/customer/17850/transactions"),
        ("GET /download/rfm_table", "/download/rfm_table"),
    ]

    api_results = {}
    for name, ep in endpoints:
        # Warmup
        for _ in range(warmup):
            client.get(ep)
        times = []
        for _ in range(repetitions):
            t0 = time.perf_counter()
            r = client.get(ep)
            assert r.status_code == 200
            times.append((time.perf_counter() - t0) * 1000)
        api_results[name] = stats_summary(times)

    app.dependency_overrides.clear()

    return {
        "system_info": system_info,
        "peak_rss_mb": round(peak_rss, 2),
        "startup": stats_summary(startup_times),
        "pipeline": {
            "data_cleaning": stats_summary(clean_times),
            "rfm_engineering": stats_summary(rfm_times),
            "kmeans_clustering_k3_k5": stats_summary(km_times),
            "silhouette_evaluation": stats_summary(eval_times),
            "persona_generation": stats_summary(persona_times),
        },
        "api_endpoints": api_results,
    }

if __name__ == "__main__":
    report = run_benchmarks(repetitions=10, warmup=3)
    print(json.dumps(report, indent=2))
