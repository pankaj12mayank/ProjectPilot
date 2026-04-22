"""Treat status tasks as milestones with schedule health and delay aggregates."""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from app.constants.columns import StatusColumns
from app.services.analytics.safe_numeric import finite_float

logger = logging.getLogger(__name__)

_EMPTY: dict[str, Any] = {
    "milestones": [],
    "late_count": 0,
    "ahead_count": 0,
    "on_track_count": 0,
    "delayed_milestone_count": 0,
    "avg_delay_pct_points": None,
    "max_delay_pct_points": None,
}


def compute_milestones(status_df: pd.DataFrame | None, limit: int = 40) -> dict[str, Any]:
    out = dict(_EMPTY)
    try:
        if status_df is None or status_df.empty:
            return out
        need = {StatusColumns.PLANNED_PCT, StatusColumns.ACTUAL_PCT}
        if not need.issubset(set(status_df.columns)):
            return out
        df = status_df.dropna(how="all").copy()
        if df.empty:
            return out
        df["_planned"] = pd.to_numeric(df[StatusColumns.PLANNED_PCT], errors="coerce")
        df["_actual"] = pd.to_numeric(df[StatusColumns.ACTUAL_PCT], errors="coerce")
        df["_delta"] = df["_actual"] - df["_planned"]
        task_col = StatusColumns.TASK if StatusColumns.TASK in df.columns else None
        for i, (_, row) in enumerate(df.iterrows()):
            if i >= limit:
                break
            name = str(row[task_col]) if task_col and pd.notna(row.get(task_col)) else f"Row {i + 1}"
            delta = row["_delta"]
            delay_pts: float | None
            if pd.isna(delta):
                state = "unknown"
                delay_pts = None
            else:
                dv = float(delta)
                ppv, aav = row["_planned"], row["_actual"]
                if pd.notna(ppv) and pd.notna(aav):
                    delay_pts = finite_float(max(0.0, float(ppv) - float(aav)))
                else:
                    delay_pts = None
                if dv < -5:
                    state = "behind"
                    out["late_count"] += 1
                elif dv > 5:
                    state = "ahead"
                    out["ahead_count"] += 1
                else:
                    state = "on_track"
                    out["on_track_count"] += 1
            out["milestones"].append(
                {
                    "name": name[:120],
                    "planned_pct": None if pd.isna(row["_planned"]) else finite_float(row["_planned"]),
                    "actual_pct": None if pd.isna(row["_actual"]) else finite_float(row["_actual"]),
                    "variance_pct": None if pd.isna(delta) else finite_float(delta),
                    "delay_pct_points": delay_pts,
                    "state": state,
                },
            )

        out["delayed_milestone_count"] = int(out["late_count"])
        behind = df["_delta"].dropna()
        behind = behind[behind < 0]
        if len(behind) > 0:
            out["avg_delay_pct_points"] = finite_float(float((-behind).mean()))
            out["max_delay_pct_points"] = finite_float(float((-behind).max()))
    except Exception:
        logger.exception("compute_milestones failed")
        return dict(_EMPTY)
    return out
