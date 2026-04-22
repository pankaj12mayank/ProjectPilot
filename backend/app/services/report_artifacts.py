"""Whitelisted report filenames under outputs/reports/{job_id}/."""

from __future__ import annotations

from pathlib import Path

from app.config.settings import Settings

ALLOWED_REPORT_ARTIFACTS: frozenset[str] = frozenset(
    {
        "executive_summary.md",
        "pm_detailed_report.md",
        "client_report.md",
        "executive_summary.pdf",
        "pm_detailed_report.pdf",
        "client_report.docx",
        "pm_detailed_report.docx",
        "intelligence_deck.pptx",
        "email_draft.txt",
    },
)


def resolve_report_artifact_path(settings: Settings, job_id: str, artifact: str) -> Path:
    if artifact not in ALLOWED_REPORT_ARTIFACTS:
        raise ValueError(f"Unknown artifact: {artifact}")
    job_root = (settings.outputs_dir / "reports" / job_id).resolve()
    path = (job_root / artifact).resolve()
    try:
        path.relative_to(job_root)
    except ValueError as exc:
        raise ValueError("Path traversal") from exc
    return path
