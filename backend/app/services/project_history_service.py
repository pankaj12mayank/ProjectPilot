"""Unified project timeline: report runs, metric snapshots, generated files (all include project_id)."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import GeneratedReportArtifact, Project, ProjectMetricsSnapshot, ProjectReportRun


def _parse_json(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {}


def build_project_history(db: Session, project: Project, *, limit: int = 120) -> dict[str, Any]:
    """Caller must enforce access (e.g. get_owned_project). Every event carries project_id."""
    project_id = project.id
    events: list[dict[str, Any]] = []

    for run in db.scalars(
        select(ProjectReportRun)
        .where(ProjectReportRun.project_id == project_id)
        .order_by(ProjectReportRun.created_at.desc())
        .limit(limit),
    ).all():
        events.append(
            {
                "type": "report_run",
                "project_id": project_id,
                "at": run.created_at.isoformat(),
                "job_id": run.id,
                "rag_status": run.rag_status,
                "forecast_headline": run.forecast_headline,
            },
        )

    for snap in db.scalars(
        select(ProjectMetricsSnapshot)
        .where(ProjectMetricsSnapshot.project_id == project_id)
        .order_by(ProjectMetricsSnapshot.created_at.desc())
        .limit(limit),
    ).all():
        events.append(
            {
                "type": "metrics_snapshot",
                "project_id": project_id,
                "at": snap.created_at.isoformat(),
                "snapshot_id": snap.id,
                "source": snap.source,
                "report_run_id": snap.report_run_id,
                "metrics": _parse_json(snap.metrics_json),
            },
        )

    for art in db.scalars(
        select(GeneratedReportArtifact)
        .where(GeneratedReportArtifact.project_id == project_id)
        .order_by(GeneratedReportArtifact.created_at.desc())
        .limit(limit),
    ).all():
        events.append(
            {
                "type": "generated_file",
                "project_id": project_id,
                "at": art.created_at.isoformat(),
                "report_run_id": art.report_run_id,
                "artifact_key": art.artifact_key,
                "relative_path": art.relative_path,
            },
        )

    events.sort(key=lambda e: e["at"], reverse=True)
    return {
        "project_id": project_id,
        "project_name": project.name,
        "events": events[:limit],
    }
