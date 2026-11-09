import io
import sys
import time
import unittest
from pathlib import Path
import pandas as pd
from cryptography.hazmat.primitives.asymmetric import ec
import jwt

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from main import app, user_data
from pipelines.data_cleaning import clean_data
from pipelines.feature_engineering import engineer_features
from pipelines.clustering_engine import run_clustering
from pipelines.evaluation import evaluate_models
from pipelines.persona_generator import generate_personas
from sklearn.preprocessing import MinMaxScaler
import numpy as np
import auth

class TestDeepUserIsolation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.private_key = ec.generate_private_key(ec.SECP256R1())
        cls.public_key = cls.private_key.public_key()
        auth._get_public_key.cache_clear()
        cls.orig_get_public_key = auth._get_public_key
        auth._get_public_key = lambda: cls.public_key

        # Populate two distinct user datasets in-memory
        cls.email_a = "user_alpha@retail.com"
        cls.email_b = "user_beta@retail.com"

        cls._setup_user(cls.email_a, cust_ids=[101, 102, 103, 104, 105, 106, 107, 108], base_spend=100.0)
        cls._setup_user(cls.email_b, cust_ids=[901, 902, 903, 904, 905, 906, 907, 908], base_spend=5000.0)

    @classmethod
    def tearDownClass(cls):
        user_data.pop(cls.email_a, None)
        user_data.pop(cls.email_b, None)
        auth._get_public_key = cls.orig_get_public_key
        auth._get_public_key.cache_clear()

    @classmethod
    def _setup_user(cls, email, cust_ids, base_spend):
        rows = []
        for i, cid in enumerate(cust_ids):
            rows.append({
                "InvoiceNo": f"INV_{cid}",
                "StockCode": f"SKU_{cid}",
                "Description": f"Product for {cid}",
                "Quantity": i + 1,
                "InvoiceDate": f"2023-01-0{i+1} 10:00:00",
                "UnitPrice": base_spend / (i + 1),
                "TotalPrice": base_spend,
                "CustomerID": cid,
                "Country": "United Kingdom"
            })
        clean_df = pd.DataFrame(rows)
        clean_df["InvoiceDate"] = pd.to_datetime(clean_df["InvoiceDate"])
        
        rfm_raw, rfm_scaled = engineer_features(clean_df)
        res = run_clustering(rfm_scaled, k_values=[3, 4, 5])
        best_k, sil = evaluate_models(rfm_scaled, res)
        all_personas = {}
        for k in [3, 4, 5]:
            all_personas[str(k)] = generate_personas(rfm_raw, res, k)

        scaler = MinMaxScaler()
        scaler.fit(np.log1p(rfm_raw[["Recency", "Frequency", "Monetary"]].values))

        user_data[email] = {
            "rfm_raw": rfm_raw,
            "rfm_scaled": rfm_scaled,
            "cleaned_data": clean_df,
            "clustering_results": res,
            "best_k": best_k,
            "silhouette_scores": sil,
            "all_personas": all_personas,
            "scaler": scaler,
        }

    def _headers(self, email):
        now = int(time.time())
        token = jwt.encode(
            {"sub": f"sub-{email}", "email": email, "aud": "authenticated", "iat": now, "exp": now + 3600},
            self.private_key,
            algorithm="ES256"
        )
        return {"Authorization": f"Bearer {token}"}

    def test_metrics_isolation(self):
        """User A and User B see only their own metrics."""
        res_a = self.client.get("/metrics", headers=self._headers(self.email_a))
        res_b = self.client.get("/metrics", headers=self._headers(self.email_b))
        self.assertEqual(res_a.status_code, 200)
        self.assertEqual(res_b.status_code, 200)
        
        data_a = res_a.json()
        data_b = res_b.json()
        
        self.assertEqual(data_a["total_customers"], 8)
        self.assertEqual(data_b["total_customers"], 8)
        # Revenue is different: A is 800, B is 40000
        self.assertEqual(data_a["total_revenue"], 800.0)
        self.assertEqual(data_b["total_revenue"], 40000.0)

    def test_customer_search_isolation(self):
        """User A can search 101 but not 901; User B can search 901 but not 101."""
        # User A searches 101 -> 200
        res = self.client.get("/customer/101?k=3", headers=self._headers(self.email_a))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(str(res.json()["customer_id"]), "101")

        # User A searches 901 -> 404
        res = self.client.get("/customer/901?k=3", headers=self._headers(self.email_a))
        self.assertEqual(res.status_code, 404)

        # User B searches 901 -> 200
        res = self.client.get("/customer/901?k=3", headers=self._headers(self.email_b))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(str(res.json()["customer_id"]), "901")

        # User B searches 101 -> 404
        res = self.client.get("/customer/101?k=3", headers=self._headers(self.email_b))
        self.assertEqual(res.status_code, 404)

    def test_transaction_history_isolation(self):
        """User A sees 101 transactions; User B cannot see 101 transactions."""
        res_a = self.client.get("/customer/101/transactions", headers=self._headers(self.email_a))
        self.assertEqual(res_a.status_code, 200)
        self.assertEqual(len(res_a.json()["transactions"]), 1)
        self.assertIn("101", res_a.json()["transactions"][0]["Description"])

        res_b = self.client.get("/customer/101/transactions", headers=self._headers(self.email_b))
        self.assertEqual(res_b.status_code, 404)

    def test_segments_and_scatter_isolation(self):
        """User A scatter data has only IDs 101-108; User B has only IDs 901-908."""
        res_a = self.client.get("/segment?k=3", headers=self._headers(self.email_a))
        cids_a = {d["CustomerID"] for d in res_a.json()["scatter_data"]}
        self.assertEqual(cids_a, {101, 102, 103, 104, 105, 106, 107, 108})

        res_b = self.client.get("/segment?k=3", headers=self._headers(self.email_b))
        cids_b = {d["CustomerID"] for d in res_b.json()["scatter_data"]}
        self.assertEqual(cids_b, {901, 902, 903, 904, 905, 906, 907, 908})

    def test_exports_isolation(self):
        """User A download contains only 101-105; User B download contains only 901-905."""
        res_a = self.client.get("/download/rfm_table", headers=self._headers(self.email_a))
        csv_a = res_a.content.decode("utf-8")
        self.assertIn("101", csv_a)
        self.assertNotIn("901", csv_a)

        res_b = self.client.get("/download/rfm_table", headers=self._headers(self.email_b))
        csv_b = res_b.content.decode("utf-8")
        self.assertIn("901", csv_b)
        self.assertNotIn("101", csv_b)

if __name__ == "__main__":
    unittest.main()
