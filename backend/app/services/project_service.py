"""Project CRUD and upload analyze / validate pipeline."""

from __future__ import annotations

import json
import logging
import math
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.constants.roles import ROLES_FULL_DIRECTORY_ASSIGNABLE, ROLES_WITH_ALL_PROJECTS_READ
from app.db.models import (
    ActivityLog,
    GeneratedReportArtifact,
    Project,
    ProjectDataRow,
    ProjectFile,
    ProjectMetricsSnapshot,
    ProjectReportRun,
    ProjectRisk,
    User,
)
from app.schemas.project import (
    AnalyzeUploadResponse,
    FileAnalyzeSlot,
    FileSlotError,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
)
from app.services.file_parser import ParseError, parse_file_bytes_detailed
from app.services.snapshot_storage import SNAPSHOT_SUBDIR
from app.services.ingestion_service import replace_ingested_rows_for_role
from app.services.mapping_engine import map_dataframe_columns
from app.services.cleaning_engine import clean_for_role
from app.services.validation_engine import validate_dataframe
from app.services import project_templates, user_service

logger = logging.getLogger(__name__)

FILE_ROLES = ("status_tracker", "raid_log", "weekly_history")
SAMPLE_FILE_ROLES = FILE_ROLES
ALLOWED_UPLOAD_SUFFIXES = frozenset({".csv", ".xlsx", ".xls"})


def sample_format_csv_path(settings: Settings, role: str) -> Path | None:
    if role not in SAMPLE_FILE_ROLES:
        return None
    p = settings.repo_root / "sample_formats" / f"{role}_sample.csv"
    return p if p.is_file() else None


def ensure_project_schema(db: Session) -> None:
    """Add columns introduced after first deploy (SQLite / PostgreSQL)."""
    try:
        from sqlalchemy import inspect, text

        bind = db.get_bind()
        insp = inspect(bind)
        cols = {c["name"] for c in insp.get_columns("projects")}
        dialect = bind.dialect.name
        stmts: list[str] = []
        if "planned_start_date" not in cols:
            if dialect == "postgresql":
                stmts.append(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS planned_start_date TIMESTAMP WITH TIME ZONE"
                )
            else:
                stmts.append("ALTER TABLE projects ADD COLUMN planned_start_date DATETIME")
        if "planned_end_date" not in cols:
            if dialect == "postgresql":
                stmts.append(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS planned_end_date TIMESTAMP WITH TIME ZONE"
                )
            else:
                stmts.append("ALTER TABLE projects ADD COLUMN planned_end_date DATETIME")
        if "team_user_ids_json" not in cols:
            if dialect == "postgresql":
                stmts.append("ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_user_ids_json TEXT DEFAULT '[]'")
            else:
                stmts.append("ALTER TABLE projects ADD COLUMN team_user_ids_json TEXT DEFAULT '[]'")
        if "template_key" not in cols:
            if dialect == "postgresql":
                stmts.append("ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_key VARCHAR(64)")
            else:
                stmts.append("ALTER TABLE projects ADD COLUMN template_key VARCHAR(64)")
        for sql in stmts:
            db.execute(text(sql))
        if stmts:
            db.commit()
        cols2 = {c["name"] for c in inspect(bind).get_columns("projects")}
        if "team_user_ids_json" in cols2:
            try:
                db.execute(text("UPDATE projects SET team_user_ids_json = '[]' WHERE team_user_ids_json IS NULL"))
                db.commit()
            except Exception:
                db.rollback()
    except Exception:
        logger.exception("ensure_project_schema failed")
        db.rollback()


def _parse_team_ids(raw: str | None) -> list[str]:
    try:
        data = json.loads(raw or "[]")
        if isinstance(data, list):
            return [str(x) for x in data if x]
    except json.JSONDecodeError:
        pass
    return []


def _dumps_team_ids(ids: list[str]) -> str:
    return json.dumps(ids)


def _normalize_team_user_ids(db: Session, owner_id: str, requested: list[str] | None) -> list[str]:
    """Owner is always included; order preserved; validates each id exists."""
    out: list[str] = []
    for uid in [owner_id, *(requested or [])]:
        if not uid or uid in out:
            continue
        if db.get(User, uid) is None:
            raise ValueError(f"Unknown team user id: {uid}")
        out.append(uid)
    return out


def list_assignable_users(db: Session, viewer: User) -> list[User]:
    """Users who may be added to a project team (admins + PMO/PM see full directory; others see only themselves)."""
    if viewer.role in ROLES_FULL_DIRECTORY_ASSIGNABLE:
        return user_service.list_users(db)
    u = db.get(User, viewer.id)
    return [u] if u else []


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
    team_ids = _normalize_team_user_ids(db, owner.id, body.team_user_ids)
    tpl = project_templates.get_template(body.template_key)
    template_key_val: str | None = tpl.key if tpl else None
    desc_in = (body.description or "").strip() if body.description else ""
    if desc_in:
        desc_final: str | None = desc_in
    elif tpl and (tpl.suggested_description or "").strip():
        desc_final = tpl.suggested_description.strip()
    else:
        desc_final = None
    p = Project(
        id=str(uuid.uuid4()),
        name=body.name.strip(),
        description=desc_final,
        owner_id=owner.id,
        planned_start_date=body.planned_start_date,
        planned_end_date=body.planned_end_date,
        team_user_ids_json=_dumps_team_ids(team_ids),
        template_key=template_key_val,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def list_projects_for_user(db: Session, viewer: User) -> list[Project]:
    if viewer.role in ROLES_WITH_ALL_PROJECTS_READ:
        return list(db.scalars(select(Project).order_by(Project.updated_at.desc())))
    needle = f'"{viewer.id}"'
    return list(
        db.scalars(
            select(Project)
            .where(
                or_(
                    Project.owner_id == viewer.id,
                    Project.team_user_ids_json.like(f"%{needle}%"),
                ),
            )
            .order_by(Project.updated_at.desc()),
        ),
    )


def get_project_for_user(db: Session, project_id: str, owner: User) -> Project | None:
    p = db.get(Project, project_id)
    if p is None or p.owner_id != owner.id:
        return None
    return p


def update_project(db: Session, project: Project, body: ProjectUpdate) -> Project:
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        project.name = str(data["name"]).strip()
    if "description" in data:
        d = (data["description"] or "").strip() if data["description"] is not None else ""
        project.description = d if d else None
    if "is_archived" in data:
        project.is_archived = bool(data["is_archived"])
    if "planned_start_date" in data:
        project.planned_start_date = data["planned_start_date"]
    if "planned_end_date" in data:
        project.planned_end_date = data["planned_end_date"]
    if "planned_start_date" in data and "planned_end_date" in data:
        s, e = project.planned_start_date, project.planned_end_date
        if s is not None and e is not None and e < s:
            raise ValueError("planned_end_date must be on or after planned_start_date")
    if "team_user_ids" in data:
        team_ids = _normalize_team_user_ids(db, project.owner_id, data["team_user_ids"])
        project.team_user_ids_json = _dumps_team_ids(team_ids)
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def delete_project_and_assets(db: Session, settings: Settings, project: Project) -> None:
    """Remove project row and dependent DB rows; best-effort disk cleanup for uploads and report outputs."""
    pid = project.id

    db.execute(delete(ProjectDataRow).where(ProjectDataRow.project_id == pid))
    db.execute(delete(GeneratedReportArtifact).where(GeneratedReportArtifact.project_id == pid))
    db.execute(delete(ProjectMetricsSnapshot).where(ProjectMetricsSnapshot.project_id == pid))
    db.execute(delete(ProjectRisk).where(ProjectRisk.project_id == pid))

    run_ids = list(db.scalars(select(ProjectReportRun.id).where(ProjectReportRun.project_id == pid)))
    for rid in run_ids:
        out_dir = (settings.outputs_dir / "reports" / rid).resolve()
        try:
            if out_dir.is_dir():
                shutil.rmtree(out_dir, ignore_errors=True)
        except OSError:
            logger.warning("Could not remove report output dir %s", out_dir)

    db.execute(delete(ProjectReportRun).where(ProjectReportRun.project_id == pid))

    file_rows = db.scalars(select(ProjectFile).where(ProjectFile.project_id == pid)).all()
    for pf in file_rows:
        try:
            disk = (settings.uploads_dir / pf.stored_path).resolve()
            if disk.is_file():
                disk.unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not remove upload file %s", pf.stored_path)
    db.execute(delete(ProjectFile).where(ProjectFile.project_id == pid))

    db.execute(delete(ActivityLog).where(ActivityLog.project_id == pid))

    proj_dir = (settings.uploads_dir / "projects" / pid).resolve()
    try:
        if proj_dir.is_dir():
            shutil.rmtree(proj_dir, ignore_errors=True)
    except OSError:
        logger.warning("Could not remove project upload dir %s", proj_dir)

    snap_dir = (settings.outputs_dir / SNAPSHOT_SUBDIR / pid).resolve()
    try:
        if snap_dir.is_dir():
            shutil.rmtree(snap_dir, ignore_errors=True)
    except OSError:
        logger.warning("Could not remove snapshot dir %s", snap_dir)

    db.delete(project)
    db.commit()


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

    suffix = Path(original_filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        return FileAnalyzeSlot(
            role=role,
            filename=original_filename,
            valid=False,
            errors=[
                FileSlotError(
                    code="unsupported_file_type",
                    message="Use a .csv, .xlsx, or .xls file for this upload.",
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

    max_bytes = settings.project_upload_max_bytes
    if len(content) > max_bytes:
        mb = max(1, settings.project_upload_max_mb)
        return FileAnalyzeSlot(
            role=role,
            filename=original_filename,
            valid=False,
            errors=[
                FileSlotError(
                    code="file_too_large",
                    message=f"This file is too large. Maximum size is {mb} MB per file.",
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


def project_list_metadata(db: Session, project_ids: list[str]) -> dict[str, dict[str, object]]:
    """Per-project flags for list/detail API: ingested data + latest report run."""
    if not project_ids:
        return {}
    with_rows = set(
        db.scalars(
            select(ProjectDataRow.project_id)
            .where(ProjectDataRow.project_id.in_(project_ids))
            .group_by(ProjectDataRow.project_id),
        ).all(),
    )
    latest: dict[str, tuple[str, datetime]] = {}
    for run in db.scalars(
        select(ProjectReportRun)
        .where(ProjectReportRun.project_id.in_(project_ids))
        .order_by(ProjectReportRun.created_at.desc())
        .limit(400),
    ).all():
        if run.project_id not in latest:
            latest[run.project_id] = (run.id, run.created_at)
    out: dict[str, dict[str, object]] = {}
    for pid in project_ids:
        extra: dict[str, object] = {"has_ingested_data": pid in with_rows}
        if pid in latest:
            extra["latest_report_job_id"] = latest[pid][0]
            extra["latest_report_at"] = latest[pid][1]
        else:
            extra["latest_report_job_id"] = None
            extra["latest_report_at"] = None
        out[pid] = extra
    return out


def project_to_out(
    p: Project,
    *,
    has_ingested_data: bool = False,
    latest_report_job_id: str | None = None,
    latest_report_at: datetime | None = None,
) -> ProjectOut:
    team = _parse_team_ids(getattr(p, "team_user_ids_json", None))
    return ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description,
        owner_id=p.owner_id,
        created_at=p.created_at,
        updated_at=p.updated_at,
        is_archived=p.is_archived,
        is_active=not p.is_archived,
        planned_start_date=getattr(p, "planned_start_date", None),
        planned_end_date=getattr(p, "planned_end_date", None),
        team_user_ids=team,
        template_key=getattr(p, "template_key", None),
        has_ingested_data=has_ingested_data,
        latest_report_job_id=latest_report_job_id,
        latest_report_at=latest_report_at,
    )