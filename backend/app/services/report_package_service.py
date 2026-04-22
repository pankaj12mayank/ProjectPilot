"""Orchestrate intelligence bundle + multi-format exports for a project."""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any

from app.config.settings import Settings
from app.db.models import ProjectReportRun
from app.services.analytics.project_health import build_project_health_payload
from app.services.intelligence.package import build_intelligence_bundle
from app.services.reports.multiformat import (
    write_client_docx,
    write_email_txt,
    write_executive_pdf,
    write_intel_ppt,
    write_markdown_bundle,
)
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def generate_project_report_package(
    db: Session,
    project_id: str,
    project_name: str,
    settings: Settings,
    job_id: str | None = None,
) -> dict[str, Any]:
    job = job_id or str(uuid.uuid4())
    out_dir = settings.outputs_dir / "reports" / job
    out_dir.mkdir(parents=True, exist_ok=True)
    repo = settings.repo_root

    health = build_project_health_payload(db, project_id, settings)
    bundle = build_intelligence_bundle(project_name, health)

    md_paths = write_markdown_bundle(out_dir, bundle)
    outputs: dict[str, str | None] = {k: str(v.resolve().relative_to(repo)) for k, v in md_paths.items()}

    def rel(p: Path) -> str:
        return str(p.resolve().relative_to(repo))

    try:
        pdf_p = out_dir / "executive_summary.pdf"
        write_executive_pdf(pdf_p, f"Executive summary — {project_name}", bundle["executive_summary_markdown"])
        outputs["executive_pdf"] = rel(pdf_p)
    except Exception as exc:
        logger.exception("PDF generation failed")
        outputs["executive_pdf"] = None
        outputs["executive_pdf_error"] = str(exc)

    try:
        pm_pdf_p = out_dir / "pm_detailed_report.pdf"
        write_executive_pdf(pm_pdf_p, f"PM detailed report — {project_name}", bundle["pm_detailed_report_markdown"])
        outputs["pm_detailed_pdf"] = rel(pm_pdf_p)
    except Exception as exc:
        logger.exception("PM PDF generation failed")
        outputs["pm_detailed_pdf"] = None
        outputs["pm_detailed_pdf_error"] = str(exc)

    try:
        docx_p = out_dir / "client_report.docx"
        write_client_docx(docx_p, f"Client report — {project_name}", bundle["client_report_markdown"])
        outputs["client_docx"] = rel(docx_p)
    except Exception as exc:
        logger.exception("DOCX generation failed")
        outputs["client_docx"] = None
        outputs["client_docx_error"] = str(exc)

    try:
        pm_docx_p = out_dir / "pm_detailed_report.docx"
        write_client_docx(pm_docx_p, f"PM detailed report — {project_name}", bundle["pm_detailed_report_markdown"])
        outputs["pm_detailed_docx"] = rel(pm_docx_p)
    except Exception as exc:
        logger.exception("PM DOCX generation failed")
        outputs["pm_detailed_docx"] = None
        outputs["pm_detailed_docx_error"] = str(exc)

    try:
        ppt_p = out_dir / "intelligence_deck.pptx"
        write_intel_ppt(ppt_p, project_name, health, bundle)
        outputs["intelligence_pptx"] = rel(ppt_p)
    except Exception as exc:
        logger.exception("PPT generation failed")
        outputs["intelligence_pptx"] = None
        outputs["intelligence_pptx_error"] = str(exc)

    try:
        em_p = out_dir / "email_draft.txt"
        write_email_txt(em_p, project_name, bundle)
        outputs["email_draft_txt"] = rel(em_p)
    except Exception as exc:
        logger.exception("Email draft failed")
        outputs["email_draft_txt"] = None
        outputs["email_draft_error"] = str(exc)

    payload = {
        "job_id": job,
        "project_id": project_id,
        "intelligence": {
            "forecast": bundle["forecast"],
            "root_causes": bundle["root_causes"],
            "recommendations": bundle["recommendations"],
        },
        "summaries_markdown": {
            "executive": bundle["executive_summary_markdown"],
            "pm_detailed": bundle["pm_detailed_report_markdown"],
            "client": bundle["client_report_markdown"],
        },
        "outputs": outputs,
    }

    try:
        health_rag = (health.get("rag") or {}).get("status", "Green")
        headline = (bundle.get("forecast") or {}).get("headline", "") or ""
        row = ProjectReportRun(
            id=job,
            project_id=project_id,
            rag_status=str(health_rag)[:16],
            forecast_headline=headline[:2000],
            outputs_json=json.dumps(outputs),
        )
        db.add(row)
        db.commit()
    except Exception:
        logger.exception("Persist ProjectReportRun failed job=%s", job)
        db.rollback()

    return payload
