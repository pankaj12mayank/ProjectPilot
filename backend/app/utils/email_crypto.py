"""Encrypt / decrypt SMTP credentials at rest (Fernet)."""

from __future__ import annotations

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config.settings import Settings

logger = logging.getLogger(__name__)


def _fernet_key(settings: Settings) -> bytes:
    raw = (settings.email_encryption_key or "").strip()
    if raw:
        # User-provided Fernet key (44 chars url-safe base64)
        return raw.encode("utf-8")
    secret = (settings.jwt_secret_key or "").encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet(settings: Settings) -> Fernet:
    return Fernet(_fernet_key(settings))


def encrypt_secret(settings: Settings, plain: str) -> str:
    return get_fernet(settings).encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(settings: Settings, token: str | None) -> str | None:
    if not token or not str(token).strip():
        return None
    try:
        return get_fernet(settings).decrypt(str(token).strip().encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        logger.warning("Could not decrypt stored SMTP secret (wrong EMAIL_ENCRYPTION_KEY or JWT_SECRET_KEY?)")
        return None
