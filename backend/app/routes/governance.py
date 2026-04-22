import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.models import User
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.services.governance_service import GovernanceService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/report", summary="Generate governance deck and email draft from uploads")
async def generate_report(
    status_tracker: UploadFile = File(..., description="Status tracker (.xlsx)"),
    raid_log: UploadFile = File(..., description="RAID log (.xlsx)"),
    weekly_history: UploadFile = File(..., description="Weekly history (.csv)"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    settings = get_settings()
    job_id = str(uuid.uuid4())
    upload_dir = settings.uploads_dir / job_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    async def _write(upload: UploadFile, filename: str) -> Path:
        dest = upload_dir / filename
        content = await upload.read()
        dest.write_bytes(content)
        return dest

    try:
        status_path = await _write(status_tracker, "status.xlsx")
        raid_path = await _write(raid_log, "raid.xlsx")
        history_path = await _write(weekly_history, "weekly_history.csv")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save uploads: {exc}") from exc

    service = GovernanceService(db)
    try:
        return service.generate_from_paths(status_path, raid_path, history_path, job_id=job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Report generation failed")
        raise HTTPException(status_code=500, detail="Report generation failed") from exc
