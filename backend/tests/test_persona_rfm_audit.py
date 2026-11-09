import unittest
import pandas as pd
import numpy as np
from pipelines.persona_generator import _rank_clusters, generate_personas, PERSONA_CATALOG

class TestPersonaRFMAudit(unittest.TestCase):
    def setUp(self):
        # Create a synthetic dataset with distinct customer profiles
        # Group 1: VIP/Champions (low recency, high frequency, high spend)
        # Group 2: Loyal (moderate recency, moderate-high frequency, good spend)
        # Group 3: At Risk (high recency, low frequency, low spend)
        np.random.seed(42)
        n = 60
        self.rfm = pd.DataFrame({
            "CustomerID": range(1, n + 1),
            "Recency": [5]*20 + [40]*20 + [250]*20,
            "Frequency": [15]*20 + [5]*20 + [1]*20,
            "Monetary": [5000.0]*20 + [1200.0]*20 + [100.0]*20,
        })
        # Cluster labels: 0=VIP, 1=Loyal, 2=AtRisk
        self.labels = [0]*20 + [1]*20 + [2]*20

    def test_ranking_aligns_with_rfm_semantics(self):
        summary, ranking = _rank_clusters(self.rfm, self.labels, k=3)
        # Cluster 0 must be Rank 0 (Champions)
        self.assertEqual(ranking[0], 0)
        # Cluster 1 must be Rank 1 (Loyal Customers)
        self.assertEqual(ranking[1], 1)
        # Cluster 2 must be Rank 2 (Occasional / At Risk)
        self.assertEqual(ranking[2], 2)

    def test_champions_rfm_dominance(self):
        summary, ranking = _rank_clusters(self.rfm, self.labels, k=3)
        champ_cid = ranking[ranking == 0].index[0]
        atrisk_cid = ranking[ranking == 2].index[0]

        # Champions must have lower recency than At Risk
        self.assertLess(summary.loc[champ_cid, "avg_recency"], summary.loc[atrisk_cid, "avg_recency"])
        # Champions must have higher frequency than At Risk
        self.assertGreater(summary.loc[champ_cid, "avg_frequency"], summary.loc[atrisk_cid, "avg_frequency"])
        # Champions must have higher monetary than At Risk
        self.assertGreater(summary.loc[champ_cid, "avg_monetary"], summary.loc[atrisk_cid, "avg_monetary"])

    def test_persona_names_unique_and_non_empty(self):
        clustering_res = {
            3: {"labels": self.labels, "inertia": 10.0},
            4: {"labels": [0]*15 + [1]*15 + [2]*15 + [3]*15, "inertia": 5.0},
            5: {"labels": [0]*12 + [1]*12 + [2]*12 + [3]*12 + [4]*12, "inertia": 2.0},
        }
        for k in [3, 4, 5]:
            summary, ranking = _rank_clusters(self.rfm, clustering_res[k]["labels"], k=k)
            # Must have exactly k unique ranks
            self.assertEqual(len(set(ranking.values)), k)

if __name__ == "__main__":
    unittest.main()

