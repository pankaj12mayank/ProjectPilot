"""Singleton email_settings row: migrations, load, validate, patch/post, decrypt for sending."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.db.models import EmailSettings
from app.schemas.email_settings import (
    EmailSettingsAdminOut,
    EmailSettingsPostIn,
    EmailSettingsUpdateIn,
)
from app.utils.email_crypto import decrypt_secret, encrypt_secret

logger = logging.getLogger(__name__)

EMAIL_ROW_ID = "default"
ALLOWED_PROVIDERS = frozenset({"smtp", "sendgrid"})


def get_or_create(db: Session) -> EmailSettings:
    row = db.get(EmailSettings, EMAIL_ROW_ID)
    if row is None:
        row = EmailSettings(id=EMAIL_ROW_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def seed_default_if_missing(db: Session) -> None:
    try:
        get_or_create(db)
    except Exception:
        logger.exception("seed_default_if_missing email_settings failed")
        db.rollback()


def ensure_email_settings_migrations(db: Session) -> None:
    """Add columns introduced after first deploy (SQLite / PostgreSQL)."""
    try:
        from sqlalchemy import inspect

        bind = db.get_bind()
        insp = inspect(bind)
        cols = {c["name"] for c in insp.get_columns("email_settings")}
        dialect = bind.dialect.name

        def run(sqlite_sql: str, pg_sql: str) -> None:
            if dialect == "postgresql":
                db.execute(text(pg_sql))
            else:
                db.execute(text(sqlite_sql))
            db.commit()

        if "provider" not in cols:
            run(
                "ALTER TABLE email_settings ADD COLUMN provider VARCHAR(32) DEFAULT 'smtp'",
                "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS provider VARCHAR(32) DEFAULT 'smtp'",
            )
            cols = {c["name"] for c in insp.get_columns("email_settings")}
        if "api_key_encrypted" not in cols:
            run(
                "ALTER TABLE email_settings ADD COLUMN api_key_encrypted TEXT",
                "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT",
            )
    except Exception:
        logger.exception("ensure_email_settings_migrations failed")
        db.rollback()


def to_admin_out(row: EmailSettings) -> EmailSettingsAdminOut:
    pw = (row.smtp_password_encrypted or "").strip()
    ak = (row.api_key_encrypted or "").strip()
    prov = (row.provider or "smtp").strip().lower()
    if prov not in ALLOWED_PROVIDERS:
        prov = "smtp"
    return EmailSettingsAdminOut(
        provider=prov,  # type: ignore[arg-type]
        enabled=bool(row.enabled),
        smtp_host=row.smtp_host or "",
        smtp_port=int(row.smtp_port or 587),
        use_tls=bool(row.use_tls),
        use_ssl=bool(row.use_ssl),
        smtp_user=row.smtp_user or "",
        from_email=row.from_email or "",
        from_name=row.from_name or "ProjectPilot",
        password_configured=bool(pw),
        api_key_configured=bool(ak),
        updated_at=row.updated_at,
        updated_by_user_id=row.updated_by_user_id,
    )


def _valid_email(addr: str) -> bool:
    if not addr or not addr.strip():
        return False
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", addr.strip(), re.I))


def smtp_password_plain(settings: Settings, row: EmailSettings) -> str | None:
    return decrypt_secret(settings, row.smtp_password_encrypted)


def api_key_plain(settings: Settings, row: EmailSettings) -> str | None:
    return decrypt_secret(settings, row.api_key_encrypted)


def describe_ready_gap(row: EmailSettings, settings: Settings) -> str | None:
    """SMTP readiness when provider is smtp (or unset)."""
    if not row.enabled:
        return "Email is disabled"
    if not (row.smtp_host or "").strip():
        return "SMTP host is empty"
    if not (row.from_email or "").strip() or not _valid_email(row.from_email):
        return "From email is missing or invalid"
    port = int(row.smtp_port or 0)
    if port < 1 or port > 65535:
        return "SMTP port is invalid"
    if (row.smtp_user or "").strip():
        if not (row.smtp_password_encrypted or "").strip():
            return "SMTP username is set but password is empty"
        if smtp_password_plain(settings, row) is None:
            return "Stored SMTP password could not be decrypted (check JWT_SECRET_KEY or EMAIL_ENCRYPTION_KEY)"
    return None


def describe_sendgrid_gap(row: EmailSettings, settings: Settings) -> str | None:
    if not row.enabled:
        return "Email is disabled"
    if not (row.from_email or "").strip() or not _valid_email(row.from_email):
        return "From email is missing or invalid"
    if not (row.api_key_encrypted or "").strip():
        return "SendGrid API key is not configured"
    if api_key_plain(settings, row) is None:
        return "Stored API key could not be decrypted (check JWT_SECRET_KEY or EMAIL_ENCRYPTION_KEY)"
    return None


def describe_send_failure_reason(row: EmailSettings, settings: Settings) -> str:
    prov = (row.provider or "smtp").strip().lower()
    if prov == "sendgrid":
        g = describe_sendgrid_gap(row, settings)
        return g or "SendGrid is not ready"
    g = describe_ready_gap(row, settings)
    return g or "SMTP is not ready"


def validate_row_if_enabled(settings: Settings, row: EmailSettings) -> None:
    """Validate persisted row when email is enabled (used after PATCH)."""
    if not row.enabled:
        return
    body = EmailSettingsPostIn(
        provider=(row.provider or "smtp").strip().lower(),  # type: ignore[arg-type]
        enabled=bool(row.enabled),
        smtp_host=row.smtp_host or "",
        smtp_port=int(row.smtp_port or 587),
        use_tls=bool(row.use_tls),
        use_ssl=bool(row.use_ssl),
        smtp_user=row.smtp_user or "",
        from_email=row.from_email or "",
        from_name=row.from_name or "ProjectPilot",
    )
    validate_post_body(settings, body, row)


def validate_post_body(settings: Settings, body: EmailSettingsPostIn, row: EmailSettings) -> None:
    """Raise ValueError when enabled configuration is inconsistent."""
    prov = (body.provider or "smtp").strip().lower()
    if prov not in ALLOWED_PROVIDERS:
        raise ValueError(f"Unsupported provider: {body.provider}")

    if not body.enabled:
        return

    if not _valid_email((body.from_email or "").strip()):
        raise ValueError("From email is required and must be valid when email is enabled")

    if prov == "smtp":
        if not (body.smtp_host or "").strip():
            raise ValueError("SMTP host is required when SMTP is enabled")
        if body.smtp_port < 1 or body.smtp_port > 65535:
            raise ValueError("SMTP port must be between 1 and 65535")
        if (body.smtp_user or "").strip():
            new_pw = "smtp_password" in body.model_fields_set and bool((body.smtp_password or "").strip())
            existing_ok = bool((row.smtp_password_encrypted or "").strip()) and smtp_password_plain(settings, row) is not None
            if not new_pw and not existing_ok:
                raise ValueError("SMTP password is required when a SMTP username is set")
    elif prov == "sendgrid":
        new_key = "api_key" in body.model_fields_set and bool((body.api_key or "").strip())
        existing_ok = bool((row.api_key_encrypted or "").strip()) and api_key_plain(settings, row) is not None
        if not new_key and not existing_ok:
            raise ValueError("SendGrid API key is required when SendGrid is enabled")


def apply_post(
    db: Session,
    *,
    row: EmailSettings,
    body: EmailSettingsPostIn,
    settings: Settings,
    actor_user_id: str,
) -> EmailSettings:
    validate_post_body(settings, body, row)

    prov = (body.provider or "smtp").strip().lower()
    row.provider = prov if prov in ALLOWED_PROVIDERS else "smtp"
    row.enabled = bool(body.enabled)
    row.smtp_host = (body.smtp_host or "").strip()
    row.smtp_port = int(body.smtp_port)
    row.use_tls = bool(body.use_tls)
    row.use_ssl = bool(body.use_ssl)
    row.smtp_user = (body.smtp_user or "").strip()
    row.from_email = (body.from_email or "").strip()
    row.from_name = (body.from_name or "").strip() or "ProjectPilot"

    fs = body.model_fields_set
    if "smtp_password" in fs:
        raw_pw = body.smtp_password
        if raw_pw is None or raw_pw == "":
            row.smtp_password_encrypted = None
        else:
            row.smtp_password_encrypted = encrypt_secret(settings, raw_pw)
    if "api_key" in fs:
        raw_k = body.api_key
        if raw_k is None or raw_k == "":
            row.api_key_encrypted = None
        else:
            row.api_key_encrypted = encrypt_secret(settings, raw_k)

    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_id = actor_user_id
    db.add(row)
    try:
        db.flush()
        validate_row_if_enabled(settings, row)
        db.commit()
    except ValueError:
        db.rollback()
        raise
    db.refresh(row)
    return row


def apply_update(
    db: Session,
    *,
    row: EmailSettings,
    body: EmailSettingsUpdateIn,
    settings: Settings,
    actor_user_id: str,
) -> EmailSettings:
    fs = body.model_fields_set
    if "smtp_password" in fs:
        raw_pw = body.smtp_password
        if raw_pw is None or raw_pw == "":
            row.smtp_password_encrypted = None
        else:
            row.smtp_password_encrypted = encrypt_secret(settings, raw_pw)
    if "api_key" in fs:
        raw_k = body.api_key
        if raw_k is None or raw_k == "":
            row.api_key_encrypted = None
        else:
            row.api_key_encrypted = encrypt_secret(settings, raw_k)
    if "provider" in fs and body.provider is not None:
        p = (body.provider or "smtp").strip().lower()
        row.provider = p if p in ALLOWED_PROVIDERS else "smtp"
    if "enabled" in fs:
        row.enabled = bool(body.enabled)
    if "smtp_host" in fs:
        row.smtp_host = (body.smtp_host or "").strip()
    if "smtp_port" in fs and body.smtp_port is not None:
        row.smtp_port = int(body.smtp_port)
    if "use_tls" in fs:
        row.use_tls = bool(body.use_tls)
    if "use_ssl" in fs:
        row.use_ssl = bool(body.use_ssl)
    if "smtp_user" in fs:
        row.smtp_user = (body.smtp_user or "").strip()
    if "from_email" in fs:
        fe = (body.from_email or "").strip()
        if fe and not _valid_email(fe):
            raise ValueError("from_email must be a valid email address")
        row.from_email = fe
    if "from_name" in fs:
        row.from_name = (body.from_name or "").strip() or "ProjectPilot"

    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_id = actor_user_id
    db.add(row)
    try:
        db.flush()
        validate_row_if_enabled(settings, row)
        db.commit()
    except ValueError:
        db.rollback()
        raise
    db.refresh(row)
    return row
