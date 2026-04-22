from __future__ import annotations

import logging

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.models import Project, ProjectFile, ProjectReportRun, User
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.deps.project import get_owned_project
from app.schemas.project import (
    AnalyzeUploadResponse,
    ProjectCreate,
    ProjectFileOut,
    ProjectOut,
    ProjectUpdate,
)
from app.schemas.reports import ProjectIntelligenceOut, ProjectReportPackageOut, ReportRunSummaryOut
from app.services import project_service
from app.services.analytics.project_health import build_project_health_payload
from app.services.intelligence.package import build_intelligence_core
from app.services.report_artifacts import resolve_report_artifact_path
from app.services.report_package_service import generate_project_report_package

logger = logging.getLogger(__name__)
router = APIRouter()

_REPORT_MIME = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}


@router.post("", response_model=ProjectOut)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    p = project_service.create_project(db, user, body)
    return project_service.project_to_out(p)


@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProjectOut]:
    rows = project_service.list_projects_for_user(db, user)
    return [project_service.project_to_out(p) for p in rows]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project: Project = Depends(get_owned_project),
) -> ProjectOut:
    return project_service.project_to_out(project)


@router.patch("/{project_id}", response_model=ProjectOut)
def patch_project(
    body: ProjectUpdate,
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
) -> ProjectOut:
    p = project_service.update_project(db, project, body)
    return project_service.project_to_out(p)


@router.post("/{project_id}/reports/generate", response_model=ProjectReportPackageOut)
def generate_project_reports(
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
) -> ProjectReportPackageOut:
    """Forecast, root causes, recommendations, and multi-format exports under outputs/reports/{job_id}/."""
    try:
        payload = generate_project_report_package(
            db,
            project.id,
            project.name,
            get_settings(),
        )
        return ProjectReportPackageOut.model_validate(payload)
    except Exception as exc:
        logger.exception("Report package generation failed project_id=%s", project.id)
        raise HTTPException(status_code=500, detail="Report generation failed") from exc


@router.get("/{project_id}/reports/history", response_model=list[ReportRunSummaryOut])
def list_project_report_history(
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
) -> list[ReportRunSummaryOut]:
    rows = (
        db.query(ProjectReportRun)
        .filter(ProjectReportRun.project_id == project.id)
        .order_by(ProjectReportRun.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        ReportRunSummaryOut(
            job_id=r.id,
            created_at=r.created_at,
            rag_status=r.rag_status,
            forecast_headline=r.forecast_headline,
        )
        for r in rows
    ]


@router.get("/{project_id}/reports/{job_id}/download/{artifact}")
def download_project_report_artifact(
    job_id: str,
    artifact: str,
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
) -> FileResponse:
    """Stream a generated file; requires prior successful generation for this job and project."""
    row = (
        db.query(ProjectReportRun)
        .filter(ProjectReportRun.id == job_id, ProjectReportRun.project_id == project.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Report job not found for this project")
    settings = get_settings()
    try:
        path = resolve_report_artifact_path(settings, job_id, artifact)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not available (generation may have failed for this format)")
    suffix = Path(artifact).suffix.lower()
    media = _REPORT_MIME.get(suffix, "application/octet-stream")
    return FileResponse(path, filename=artifact, media_type=media)


@router.get("/{project_id}/analytics/intelligence", response_model=ProjectIntelligenceOut)
def get_project_intelligence(
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
) -> ProjectIntelligenceOut:
    """Forecast (completion, budget, risk, resources), root causes, and evidence-linked recommendations."""
    try:
        health = build_project_health_payload(db, project.id, get_settings())
        core = build_intelligence_core(health)
        return ProjectIntelligenceOut(
            project_id=project.id,
            project_name=project.name,
            data_complete=bool(health.get("data_complete")),
            missing_roles=list(health.get("missing_roles") or []),
            forecast=core["forecast"],
            root_causes=core["root_causes"],
            recommendations=core["recommendations"],
        )
    except Exception as exc:
        logger.exception("Project intelligence failed project_id=%s", project.id)
        raise HTTPException(status_code=500, detail="Intelligence computation failed") from exc


@router.get("/{project_id}/analytics/health")
def get_project_health_analytics(
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
) -> dict:
    """KPI, EVM, risk, milestones, resources, dependencies, RAG — from last validated ingested uploads."""
    try:
        return build_project_health_payload(db, project.id, get_settings())
    except Exception as exc:
        logger.exception("Project health analytics failed project_id=%s", project.id)
        raise HTTPException(status_code=500, detail="Analytics computation failed") from exc


@router.get("/{project_id}/files", response_model=list[ProjectFileOut])
def list_project_files(
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
) -> list[ProjectFileOut]:
    rows = db.query(ProjectFile).filter(ProjectFile.project_id == project.id).order_by(ProjectFile.uploaded_at.desc()).all()
    return [ProjectFileOut.model_validate(r) for r in rows]


@router.post("/{project_id}/uploads/analyze", response_model=AnalyzeUploadResponse)
async def analyze_uploads(
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
    status_tracker: UploadFile | None = File(None),
    raid_log: UploadFile | None = File(None),
    weekly_history: UploadFile | None = File(None),
) -> AnalyzeUploadResponse:
    files_by_role: dict[str, tuple[bytes, str]] = {}
    for upload, role in (
        (status_tracker, "status_tracker"),
        (raid_log, "raid_log"),
        (weekly_history, "weekly_history"),
    ):
        if upload is None:
            continue
        raw_name = upload.filename or ""
        if not raw_name.strip():
            continue
        content = await upload.read()
        if not content:
            continue
        files_by_role[role] = (content, raw_name)

    if not files_by_role:
        raise HTTPException(status_code=400, detail="Attach at least one file (status_tracker, raid_log, or weekly_history).")

    return project_service.analyze_uploads(db, project, files_by_role)
