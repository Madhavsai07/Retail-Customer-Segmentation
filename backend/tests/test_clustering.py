import unittest
import pandas as pd
from pipelines.clustering_engine import run_clustering
from pipelines.evaluation import evaluate_models
from pipelines.persona_generator import generate_personas

class TestClusteringPipeline(unittest.TestCase):
    def setUp(self):
        # 10 synthetic customer profiles
        self.rfm_scaled = pd.DataFrame({
            "Recency": [0.1, 0.2, 0.8, 0.9, 0.15, 0.85, 0.3, 0.7, 0.1, 0.95],
            "Frequency": [0.9, 0.85, 0.1, 0.05, 0.95, 0.2, 0.7, 0.15, 0.8, 0.1],
            "Monetary": [0.95, 0.8, 0.15, 0.05, 0.9, 0.1, 0.75, 0.2, 0.85, 0.08]
        })
        self.rfm_raw = pd.DataFrame({
            "CustomerID": list(range(1001, 1011)),
            "Recency": [5, 10, 150, 200, 7, 180, 25, 140, 8, 220],
            "Frequency": [15, 12, 1, 1, 18, 2, 8, 2, 11, 1],
            "Monetary": [3500.0, 2800.0, 150.0, 90.0, 4200.0, 210.0, 1800.0, 250.0, 2600.0, 120.0]
        })

    def test_clustering_keys_and_shapes(self):
        results = run_clustering(self.rfm_scaled, k_values=[3, 4, 5])
        self.assertEqual(sorted(list(results.keys())), [3, 4, 5])
        for k in [3, 4, 5]:
            self.assertEqual(len(results[k]["labels"]), 10)
            self.assertIn("inertia", results[k])
            self.assertIn("model", results[k])

    def test_evaluation(self):
        results = run_clustering(self.rfm_scaled, k_values=[3, 4, 5])
        best_k, scores = evaluate_models(self.rfm_scaled, results)
        self.assertIn(best_k, [3, 4, 5])
        self.assertEqual(len(scores), 3)

    def test_persona_generation(self):
        results = run_clustering(self.rfm_scaled, k_values=[3, 4, 5])
        best_k, scores = evaluate_models(self.rfm_scaled, results)
        personas = generate_personas(self.rfm_raw, results, best_k)
        self.assertEqual(len(personas), best_k)
        names = [p["persona_name"] for p in personas]
        # Check collision-free
        self.assertEqual(len(names), len(set(names)))

if __name__ == "__main__":
    unittest.main()

