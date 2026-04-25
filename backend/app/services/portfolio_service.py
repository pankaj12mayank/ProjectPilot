"""Portfolio overview, cross-project comparison, and report history."""

from __future__ import annotations

import json
import logging
import uuid
from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.constants.roles import ROLES_WITH_ALL_PROJECTS_READ
from app.db.models import Project, ProjectMetricsSnapshot, ProjectReportRun, User
logger = logging.getLogger(__name__)

_SNAPSHOT_LIMIT = 24


def _projects_scope(db: Session, viewer: User) -> list[Project]:
    if viewer.role in ROLES_WITH_ALL_PROJECTS_READ:
        return list(db.scalars(select(Project).order_by(Project.updated_at.desc())).all())
    from app.services import project_service

    return project_service.list_projects_for_user(db, viewer)


def _latest_snapshot(db: Session, project_id: str) -> ProjectMetricsSnapshot | None:
    return db.scalars(
        select(ProjectMetricsSnapshot)
        .where(ProjectMetricsSnapshot.project_id == project_id)
        .order_by(ProjectMetricsSnapshot.created_at.desc())
        .limit(1),
    ).first()


def _snapshot_series(db: Session, project_id: str, limit: int = _SNAPSHOT_LIMIT) -> list[ProjectMetricsSnapshot]:
    return list(
        db.scalars(
            select(ProjectMetricsSnapshot)
            .where(ProjectMetricsSnapshot.project_id == project_id)
            .order_by(ProjectMetricsSnapshot.created_at.desc())
            .limit(limit),
        ).all(),
    )[::-1]


def _parse_metrics(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {}


def build_portfolio_dashboard(db: Session, viewer: User) -> dict[str, Any]:
    projects = _projects_scope(db, viewer)
    overview: list[dict[str, Any]] = []
    trends: dict[str, list[dict[str, Any]]] = {}

    for p in projects:
        snap = _latest_snapshot(db, p.id)
        m: dict[str, Any] = _parse_metrics(snap.metrics_json) if snap else {}
        overview.append(
            {
                "project_id": p.id,
                "name": p.name,
                "owner_id": p.owner_id,
                "is_archived": p.is_archived,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                "latest_rag": m.get("rag"),
                "latest_completion_pct": m.get("completion_pct"),
                "latest_spi": m.get("spi"),
                "latest_cpi": m.get("cpi"),
                "latest_risk_score": m.get("risk_score"),
                "last_snapshot_at": snap.created_at.isoformat() if snap else None,
                "data_complete": m.get("data_complete"),
            },
        )
        series = _snapshot_series(db, p.id)
        trends[p.id] = [
            {
                "captured_at": s.created_at.isoformat(),
                "source": s.source,
                **_parse_metrics(s.metrics_json),
            }
            for s in series
        ]

    return {"projects": overview, "trends": trends}


def build_cross_project_comparison(db: Session, viewer: User) -> dict[str, Any]:
    """Tabular latest metrics plus normalized ranks (0–1) for PMO comparison."""
    dash = build_portfolio_dashboard(db, viewer)
    rows_in = dash["projects"]
    if not rows_in:
        return {"rows": [], "trends": dash.get("trends", {})}

    def rank_key(items: list[tuple[str, float | None]], higher_is_better: bool) -> dict[str, float]:
        vals = [(pid, float(v)) for pid, v in items if v is not None and isinstance(v, (int, float))]
        if not vals:
            return {}
        sorted_vals = sorted(vals, key=lambda x: x[1], reverse=higher_is_better)
        n = len(sorted_vals)
        out: dict[str, float] = {}
        for i, (pid, _) in enumerate(sorted_vals):
            out[pid] = 1.0 if n == 1 else round((n - 1 - i) / (n - 1), 3)
        return out

    completion_items = [(r["project_id"], r.get("latest_completion_pct")) for r in rows_in]
    spi_items = [(r["project_id"], r.get("latest_spi")) for r in rows_in]
    risk_items = [(r["project_id"], r.get("latest_risk_score")) for r in rows_in]

    rc = rank_key(completion_items, higher_is_better=True)
    rs = rank_key(spi_items, higher_is_better=True)
    rr = rank_key(risk_items, higher_is_better=False)
    rows: list[dict[str, Any]] = []
    for r in rows_in:
        pid = r["project_id"]
        rows.append(
            {
                **r,
                "rank_completion_pct": rc.get(pid),
                "rank_spi": rs.get(pid),
                "rank_risk_score": rr.get(pid),
            },
        )
    return {"rows": rows, "trends": dash["trends"]}


def build_portfolio_report_history(
    db: Session,
    viewer: User,
    limit: int = 100,
    project_id: str | None = None,
) -> list[dict[str, Any]]:
    project_ids = [p.id for p in _projects_scope(db, viewer)]
    if not project_ids:
        return []
    if project_id and project_id not in project_ids:
        return []
    q = (
        db.query(ProjectReportRun, Project.name)
        .join(Project, Project.id == ProjectReportRun.project_id)
        .filter(ProjectReportRun.project_id.in_(project_ids))
    )
    if project_id:
        q = q.filter(ProjectReportRun.project_id == project_id)
    rows = q.order_by(ProjectReportRun.created_at.desc()).limit(limit).all()
    out: list[dict[str, Any]] = []
    for run, pname in rows:
        out.append(
            {
                "job_id": run.id,
                "project_id": run.project_id,
                "project_name": pname,
                "created_at": run.created_at.isoformat(),
                "rag_status": run.rag_status,
                "forecast_headline": run.forecast_headline,
            },
        )
    return out


def list_project_metrics_snapshots(db: Session, project_id: str, *, limit: int = 50) -> list[ProjectMetricsSnapshot]:
    lim = max(1, min(limit, 200))
    return list(
        db.scalars(
            select(ProjectMetricsSnapshot)
            .where(ProjectMetricsSnapshot.project_id == project_id)
            .order_by(ProjectMetricsSnapshot.created_at.desc())
            .limit(lim),
        ).all(),
    )


def record_manual_snapshot(
    db: Session,
    project_id: str,
    health: dict[str, Any],
    settings: Settings | None = None,
) -> dict[str, Any]:
    from app.config.settings import get_settings
    from app.services.metrics_snapshot import snapshot_metrics_json
    from app.services.snapshot_storage import write_metrics_snapshot_file

    settings = settings or get_settings()

    row = ProjectMetricsSnapshot(
        id=str(uuid.uuid4()),
        project_id=project_id,
        report_run_id=None,
        source="manual_refresh",
        metrics_json=snapshot_metrics_json(health),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    try:
        write_metrics_snapshot_file(settings, row)
    except Exception:
        logger.exception("Disk snapshot write failed project_id=%s snapshot_id=%s", project_id, row.id)
    return {"snapshot_id": row.id, "created_at": row.created_at.isoformat()}


def build_portfolio_summary(db: Session, viewer: User) -> dict[str, Any]:
    """Aggregate counts, RAG distribution, average risk, and top risky projects (latest snapshot per project)."""
    dash = build_portfolio_dashboard(db, viewer)
    rows = dash["projects"]
    by_rag: Counter[str] = Counter()
    risk_pairs: list[tuple[str, str, int, str | None]] = []
    for r in rows:
        rag = str(r.get("latest_rag") or "Unknown")
        by_rag[rag] += 1
        rs = r.get("latest_risk_score")
        if rs is not None:
            try:
                risk_pairs.append((r["project_id"], r["name"], int(rs), r.get("latest_rag")))
            except (TypeError, ValueError):
                continue
    risk_pairs.sort(key=lambda x: -x[2])
    avg_risk = sum(x[2] for x in risk_pairs) / len(risk_pairs) if risk_pairs else None
    return {
        "totals": {"projects": len(rows)},
        "by_rag": dict(by_rag),
        "average_risk_score": None if avg_risk is None else round(avg_risk, 2),
        "top_risky_projects": [
            {"project_id": a, "name": b, "risk_score": c, "rag": d}
            for a, b, c, d in risk_pairs[:10]
        ],
        "projects": rows,
    }


def _spi_stress(spi: float | None) -> float | None:
    if spi is None:
        return None
    try:
        s = float(spi)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, (0.95 - s) / 0.25))


def build_risk_heatmap(db: Session, viewer: User) -> dict[str, Any]:
    """Per-project normalized cells for portfolio risk heatmap (0 = calm, 1 = hot)."""
    dash = build_portfolio_dashboard(db, viewer)
    rows_in = dash["projects"]
    if not rows_in:
        return {"projects": [], "dimensions": ["risk", "schedule_stress", "cost_stress", "rag_stress"]}

    rs_vals: list[int] = []
    for r in rows_in:
        v = r.get("latest_risk_score")
        if v is not None:
            try:
                rs_vals.append(int(v))
            except (TypeError, ValueError):
                continue

    def norm_risk(v: int | None) -> float | None:
        if v is None or not rs_vals:
            return None
        lo, hi = min(rs_vals), max(rs_vals)
        if hi == lo:
            return 0.5
        return round((float(v) - lo) / (hi - lo), 3)

    rag_map = {"Green": 0.0, "Amber": 0.55, "Red": 1.0}

    out: list[dict[str, Any]] = []
    for r in rows_in:
        rs = r.get("latest_risk_score")
        rsi: int | None
        try:
            rsi = int(rs) if rs is not None else None
        except (TypeError, ValueError):
            rsi = None
        rag = r.get("latest_rag")
        rag_s = str(rag) if rag is not None else None
        out.append(
            {
                "project_id": r["project_id"],
                "name": r["name"],
                "raw": {
                    "risk_score": rsi,
                    "spi": r.get("latest_spi"),
                    "cpi": r.get("latest_cpi"),
                    "rag": rag_s,
                },
                "heatmap": {
                    "risk": norm_risk(rsi),
                    "schedule_stress": _spi_stress(r.get("latest_spi")),
                    "cost_stress": _spi_stress(r.get("latest_cpi")),
                    "rag_stress": rag_map.get(rag_s or "", 0.3),
                },
            },
        )
    return {
        "projects": out,
        "dimensions": ["risk", "schedule_stress", "cost_stress", "rag_stress"],
    }
