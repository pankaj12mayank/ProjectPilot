from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.models import User
from app.db.session import get_db
from app.deps.auth import require_admin
from app.schemas.branding import BrandingAdminOut, BrandingPublicOut, BrandingUpdateIn, BrandingUploadOut
from app.schemas.email_settings import (
    EmailSettingsAdminOut,
    EmailSettingsPostIn,
    EmailSettingsUpdateIn,
    EmailTestIn,
    EmailTestOut,
)
from app.schemas.logs import ActivityLogOut, PaginatedActivityLogsOut
from app.services import admin_service, branding_service, email_service, email_settings_service, event_log_service
from app.services.logs_list_service import LogQuery, list_activity_logs_admin

router = APIRouter()


def _parse_dt(value: str | None) -> datetime | None:
    if not value or not str(value).strip():
        return None
    t = str(value).strip().replace("Z", "+00:00")
    if len(t) == 10:
        t = f"{t}T00:00:00+00:00"
    return datetime.fromisoformat(t)


def _client_ip(request: Request) -> str | None:
    c = request.client
    return c.host if c else None


@router.get("/stats")
def admin_stats(admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict[str, object]:
    return admin_service.admin_dashboard_stats(db, admin)


@router.get("/system-config")
def admin_system_config(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Read-only snapshot of effective server configuration (no secrets)."""
    s = get_settings()
    uri = s.sqlalchemy_database_uri
    db_kind = "postgresql" if "postgresql" in uri.lower() else "sqlite" if "sqlite" in uri.lower() else "other"
    secret = (s.jwt_secret_key or "").strip()
    email_row = email_settings_service.get_or_create(db)
    email_gap = None
    if email_row.enabled:
        prov = (email_row.provider or "smtp").lower()
        if prov == "sendgrid":
            email_gap = email_settings_service.describe_sendgrid_gap(email_row, s)
        else:
            email_gap = email_settings_service.describe_ready_gap(email_row, s)
    return {
        "api_prefix": s.api_prefix,
        "cors_origins": s.cors_origins,
        "log_level": s.log_level,
        "chart_dpi": s.chart_dpi,
        "jwt_algorithm": s.jwt_algorithm,
        "jwt_access_expire_minutes": s.jwt_access_expire_minutes,
        "jwt_refresh_expire_days": s.jwt_refresh_expire_days,
        "jwt_secret_configured": len(secret) > 20 and not secret.startswith("dev-only"),
        "rag_thresholds": s.rag_thresholds(),
        "branding_max_upload_mb": s.branding_max_upload_mb,
        "project_upload_max_mb": s.project_upload_max_mb,
        "public_api_url": s.public_api_url,
        "public_app_url": s.public_app_url,
        "database_kind": db_kind,
        "paths": {
            "repo_root": str(s.repo_root),
            "data_dir": str(s.repo_root / "data"),
            "logs_dir": str(s.logs_dir),
            "outputs_dir": str(s.outputs_dir),
            "uploads_dir": str(s.uploads_dir),
        },
        "dev_return_reset_token": bool(s.dev_return_reset_token),
        "email_send_ready": (not email_row.enabled) or (email_gap is None),
        "email_send_status": "disabled" if not email_row.enabled else ("ready" if email_gap is None else email_gap),
    }


@router.post("/runtime/reload-settings")
def reload_process_settings_cache(_: User = Depends(require_admin)) -> dict[str, str]:
    """Clears the in-process settings singleton. Env file changes still require a process restart."""
    get_settings.cache_clear()
    return {
        "status": "ok",
        "message": "In-process configuration cache was cleared. Restart the API process to load new environment variables from disk.",
    }


@router.get("/activity-logs", response_model=PaginatedActivityLogsOut)
def admin_activity_logs(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    actor_user_id: str | None = Query(None, description="Filter to this user id; omit for all users"),
    q: str | None = Query(None),
    project_id: str | None = Query(None),
    kind: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedActivityLogsOut:
    f = LogQuery(
        q=q,
        project_id=project_id,
        kind=kind,
        actor_user_id=actor_user_id,
        date_from=_parse_dt(date_from),
        date_to=_parse_dt(date_to),
        limit=limit,
        offset=offset,
    )
    items, total = list_activity_logs_admin(db, admin, f)
    return PaginatedActivityLogsOut(
        items=[ActivityLogOut.model_validate(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/branding", response_model=BrandingAdminOut)
def admin_get_branding(
    request: Request,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BrandingAdminOut:
    settings = get_settings()
    row = branding_service.get_or_create(db)
    p = branding_service.build_public_payload(settings, row, request_base=str(request.base_url))
    base = BrandingPublicOut.model_validate({k: p[k] for k in BrandingPublicOut.model_fields if k in p})
    return BrandingAdminOut.model_validate(
        {
            **base.model_dump(),
            "assets": p.get("assets") or {},
            "updated_at": p.get("updated_at"),
            "updated_by_user_id": p.get("updated_by_user_id"),
            "max_upload_mb": settings.branding_max_upload_mb,
        },
    )


@router.patch("/branding", response_model=BrandingAdminOut)
def admin_patch_branding(
    request: Request,
    raw: dict[str, Any] = Body(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BrandingAdminOut:
    settings = get_settings()
    try:
        body = BrandingUpdateIn.model_validate(raw)
        branding_service.update_text_fields(
            db,
            settings=settings,
            body=body,
            actor_user_id=admin.id,
            raw_patch=raw,
            ip_address=_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row = branding_service.get_or_create(db)
    p = branding_service.build_public_payload(settings, row, request_base=str(request.base_url))
    base = BrandingPublicOut.model_validate({k: p[k] for k in BrandingPublicOut.model_fields if k in p})
    return BrandingAdminOut.model_validate(
        {
            **base.model_dump(),
            "assets": p.get("assets") or {},
            "updated_at": p.get("updated_at"),
            "updated_by_user_id": p.get("updated_by_user_id"),
            "max_upload_mb": settings.branding_max_upload_mb,
        },
    )


@router.post("/branding/upload", response_model=BrandingUploadOut)
async def admin_upload_branding(
    request: Request,
    slot: str = Form(...),
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BrandingUploadOut:
    settings = get_settings()
    name = file.filename or "upload.bin"
    try:
        data = await file.read(settings.branding_max_upload_bytes + 1)
        if len(data) > settings.branding_max_upload_bytes:
            raise ValueError(f"File too large (max {settings.branding_max_upload_mb} MB)")
        stored, url, ver = branding_service.save_uploaded_asset(
            db,
            settings=settings,
            slot=slot,
            original_filename=name,
            data=data,
            actor_user_id=admin.id,
            request_base=str(request.base_url),
            ip_address=_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BrandingUploadOut(slot=slot, filename=stored, url=url, asset_version=ver)


@router.delete("/branding/assets/{slot}", response_model=BrandingAdminOut)
def admin_delete_branding_asset(
    request: Request,
    slot: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BrandingAdminOut:
    settings = get_settings()
    try:
        branding_service.clear_asset_slot(
            db,
            settings=settings,
            slot=slot,
            actor_user_id=admin.id,
            ip_address=_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row = branding_service.get_or_create(db)
    p = branding_service.build_public_payload(settings, row, request_base=str(request.base_url))
    base = BrandingPublicOut.model_validate({k: p[k] for k in BrandingPublicOut.model_fields if k in p})
    return BrandingAdminOut.model_validate(
        {
            **base.model_dump(),
            "assets": p.get("assets") or {},
            "updated_at": p.get("updated_at"),
            "updated_by_user_id": p.get("updated_by_user_id"),
            "max_upload_mb": settings.branding_max_upload_mb,
        },
    )


@router.get("/email-settings", response_model=EmailSettingsAdminOut)
def admin_get_email_settings(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EmailSettingsAdminOut:
    row = email_settings_service.get_or_create(db)
    return email_settings_service.to_admin_out(row)


@router.post("/email-settings", response_model=EmailSettingsAdminOut)
def admin_post_email_settings(
    request: Request,
    body: EmailSettingsPostIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EmailSettingsAdminOut:
    settings = get_settings()
    row = email_settings_service.get_or_create(db)
    try:
        email_settings_service.apply_post(
            db,
            row=row,
            body=body,
            settings=settings,
            actor_user_id=admin.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row = email_settings_service.get_or_create(db)
    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.email_settings.post",
        entity_type="email_settings",
        entity_id="default",
        detail={"provider": body.provider, "enabled": body.enabled},
        ip_address=_client_ip(request),
    )
    return email_settings_service.to_admin_out(row)


@router.patch("/email-settings", response_model=EmailSettingsAdminOut)
def admin_patch_email_settings(
    request: Request,
    body: EmailSettingsUpdateIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EmailSettingsAdminOut:
    if not body.model_fields_set:
        row = email_settings_service.get_or_create(db)
        return email_settings_service.to_admin_out(row)
    settings = get_settings()
    row = email_settings_service.get_or_create(db)
    try:
        email_settings_service.apply_update(
            db,
            row=row,
            body=body,
            settings=settings,
            actor_user_id=admin.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row = email_settings_service.get_or_create(db)
    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.email_settings.patch",
        entity_type="email_settings",
        entity_id="default",
        detail={"fields": sorted(body.model_fields_set)},
        ip_address=_client_ip(request),
    )
    return email_settings_service.to_admin_out(row)


@router.post("/email-settings/test", response_model=EmailTestOut)
def admin_post_email_settings_test(
    request: Request,
    body: EmailTestIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EmailTestOut:
    settings = get_settings()
    res = email_service.EmailService(settings, db).send_test_email(to_email=str(body.to))
    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.email_settings.test",
        entity_type="email_settings",
        entity_id="default",
        detail={"to": str(body.to), "ok": res.ok, "message": res.message[:500]},
        ip_address=_client_ip(request),
    )
    return EmailTestOut(ok=res.ok, message=res.message)
