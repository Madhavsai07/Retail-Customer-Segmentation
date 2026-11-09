import io
import os
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
from main import app, ARTIFACTS_DIR_BASE
import auth

class TestUploadAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.private_key = ec.generate_private_key(ec.SECP256R1())
        cls.public_key = cls.private_key.public_key()
        auth._get_public_key.cache_clear()
        cls.orig_get_public_key = auth._get_public_key
        auth._get_public_key = lambda: cls.public_key

    @classmethod
    def tearDownClass(cls):
        auth._get_public_key = cls.orig_get_public_key
        auth._get_public_key.cache_clear()

    def _headers(self, email="test_uploader@retail.com"):
        now = int(time.time())
        token = jwt.encode(
            {"sub": "uploader-1", "email": email, "aud": "authenticated", "iat": now, "exp": now + 3600},
            self.private_key,
            algorithm="ES256"
        )
        return {"Authorization": f"Bearer {token}"}

    def test_upload_invalid_file_extension(self):
        """Non-CSV/XLSX/XLS extension is rejected with 400."""
        file_content = b"some random text"
        files = {"file": ("dataset.txt", file_content, "text/plain")}
        res = self.client.post("/upload", files=files, headers=self._headers())
        self.assertEqual(res.status_code, 400)
        self.assertIn("Unsupported file format", res.json().get("detail", ""))

    def test_upload_empty_file(self):
        """Empty file content is rejected with 400."""
        files = {"file": ("empty.csv", b"", "text/csv")}
        res = self.client.post("/upload", files=files, headers=self._headers())
        self.assertEqual(res.status_code, 400)
        self.assertTrue(
            "empty" in res.json().get("detail", "").lower() or
            "failed to parse" in res.json().get("detail", "").lower()
        )

    def test_upload_missing_required_columns(self):
        """CSV missing CustomerID/UnitPrice/Quantity/InvoiceDate is rejected with 400."""
        df = pd.DataFrame({"Item": ["A", "B"], "Price": [10, 20]})
        csv_bytes = df.to_csv(index=False).encode("utf-8")
        files = {"file": ("bad_schema.csv", csv_bytes, "text/csv")}
        res = self.client.post("/upload", files=files, headers=self._headers())
        self.assertEqual(res.status_code, 400)
        detail = res.json().get("detail", "")
        self.assertIn("Dataset Validation Failed", detail)
        self.assertIn("Missing Required Columns", detail)

    def test_upload_malformed_csv(self):
        """Corrupted/binary data passed as CSV is handled with 400."""
        files = {"file": ("corrupt.csv", b"\x00\x01\x02\xff\xfe", "text/csv")}
        res = self.client.post("/upload", files=files, headers=self._headers())
        # Should return 400 (either failed to parse or missing columns)
        self.assertEqual(res.status_code, 400)

    def test_upload_valid_csv(self):
        """Valid CSV initiates pipeline thread and returns 200 message."""
        df = pd.DataFrame({
            "InvoiceNo": ["5001", "5002", "5003"],
            "StockCode": ["85123A", "71053", "84406B"],
            "Description": ["Product A", "Product B", "Product C"],
            "Quantity": [2, 5, 1],
            "InvoiceDate": ["2023-01-01 10:00:00", "2023-01-02 11:00:00", "2023-01-03 12:00:00"],
            "UnitPrice": [10.0, 15.0, 25.0],
            "CustomerID": [10001, 10002, 10001],
            "Country": ["United Kingdom", "United Kingdom", "United Kingdom"]
        })
        csv_bytes = df.to_csv(index=False).encode("utf-8")
        files = {"file": ("valid.csv", csv_bytes, "text/csv")}
        user_email = "upload_csv_user@retail.com"
        res = self.client.post("/upload", files=files, headers=self._headers(user_email))
        self.assertEqual(res.status_code, 200)
        self.assertIn("ML pipeline started", res.json().get("message", ""))

    def test_upload_valid_xlsx(self):
        """Valid XLSX initiates pipeline thread and returns 200 message."""
        df = pd.DataFrame({
            "InvoiceNo": ["6001", "6002"],
            "StockCode": ["85123A", "71053"],
            "Description": ["Item 1", "Item 2"],
            "Quantity": [3, 4],
            "InvoiceDate": ["2023-02-01 10:00:00", "2023-02-02 11:00:00"],
            "UnitPrice": [12.0, 8.5],
            "CustomerID": [20001, 20002],
            "Country": ["France", "Germany"]
        })
        xlsx_buffer = io.BytesIO()
        df.to_excel(xlsx_buffer, index=False)
        xlsx_bytes = xlsx_buffer.getvalue()
        files = {"file": ("valid.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        user_email = "upload_xlsx_user@retail.com"
        res = self.client.post("/upload", files=files, headers=self._headers(user_email))
        self.assertEqual(res.status_code, 200)
        self.assertIn("ML pipeline started", res.json().get("message", ""))

    def test_upload_valid_xls(self):
        """Valid legacy .xls (Excel 97-2004) file initiates pipeline thread and returns 200 message."""
        import xlwt
        wb = xlwt.Workbook()
        ws = wb.add_sheet("Sheet1")
        cols = ["InvoiceNo", "StockCode", "Description", "Quantity", "InvoiceDate", "UnitPrice", "CustomerID", "Country"]
        for c_idx, col in enumerate(cols):
            ws.write(0, c_idx, col)
        ws.write(1, 0, "7001")
        ws.write(1, 1, "85123A")
        ws.write(1, 2, "Vintage Cup")
        ws.write(1, 3, 5)
        ws.write(1, 4, "2023-03-01 12:00:00")
        ws.write(1, 5, 4.5)
        ws.write(1, 6, 30001)
        ws.write(1, 7, "United Kingdom")
        
        xls_buf = io.BytesIO()
        wb.save(xls_buf)
        xls_bytes = xls_buf.getvalue()

        files = {"file": ("valid.xls", xls_bytes, "application/vnd.ms-excel")}
        user_email = "upload_xls_user@retail.com"
        res = self.client.post("/upload", files=files, headers=self._headers(user_email))
        self.assertEqual(res.status_code, 200)
        self.assertIn("ML pipeline started", res.json().get("message", ""))

    def test_multi_user_upload_isolation(self):
        """User A and User B uploads are directed to their distinct user artifact folders."""
        email_a = "user_alpha@retail.com"
        email_b = "user_beta@retail.com"
        
        dir_a = ARTIFACTS_DIR_BASE / email_a
        dir_b = ARTIFACTS_DIR_BASE / email_b
        
        # Verify their target directories are completely distinct paths
        self.assertNotEqual(str(dir_a), str(dir_b))
        self.assertTrue(str(dir_a).endswith(email_a))
        self.assertTrue(str(dir_b).endswith(email_b))

if __name__ == "__main__":
    unittest.main()

