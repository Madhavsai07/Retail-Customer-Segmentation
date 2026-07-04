"""
auth.py
Verifies Supabase JWT tokens (ES256) using the Supabase JWKS public key.
Tokens are fetched and cached at startup — no secret key needed.
"""

import jwt
import json
import os
import urllib.request
from functools import lru_cache
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.algorithms import ECAlgorithm

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://hdomxuirontyppniwgjt.supabase.co")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

bearer_scheme = HTTPBearer()


@lru_cache(maxsize=1)
def _get_public_key():
    """Fetch and cache the Supabase EC public key from JWKS endpoint."""
    with urllib.request.urlopen(JWKS_URL, timeout=10) as r:
        jwks = json.loads(r.read().decode())
    jwk = jwks["keys"][0]
    return ECAlgorithm.from_jwk(json.dumps(jwk))


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """
    Verify the Supabase JWT (ES256) sent by the frontend.
    Returns the decoded payload. Raises 401 if invalid or expired.
    """
    token = credentials.credentials
    try:
        public_key = _get_public_key()
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
