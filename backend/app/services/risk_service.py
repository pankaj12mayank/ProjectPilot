"""Registered project risks (manual) — linked to project and optionally to a report run."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Project, ProjectReportRun, ProjectRisk, User
from app.schemas.project_risk import ProjectRiskCreate, ProjectRiskUpdate
from app.services import project_service

ALLOWED_SEVERITY = frozenset({"low", "medium", "high"})
ALLOWED_STATUS = frozenset({"open", "closed"})


def _norm_sev(s: str) -> str:
    x = (s or "medium").strip().lower()
    return x if x in ALLOWED_SEVERITY else "medium"


def _norm_status(s: str) -> str:
    x = (s or "open").strip().lower()
    return x if x in ALLOWED_STATUS else "open"


def _validate_report_link(db: Session, project_id: str, report_run_id: str | None) -> None:
    if not report_run_id:
        return
    run = db.get(ProjectReportRun, report_run_id)
    if run is None or run.project_id != project_id:
        raise HTTPException(status_code=400, detail="That report job does not belong to this project.")


def list_risks_for_project(db: Session, project_id: str) -> list[ProjectRisk]:
    return list(
        db.scalars(
            select(ProjectRisk)
            .where(ProjectRisk.project_id == project_id)
            .order_by(ProjectRisk.created_at.desc()),
        ).all(),
    )


def list_registered_risk_dicts(db: Session, project_id: str) -> list[dict]:
    rows = list_risks_for_project(db, project_id)
    return [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "severity": r.severity,
            "status": r.status,
            "report_run_id": r.report_run_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


def create_risk(db: Session, project: Project, actor: User, body: ProjectRiskCreate) -> ProjectRisk:
    _validate_report_link(db, project.id, body.report_run_id)
    now = datetime.now(timezone.utc)
    row = ProjectRisk(
        id=str(uuid.uuid4()),
        project_id=project.id,
        title=body.title.strip(),
        description=(body.description.strip() if body.description else None) or None,
        severity=_norm_sev(str(body.severity)),
        status=_norm_status(str(body.status)),
        report_run_id=body.report_run_id,
        created_by=actor.id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_risk(db: Session, project_id: str, risk_id: str, body: ProjectRiskUpdate) -> ProjectRisk:
    row = db.get(ProjectRisk, risk_id)
    if row is None or row.project_id != project_id:
        raise HTTPException(status_code=404, detail="Risk not found")
    if body.report_run_id is not None:
        _validate_report_link(db, project_id, body.report_run_id)
    data = body.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        row.title = str(data["title"]).strip()
    if "description" in data:
        d = data["description"]
        row.description = (str(d).strip() if d else None) or None
    if "severity" in data and data["severity"] is not None:
        row.severity = _norm_sev(str(data["severity"]))
    if "status" in data and data["status"] is not None:
        row.status = _norm_status(str(data["status"]))
    if "report_run_id" in data:
        row.report_run_id = data["report_run_id"]
    row.updated_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_open_risks_for_viewer(db: Session, viewer: User, *, limit: int = 40) -> list[dict]:
    projects = project_service.list_projects_for_user(db, viewer)
    ids = [p.id for p in projects]
    if not ids:
        return []
    lim = max(1, min(limit, 100))
    risks = list(
        db.scalars(
            select(ProjectRisk)
            .where(ProjectRisk.project_id.in_(ids), ProjectRisk.status == "open")
            .order_by(ProjectRisk.created_at.desc())
            .limit(lim),
        ).all(),
    )
    names = {p.id: p.name for p in db.scalars(select(Project).where(Project.id.in_(ids))).all()}
    out: list[dict] = []
    for r in risks:
        out.append(
            {
                "risk_id": r.id,
                "project_id": r.project_id,
                "project_name": names.get(r.project_id, "Project"),
                "title": r.title,
                "severity": r.severity,
                "status": r.status,
                "report_run_id": r.report_run_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            },
        )
    return out
