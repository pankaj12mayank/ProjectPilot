"""Resource view: planned vs actual effort."""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from app.constants.columns import StatusColumns
from app.services.analytics.safe_numeric import finite_float, safe_sum

logger = logging.getLogger(__name__)

_EMPTY: dict[str, Any] = {
    "total_planned_hours": None,
    "total_actual_hours": None,
    "variance_hours": None,
    "utilization_ratio": None,
    "by_task": [],
}


def compute_resources(status_df: pd.DataFrame | None, limit: int = 25) -> dict[str, Any]:
    out = dict(_EMPTY)
    try:
        if status_df is None or status_df.empty:
            return out
        need = {StatusColumns.PLANNED_HOURS, StatusColumns.ACTUAL_HOURS}
        if not need.issubset(set(status_df.columns)):
            return out
        df = status_df.dropna(how="all").copy()
        if df.empty:
            return out
        df["_ph"] = pd.to_numeric(df[StatusColumns.PLANNED_HOURS], errors="coerce")
        df["_ah"] = pd.to_numeric(df[StatusColumns.ACTUAL_HOURS], errors="coerce")
        tph = safe_sum(df["_ph"])
        tah = safe_sum(df["_ah"])
        out["total_planned_hours"] = tph
        out["total_actual_hours"] = tah
        if tph is not None and tah is not None:
            out["variance_hours"] = finite_float(tah - tph)
        if tph not in (None, 0) and tah is not None:
            out["utilization_ratio"] = finite_float(tah / tph)

        df["_dv"] = (df["_ah"] - df["_ph"]).abs()
        task_col = StatusColumns.TASK if StatusColumns.TASK in df.columns else None
        if not df["_dv"].notna().any():
            return out
        top = df.nlargest(min(limit, len(df)), "_dv", keep="all").head(limit)
        for _, row in top.iterrows():
            name = str(row[task_col])[:100] if task_col and pd.notna(row.get(task_col)) else "—"
            ph = row["_ph"]
            ah = row["_ah"]
            out["by_task"].append(
                {
                    "task": name,
                    "planned_hours": None if pd.isna(ph) else finite_float(ph),
                    "actual_hours": None if pd.isna(ah) else finite_float(ah),
                    "delta_hours": None
                    if pd.isna(ah) or pd.isna(ph)
                    else finite_float(float(ah) - float(ph)),
                },
            )
    except Exception:
        logger.exception("compute_resources failed")
        return dict(_EMPTY)
    return out
