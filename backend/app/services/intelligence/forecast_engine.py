"""Delay / overrun / risk / resource projections from ingested health metrics (heuristic)."""

from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)


def _lin_slope(xs: list[float], ys: list[float]) -> tuple[float | None, float | None]:
    """Return slope, intercept for y ~ slope*x + intercept; xs are 0..n-1."""
    if len(xs) < 2 or len(ys) != len(xs):
        return None, None
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0 or not math.isfinite(den):
        return None, None
    slope = num / den
    intercept = my - slope * mx
    if not math.isfinite(slope) or not math.isfinite(intercept):
        return None, None
    return float(slope), float(intercept)


def _parse_week_anchor(week_label: str) -> date | None:
    """Best-effort parse of weekly history 'week' cell into a calendar date."""
    s = (week_label or "").strip()
    if not s:
        return None
    head = s.replace("Z", "")[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(head, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(head).date()
    except ValueError:
        return None


def _completion_date_block(
    health: dict[str, Any],
    weekly_pts: list[tuple[float, float]],
    last_week_label: str,
    slope_pct_per_week: float | None,
    intercept: float | None,
) -> dict[str, Any]:
    kpis = health.get("kpis") or {}
    charts = health.get("charts") or {}
    weekly = charts.get("weekly_completion") or []

    current: float | None = None
    if weekly_pts:
        current = float(weekly_pts[-1][1])
    comp_k = kpis.get("completion_pct")
    if comp_k is not None:
        try:
            ck = float(comp_k)
            if math.isfinite(ck):
                current = ck if current is None else (current + ck) / 2.0
        except (TypeError, ValueError):
            pass

    weeks_to_100: float | None = None
    if current is not None and slope_pct_per_week is not None and slope_pct_per_week > 0.05:
        gap = 100.0 - current
        if gap > 0:
            weeks_to_100 = gap / slope_pct_per_week

    anchor = _parse_week_anchor(last_week_label) or date.today()
    projected_iso: str | None = None
    if weeks_to_100 is not None and math.isfinite(weeks_to_100):
        days = int(max(0, math.ceil(weeks_to_100 * 7)))
        projected_iso = (anchor + timedelta(days=days)).isoformat()

    notes: list[str] = []
    if slope_pct_per_week is not None and slope_pct_per_week <= 0 and (current or 0) < 99:
        notes.append("Completion trend is flat or negative; calendar finish is uncertain without scope or rate change.")
    if not weekly:
        notes.append("No weekly history series; completion outlook uses KPI mean only.")

    headline = ""
    if weeks_to_100 is not None and projected_iso:
        headline = f"At the current weekly trend, ~{weeks_to_100:.1f} weeks to reach 100% (indicative target ~{projected_iso})."
    elif current is not None and current >= 99:
        headline = "Completion is at or near 100% in the latest data."
    else:
        headline = "Insufficient upward trend to project a reliable 100% date from uploads alone."

    return {
        "as_of_week_label": last_week_label or None,
        "anchor_date_iso": anchor.isoformat(),
        "current_completion_pct": None if current is None else round(current, 2),
        "trend_pct_per_week": None if slope_pct_per_week is None else round(slope_pct_per_week, 4),
        "weeks_to_100_at_trend": None if weeks_to_100 is None else round(weeks_to_100, 2),
        "projected_100pct_date_iso": projected_iso,
        "headline": headline,
        "notes": notes,
    }


def _budget_block(health: dict[str, Any], evm: dict[str, Any], cpi_f: float) -> dict[str, Any]:
    kpis = health.get("kpis") or {}
    cv_sum = kpis.get("cost_variance_sum")
    ev = evm.get("ev")
    ac = evm.get("ac")
    bac = evm.get("bac")
    vac = evm.get("vac")

    at_risk = bool(cpi_f < 0.95)
    try:
        if cv_sum is not None and float(cv_sum) > 0:
            at_risk = True
    except (TypeError, ValueError):
        pass

    predicted_gap: float | None = None
    try:
        if cv_sum is not None:
            predicted_gap = max(0.0, float(cv_sum))
    except (TypeError, ValueError):
        predicted_gap = None

    headline = ""
    if cpi_f < 0.92:
        headline = "CPI indicates likely budget overrun versus planned efficiency."
    elif predicted_gap and predicted_gap > 0:
        headline = f"Aggregate task cost variance is +{predicted_gap:.0f} vs planned (sum of actual − planned budget)."
    elif at_risk:
        headline = "Cost performance is below plan; monitor burn on high-value tasks."
    else:
        headline = "No strong budget-overrun signal from CPI and cost variance in current uploads."

    notes: list[str] = []
    if bac is not None and ev is not None:
        notes.append(f"BAC={float(bac):.0f}, EV={float(ev):.0f} (from status tracker).")
    if ac is not None:
        notes.append(f"AC={float(ac):.0f}.")
    if vac is not None:
        notes.append(f"BAC−EV (as stored) = {float(vac):.0f} — use with CPI for directional overrun context.")

    return {
        "cost_variance_sum": cv_sum,
        "cpi": cpi_f,
        "bac": bac,
        "ev": ev,
        "ac": ac,
        "vac_b_minus_ev": vac,
        "predicted_overrun_currency_hint": predicted_gap,
        "at_risk": at_risk,
        "headline": headline,
        "notes": notes,
    }


def _risk_escalation_block(health: dict[str, Any], risk: dict[str, Any], settings_rag: dict[str, Any]) -> dict[str, Any]:
    rs = int(risk.get("risk_score") or 0)
    high_open = int(risk.get("high_severity_open_count") or 0)
    open_risks = int(risk.get("open_risk_count") or 0)
    red_thr = int(settings_rag.get("red_risk", 5))
    amb_thr = int(settings_rag.get("amber_risk", 3))

    if rs >= red_thr or high_open >= 3:
        level = "critical"
        headline = "Risk exposure is elevated: score and/or open high-severity items warrant escalation."
    elif rs >= amb_thr or high_open >= 1:
        level = "elevated"
        headline = "Risk register shows material open exposure; track mitigations weekly."
    else:
        level = "stable"
        headline = "RAID-based risk counts are within a routine band for this upload."

    snippets = risk.get("open_high_risks") or []
    evidence = f"Governance risk score={rs}, open high-severity items={high_open}, open risks={open_risks}."
    if snippets:
        evidence += f" Example: {(snippets[0] or {}).get('summary', '')[:120]}"

    return {
        "risk_score": rs,
        "high_severity_open_count": high_open,
        "open_risk_count": open_risks,
        "escalation_level": level,
        "headline": headline,
        "evidence": evidence.strip(),
        "thresholds": {"red_risk": red_thr, "amber_risk": amb_thr},
    }


def _resource_overload_block(resources: dict[str, Any]) -> dict[str, Any]:
    util = resources.get("utilization_ratio")
    try:
        util_f = float(util) if util is not None else None
    except (TypeError, ValueError):
        util_f = None

    overloaded: list[dict[str, Any]] = []
    for t in resources.get("by_task") or []:
        ph = t.get("planned_hours")
        ah = t.get("actual_hours")
        if ph is None or ah is None:
            continue
        try:
            pf, af = float(ph), float(ah)
        except (TypeError, ValueError):
            continue
        if pf <= 0:
            continue
        ratio = af / pf
        if ratio >= 1.1:
            overloaded.append(
                {
                    "task": t.get("task", "—"),
                    "planned_hours": pf,
                    "actual_hours": af,
                    "ratio": round(ratio, 3),
                },
            )

    overloaded.sort(key=lambda x: -x["ratio"])
    top = overloaded[:10]
    at_risk = bool(util_f is not None and util_f > 1.05) or len(overloaded) > 0

    headline = ""
    if util_f is not None and util_f > 1.15:
        headline = f"Aggregate hours are {util_f:.0%} of plan — sustained overload likely."
    elif top:
        headline = f"{len(overloaded)} task(s) exceed 110% of planned hours; top drivers listed below."
    else:
        headline = "No task-level hour overload (>110% of plan) detected in the current slice."

    return {
        "utilization_ratio": util_f,
        "variance_hours": resources.get("variance_hours"),
        "overload_task_count": len(overloaded),
        "top_overloaded_tasks": top,
        "at_risk": at_risk,
        "headline": headline,
    }


def build_forecast(health: dict[str, Any]) -> dict[str, Any]:
    settings = health.get("forecast_thresholds") or {}
    if not settings:
        settings = {"red_risk": 5, "amber_risk": 3}

    out: dict[str, Any] = {
        "completion_trend_slope_per_week": None,
        "projected_completion_next_week_pct": None,
        "schedule_at_risk": False,
        "cost_at_risk": False,
        "predicted_overrun_hours": None,
        "confidence": "low",
        "headline": "",
        "drivers": [],
        "completion_date": {},
        "budget_overrun": {},
        "risk_escalation": {},
        "resource_overload": {},
    }
    try:
        kpis = health.get("kpis") or {}
        evm = health.get("evm") or {}
        risk = health.get("risk") or {}
        resources = health.get("resources") or {}
        charts = health.get("charts") or {}
        weekly = charts.get("weekly_completion") or []

        pts: list[tuple[float, float]] = []
        last_label = ""
        for i, row in enumerate(weekly):
            c = row.get("completion")
            if c is None:
                continue
            try:
                v = float(c)
            except (TypeError, ValueError):
                continue
            if math.isfinite(v):
                pts.append((float(len(pts)), v))
                wk = row.get("week")
                if wk is not None and str(wk).strip():
                    last_label = str(wk).strip()

        slope_pct_per_week: float | None = None
        intercept: float | None = None
        if len(pts) >= 2:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            slope, icept = _lin_slope(xs, ys)
            out["completion_trend_slope_per_week"] = slope
            slope_pct_per_week = slope
            intercept = icept
            if slope is not None and icept is not None:
                next_x = float(len(pts))
                proj = slope * next_x + icept
                out["projected_completion_next_week_pct"] = max(0.0, min(100.0, proj))
            out["confidence"] = "medium" if len(pts) >= 4 else "low"
        elif len(pts) == 1:
            out["projected_completion_next_week_pct"] = max(0.0, min(100.0, pts[0][1]))

        spi = evm.get("spi")
        cpi = evm.get("cpi")
        try:
            spi_f = float(spi) if spi is not None else 1.0
            cpi_f = float(cpi) if cpi is not None else 1.0
        except (TypeError, ValueError):
            spi_f, cpi_f = 1.0, 1.0
        out["schedule_at_risk"] = bool(spi_f < 0.95)
        out["cost_at_risk"] = bool(cpi_f < 0.95)

        ev = kpis.get("effort_variance_sum")
        if ev is not None:
            try:
                evf = float(ev)
                if evf > 0:
                    out["predicted_overrun_hours"] = max(0.0, evf)
            except (TypeError, ValueError):
                pass

        out["completion_date"] = _completion_date_block(health, pts, last_label, slope_pct_per_week, intercept)
        out["budget_overrun"] = _budget_block(health, evm, cpi_f)
        out["risk_escalation"] = _risk_escalation_block(health, risk, settings)
        out["resource_overload"] = _resource_overload_block(resources)

        drivers: list[str] = []
        if out["schedule_at_risk"]:
            drivers.append(f"SPI={spi_f:.3f} (<0.95): earned schedule lags planned value.")
        if out["cost_at_risk"]:
            drivers.append(f"CPI={cpi_f:.3f} (<0.95): cost efficiency below plan.")
        slp = out["completion_trend_slope_per_week"]
        if slp is not None and slp < -0.5:
            drivers.append("Weekly completion trend is declining materially.")
        if out["resource_overload"].get("at_risk"):
            drivers.append(out["resource_overload"]["headline"])
        if out["risk_escalation"].get("escalation_level") in ("elevated", "critical"):
            drivers.append(out["risk_escalation"]["headline"])
        out["drivers"] = drivers

        if out["schedule_at_risk"] and out["cost_at_risk"]:
            out["headline"] = "Elevated risk of both schedule slip and cost overrun."
        elif out["schedule_at_risk"]:
            out["headline"] = "Schedule pressure detected; monitor critical path tasks."
        elif out["cost_at_risk"]:
            out["headline"] = "Cost burn is above plan; validate scope and vendor spend."
        else:
            out["headline"] = "No strong overrun signal from current indices; continue routine tracking."
    except Exception:
        logger.exception("build_forecast failed")
        out["headline"] = "Forecast unavailable due to data quality; re-check uploads."
    return out
