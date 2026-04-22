"""RAID-based risk summaries and scoring."""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any

import pandas as pd

from app.constants.columns import RaidColumns
from app.services import calculations

logger = logging.getLogger(__name__)

_EMPTY: dict[str, Any] = {
    "risk_score": 0,
    "high_risk_count": 0,
    "high_severity_open_count": 0,
    "open_risk_count": 0,
    "by_severity": {},
    "by_type": {},
    "by_status": {},
    "open_high_risks": [],
    "total_items": 0,
}


def _norm(s: pd.Series) -> pd.Series:
    return s.astype(str).str.strip().str.casefold()


def compute_risk(_status_df: pd.DataFrame | None, raid_df: pd.DataFrame | None) -> dict[str, Any]:
    out = dict(_EMPTY)
    try:
        if raid_df is None or raid_df.empty:
            return out
        req = {RaidColumns.TYPE, RaidColumns.SEVERITY, RaidColumns.STATUS}
        if not req.issubset(set(raid_df.columns)):
            return out
        df = raid_df.dropna(how="all").copy()
        if df.empty:
            return out
        out["total_items"] = int(len(df))
        try:
            out["risk_score"] = int(calculations.calculate_risk_score(df))
        except Exception:
            logger.exception("calculate_risk_score failed")
            out["risk_score"] = 0

        out["high_risk_count"] = int(out["risk_score"])

        high_open = _norm(df[RaidColumns.SEVERITY]).eq("high") & _norm(df[RaidColumns.STATUS]).eq("open")
        open_risk = _norm(df[RaidColumns.TYPE]).eq("risk") & _norm(df[RaidColumns.STATUS]).eq("open")
        out["high_severity_open_count"] = int(high_open.sum())
        out["open_risk_count"] = int(open_risk.sum())

        try:
            out["by_severity"] = dict(Counter(_norm(df[RaidColumns.SEVERITY])))
            out["by_type"] = dict(Counter(_norm(df[RaidColumns.TYPE])))
            out["by_status"] = dict(Counter(_norm(df[RaidColumns.STATUS])))
        except Exception:
            logger.exception("risk counters failed")

        mask = (
            _norm(df[RaidColumns.TYPE]).eq("risk")
            & _norm(df[RaidColumns.SEVERITY]).eq("high")
            & _norm(df[RaidColumns.STATUS]).eq("open")
        )
        open_high = df.loc[mask]
        for _, row in open_high.head(15).iterrows():
            parts = [
                f"{c}: {row.get(c, '')}"
                for c in (RaidColumns.TYPE, RaidColumns.SEVERITY, RaidColumns.STATUS)
                if c in row.index
            ]
            label = " · ".join(parts)[:220]
            out["open_high_risks"].append({"summary": label})
    except Exception:
        logger.exception("compute_risk failed")
        return dict(_EMPTY)
    return out
