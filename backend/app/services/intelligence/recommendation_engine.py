"""Actionable recommendations derived from forecast + root causes + health snapshot."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _metric(metric: str, value: Any, source: str) -> dict[str, Any]:
    return {"metric": metric, "value": value, "source": source}


def _rec(
    priority: int,
    title: str,
    detail: str,
    owner_hint: str,
    *,
    metric_refs: list[dict[str, Any]],
    root_cause_ids: list[str],
    risk_refs: dict[str, Any] | None = None,
    engine: str | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "priority": priority,
        "title": title,
        "detail": detail,
        "owner_hint": owner_hint,
        "metric_refs": metric_refs,
        "root_cause_ids": root_cause_ids,
        "risk_refs": risk_refs or {},
    }
    if engine:
        out["engine"] = engine
    return out


def build_rule_based_recommendations(health: dict[str, Any]) -> list[dict[str, Any]]:
    """Deterministic suggestions from registered risks and SPI/CPI (no ML)."""
    out: list[dict[str, Any]] = []
    evm = health.get("evm") or {}
    spi = evm.get("spi")
    cpi = evm.get("cpi")
    try:
        spi_f = float(spi) if spi is not None and str(spi).strip() != "" else None
    except (TypeError, ValueError):
        spi_f = None
    try:
        cpi_f = float(cpi) if cpi is not None and str(cpi).strip() != "" else None
    except (TypeError, ValueError):
        cpi_f = None

    for r in health.get("registered_risks") or []:
        if str(r.get("status", "")).lower() != "open":
            continue
        sev = str(r.get("severity", "")).lower()
        title = str(r.get("title") or "Registered risk").strip()
        if sev == "high":
            out.append(
                _rec(
                    1,
                    f"Mitigation (registered): {title}",
                    "Assign an owner, target date, and concrete mitigation steps; review weekly until the risk is closed.",
                    "Risk owner / PM",
                    metric_refs=[_metric("registered_risk", title, "project_risks")],
                    root_cause_ids=[],
                    risk_refs={"registered_risk_id": r.get("id"), "severity": sev},
                    engine="rules",
                ),
            )
        elif sev == "medium":
            out.append(
                _rec(
                    2,
                    f"Track registered risk: {title}",
                    "Keep it on the RAID register with owners and dates; escalate if schedule or cost impact grows.",
                    "PM",
                    metric_refs=[_metric("registered_risk", title, "project_risks")],
                    root_cause_ids=[],
                    risk_refs={"registered_risk_id": r.get("id"), "severity": sev},
                    engine="rules",
                ),
            )

    if spi_f is not None and spi_f < 1.0:
        out.append(
            _rec(
                2,
                "Schedule performance improvement (SPI)",
                f"SPI is {spi_f:.3f} (below 1.0). Re-baseline near-term work, clear blockers on the critical path, and re-check task estimates.",
                "Project Manager",
                metric_refs=[_metric("SPI", spi_f, "evm")],
                root_cause_ids=[],
                risk_refs={},
                engine="rules",
            ),
        )
    if cpi_f is not None and cpi_f < 1.0:
        out.append(
            _rec(
                2,
                "Cost performance improvement (CPI)",
                f"CPI is {cpi_f:.3f} (below 1.0). Run variance analysis on top cost drivers and tighten scope / change control with finance.",
                "PM / Finance",
                metric_refs=[_metric("CPI", cpi_f, "evm")],
                root_cause_ids=[],
                risk_refs={},
                engine="rules",
            ),
        )
    return out


def build_recommendations(
    health: dict[str, Any],
    forecast: dict[str, Any],
    root_causes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    recs: list[dict[str, Any]] = []
    rc_ids = {c.get("id"): c for c in root_causes if c.get("id")}
    kpis = health.get("kpis") or {}
    evm = health.get("evm") or {}
    risk = health.get("risk") or {}

    def rc_list(*ids: str) -> list[str]:
        return [i for i in ids if i in rc_ids]

    try:
        rag = (health.get("rag") or {}).get("status", "Green")
        rs = int(risk.get("risk_score") or 0)
        spi = evm.get("spi")
        cpi = evm.get("cpi")
        util = (forecast.get("resource_overload") or {}).get("utilization_ratio")

        if rag == "Red":
            recs.append(
                _rec(
                    1,
                    "Executive escalation",
                    "Convene a leadership review within 48 hours with RAID owners and finance.",
                    "Sponsor / PMO",
                    metric_refs=[
                        _metric("RAG", rag, "rag"),
                        _metric("risk_score", rs, "risk"),
                    ],
                    root_cause_ids=rc_list("rc_rag", "rc_spi", "rc_cpi", "rc_open_high_risks"),
                    risk_refs={"risk_score": rs, "high_severity_open_count": risk.get("high_severity_open_count")},
                ),
            )
        if forecast.get("schedule_at_risk"):
            recs.append(
                _rec(
                    1,
                    "Re-baseline near-term schedule",
                    "Re-sequence two-week lookahead; validate dependencies on delayed tasks.",
                    "Project Manager",
                    metric_refs=[
                        _metric("SPI", spi, "evm"),
                        _metric("schedule_variance_sum", kpis.get("schedule_variance_sum"), "kpis"),
                    ],
                    root_cause_ids=rc_list("rc_spi", "rc_schedule_spread", "rc_milestones"),
                    risk_refs={"risk_score": rs},
                ),
            )
        if forecast.get("cost_at_risk") or (forecast.get("budget_overrun") or {}).get("at_risk"):
            recs.append(
                _rec(
                    2,
                    "Cost control checkpoint",
                    "Run variance analysis on top cost tasks; freeze non-critical scope adds.",
                    "Finance / PM",
                    metric_refs=[
                        _metric("CPI", cpi, "evm"),
                        _metric("cost_variance_sum", kpis.get("cost_variance_sum"), "kpis"),
                        _metric("cost_variance (EV−AC)", evm.get("cost_variance"), "evm"),
                    ],
                    root_cause_ids=rc_list("rc_cpi", "rc_cost_burn"),
                    risk_refs={},
                ),
            )

        for c in root_causes:
            cid = c.get("id")
            if cid == "rc_open_high_risks":
                recs.append(
                    _rec(
                        1,
                        "Triage open high risks",
                        "Assign owner, mitigation date, and trigger for each open high item.",
                        "Risk owner",
                        metric_refs=[
                            _metric("risk_score", rs, "risk"),
                            _metric("high_severity_open_count", risk.get("high_severity_open_count"), "risk"),
                        ],
                        root_cause_ids=["rc_open_high_risks"],
                        risk_refs={
                            "risk_score": rs,
                            "high_severity_open_count": risk.get("high_severity_open_count"),
                            "snippets": [x.get("summary") for x in (risk.get("open_high_risks") or [])[:3]],
                        },
                    ),
                )
            if cid == "rc_overwork":
                recs.append(
                    _rec(
                        2,
                        "Rebalance workload",
                        "Shift lower-priority tasks or add capacity where burn exceeds plan.",
                        "Resource manager",
                        metric_refs=[
                            _metric("utilization_ratio", util, "forecast.resource_overload"),
                            _metric("variance_hours", (health.get("resources") or {}).get("variance_hours"), "resources"),
                        ],
                        root_cause_ids=["rc_overwork"],
                        risk_refs={},
                    ),
                )

        if forecast.get("completion_trend_slope_per_week") is not None:
            slope = float(forecast["completion_trend_slope_per_week"])
            if slope < -0.25:
                recs.append(
                    _rec(
                        2,
                        "Improve delivery cadence",
                        "Weekly completion trend is negative; add integration/test focus weeks.",
                        "Delivery lead",
                        metric_refs=[
                            _metric("completion_trend_slope_per_week", slope, "forecast"),
                            _metric("last_reported_completion", kpis.get("last_reported_completion"), "kpis"),
                        ],
                        root_cause_ids=rc_list("rc_schedule_spread", "rc_milestones"),
                        risk_refs={"risk_score": rs},
                    ),
                )

        ro = forecast.get("resource_overload") or {}
        if ro.get("overload_task_count") and not any(r.get("title") == "Rebalance workload" for r in recs):
            recs.append(
                _rec(
                    2,
                    "Resolve hour hotspots",
                    f"{ro['overload_task_count']} task(s) exceed 110% of planned hours — re-scope or re-staff.",
                    "Resource manager",
                    metric_refs=[
                        _metric("overload_task_count", ro.get("overload_task_count"), "forecast.resource_overload"),
                        _metric("utilization_ratio", ro.get("utilization_ratio"), "forecast.resource_overload"),
                    ],
                    root_cause_ids=rc_list("rc_overwork"),
                    risk_refs={},
                ),
            )

        re = forecast.get("risk_escalation") or {}
        if re.get("escalation_level") == "critical" and not any(r.get("title") == "Triage open high risks" for r in recs):
            recs.append(
                _rec(
                    1,
                    "Formal risk review",
                    "Escalate RAID items to sponsor; align mitigations to milestone dates.",
                    "PM / Risk lead",
                    metric_refs=[
                        _metric("escalation_level", re.get("escalation_level"), "forecast.risk_escalation"),
                        _metric("risk_score", rs, "risk"),
                    ],
                    root_cause_ids=rc_list("rc_open_high_risks", "rc_rag"),
                    risk_refs={"risk_score": rs, "evidence": re.get("evidence")},
                ),
            )

        if not recs:
            recs.append(
                _rec(
                    3,
                    "Maintain governance rhythm",
                    "No critical trigger fired; continue weekly uploads and RAID hygiene.",
                    "PMO",
                    metric_refs=[_metric("RAG", rag, "rag")],
                    root_cause_ids=[],
                    risk_refs={"risk_score": rs},
                ),
            )

        recs = build_rule_based_recommendations(health) + recs

        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for r in recs:
            t = r.get("title", "")
            if t in seen:
                continue
            seen.add(t)
            unique.append(r)
        unique.sort(key=lambda x: int(x.get("priority") or 3))
        return unique[:15]
    except Exception:
        logger.exception("build_recommendations failed")
        return [
            _rec(
                3,
                "Review data and retry",
                "Recommendation engine could not complete; validate uploads and health API.",
                "PMO",
                metric_refs=[],
                root_cause_ids=[],
                risk_refs={},
            ),
        ]
