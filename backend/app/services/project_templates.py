"""Built-in project templates (structure + sample content for creation wizard)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ProjectTemplateDef:
    key: str
    name: str
    summary: str
    checklist: tuple[str, ...]
    suggested_description: str


# Keys are stable API identifiers (stored on `projects.template_key` when used).
SAMPLE_TEMPLATES: tuple[ProjectTemplateDef, ...] = (
    ProjectTemplateDef(
        key="software_delivery",
        name="Software delivery",
        summary="Iterative build with RAID hygiene, weekly completion tracking, and EVM-friendly task rows.",
        checklist=(
            "Status tracker with planned/actual % and hours per sprint or milestone.",
            "RAID log for risks, issues, assumptions, and dependencies.",
            "Weekly completion % aligned to release train or PI boundaries.",
        ),
        suggested_description=(
            "Software delivery initiative using weekly governance uploads: status tracker (tasks, planned vs actual %, "
            "hours), RAID log, and weekly completion history for portfolio reporting."
        ),
    ),
    ProjectTemplateDef(
        key="infrastructure_rollout",
        name="Infrastructure / rollout",
        summary="Suited to capital workstreams with vendor RAID and burn tracking.",
        checklist=(
            "Track milestones and physical % complete in the status sheet.",
            "Log vendor and interface risks in RAID with clear severity.",
            "Weekly % complete for executive readouts.",
        ),
        suggested_description=(
            "Infrastructure or rollout program: structured status tracker, RAID register for vendor and technical risks, "
            "and weekly completion trend for schedule confidence."
        ),
    ),
    ProjectTemplateDef(
        key="regulatory_program",
        name="Regulatory / compliance program",
        summary="Emphasis on evidence trails and controlled change; same three-file model.",
        checklist=(
            "Tasks tied to submission or audit milestones.",
            "RAID for regulatory findings and remediation items.",
            "Weekly completion to evidence steady progress.",
        ),
        suggested_description=(
            "Compliance-oriented program with auditable uploads: task-level status, RAID for findings and issues, "
            "and weekly completion reporting."
        ),
    ),
    ProjectTemplateDef(
        key="blank",
        name="Blank project",
        summary="No preset text — use your own description and team setup.",
        checklist=(
            "Add your own description on the first step.",
            "Upload samples when you are ready on the upload screen.",
        ),
        suggested_description="",
    ),
)


def list_template_dicts() -> list[dict[str, Any]]:
    return [
        {
            "key": t.key,
            "name": t.name,
            "summary": t.summary,
            "checklist": list(t.checklist),
            "suggested_description": t.suggested_description,
        }
        for t in SAMPLE_TEMPLATES
    ]


def get_template(key: str | None) -> ProjectTemplateDef | None:
    if not key or not str(key).strip():
        return None
    k = str(key).strip().lower()
    for t in SAMPLE_TEMPLATES:
        if t.key == k:
            return t
    return None
