import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Any

from fastapi import Depends, Header, HTTPException, status
from dotenv import load_dotenv
from sqlalchemy.orm import Session

if __package__:
    from .database import get_db
    from .models import User
else:
    from database import get_db
    from models import User

load_dotenv(Path(__file__).resolve().parent / ".env")

SECRET_KEY = os.getenv("STUDYGENIE_SECRET_KEY", "studygenie-dev-secret")
TOKEN_EXPIRY_SECONDS = 60 * 60 * 24
HASH_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    """Hash a password with PBKDF2 and a random salt."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        HASH_ITERATIONS,
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Compare a password with the stored PBKDF2 hash."""
    try:
        salt, expected_digest = stored_hash.split("$", 1)
    except ValueError:
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        HASH_ITERATIONS,
    ).hex()
    return hmac.compare_digest(actual_digest, expected_digest)


def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(user_id: int) -> str:
    """Create a compact signed token for this local prototype."""
    payload = {
        "sub": user_id,
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS,
    }
    payload_part = _b64_encode(json.dumps(payload).encode("utf-8"))
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        payload_part.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{payload_part}.{_b64_encode(signature)}"


def decode_access_token(token: str) -> dict[str, Any]:
    """Validate the token signature and expiry time."""
    try:
        payload_part, signature_part = token.split(".", 1)
        expected_signature = hmac.new(
            SECRET_KEY.encode("utf-8"),
            payload_part.encode("utf-8"),
            hashlib.sha256,
        ).digest()

        if not hmac.compare_digest(_b64_decode(signature_part), expected_signature):
            raise ValueError("Invalid signature")

        payload = json.loads(_b64_decode(payload_part))
    except (ValueError, json.JSONDecodeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token expired",
        )

    return payload


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Read the bearer token and return the authenticated user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    user = db.get(User, payload["sub"])

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """Return a user when a valid bearer token is present, otherwise None."""
    if not authorization:
        return None

    return get_current_user(authorization=authorization, db=db)
