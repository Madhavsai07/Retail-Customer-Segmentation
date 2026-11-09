import sys
import time
import unittest
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import jwt

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from main import app
import auth

class TestAuthAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        
        # Generate an EC key pair for testing ES256 tokens
        cls.private_key = ec.generate_private_key(ec.SECP256R1())
        cls.public_key = cls.private_key.public_key()
        
        # Patch _get_public_key to return our test public key
        auth._get_public_key.cache_clear()
        cls.orig_get_public_key = auth._get_public_key
        auth._get_public_key = lambda: cls.public_key

    @classmethod
    def tearDownClass(cls):
        auth._get_public_key = cls.orig_get_public_key
        auth._get_public_key.cache_clear()

    def _make_token(self, email="testuser@retail.com", exp_offset=3600):
        now = int(time.time())
        payload = {
            "sub": "12345-abcde",
            "email": email,
            "aud": "authenticated",
            "role": "authenticated",
            "iat": now,
            "exp": now + exp_offset
        }
        token = jwt.encode(payload, self.private_key, algorithm="ES256")
        return token

    def test_public_endpoint_no_token(self):
        """Public /health endpoint requires no Authorization header."""
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "ok")

    def test_protected_endpoints_missing_token(self):
        """Calling protected endpoints without token returns 401 or 403."""
        endpoints = [
            "/metrics",
            "/segment?k=4",
            "/personas?k=4",
            "/customer/17850?k=4",
            "/customer/17850/transactions",
            "/analysis/status",
            "/pipeline/status",
            "/download/rfm_table",
        ]
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertIn(res.status_code, [401, 403], f"Endpoint {ep} did not enforce auth (status={res.status_code})")

    def test_invalid_token(self):
        """Malformed token string returns 401."""
        headers = {"Authorization": "Bearer not-a-valid-token"}
        res = self.client.get("/metrics", headers=headers)
        self.assertEqual(res.status_code, 401)
        self.assertIn("Invalid token", res.json().get("detail", ""))

    def test_expired_token(self):
        """Expired token returns 401 Token has expired."""
        expired_token = self._make_token(exp_offset=-3600)
        headers = {"Authorization": f"Bearer {expired_token}"}
        res = self.client.get("/metrics", headers=headers)
        self.assertEqual(res.status_code, 401)
        self.assertIn("expired", res.json().get("detail", "").lower())

    def test_wrong_signature_token(self):
        """Token signed by another private key returns 401."""
        other_key = ec.generate_private_key(ec.SECP256R1())
        now = int(time.time())
        payload = {"email": "intruder@retail.com", "iat": now, "exp": now + 3600}
        bad_token = jwt.encode(payload, other_key, algorithm="ES256")
        headers = {"Authorization": f"Bearer {bad_token}"}
        res = self.client.get("/metrics", headers=headers)
        self.assertEqual(res.status_code, 401)

    def test_valid_admin_token(self):
        """Valid token with admin@retail.com accesses preloaded data."""
        token = self._make_token(email="admin@retail.com")
        headers = {"Authorization": f"Bearer {token}"}
        res = self.client.get("/metrics", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_customers", data)
        self.assertGreater(data["total_customers"], 0)

    def test_user_data_isolation(self):
        """User B cannot access User A's un-uploaded data (returns 503 Analysis not ready)."""
        token = self._make_token(email="brand_new_isolated_user@retail.com")
        headers = {"Authorization": f"Bearer {token}"}
        res = self.client.get("/metrics", headers=headers)
        # Should return 503 because this user has no artifacts and hasn't uploaded
        self.assertEqual(res.status_code, 503)
        self.assertIn("Analysis not ready", res.json().get("detail", ""))

if __name__ == "__main__":
    unittest.main()

