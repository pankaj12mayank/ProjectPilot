"""Branding singleton row, uploads, compression, and public payload."""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.db.models import BrandingSettings

logger = logging.getLogger(__name__)

BRANDING_ROW_ID = "default"

ASSET_SLOTS: tuple[str, ...] = (
    "logo",
    "logo_dark",
    "favicon",
)

FAVICON_SLOTS = frozenset({"favicon"})

ALLOWED_EXT_COMMON = frozenset({"png", "jpg", "jpeg", "svg", "webp"})
ALLOWED_EXT_FAVICON = frozenset({"ico", "png", "webp", "jpg", "jpeg"})

_STORED_NAME_RE = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-z0-9]{1,8}$")


def is_safe_stored_filename(name: str) -> bool:
    return bool(name) and bool(_STORED_NAME_RE.match(name.lower()))


def _loads_json(raw: str | None, default: Any) -> Any:
    if not raw or not str(raw).strip():
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def _dumps_json(obj: Any) -> str:
    try:
        return json.dumps(obj, default=str)
    except (TypeError, ValueError):
        return "{}"


def get_or_create(db: Session) -> BrandingSettings:
    row = db.get(BrandingSettings, BRANDING_ROW_ID)
    if row is None:
        row = BrandingSettings(id=BRANDING_ROW_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _branding_columns(db: Session) -> set[str]:
    from sqlalchemy import inspect

    bind = db.get_bind()
    insp = inspect(bind)
    return {c["name"] for c in insp.get_columns("branding_settings")}


def ensure_branding_migrations(db: Session) -> None:
    """Add columns introduced after first deploy (SQLite / PostgreSQL)."""
    try:
        from sqlalchemy import text

        cols = _branding_columns(db)
        dialect = db.get_bind().dialect.name
        stmts: list[str] = []
        if "sidebar_logo_filter" not in cols:
            stmts.append("ALTER TABLE branding_settings ADD COLUMN sidebar_logo_filter VARCHAR(16) DEFAULT 'auto'")
        if "accent_color_light" not in cols:
            if dialect == "postgresql":
                stmts.append(
                    "ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS accent_color_light VARCHAR(16) DEFAULT ''"
                )
            else:
                stmts.append("ALTER TABLE branding_settings ADD COLUMN accent_color_light VARCHAR(16) DEFAULT ''")
        if "accent_color_dark" not in cols:
            if dialect == "postgresql":
                stmts.append(
                    "ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS accent_color_dark VARCHAR(16) DEFAULT ''"
                )
            else:
                stmts.append("ALTER TABLE branding_settings ADD COLUMN accent_color_dark VARCHAR(16) DEFAULT ''")
        for sql in stmts:
            db.execute(text(sql))
        if stmts:
            db.commit()
    except Exception:
        logger.exception("ensure_branding_migrations failed")
        db.rollback()


def seed_default_if_missing(db: Session) -> None:
    ensure_branding_migrations(db)
    if db.get(BrandingSettings, BRANDING_ROW_ID) is None:
        get_or_create(db)


def _files_base(settings: Settings, row: BrandingSettings, request_base: str | None) -> str:
    env = (settings.public_api_url or "").strip().rstrip("/")
    if env:
        return f"{env}{settings.api_prefix}"
    db_u = (row.public_api_url or "").strip().rstrip("/")
    if db_u:
        return f"{db_u}{settings.api_prefix}"
    if request_base:
        rb = request_base.rstrip("/")
        return f"{rb}{settings.api_prefix}"
    return ""


def _asset_url(files_base: str, filename: str | None) -> str | None:
    if not filename or not files_base:
        return None
    return f"{files_base}/branding/files/{filename}"


def _default_asset_url(settings: Settings, slot: str) -> str | None:
    p = settings.branding_defaults_dir / f"{slot}.png"
    if p.is_file():
        return f"{settings.api_prefix}/branding/defaults/{slot}"
    return None


_ACCENT_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _normalize_accent_hex(raw: str | None) -> str:
    """Return lowercase #RRGGBB or empty string."""
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    if not _ACCENT_HEX_RE.match(s):
        raise ValueError("Accent color must be #RRGGBB (six hex digits, e.g. #14B8A6)")
    return s.lower()


def build_public_payload(
    settings: Settings,
    row: BrandingSettings,
    *,
    request_base: str | None = None,
) -> dict[str, Any]:
    files_base = _files_base(settings, row, request_base)
    assets: dict[str, str | None] = _loads_json(row.assets_json, {})
    if not isinstance(assets, dict):
        assets = {}
    asset_urls: dict[str, str | None] = {}
    for slot in ASSET_SLOTS:
        fn = assets.get(slot)
        fn_s = str(fn).strip() if fn is not None else ""
        url = _asset_url(files_base, fn_s) if fn_s and is_safe_stored_filename(fn_s) else None
        if url is None:
            url = _default_asset_url(settings, slot)
        asset_urls[slot] = url

    social = _loads_json(row.social_links_json, {})
    if not isinstance(social, dict):
        social = {}

    light = str(getattr(row, "accent_color_light", "") or "").strip()
    dark = str(getattr(row, "accent_color_dark", "") or "").strip()
    accent_color = light or dark

    return {
        "social": {k: (str(v) if v is not None else None) for k, v in social.items()},
        "meta_title": row.meta_title or "",
        "meta_description": row.meta_description or "",
        "asset_version": int(row.asset_version or 1),
        "asset_urls": asset_urls,
        "files_base": files_base,
        "accent_color": accent_color,
        "assets": {k: (str(v) if v else None) for k, v in assets.items() if k in ASSET_SLOTS},
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "updated_by_user_id": row.updated_by_user_id,
    }


def _compress_bytes(data: bytes, ext: str, *, max_side: int = 2048) -> bytes:
    e = ext.lower()
    if e in ("svg", "ico"):
        return data
    try:
        from io import BytesIO

        from PIL import Image

        img = Image.open(BytesIO(data))
        img = img.convert("RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB")
        w, h = img.size
        if max(w, h) > max_side:
            ratio = max_side / float(max(w, h))
            img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
        out = BytesIO()
        if e in ("jpg", "jpeg"):
            rgb = Image.new("RGB", img.size, (255, 255, 255))
            rgb.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            rgb.save(out, format="JPEG", quality=85, optimize=True)
        elif e == "webp":
            img.save(out, format="WEBP", quality=82, method=4)
        else:
            img.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception:
        logger.exception("Image compression skipped")
        return data


def _normalize_ext(original_name: str) -> str:
    base = (original_name or "").rsplit(".", 1)
    return base[-1].lower() if len(base) == 2 else ""


def validate_upload(slot: str, original_filename: str, size: int, settings: Settings) -> str:
    if slot not in ASSET_SLOTS:
        raise ValueError("Unknown asset slot")
    ext = _normalize_ext(original_filename)
    allowed = ALLOWED_EXT_FAVICON if slot in FAVICON_SLOTS else ALLOWED_EXT_COMMON
    if ext not in allowed:
        raise ValueError(f"Unsupported file type for this slot (allowed: {', '.join(sorted(allowed))})")
    if size <= 0:
        raise ValueError("Empty file")
    if size > settings.branding_max_upload_bytes:
        raise ValueError(f"File too large (max {settings.branding_max_upload_mb} MB)")
    return ext


def save_uploaded_asset(
    db: Session,
    *,
    settings: Settings,
    slot: str,
    original_filename: str,
    data: bytes,
    actor_user_id: str,
    request_base: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str, int]:
    from app.services import event_log_service

    ext = validate_upload(slot, original_filename, len(data), settings)
    data = _compress_bytes(data, ext)
    ext2 = _normalize_ext(original_filename)
    stored = f"{uuid.uuid4()}.{ext2}"
    dest = settings.branding_upload_dir / stored
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    try:
        tmp.write_bytes(data)
        tmp.replace(dest)
    except OSError:
        logger.exception("Failed to write branding file")
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise ValueError("Could not store file") from None

    row = get_or_create(db)
    assets = _loads_json(row.assets_json, {})
    if not isinstance(assets, dict):
        assets = {}
    old_name = assets.get(slot)
    assets[slot] = stored
    row.assets_json = _dumps_json(assets)
    row.asset_version = int(row.asset_version or 1) + 1
    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_id = actor_user_id
    db.add(row)
    db.commit()
    db.refresh(row)

    if isinstance(old_name, str) and old_name != stored and is_safe_stored_filename(old_name):
        old_path = settings.branding_upload_dir / old_name
        try:
            old_path.unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not remove old branding file %s", old_name)

    event_log_service.write_audit(
        db,
        actor_user_id=actor_user_id,
        action="branding.upload",
        entity_type="branding",
        entity_id=BRANDING_ROW_ID,
        detail={"slot": slot, "filename": stored},
        ip_address=ip_address,
    )
    files_base = _files_base(settings, row, request_base)
    rel = f"{settings.api_prefix}/branding/files/{stored}"
    url = _asset_url(files_base, stored)
    if not url:
        url = rel
        if request_base:
            rb = request_base.rstrip("/")
            url = f"{rb}{rel}"
    return stored, url, int(row.asset_version)


def update_text_fields(
    db: Session,
    *,
    settings: Settings,
    body: Any,
    actor_user_id: str,
    raw_patch: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> BrandingSettings:
    from app.schemas.branding import BrandingUpdateIn
    from app.services import event_log_service

    if not isinstance(body, BrandingUpdateIn):
        body = BrandingUpdateIn.model_validate(body)
    raw = raw_patch or {}
    row = get_or_create(db)
    detail_before: dict[str, Any] = {}

    if body.meta_title is not None:
        detail_before["meta_title"] = row.meta_title
        row.meta_title = body.meta_title
    if body.meta_description is not None:
        detail_before["meta_description"] = row.meta_description
        row.meta_description = body.meta_description

    if "social" in raw and isinstance(raw["social"], dict):
        merged = _loads_json(row.social_links_json, {})
        if not isinstance(merged, dict):
            merged = {}
        for k, v in raw["social"].items():
            key = str(k)
            if v is None or (isinstance(v, str) and not v.strip()):
                merged.pop(key, None)
            else:
                merged[key] = str(v).strip()
        detail_before["social"] = row.social_links_json
        row.social_links_json = _dumps_json(merged)

    if body.accent_color is not None:
        prev_l = str(getattr(row, "accent_color_light", "") or "")
        prev_d = str(getattr(row, "accent_color_dark", "") or "")
        nv = _normalize_accent_hex(body.accent_color)
        if nv != prev_l or nv != prev_d:
            detail_before["accent_color"] = {"light": prev_l, "dark": prev_d}
            row.accent_color_light = nv
            row.accent_color_dark = nv

    if not detail_before:
        return row

    row.asset_version = int(row.asset_version or 1) + 1
    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_id = actor_user_id
    db.add(row)
    db.commit()
    db.refresh(row)

    event_log_service.write_audit(
        db,
        actor_user_id=actor_user_id,
        action="branding.update",
        entity_type="branding",
        entity_id=BRANDING_ROW_ID,
        detail={"changed": detail_before},
        ip_address=ip_address,
    )
    return row


def clear_asset_slot(
    db: Session,
    *,
    settings: Settings,
    slot: str,
    actor_user_id: str,
    ip_address: str | None = None,
) -> BrandingSettings:
    from app.services import event_log_service

    if slot not in ASSET_SLOTS:
        raise ValueError("Unknown asset slot")
    row = get_or_create(db)
    assets = _loads_json(row.assets_json, {})
    if not isinstance(assets, dict):
        assets = {}
    old_name = assets.pop(slot, None)
    row.assets_json = _dumps_json(assets)
    row.asset_version = int(row.asset_version or 1) + 1
    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_id = actor_user_id
    db.add(row)
    db.commit()
    db.refresh(row)

    if isinstance(old_name, str) and is_safe_stored_filename(old_name):
        try:
            (settings.branding_upload_dir / old_name).unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not remove branding file %s", old_name)

    event_log_service.write_audit(
        db,
        actor_user_id=actor_user_id,
        action="branding.delete_asset",
        entity_type="branding",
        entity_id=BRANDING_ROW_ID,
        detail={"slot": slot},
        ip_address=ip_address,
    )
    return row
