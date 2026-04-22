"""Structured root-cause hypotheses tied to observable metrics from uploads."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def build_root_causes(health: dict[str, Any]) -> list[dict[str, Any]]:
    causes: list[dict[str, Any]] = []
    try:
        kpis = health.get("kpis") or {}
        evm = health.get("evm") or {}
        risk = health.get("risk") or {}
        resources = health.get("resources") or {}
        milestones = health.get("milestones") or {}
        rag = health.get("rag") or {}

        sv = kpis.get("schedule_variance_sum")
        if sv is not None and float(sv) < -10:
            causes.append(
                {
                    "id": "rc_schedule_spread",
                    "severity": "high",
                    "category": "Schedule",
                    "statement": "Large negative aggregate schedule variance across tasks.",
                    "evidence": f"Σ(Actual% − Planned%) = {float(sv):.1f} percentage points.",
                },
            )
        spi = evm.get("spi")
        if spi is not None and float(spi) < 0.92:
            causes.append(
                {
                    "id": "rc_spi",
                    "severity": "high",
                    "category": "EVM",
                    "statement": "SPI indicates earned value is materially behind planned schedule.",
                    "evidence": f"SPI = {float(spi):.3f}.",
                },
            )

        cpi = evm.get("cpi")
        if cpi is not None and float(cpi) < 0.92:
            causes.append(
                {
                    "id": "rc_cpi",
                    "severity": "high",
                    "category": "Cost",
                    "statement": "CPI indicates cost performance below plan.",
                    "evidence": f"CPI = {float(cpi):.3f}.",
                },
            )

        cv = kpis.get("cost_variance_sum")
        if cv is not None and abs(float(cv)) > 0:
            if float(cv) > 0:
                causes.append(
                    {
                        "id": "rc_cost_burn",
                        "severity": "medium",
                        "category": "Cost",
                        "statement": "Actual cost exceeds planned budget at task level (sum).",
                        "evidence": f"Σ(Actual cost − Planned budget) = {float(cv):.0f}.",
                    },
                )

        rs = int(risk.get("risk_score") or 0)
        if rs > 0:
            causes.append(
                {
                    "id": "rc_open_high_risks",
                    "severity": "high",
                    "category": "Risk",
                    "statement": "Open high-severity risk items are present in the RAID log.",
                    "evidence": f"Governance risk score = {rs}.",
                },
            )

        util = resources.get("utilization_ratio")
        if util is not None and float(util) > 1.15:
            causes.append(
                {
                    "id": "rc_overwork",
                    "severity": "medium",
                    "category": "Resources",
                    "statement": "Actual hours materially exceed planned hours in aggregate.",
                    "evidence": f"Utilization ratio (actual/planned) = {float(util):.2f}.",
                },
            )

        late = int(milestones.get("late_count") or 0)
        if late >= 3:
            causes.append(
                {
                    "id": "rc_milestones",
                    "severity": "medium",
                    "category": "Delivery",
                    "statement": "Multiple milestones/tasks show planned vs actual % gaps.",
                    "evidence": f"Tasks flagged behind threshold: {late}.",
                },
            )

        if not causes and (rag.get("status") in ("Amber", "Red")):
            causes.append(
                {
                    "id": "rc_rag",
                    "severity": "medium" if rag.get("status") == "Amber" else "high",
                    "category": "Health",
                    "statement": "Composite RAG is not Green based on configured thresholds.",
                    "evidence": f"RAG = {rag.get('status')}.",
                },
            )
    except Exception:
        logger.exception("build_root_causes failed")
        causes.append(
            {
                "id": "rc_error",
                "severity": "low",
                "category": "System",
                "statement": "Root-cause pass failed; verify ingested data completeness.",
                "evidence": "",
            },
        )
    return causes[:12]
