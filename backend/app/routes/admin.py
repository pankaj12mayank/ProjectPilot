from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.models import User
from app.db.session import get_db
from app.deps.auth import require_admin
from app.schemas.branding import BrandingAdminOut, BrandingPublicOut, BrandingUpdateIn, BrandingUploadOut
from app.services import admin_service, branding_service

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    c = request.client
    return c.host if c else None


@router.get("/stats")
def admin_stats(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict[str, int]:
    return admin_service.admin_dashboard_counts(db)


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
