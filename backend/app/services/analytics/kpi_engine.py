"""KPI calculations from status and weekly history."""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from app.constants.columns import StatusColumns, WeeklyHistoryColumns
from app.services.analytics.safe_numeric import finite_float, safe_mean, safe_sum

logger = logging.getLogger(__name__)

_EMPTY: dict[str, Any] = {
    "completion_pct": None,
    "schedule_variance_sum": None,
    "effort_variance_sum": None,
    "cost_variance_sum": None,
    "tasks_on_track": None,
    "tasks_at_risk": None,
    "tasks_ahead": None,
    "weekly_trend_slope": None,
    "last_reported_completion": None,
}


def compute_kpis(status_df: pd.DataFrame | None, history_df: pd.DataFrame | None) -> dict[str, Any]:
    out = dict(_EMPTY)
    try:
        if status_df is None or status_df.empty:
            return out
        df = status_df.copy()
        req = {
            StatusColumns.PLANNED_PCT,
            StatusColumns.ACTUAL_PCT,
            StatusColumns.PLANNED_HOURS,
            StatusColumns.ACTUAL_HOURS,
        }
        if not req.issubset(set(df.columns)):
            return out
        df = df.dropna(how="all")
        if df.empty:
            return out

        ap = pd.to_numeric(df[StatusColumns.ACTUAL_PCT], errors="coerce")
        pp = pd.to_numeric(df[StatusColumns.PLANNED_PCT], errors="coerce")
        ah = pd.to_numeric(df[StatusColumns.ACTUAL_HOURS], errors="coerce")
        ph = pd.to_numeric(df[StatusColumns.PLANNED_HOURS], errors="coerce")

        out["completion_pct"] = safe_mean(ap)

        df["sv_pct"] = ap - pp
        df["ev_hours"] = ah - ph
        out["schedule_variance_sum"] = safe_sum(df["sv_pct"])
        out["effort_variance_sum"] = safe_sum(df["ev_hours"])

        d = df["sv_pct"]
        mask_ahead = d.notna() & (d > 2)
        mask_risk = d.notna() & (d < -5)
        mask_on = d.notna() & ~mask_ahead & ~mask_risk
        out["tasks_on_track"] = int(mask_on.sum())
        out["tasks_at_risk"] = int(mask_risk.sum())
        out["tasks_ahead"] = int(mask_ahead.sum())

        budget_cost = {StatusColumns.PLANNED_BUDGET, StatusColumns.ACTUAL_COST}
        if budget_cost.issubset(set(df.columns)):
            pb = pd.to_numeric(df[StatusColumns.PLANNED_BUDGET], errors="coerce")
            ac = pd.to_numeric(df[StatusColumns.ACTUAL_COST], errors="coerce")
            out["cost_variance_sum"] = safe_sum(ac - pb)

        if history_df is not None and not history_df.empty:
            h = history_df.copy()
            if WeeklyHistoryColumns.COMPLETION in h.columns and len(h) >= 1:
                y = pd.to_numeric(h[WeeklyHistoryColumns.COMPLETION], errors="coerce")
                if y.notna().any():
                    last = finite_float(y.iloc[-1])
                    out["last_reported_completion"] = last
                if len(h) >= 2 and y.notna().sum() >= 2:
                    slope = finite_float(pd.Series(y).diff().mean())
                    out["weekly_trend_slope"] = slope
    except Exception:
        logger.exception("compute_kpis failed")
        return dict(_EMPTY)
    return out
