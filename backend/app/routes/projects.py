from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.models import Project, ProjectFile, ProjectReportRun, User
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.deps.project import fetch_deletable_project, get_accessible_project, get_owned_project
from app.schemas.project import (
    AnalyzeUploadResponse,
    AssignableUserOut,
    FormatGuideOut,
    ProjectCreate,
    ProjectFileOut,
    ProjectOut,
    ProjectTemplateOut,
    ProjectUpdate,
    format_guide_payload,
)
from app.schemas.portfolio import MetricsSnapshotListItem, MetricsSnapshotOut, ProjectHistoryOut
from app.schemas.reports import ProjectIntelligenceOut, ProjectReportPackageOut, ReportRunSummaryOut
from app.schemas.project_risk import ProjectRiskCreate, ProjectRiskOut, ProjectRiskUpdate
from app.services import event_log_service, project_service, risk_service
from app.services.portfolio_service import list_project_metrics_snapshots, record_manual_snapshot
from app.services.project_history_service import build_project_history
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


def _delete_project_common(db: Session, user: User, project: Project) -> Response:
    """Shared implementation for DELETE and POST delete (some proxies block DELETE → 405)."""
    settings = get_settings()
    pid, pname = project.id, project.name
    project_service.delete_project_and_assets(db, settings, project)
    event_log_service.write_activity(
        db,
        actor_user_id=user.id,
        project_id=None,
        kind="project.delete",
        summary=f"Deleted project {pname}",
        detail={"project_id": pid},
    )
    event_log_service.write_audit(
        db,
        actor_user_id=user.id,
        action="project.delete",
        entity_type="project",
        entity_id=pid,
        detail={"name": pname},
    )
    return Response(status_code=204)


@router.post("", response_model=ProjectOut)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    try:
        p = project_service.create_project(db, user, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    event_log_service.write_activity(
        db,
        actor_user_id=user.id,
        project_id=p.id,
        kind="project.create",
        summary=f"Created project {p.name}",
        detail={"project_id": p.id},
    )
    event_log_service.write_audit(
        db,
        actor_user_id=user.id,
        action="project.create",
        entity_type="project",
        entity_id=p.id,
        detail={"name": p.name},
    )
    meta = project_service.project_list_metadata(db, [p.id]).get(p.id, {})
    return project_service.project_to_out(p, **meta)  # type: ignore[arg-type]


@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProjectOut]:
    rows = project_service.list_projects_for_user(db, user)
    meta = project_service.project_list_metadata(db, [p.id for p in rows])
    return [
        project_service.project_to_out(p, **meta.get(p.id, {}))  # type: ignore[arg-type]
        for p in rows
    ]


@router.get("/creation/assignable-users", response_model=list[AssignableUserOut])
def creation_assignable_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AssignableUserOut]:
    rows = project_service.list_assignable_users(db, user)
    return [AssignableUserOut.model_validate(u) for u in rows]


@router.get("/creation/format-guide", response_model=FormatGuideOut)
def creation_format_guide() -> FormatGuideOut:
    return FormatGuideOut.model_validate(format_guide_payload())


@router.get("/creation/templates", response_model=list[ProjectTemplateOut])
def creation_templates() -> list[ProjectTemplateOut]:
    return [ProjectTemplateOut.model_validate(row) for row in list_template_dicts()]


@router.get("/creation/samples/{role}")
def download_creation_sample(role: str, user: User = Depends(get_current_user)) -> FileResponse:
    _ = user
    settings = get_settings()
    path = project_service.sample_format_csv_path(settings, role)
    if path is None:
        raise HTTPException(status_code=404, detail="Unknown role or sample file missing")
    return FileResponse(
        path,
        filename=f"{role}_sample.csv",
        media_type="text/csv; charset=utf-8",
    )


@router.post("/delete/{project_id}", status_code=204)
def delete_project_post(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Remove a project (POST when DELETE is blocked). Path param must be explicit for reliable DI."""
    project = fetch_deletable_project(db, project_id, user)
    return _delete_project_common(db, user, project)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
) -> ProjectOut:
    meta = project_service.project_list_metadata(db, [project.id]).get(project.id, {})
    return project_service.project_to_out(project, **meta)  # type: ignore[arg-type]


@router.patch("/{project_id}", response_model=ProjectOut)
def patch_project(
    raw: dict[str, Any] = Body(...),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    try:
        body = ProjectUpdate.model_validate(raw)
        p = project_service.update_project(db, project, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    event_log_service.write_activity(
        db,
        actor_user_id=user.id,
        project_id=p.id,
        kind="project.update",
        summary=f"Updated project {p.name}",
        detail={"project_id": p.id},
    )
    event_log_service.write_audit(
        db,
        actor_user_id=user.id,
        action="project.update",
        entity_type="project",
        entity_id=p.id,
        detail={},
    )
    meta = project_service.project_list_metadata(db, [p.id]).get(p.id, {})
    return project_service.project_to_out(p, **meta)  # type: ignore[arg-type]


@router.post("/{project_id}/delete", status_code=204)
def delete_project_post_under_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Same as POST /delete/{id}; matches other /projects/{id}/… sub-routes (avoids some 404 setups)."""
    project = fetch_deletable_project(db, project_id, user)
    return _delete_project_common(db, user, project)


@router.delete("/{project_id}", status_code=204)
def delete_project_route(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    project = fetch_deletable_project(db, project_id, user)
    return _delete_project_common(db, user, project)


@router.post("/{project_id}/reports/generate", response_model=ProjectReportPackageOut)
def generate_project_reports(
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectReportPackageOut:
    """Forecast, root causes, recommendations, and multi-format exports under outputs/reports/{job_id}/."""
    try:
        payload = generate_project_report_package(
            db,
            project.id,
            project.name,
            get_settings(),
            actor_user_id=user.id,
        )
        return ProjectReportPackageOut.model_validate(payload)
    except Exception as exc:
        logger.exception("Report package generation failed project_id=%s", project.id)
        raise HTTPException(status_code=500, detail="Report generation failed") from exc


@router.get("/{project_id}/reports/history", response_model=list[ReportRunSummaryOut])
def list_project_report_history(
    project: Project = Depends(get_accessible_project),
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
    project: Project = Depends(get_accessible_project),
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
    project: Project = Depends(get_accessible_project),
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


@router.get("/{project_id}/history", response_model=ProjectHistoryOut)
def get_project_history(
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
    limit: int = Query(120, ge=1, le=300),
) -> ProjectHistoryOut:
    """Report runs, metric snapshots, and stored generated files — all linked to this project_id."""
    data = build_project_history(db, project, limit=limit)
    return ProjectHistoryOut.model_validate(data)


@router.get("/{project_id}/metrics/snapshots", response_model=list[MetricsSnapshotListItem])
def list_metrics_snapshots(
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> list[MetricsSnapshotListItem]:
    """Stored metrics snapshots for this project (DB + mirror files under outputs/snapshots/{project_id}/)."""
    rows = list_project_metrics_snapshots(db, project.id, limit=limit)
    return [
        MetricsSnapshotListItem(
            snapshot_id=r.id,
            project_id=r.project_id,
            created_at=r.created_at.isoformat(),
            source=r.source,
            report_run_id=r.report_run_id,
        )
        for r in rows
    ]


@router.post("/{project_id}/metrics/snapshot", response_model=MetricsSnapshotOut)
def record_metrics_snapshot(
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MetricsSnapshotOut:
    """Persist a trend point from current ingested data (no full report generation)."""
    health = build_project_health_payload(db, project.id, get_settings())
    out = record_manual_snapshot(db, project.id, health, get_settings())
    event_log_service.write_activity(
        db,
        actor_user_id=user.id,
        project_id=project.id,
        kind="metrics.snapshot",
        summary=f"Recorded metrics snapshot for {project.name}",
        detail={"snapshot_id": out["snapshot_id"]},
    )
    return MetricsSnapshotOut.model_validate(out)


@router.get("/{project_id}/analytics/health")
def get_project_health_analytics(
    project: Project = Depends(get_accessible_project),
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
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
) -> list[ProjectFileOut]:
    rows = db.query(ProjectFile).filter(ProjectFile.project_id == project.id).order_by(ProjectFile.uploaded_at.desc()).all()
    return [ProjectFileOut.model_validate(r) for r in rows]


@router.get("/{project_id}/risks", response_model=list[ProjectRiskOut])
def list_project_risks(
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
) -> list[ProjectRiskOut]:
    rows = risk_service.list_risks_for_project(db, project.id)
    return [ProjectRiskOut.model_validate(r) for r in rows]


@router.post("/{project_id}/risks", response_model=ProjectRiskOut)
def create_project_risk(
    body: ProjectRiskCreate,
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectRiskOut:
    row = risk_service.create_risk(db, project, user, body)
    event_log_service.write_activity(
        db,
        actor_user_id=user.id,
        project_id=project.id,
        kind="risk.create",
        summary=f"Registered risk: {row.title}",
        detail={"risk_id": row.id, "severity": row.severity, "report_run_id": row.report_run_id},
    )
    return ProjectRiskOut.model_validate(row)


@router.patch("/{project_id}/risks/{risk_id}", response_model=ProjectRiskOut)
def update_project_risk(
    risk_id: str,
    body: ProjectRiskUpdate,
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectRiskOut:
    row = risk_service.update_risk(db, project.id, risk_id, body)
    event_log_service.write_activity(
        db,
        actor_user_id=user.id,
        project_id=project.id,
        kind="risk.update",
        summary=f"Updated risk: {row.title}",
        detail={"risk_id": row.id, "severity": row.severity, "status": row.status},
    )
    return ProjectRiskOut.model_validate(row)


@router.post("/{project_id}/uploads/analyze", response_model=AnalyzeUploadResponse)
async def analyze_uploads(
    project: Project = Depends(get_accessible_project),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
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
        raise HTTPException(
            status_code=400,
            detail="Please choose at least one file to upload (status tracker, RAID log, or weekly history).",
        )

    resp = project_service.analyze_uploads(db, project, files_by_role)
    event_log_service.write_activity(
        db,
        actor_user_id=user.id,
        project_id=project.id,
        kind="upload.analyze",
        summary=f"Analyzed uploads for {project.name}",
        detail={"roles": list(files_by_role.keys())},
    )
    return resp
