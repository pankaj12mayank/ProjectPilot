from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.session import get_db
from app.schemas.branding import BrandingPublicOut
from app.services import branding_service

router = APIRouter()


@router.get("/public", response_model=BrandingPublicOut)
def get_branding_public(request: Request, db: Session = Depends(get_db)) -> BrandingPublicOut:
    settings = get_settings()
    row = branding_service.get_or_create(db)
    payload = branding_service.build_public_payload(settings, row, request_base=str(request.base_url))
    data = {k: payload[k] for k in BrandingPublicOut.model_fields if k in payload}
    return BrandingPublicOut.model_validate(data)


@router.get("/files/{filename}")
def get_branding_file(filename: str) -> FileResponse:
    settings = get_settings()
    if not branding_service.is_safe_stored_filename(filename):
        raise HTTPException(status_code=404, detail="Not found")
    path = settings.branding_upload_dir / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, filename=filename)


@router.get("/defaults/{slot}")
def get_branding_default(slot: str) -> FileResponse:
    settings = get_settings()
    if slot not in branding_service.ASSET_SLOTS:
        raise HTTPException(status_code=404, detail="Not found")
    path: Path = settings.branding_defaults_dir / f"{slot}.png"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type="image/png")
