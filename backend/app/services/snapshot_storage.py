"""Persist metrics snapshots under outputs/snapshots/{project_id}/ (JSON with project_id + timestamp)."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config.settings import Settings
from app.db.models import ProjectMetricsSnapshot

logger = logging.getLogger(__name__)

SNAPSHOT_SUBDIR = "snapshots"


def snapshot_dir_for_project(settings: Settings, project_id: str) -> Path:
    return (settings.outputs_dir / SNAPSHOT_SUBDIR / project_id).resolve()


def write_metrics_snapshot_file(settings: Settings, snap: ProjectMetricsSnapshot) -> None:
    """Best-effort JSON file alongside DB row; filename includes UTC time + snapshot id."""
    base = snapshot_dir_for_project(settings, snap.project_id)
    try:
        base.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        logger.warning("Could not create snapshot directory %s: %s", base, exc)
        return

    ts = snap.created_at.strftime("%Y%m%dT%H%M%SZ") if snap.created_at else "unknown"
    path = base / f"{ts}_{snap.id}.json"
    try:
        metrics_obj = json.loads(snap.metrics_json or "{}")
    except json.JSONDecodeError:
        metrics_obj = {"_parse_error": True, "raw": snap.metrics_json}

    doc = {
        "project_id": snap.project_id,
        "snapshot_id": snap.id,
        "created_at": snap.created_at.isoformat() if snap.created_at else None,
        "source": snap.source,
        "report_run_id": snap.report_run_id,
        "metrics": metrics_obj,
    }
    try:
        path.write_text(json.dumps(doc, indent=2, default=str), encoding="utf-8")
    except OSError:
        logger.exception("Could not write snapshot file %s", path)
