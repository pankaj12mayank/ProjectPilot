"""Singleton ai_settings row: migrations, load, encrypt/decrypt api key."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.db.models import AiSettings
from app.schemas.ai_settings import AiSettingsAdminOut
from app.utils.email_crypto import decrypt_secret, encrypt_secret

logger = logging.getLogger(__name__)

AI_ROW_ID = "default"
ALLOWED_PROVIDERS = frozenset({"openai", "anthropic", "gemini", "ollama", "custom"})

DEFAULTS = {
    "provider": "openai",
    "base_url": "",
    "model": "gpt-4o-mini",
    "enabled": False,
    "temperature": 0.7,
    "max_tokens": 1024,
    "timeout_ms": 15000,
}


def _mask_key(plain: str | None) -> str:
    if not plain or len(plain.strip()) < 4:
        return ""
    p = plain.strip()
    if len(p) <= 8:
        return "****" + p[-2:]
    return p[:3] + "-****-" + p[-4:]


def get_or_create(db: Session) -> AiSettings:
    row = db.get(AiSettings, AI_ROW_ID)
    if row is None:
        row = AiSettings(
            id=AI_ROW_ID,
            provider=DEFAULTS["provider"],
            base_url=DEFAULTS["base_url"],
            model=DEFAULTS["model"],
            enabled=DEFAULTS["enabled"],
            temperature=DEFAULTS["temperature"],
            max_tokens=DEFAULTS["max_tokens"],
            timeout_ms=DEFAULTS["timeout_ms"],
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def seed_default_if_missing(db: Session) -> None:
    try:
        get_or_create(db)
    except Exception:
        logger.exception("seed_default_if_missing ai_settings failed")
        db.rollback()


def ensure_ai_settings_migrations(db: Session) -> None:
    try:
        from sqlalchemy import inspect

        bind = db.get_bind()
        insp = inspect(bind)
        # If table doesn't exist yet, Base.metadata.create_all will create it in lifespan - skip
        if "ai_settings" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("ai_settings")}
        dialect = bind.dialect.name

        def run(sqlite_sql: str, pg_sql: str) -> None:
            if dialect == "postgresql":
                db.execute(text(pg_sql))
            else:
                db.execute(text(sqlite_sql))
            db.commit()

        # Add columns if missing (for upgrades)
        if "temperature" not in cols:
            run(
                "ALTER TABLE ai_settings ADD COLUMN temperature FLOAT DEFAULT 0.7",
                "ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.7",
            )
        if "max_tokens" not in cols:
            run(
                "ALTER TABLE ai_settings ADD COLUMN max_tokens INTEGER DEFAULT 1024",
                "ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 1024",
            )
        if "timeout_ms" not in cols:
            run(
                "ALTER TABLE ai_settings ADD COLUMN timeout_ms INTEGER DEFAULT 15000",
                "ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS timeout_ms INTEGER DEFAULT 15000",
            )
        if "base_url" not in cols:
            run(
                "ALTER TABLE ai_settings ADD COLUMN base_url VARCHAR(512) DEFAULT ''",
                "ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS base_url VARCHAR(512) DEFAULT ''",
            )
    except Exception:
        logger.exception("ensure_ai_settings_migrations failed")
        db.rollback()


def to_admin_out(row: AiSettings, settings: Settings) -> AiSettingsAdminOut:
    plain = decrypt_secret(settings, row.api_key_encrypted)
    masked = _mask_key(plain) if plain else ""
    configured = bool((row.api_key_encrypted or "").strip() and plain)
    prov = (row.provider or "openai").strip().lower() or "openai"
    # allow free-form provider, store as-is
    return AiSettingsAdminOut(
        provider=prov,
        base_url=row.base_url or "",
        model=row.model or "gpt-4o-mini",
        enabled=bool(row.enabled),
        temperature=float(row.temperature or 0.7),
        max_tokens=int(row.max_tokens or 1024),
        timeout_ms=int(row.timeout_ms or 15000),
        api_key_configured=configured,
        api_key_masked=masked,
        updated_at=row.updated_at,
        updated_by_user_id=row.updated_by_user_id,
    )


def api_key_plain(settings: Settings, row: AiSettings) -> str | None:
    return decrypt_secret(settings, row.api_key_encrypted)


def _resolve_base_url(provider: str, base_url: str) -> str:
    bu = (base_url or "").strip().rstrip("/")
    if bu:
        return bu
    defaults = {
        "openai": "https://api.openai.com/v1",
        "anthropic": "https://api.anthropic.com/v1",
        "gemini": "https://generativelanguage.googleapis.com/v1",
        "ollama": "http://localhost:11434/v1",
        "custom": "",
    }
    return defaults.get(provider, "https://api.openai.com/v1")


def effective_base_url(row: AiSettings) -> str:
    return _resolve_base_url(row.provider or "openai", row.base_url or "")


def describe_ready_gap(row: AiSettings, settings: Settings) -> str | None:
    if not row.enabled:
        return "AI is disabled"
    if not (row.model or "").strip():
        return "Model is empty"
    if not (row.api_key_encrypted or "").strip():
        # Ollama/custom may not need key
        if row.provider in ("ollama",):
            return None
        return "API key is not configured"
    if api_key_plain(settings, row) is None:
        return "Stored API key could not be decrypted (check JWT_SECRET_KEY or EMAIL_ENCRYPTION_KEY)"
    bu = effective_base_url(row)
    if row.provider == "custom" and not bu:
        return "Base URL is required for custom provider"
    return None
