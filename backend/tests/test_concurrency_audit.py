import io
import time
import shutil
import threading
import unittest
import pandas as pd
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import rsa
import jwt

from main import app, user_data, pipeline_status, run_user_pipeline_task, ARTIFACTS_DIR_BASE
import auth

class TestConcurrencyAndBackgroundAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Generate RSA keypair for JWT simulation
        cls.private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.public_key = cls.private_key.public_key()
        auth._get_public_key.cache_clear()
        cls.orig_get_public_key = auth._get_public_key
        auth._get_public_key = lambda: cls.public_key

        cls.user_1 = "concurrent_u1@retail.com"
        cls.user_2 = "concurrent_u2@retail.com"

    @classmethod
    def tearDownClass(cls):
        auth._get_public_key = cls.orig_get_public_key
        auth._get_public_key.cache_clear()
        for u in [cls.user_1, cls.user_2]:
            user_data.pop(u, None)
            pipeline_status.pop(u, None)
            u_dir = ARTIFACTS_DIR_BASE / u
            if u_dir.exists():
                shutil.rmtree(u_dir)

    def _make_sample_df(self, cust_ids, base_spend):
        rows = []
        for i, cid in enumerate(cust_ids):
            rows.append({
                "InvoiceNo": f"INV{cid}",
                "StockCode": "ITEM01",
                "Description": f"Item for {cid}",
                "Quantity": 1,
                "UnitPrice": base_spend + i * 10,
                "CustomerID": cid,
                "InvoiceDate": f"2023-01-0{min(i+1, 9)} 10:00:00",
                "Country": "United Kingdom",
            })
        return pd.DataFrame(rows)

    def test_concurrent_uploads_different_users(self):
        """User 1 and User 2 run pipelines concurrently in separate threads."""
        df1 = self._make_sample_df([201, 202, 203, 204, 205, 206, 207, 208], 50.0)
        df2 = self._make_sample_df([801, 802, 803, 804, 805, 806, 807, 808], 500.0)

        t1 = threading.Thread(target=run_user_pipeline_task, args=(self.user_1, df1))
        t2 = threading.Thread(target=run_user_pipeline_task, args=(self.user_2, df2))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Both statuses must be complete
        self.assertEqual(pipeline_status.get(self.user_1, {}).get("status"), "complete")
        self.assertEqual(pipeline_status.get(self.user_2, {}).get("status"), "complete")

        # In-memory customer sets must be completely separate
        cids_1 = set(user_data[self.user_1]["rfm_raw"]["CustomerID"])
        cids_2 = set(user_data[self.user_2]["rfm_raw"]["CustomerID"])
        self.assertTrue(cids_1.isdisjoint(cids_2))
        self.assertEqual(len(cids_1), 8)
        self.assertEqual(len(cids_2), 8)

        # Artifact directories on disk must exist separately
        dir_1 = ARTIFACTS_DIR_BASE / self.user_1
        dir_2 = ARTIFACTS_DIR_BASE / self.user_2
        self.assertTrue((dir_1 / "rfm_features.parquet").exists())
        self.assertTrue((dir_2 / "rfm_features.parquet").exists())

    def test_repeated_upload_same_user(self):
        """User 1 uploads a new dataset, cleanly replacing prior artifacts."""
        df_new = self._make_sample_df([301, 302, 303, 304, 305, 306, 307, 308], 99.0)
        run_user_pipeline_task(self.user_1, df_new)

        self.assertEqual(pipeline_status[self.user_1]["status"], "complete")
        cids_updated = set(user_data[self.user_1]["rfm_raw"]["CustomerID"])
        self.assertEqual(cids_updated, {301, 302, 303, 304, 305, 306, 307, 308})

        # User 2's data must remain intact and unchanged
        cids_2 = set(user_data[self.user_2]["rfm_raw"]["CustomerID"])
        self.assertEqual(cids_2, {801, 802, 803, 804, 805, 806, 807, 808})

    def test_pipeline_processing_failure_isolation(self):
        """User 1 uploads invalid/malformed data. User 1 gets error, User 2 remains healthy."""
        # DataFrame missing required columns and with invalid data
        df_broken = pd.DataFrame({"InvalidCol": [None, None]})
        run_user_pipeline_task(self.user_1, df_broken)

        self.assertEqual(pipeline_status[self.user_1]["status"], "error")
        self.assertIsNotNone(pipeline_status[self.user_1]["error"])

        # User 2's data and status must remain completely unaffected
        self.assertEqual(pipeline_status[self.user_2]["status"], "complete")
        self.assertIn(self.user_2, user_data)
        self.assertEqual(len(user_data[self.user_2]["rfm_raw"]), 8)

if __name__ == "__main__":
    unittest.main()

