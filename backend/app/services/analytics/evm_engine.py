"""Earned value metrics (PV, EV, AC, variances, performance indexes)."""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from app.constants.columns import StatusColumns
from app.services import calculations
from app.services.analytics.safe_numeric import finite_float, safe_sum

logger = logging.getLogger(__name__)

_EMPTY: dict[str, Any] = {
    "bac": None,
    "pv": None,
    "ev": None,
    "ac": None,
    "sv": None,
    "cv": None,
    "cost_variance": None,
    "spi": None,
    "cpi": None,
    "vac": None,
    "tcpi": None,
}


def compute_evm(status_df: pd.DataFrame | None) -> dict[str, Any]:
    out = dict(_EMPTY)
    try:
        if status_df is None or status_df.empty:
            return out
        req = {
            StatusColumns.PLANNED_PCT,
            StatusColumns.ACTUAL_PCT,
            StatusColumns.PLANNED_BUDGET,
            StatusColumns.ACTUAL_COST,
        }
        if not req.issubset(set(status_df.columns)):
            return out
        df = status_df.dropna(how="all").copy()
        if df.empty:
            return out
        for c in req:
            df[c] = pd.to_numeric(df[c], errors="coerce")

        df["PV"] = df[StatusColumns.PLANNED_PCT] * df[StatusColumns.PLANNED_BUDGET]
        df["EV"] = df[StatusColumns.ACTUAL_PCT] * df[StatusColumns.PLANNED_BUDGET]
        df["AC"] = df[StatusColumns.ACTUAL_COST]

        out["bac"] = safe_sum(df[StatusColumns.PLANNED_BUDGET])
        out["pv"] = safe_sum(df["PV"])
        out["ev"] = safe_sum(df["EV"])
        out["ac"] = safe_sum(df["AC"])

        pv, ev, ac = out["pv"], out["ev"], out["ac"]
        if pv is None or ev is None or ac is None:
            return dict(_EMPTY)

        sv = ev - pv
        cv = ev - ac
        out["sv"] = finite_float(sv)
        out["cv"] = finite_float(cv)
        out["cost_variance"] = finite_float(cv)

        spi_v = finite_float(ev / pv) if pv else None
        cpi_v = finite_float(ev / ac) if ac else None
        if spi_v is None or cpi_v is None:
            try:
                spi_f, cpi_f = calculations.calculate_evm(status_df)
                if spi_v is None:
                    spi_v = finite_float(spi_f)
                if cpi_v is None:
                    cpi_v = finite_float(cpi_f)
            except Exception:
                logger.exception("calculate_evm fallback failed")
        out["spi"] = spi_v
        out["cpi"] = cpi_v

        bac = out["bac"]
        if bac is not None:
            vac = bac - ev
            out["vac"] = finite_float(vac)
            denom = bac - ac
            fd = finite_float(denom)
            if fd is not None and fd != 0:
                tcpi = (bac - ev) / denom
                out["tcpi"] = finite_float(tcpi)
    except Exception:
        logger.exception("compute_evm failed")
        return dict(_EMPTY)
    return out
