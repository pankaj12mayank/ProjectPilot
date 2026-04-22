"""Assemble KPI, EVM, risk, milestone, resource, dependency, and RAG analytics for a project."""

from __future__ import annotations

import logging
import math
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.constants.columns import WeeklyHistoryColumns
from app.services.analytics.dependency_engine import compute_dependencies
from app.services.analytics.evm_engine import compute_evm
from app.services.analytics.kpi_engine import compute_kpis
from app.services.analytics.loader import load_role_dataframe
from app.services.analytics.milestone_engine import compute_milestones
from app.services.analytics.rag_engine import compute_rag
from app.services.analytics.resource_engine import compute_resources
from app.services.analytics.risk_engine import compute_risk

logger = logging.getLogger(__name__)


def _chart_spi_cpi(evm: dict[str, Any]) -> dict[str, float]:
    def pick(key: str) -> float:
        v = evm.get(key)
        try:
            x = float(v) if v is not None else 0.0
        except (TypeError, ValueError):
            return 0.0
        return x if math.isfinite(x) else 0.0

    return {"spi": pick("spi"), "cpi": pick("cpi")}


def _weekly_series(history_df: pd.DataFrame | None) -> list[dict[str, Any]]:
    try:
        if history_df is None or history_df.empty:
            return []
        h = history_df.copy()
        if WeeklyHistoryColumns.WEEK not in h.columns or WeeklyHistoryColumns.COMPLETION not in h.columns:
            return []
        rows: list[dict[str, Any]] = []
        for _, row in h.iterrows():
            w = row.get(WeeklyHistoryColumns.WEEK)
            c = pd.to_numeric(row.get(WeeklyHistoryColumns.COMPLETION), errors="coerce")
            rows.append(
                {
                    "week": str(w) if pd.notna(w) else "",
                    "completion": float(c) if pd.notna(c) else None,
                },
            )
        return rows
    except Exception:
        logger.exception("_weekly_series failed")
        return []


def _severity_chart(risk: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        by = risk.get("by_severity") or {}
        out: list[dict[str, Any]] = []
        for k, v in sorted(by.items(), key=lambda x: -float(x[1] or 0)):
            try:
                out.append({"name": str(k), "value": int(float(v))})
            except (TypeError, ValueError):
                continue
        return out
    except Exception:
        logger.exception("_severity_chart failed")
        return []


def _resource_chart(resources: dict[str, Any]) -> dict[str, Any]:
    tasks = resources.get("by_task") or []
    labels = [t.get("task", "—")[:24] for t in tasks[:12]]
    planned = [t.get("planned_hours") or 0 for t in tasks[:12]]
    actual = [t.get("actual_hours") or 0 for t in tasks[:12]]
    return {"labels": labels, "planned": planned, "actual": actual}


def build_project_health_payload(db: Session, project_id: str, settings: Settings) -> dict[str, Any]:
    try:
        status_df = load_role_dataframe(db, project_id, "status_tracker")
        raid_df = load_role_dataframe(db, project_id, "raid_log")
        history_df = load_role_dataframe(db, project_id, "weekly_history")

        missing: list[str] = []
        if status_df is None or status_df.empty:
            missing.append("status_tracker")
        if raid_df is None or raid_df.empty:
            missing.append("raid_log")
        if history_df is None or history_df.empty:
            missing.append("weekly_history")

        kpis = compute_kpis(status_df, history_df)
        evm = compute_evm(status_df)
        risk = compute_risk(status_df, raid_df)
        milestones = compute_milestones(status_df)
        resources = compute_resources(status_df)
        dependencies = compute_dependencies(status_df)

        sv = kpis.get("schedule_variance_sum")
        rag_detail = compute_rag(
            sv if sv is not None else 0.0,
            int(risk.get("risk_score") or 0),
            settings.rag_thresholds(),
        )

        comp = kpis.get("completion_pct")
        try:
            cg = max(0.0, min(100.0, float(comp or 0.0)))
            if not math.isfinite(cg):
                cg = 0.0
        except (TypeError, ValueError):
            cg = 0.0

        charts = {
            "weekly_completion": _weekly_series(history_df),
            "severity_distribution": _severity_chart(risk),
            "resource_hours": _resource_chart(resources),
            "completion_gauge": {"value": cg},
            "spi_cpi": _chart_spi_cpi(evm),
        }

        data_complete = len(missing) == 0

        return {
            "project_id": project_id,
            "data_complete": data_complete,
            "missing_roles": missing,
            "forecast_thresholds": settings.rag_thresholds(),
            "rag": rag_detail,
            "kpis": kpis,
            "evm": evm,
            "risk": risk,
            "milestones": milestones,
            "resources": resources,
            "dependencies": dependencies,
            "charts": charts,
        }
    except Exception:
        logger.exception("build_project_health_payload failed project_id=%s", project_id)
        return {
            "project_id": project_id,
            "data_complete": False,
            "missing_roles": ["status_tracker", "raid_log", "weekly_history"],
            "forecast_thresholds": settings.rag_thresholds(),
            "rag": {
                "status": "Green",
                "reasons": ["Analytics could not be computed from stored data. Re-upload validated files."],
                "inputs": {"risk_score": 0, "schedule_variance_sum_pct_points": 0.0, "thresholds": {}},
            },
            "kpis": {},
            "evm": {},
            "risk": {},
            "milestones": {},
            "resources": {},
            "dependencies": {},
            "charts": {
                "weekly_completion": [],
                "severity_distribution": [],
                "resource_hours": {"labels": [], "planned": [], "actual": []},
                "completion_gauge": {"value": 0},
                "spi_cpi": {"spi": 0, "cpi": 0},
            },
        }
