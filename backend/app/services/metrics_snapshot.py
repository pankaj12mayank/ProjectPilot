"""Compact health metrics for portfolio history / snapshots."""

from __future__ import annotations

import json
from typing import Any


def compact_metrics_from_health(health: dict[str, Any]) -> dict[str, Any]:
    kpis = health.get("kpis") or {}
    evm = health.get("evm") or {}
    risk = health.get("risk") or {}
    rag = health.get("rag") or {}
    return {
        "rag": rag.get("status"),
        "completion_pct": kpis.get("completion_pct"),
        "schedule_variance_sum": kpis.get("schedule_variance_sum"),
        "effort_variance_sum": kpis.get("effort_variance_sum"),
        "cost_variance_sum": kpis.get("cost_variance_sum"),
        "risk_score": risk.get("risk_score"),
        "spi": evm.get("spi"),
        "cpi": evm.get("cpi"),
        "data_complete": health.get("data_complete"),
    }


def snapshot_metrics_json(health: dict[str, Any]) -> str:
    return json.dumps(compact_metrics_from_health(health), default=str)
