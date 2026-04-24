"""Markdown summaries: executive, detailed PM, and client-facing narratives."""

from __future__ import annotations

from typing import Any


def _registered_risk_lines(health: dict[str, Any]) -> list[str]:
    reg = health.get("registered_risks") or []
    if not reg:
        return ["- None recorded in the risk register for this project."]
    lines: list[str] = []
    for r in reg[:25]:
        rid = r.get("report_run_id")
        link = f" (linked report job: `{rid}`)" if rid else ""
        lines.append(
            f"- **{r.get('title', '—')}** — severity **{r.get('severity', '—')}**, status **{r.get('status', '—')}**{link}",
        )
    return lines


def executive_summary(
    project_name: str,
    health: dict[str, Any],
    forecast: dict[str, Any],
    root_causes: list[dict[str, Any]],
    recommendations: list[dict[str, Any]],
) -> str:
    rag = (health.get("rag") or {}).get("status", "—")
    kpis = health.get("kpis") or {}
    comp = kpis.get("completion_pct")
    comp_s = f"{float(comp):.1f}%" if comp is not None else "n/a"
    lines = [
        f"# Executive summary — {project_name}",
        "",
        f"- **Overall health (RAG):** {rag}",
        f"- **Mean completion:** {comp_s}",
        f"- **Outlook:** {forecast.get('headline', '')}",
        "",
        "## Key risks / drivers",
    ]
    for c in root_causes[:5]:
        lines.append(f"- **{c.get('category')}:** {c.get('statement')}")
    lines.extend(["", "## Registered project risks (manual)"])
    lines.extend(_registered_risk_lines(health))
    lines.extend(["", "## Top actions"])
    for r in recommendations[:5]:
        lines.append(f"- **P{r.get('priority')} — {r.get('title')}:** {r.get('detail')}")
    return "\n".join(lines) + "\n"


def pm_detailed_report(
    project_name: str,
    health: dict[str, Any],
    forecast: dict[str, Any],
    root_causes: list[dict[str, Any]],
    recommendations: list[dict[str, Any]],
) -> str:
    kpis = health.get("kpis") or {}
    evm = health.get("evm") or {}
    risk = health.get("risk") or {}
    ms = health.get("milestones") or {}
    res = health.get("resources") or {}
    lines = [
        f"# PM detailed report — {project_name}",
        "",
        "## Data completeness",
        f"- Complete ingest: **{health.get('data_complete')}**",
        f"- Missing roles: {', '.join(health.get('missing_roles') or []) or 'none'}",
        "",
        "## KPI snapshot",
        f"- Completion % (mean actual): {evm_field(kpis, 'completion_pct')}",
        f"- Schedule variance Σ: {evm_field(kpis, 'schedule_variance_sum')}",
        f"- Effort variance Σ: {evm_field(kpis, 'effort_variance_sum')}",
        "",
        "## EVM",
        f"- BAC / PV / EV / AC: {evm_field(evm, 'bac')} / {evm_field(evm, 'pv')} / {evm_field(evm, 'ev')} / {evm_field(evm, 'ac')}",
        f"- SPI / CPI: {evm_field(evm, 'spi')} / {evm_field(evm, 'cpi')}",
        f"- SV / CV: {evm_field(evm, 'sv')} / {evm_field(evm, 'cv')}",
        "",
        "## Forecast",
        f"- {forecast.get('headline', '')}",
        f"- Projected next-week completion %: {forecast.get('projected_completion_next_week_pct')}",
        f"- Schedule at risk: {forecast.get('schedule_at_risk')} | Cost at risk: {forecast.get('cost_at_risk')}",
        "",
        "## RAID summary",
        f"- Items: {risk.get('total_items')} | Open high-severity: {risk.get('high_severity_open_count', risk.get('risk_score'))}",
        "",
        "## Registered project risks (manual register)",
        *_registered_risk_lines(health),
        "",
        "## Milestones",
        f"- Behind / on-track / ahead: {ms.get('late_count')} / {ms.get('on_track_count')} / {ms.get('ahead_count')}",
        "",
        "## Resources",
        f"- Planned h Σ: {res.get('total_planned_hours')} | Actual h Σ: {res.get('total_actual_hours')} | Utilization: {res.get('utilization_ratio')}",
        "",
        "## Root causes (structured)",
    ]
    for c in root_causes:
        lines.append(f"- **[{c.get('severity')}/{c.get('category')}]** {c.get('statement')} _{c.get('evidence')}_")
    lines.extend(["", "## Recommendations"])
    for r in recommendations:
        lines.append(f"- **P{r.get('priority')} [{r.get('owner_hint')}]** {r.get('title')}: {r.get('detail')}")
    return "\n".join(lines) + "\n"


def evm_field(d: dict[str, Any], k: str) -> str:
    v = d.get(k)
    if v is None:
        return "n/a"
    try:
        if isinstance(v, float):
            return f"{v:.3f}" if abs(v) < 1000 else f"{v:.0f}"
        return str(v)
    except Exception:
        return "n/a"


def client_report(
    project_name: str,
    health: dict[str, Any],
    forecast: dict[str, Any],
    recommendations: list[dict[str, Any]],
) -> str:
    rag = (health.get("rag") or {}).get("status", "Green")
    kpis = health.get("kpis") or {}
    comp = kpis.get("completion_pct")
    comp_s = f"{float(comp):.1f}%" if comp is not None else "being validated"
    tone = (
        "The initiative is tracking with manageable variance."
        if rag == "Green"
        else "We are watching a few areas that need coordinated attention."
        if rag == "Amber"
        else "There are material schedule and/or risk signals that require leadership focus."
    )
    lines = [
        f"# Client status — {project_name}",
        "",
        tone,
        "",
        f"**Overall indicator:** {rag}",
        f"**Progress snapshot:** completion metrics are at approximately **{comp_s}** where data is available.",
        "",
        "## Registered risks (summary)",
    ]
    lines.extend(_registered_risk_lines(health))
    lines.extend(["", "## What we are doing next"])
    for r in recommendations[:4]:
        lines.append(f"- {r.get('title')}: {r.get('detail')}")
    lines.extend(
        [
            "",
            "_Figures are generated from validated project uploads; contact the PMO for the detailed technical annex._",
        ],
    )
    return "\n".join(lines) + "\n"
