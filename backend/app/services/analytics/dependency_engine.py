"""Sequential dependency baseline with per-link slip metrics from uploaded task % columns."""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from app.constants.columns import StatusColumns
from app.services.analytics.safe_numeric import finite_float

logger = logging.getLogger(__name__)

_EMPTY: dict[str, Any] = {
    "mode": "none",
    "note": "",
    "nodes": [],
    "edges": [],
    "edge_delays": [],
    "total_dependency_slip_pct": None,
}


def compute_dependencies(status_df: pd.DataFrame | None, max_nodes: int = 24) -> dict[str, Any]:
    out = dict(_EMPTY)
    try:
        if status_df is None or status_df.empty or StatusColumns.TASK not in status_df.columns:
            out["note"] = "No task names available; upload a status tracker with a Task column for a simple chain view."
            return out

        sub = status_df.dropna(subset=[StatusColumns.TASK], how="any").head(max_nodes).copy()
        labels: list[str] = []
        for t in sub[StatusColumns.TASK]:
            s = str(t).strip()[:80]
            labels.append(s if s else "(unnamed)")
        if len(labels) < 2:
            out["note"] = "Need at least two tasks to infer a sequential chain."
            return out

        out["mode"] = "sequential_baseline"
        out["note"] = (
            "Dependencies are inferred as a sequential chain in spreadsheet order. "
            "Per-link delay uses the successor task’s slip: max(0, Planned% − Actual%)."
        )
        n = len(sub)
        for i in range(n):
            out["nodes"].append({"id": str(i), "label": labels[i]})
        for i in range(1, n):
            out["edges"].append({"from": str(i - 1), "to": str(i), "type": "finish_to_start_placeholder"})

        slips: list[float] = []
        if {StatusColumns.PLANNED_PCT, StatusColumns.ACTUAL_PCT}.issubset(set(sub.columns)):
            sub["_p"] = pd.to_numeric(sub[StatusColumns.PLANNED_PCT], errors="coerce")
            sub["_a"] = pd.to_numeric(sub[StatusColumns.ACTUAL_PCT], errors="coerce")
            for i in range(1, n):
                row = sub.iloc[i]
                p, a = row.get("_p"), row.get("_a")
                slip = None
                if pd.notna(p) and pd.notna(a):
                    slip = max(0.0, float(p) - float(a))
                    slips.append(slip)
                fr = labels[i - 1]
                to = labels[i]
                out["edge_delays"].append(
                    {
                        "from_label": fr,
                        "to_label": to,
                        "successor_slip_pct": finite_float(slip) if slip is not None else None,
                    },
                )
        if slips:
            out["total_dependency_slip_pct"] = finite_float(sum(slips))
    except Exception:
        logger.exception("compute_dependencies failed")
        return dict(_EMPTY)
    return out
