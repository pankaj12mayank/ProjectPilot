"""Project CRUD and upload analyze / validate pipeline."""

from __future__ import annotations

import json
import logging
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.db.models import Project, ProjectFile, User
from app.schemas.project import (
    AnalyzeUploadResponse,
    FileAnalyzeSlot,
    FileSlotError,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
)
from app.services.file_parser import ParseError, parse_file_bytes_detailed
from app.services.ingestion_service import replace_ingested_rows_for_role
from app.services.mapping_engine import map_dataframe_columns
from app.services.cleaning_engine import clean_for_role
from app.services.validation_engine import validate_dataframe

logger = logging.getLogger(__name__)

FILE_ROLES = ("status_tracker", "raid_log", "weekly_history")


def _serialize_cell(value: object) -> str | float | int | bool | None:
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        return value
    if hasattr(value, "item"):
        try:
            return _serialize_cell(value.item())  # type: ignore[no-any-return]
        except (ValueError, TypeError, AttributeError):
            return str(value)
    return str(value)


def _preview_from_df(df: pd.DataFrame, limit: int = 10) -> tuple[list[str], list[list[str | float | int | bool | None]]]:
    head = df.head(limit)
    cols = [str(c) for c in head.columns]
    rows: list[list[str | float | int | bool | None]] = []
    for _, row in head.iterrows():
        rows.append([_serialize_cell(row[c]) for c in head.columns])
    return cols, rows


def create_project(db: Session, owner: User, body: ProjectCreate) -> Project:
    p = Project(
        id=str(uuid.uuid4()),
        name=body.name.strip(),
        description=body.description.strip() if body.description else None,
        owner_id=owner.id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def list_projects_for_user(db: Session, owner: User) -> list[Project]:
    return list(db.scalars(select(Project).where(Project.owner_id == owner.id).order_by(Project.updated_at.desc())))


def get_project_for_user(db: Session, project_id: str, owner: User) -> Project | None:
    p = db.get(Project, project_id)
    if p is None or p.owner_id != owner.id:
        return None
    return p


def update_project(db: Session, project: Project, body: ProjectUpdate) -> Project:
    if body.name is not None:
        project.name = body.name.strip()
    if body.description is not None:
        d = body.description.strip()
        project.description = d if d else None
    if body.is_archived is not None:
        project.is_archived = body.is_archived
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _upsert_project_file(
    db: Session,
    project_id: str,
    file_role: str,
    original_filename: str,
    stored_path: str,
    validation_payload: dict,
) -> ProjectFile:
    """Insert or update project_files row. Does not commit — caller must commit."""
    existing = db.scalar(
        select(ProjectFile).where(ProjectFile.project_id == project_id, ProjectFile.file_role == file_role),
    )
    payload_json = json.dumps(validation_payload)
    if existing:
        existing.original_filename = original_filename
        existing.stored_path = stored_path
        existing.last_validation_json = payload_json
        db.add(existing)
        db.flush()
        db.refresh(existing)
        return existing
    row = ProjectFile(
        id=str(uuid.uuid4()),
        project_id=project_id,
        file_role=file_role,
        original_filename=original_filename,
        stored_path=stored_path,
        last_validation_json=payload_json,
    )
    db.add(row)
    db.flush()
    db.refresh(row)
    return row


def _empty_slot(role: str) -> FileAnalyzeSlot:
    return FileAnalyzeSlot(
        role=role,
        filename=None,
        valid=True,
        errors=[],
        warnings=["No file was uploaded for this slot."],
        column_mapping={},
        preview_columns=[],
        preview_rows=[],
        sheet_used=None,
        data_row_count=None,
        persisted_row_count=None,
    )


def _analyze_upload_slot_impl(
    db: Session,
    settings: Settings,
    project: Project,
    role: str,
    content: bytes,
    original_filename: str,
) -> FileAnalyzeSlot:
    if role not in FILE_ROLES:
        return FileAnalyzeSlot(
            role=role,
            filename=original_filename,
            valid=False,
            errors=[FileSlotError(code="invalid_role", message=f"Unknown role '{role}'.")],
            warnings=[],
            column_mapping={},
            preview_columns=[],
            preview_rows=[],
            sheet_used=None,
            data_row_count=None,
            persisted_row_count=None,
        )

    try:
        parse_out = parse_file_bytes_detailed(content, original_filename)
    except ParseError as exc:
        return FileAnalyzeSlot(
            role=role,
            filename=original_filename,
            valid=False,
            errors=[FileSlotError(code="parse_error", message=str(exc))],
            warnings=[],
            column_mapping={},
            preview_columns=[],
            preview_rows=[],
            sheet_used=None,
            data_row_count=None,
            persisted_row_count=None,
        )

    parse_warnings = list(parse_out.warnings)
    df_raw = parse_out.dataframe
    if df_raw is None or not isinstance(df_raw, pd.DataFrame):
        return FileAnalyzeSlot(
            role=role,
            filename=original_filename,
            valid=False,
            errors=[FileSlotError(code="parse_error", message="Parser returned no tabular data.")],
            warnings=parse_warnings,
            column_mapping={},
            preview_columns=[],
            preview_rows=[],
            sheet_used=parse_out.sheet_used,
            data_row_count=None,
            persisted_row_count=None,
        )

    try:
        df_mapped, column_mapping = map_dataframe_columns(df_raw, role)
        df_clean, clean_warnings = clean_for_role(df_mapped, role)
    except Exception as exc:
        logger.exception("Mapping/cleaning failed for project=%s role=%s", project.id, role)
        return FileAnalyzeSlot(
            role=role,
            filename=original_filename,
            valid=False,
            errors=[
                FileSlotError(
                    code="processing_error",
                    message="Could not normalize this spreadsheet. Check for merged cells, stray titles, or invalid headers.",
                ),
            ],
            warnings=parse_warnings,
            column_mapping={},
            preview_columns=[],
            preview_rows=[],
            sheet_used=parse_out.sheet_used,
            data_row_count=None,
            persisted_row_count=None,
        )

    all_warnings = parse_warnings + clean_warnings

    try:
        raw_issues = validate_dataframe(df_clean, role)
    except Exception as exc:
        logger.exception("Validation engine failed for project=%s role=%s", project.id, role)
        raw_issues = [
            {
                "code": "validation_internal",
                "message": "Validation step failed safely; try simplifying the sheet or exporting to CSV.",
                "row": None,
                "column": None,
            },
        ]
    errors = [FileSlotError(**issue) for issue in raw_issues]
    valid = len(errors) == 0

    df_store = df_clean.dropna(how="all").reset_index(drop=True)
    data_row_count = int(df_store.shape[0])

    preview_columns, preview_rows = _preview_from_df(df_store)

    ext = Path(original_filename).suffix.lower() or ".bin"
    safe_role = role.replace("/", "_")
    file_id = str(uuid.uuid4())
    rel_dir = Path("projects") / project.id
    disk_dir = settings.uploads_dir / rel_dir
    disk_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{safe_role}_{file_id}{ext}"
    disk_path = disk_dir / stored_name
    disk_path.write_bytes(content)
    stored_path = rel_dir.as_posix() + "/" + stored_name

    validation_payload = {
        "valid": valid,
        "errors": [e.model_dump() for e in errors],
        "warnings": all_warnings,
        "column_mapping": column_mapping,
        "filename": original_filename,
        "sheet_used": parse_out.sheet_used,
        "data_row_count": data_row_count,
    }

    persisted_row_count: int | None = None
    try:
        pf = _upsert_project_file(
            db,
            project.id,
            role,
            original_filename,
            stored_path,
            validation_payload,
        )
        if valid:
            persisted_row_count = replace_ingested_rows_for_role(
                db,
                project.id,
                pf.id,
                role,
                df_store,
            )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Database ingestion failed for project=%s role=%s", project.id, role)
        return FileAnalyzeSlot(
            role=role,
            filename=original_filename,
            valid=False,
            errors=[
                FileSlotError(
                    code="persist_error",
                    message="Validation succeeded but saving to the database failed. Try again or use a smaller file.",
                ),
            ],
            warnings=all_warnings,
            column_mapping=column_mapping,
            preview_columns=preview_columns,
            preview_rows=preview_rows,
            sheet_used=parse_out.sheet_used,
            data_row_count=data_row_count,
            persisted_row_count=None,
        )

    return FileAnalyzeSlot(
        role=role,
        filename=original_filename,
        valid=valid,
        errors=errors,
        warnings=all_warnings,
        column_mapping=column_mapping,
        preview_columns=preview_columns,
        preview_rows=preview_rows,
        sheet_used=parse_out.sheet_used,
        data_row_count=data_row_count,
        persisted_row_count=persisted_row_count if valid else None,
    )


def analyze_upload_slot(
    db: Session,
    settings: Settings,
    project: Project,
    role: str,
    content: bytes,
    original_filename: str,
) -> FileAnalyzeSlot:
    """Parse, validate, store raw file, and persist clean rows when valid. Never raises to the API layer."""
    try:
        return _analyze_upload_slot_impl(db, settings, project, role, content, original_filename)
    except Exception:
        logger.exception("Unexpected error in analyze_upload_slot project=%s role=%s", project.id, role)
        try:
            db.rollback()
        except Exception:
            pass
        return FileAnalyzeSlot(
            role=role,
            filename=original_filename,
            valid=False,
            errors=[
                FileSlotError(
                    code="internal_error",
                    message="An unexpected error occurred while processing this file. Try CSV format or fewer rows.",
                ),
            ],
            warnings=[],
            column_mapping={},
            preview_columns=[],
            preview_rows=[],
            sheet_used=None,
            data_row_count=None,
            persisted_row_count=None,
        )


def analyze_uploads(
    db: Session,
    project: Project,
    files_by_role: dict[str, tuple[bytes, str]],
    settings: Settings | None = None,
) -> AnalyzeUploadResponse:
    settings = settings or get_settings()
    slots: list[FileAnalyzeSlot] = []
    for role in FILE_ROLES:
        if role not in files_by_role:
            slots.append(_empty_slot(role))
            continue
        content, name = files_by_role[role]
        if not content or not name:
            slots.append(_empty_slot(role))
            continue
        slots.append(analyze_upload_slot(db, settings, project, role, content, name))
    return AnalyzeUploadResponse(project_id=project.id, files=slots)


def project_to_out(p: Project) -> ProjectOut:
    return ProjectOut.model_validate(p)