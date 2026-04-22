"""RAG (Red / Amber / Green) health band with human-readable drivers."""

from __future__ import annotations

import logging
import math
from typing import Any

from app.services import rag

logger = logging.getLogger(__name__)

_DEFAULT_THRESHOLDS: dict[str, float | int] = {
    "red_risk": 5,
    "amber_risk": 3,
    "red_sv": -10.0,
    "amber_sv": -5.0,
}


def compute_rag(total_schedule_variance_pct_sum: float | None, risk_score: int, thresholds: dict[str, float | int]) -> dict[str, Any]:
    """Schedule variance: sum of (Actual% − Planned%) across tasks, in percentage points."""
    thr = dict(_DEFAULT_THRESHOLDS)
    try:
        for k, v in (thresholds or {}).items():
            if isinstance(v, bool):
                continue
            if isinstance(v, float) and not math.isfinite(v):
                continue
            if isinstance(v, (int, float)):
                thr[k] = v
    except Exception:
        logger.exception("RAG thresholds merge failed")

    try:
        sv = float(total_schedule_variance_pct_sum or 0.0)
    except (TypeError, ValueError):
        sv = 0.0
    try:
        rs = int(risk_score)
    except (TypeError, ValueError):
        rs = 0

    try:
        status = rag.calculate_rag(sv, rs, thr)
    except Exception:
        logger.exception("calculate_rag failed")
        status = "Green"

    reasons: list[str] = []
    try:
        if rs >= int(thr["red_risk"]):
            reasons.append(f"Open high-severity risks ({rs}) meet or exceed the Red threshold ({thr['red_risk']}).")
        if sv <= float(thr["red_sv"]):
            reasons.append(
                f"Aggregate schedule variance ({sv:.1f} points) is at or below the Red schedule threshold ({thr['red_sv']}).",
            )
        if status != "Red":
            if rs >= int(thr["amber_risk"]):
                reasons.append(f"Risk count ({rs}) is in the Amber band versus threshold {thr['amber_risk']}.")
            if sv <= float(thr["amber_sv"]):
                reasons.append(
                    f"Aggregate schedule variance ({sv:.1f} points) is in the Amber band versus threshold {thr['amber_sv']}.",
                )
        if status == "Green" and not reasons:
            reasons.append("Risk and schedule signals are within Green thresholds.")
    except Exception:
        logger.exception("RAG reasons build failed")
        reasons = ["RAG computed; see raw inputs for details."]

    safe_thr: dict[str, float] = {}
    for k, v in thr.items():
        try:
            if isinstance(v, (int, float)) and v == v:
                safe_thr[k] = float(v)
        except Exception:
            continue

    return {
        "status": status,
        "reasons": reasons,
        "inputs": {
            "risk_score": rs,
            "schedule_variance_sum_pct_points": sv,
            "thresholds": safe_thr,
        },
    }
