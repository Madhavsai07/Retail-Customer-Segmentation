import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from main import app
import auth

class TestAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Override Supabase JWT verification for offline testing with admin user
        app.dependency_overrides[auth.get_current_user] = lambda: {"email": "admin@retail.com"}
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()

    def test_health(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "ok")

    def test_metrics(self):
        res = self.client.get("/metrics")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_customers", data)
        self.assertIn("avg_recency", data)
        self.assertIn("avg_frequency", data)
        self.assertIn("total_revenue", data)

    def test_segment(self):
        for k in [3, 4, 5]:
            res = self.client.get(f"/segment?k={k}")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["k"], k)
            self.assertEqual(len(data["cluster_summary"]), k)

    def test_personas(self):
        for k in [3, 4, 5]:
            res = self.client.get(f"/personas?k={k}")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["k"], k)
            self.assertEqual(len(data["personas"]), k)

    def test_customer_lookup_valid(self):
        res = self.client.get("/customer/17850?k=4")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(str(data["customer_id"]), "17850")
        self.assertIn("cluster_id", data)
        self.assertIn("persona_name", data)
        self.assertIn("metrics", data)

    def test_customer_lookup_not_found(self):
        res = self.client.get("/customer/999999999?k=4")
        self.assertEqual(res.status_code, 404)

    def test_customer_transactions(self):
        res = self.client.get("/customer/17850/transactions")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(str(data["customer_id"]), "17850")
        self.assertIn("transactions", data)
        self.assertIn("total_transactions", data)

    def test_download_endpoints(self):
        for ftype in ["rfm_table", "cluster_summary", "clustered_csv"]:
            res = self.client.get(f"/download/{ftype}")
            self.assertEqual(res.status_code, 200)
            self.assertIn("text/csv", res.headers.get("content-type", ""))

if __name__ == "__main__":
    unittest.main()

