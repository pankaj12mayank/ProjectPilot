"""Admin-editable AI prompt templates (12 defaults, versioned)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.models import AiPrompt

logger = logging.getLogger(__name__)

# 12 core prompts — admin can edit template or disable without code deploy
# Best-quality versions: detailed role, context, output format, constraints, placeholders
DEFAULT_PROMPTS: list[dict[str, str]] = [
    {
        "key": "upload_validation_assistant",
        "label": "Upload Validation Assistant",
        "description": "Explains validation errors in plain language and suggests column mapping fixes for status/raid/weekly files.",
        "prompt_template": (
            "You are ProjectPilot Data Validation Assistant. Project file_role={{file_role}}.\n"
            "Context:\n- errors_json={{errors_json}}\n- mapping_json={{mapping_json}}\n"
            "Task: For each error code (missing_columns, empty_column, duplicate_row, missing_value, invalid_format), explain in 1 line plain English (Hindi mix ok) WHY it failed and HOW to fix in Excel/CSV. For missing_columns suggest exact canonical rename e.g. 'Planned %' not 'Plan % (old)'. For duplicate_row mention which rows to deduplicate. For invalid_format show valid range 0-100.\n"
            "Output: Bullet list, max 8 bullets, no hallucination, no invented column names. If no errors, say 'No issues — file is valid'."
        ),
    },
    {
        "key": "anomaly_explain",
        "label": "Anomaly Explanation",
        "description": "Explains outliers in hours/cost/completion detected during cleaning.",
        "prompt_template": (
            "You are a Project Data Quality Analyst for {{project_name}}.\n"
            "Anomalies: {{anomaly_json}}\n"
            "Task: For each outlier (e.g. Actual Hours >> Planned Hours, Actual Cost spike, Completion >100% or <0%), write 1 bullet: what is abnormal (with numbers), why it matters (schedule/cost impact), and what to verify (vendor invoice, entry typo, scope change, re-estimate).\n"
            "Constraints: 3-5 bullets only, non-technical, cite metric name + value, never invent tasks. If no anomalies, say 'No significant anomalies'."
        ),
    },
    {
        "key": "risk_summarizer",
        "label": "RAID Risk Summarizer",
        "description": "Summarizes open high RAID risks for executive view.",
        "prompt_template": (
            "You are a Risk Lead for {{project_name}}.\n"
            "RAID risks JSON (open high severity): {{risks_json}}\n"
            "Task: Produce 3-5 line executive summary: 1) Top risk title + severity, 2) count of open high risks, 3) most urgent owner action (assign owner + mitigation date). Use crisp business English, no jargon, include severity and status verbatim.\n"
            "Do not invent risks. If empty, say 'No open high risks — routine tracking continues.'"
        ),
    },
    {
        "key": "forecast_narrative",
        "label": "Forecast Narrative",
        "description": "Generates human narrative for forecast headline and drivers.",
        "prompt_template": (
            "You are a PMO Analyst. Project health={{health_json}} Forecast={{forecast_json}}\n"
            "Task: Write: 1) Headline 2-3 sentences: overall outlook (On track / Schedule pressure / Cost pressure / Critical) using SPI, CPI, risk_score, utilization_ratio numbers. 2) Exactly 3 driver bullets each 1 line: Schedule (SPI + schedule_variance_sum), Cost (CPI + cost_variance_sum), Risk/Resource (risk_score or utilization_ratio + at-risk flag). Cite numbers like SPI=0.92.\n"
            "Style: Factual, no optimism bias, mention confidence (low/medium). No new metrics."
        ),
    },
    {
        "key": "root_cause_narrator",
        "label": "Root Cause Narrator",
        "description": "Turns structured root causes into evidence-linked paragraphs.",
        "prompt_template": (
            "You are a Root Cause Analyst for {{project_name}}.\n"
            "Causes: {{causes_json}} Health: {{health_json}}\n"
            "Task: For each cause id (rc_spi, rc_cpi, rc_schedule_spread, rc_cost_burn, rc_open_high_risks, rc_overwork, rc_milestones, rc_rag), write 2-3 lines: Category [Severity] Statement + Evidence line with actual numbers (SPI=, CPI=, SVsum=, risk_score). Keep original id and severity.\n"
            "Output: Numbered list, evidence in parentheses. If no causes, say 'No structural root cause beyond thresholds'."
        ),
    },
    {
        "key": "recommendation_generator",
        "label": "Recommendation Generator",
        "description": "Generates personalized actionable recommendations with owner, timeline, dependencies.",
        "prompt_template": (
            "You are a Delivery Lead for quality recommendations.\n"
            "Inputs: health={{health_json}} forecast={{forecast_json}} root_causes={{causes_json}} existing_recs={{existing_recs_json}}\n"
            "Task: Generate 5-8 NEW actions sorted priority 1 (critical) to 3 (routine). Each as JSON: {\"title\":\"...\",\"detail\":\"2 lines how + when (e.g. within 48h)\",\"owner_hint\":\"PM/Finance/Sponsor...\",\"metric_refs\":[{\"metric\":\"SPI\",\"value\":0.88,\"source\":\"evm\"}],\"root_cause_ids\":[\"rc_spi\"],\"priority\":1}. Rules: Title must be unique vs existing_recs, detail 20-30 words, owner_hint specific, priority realistic, metric_refs cite SPI/CPI/risk_score/utilization.\n"
            "Output: JSON array only, no markdown, 5-8 items, valid JSON."
        ),
    },
    {
        "key": "exec_summary_sponsor",
        "label": "Executive Summary (Sponsor)",
        "description": "One-pager for sponsor/executive.",
        "prompt_template": (
            "You are writing for Sponsor/Steering Committee. Project={{project_name}} RAG={{rag}}\n"
            "Health={{health_json}} Forecast={{forecast_json}} Top risks={{risks_json}}\n"
            "Task: Markdown 4 sections, 200 words max:\n## Status (RAG + completion % + SPI/CPI)\n## Outlook (forecast headline + weeks to 100% if available)\n## Top Risks (up to 3 with severity)\n## Next 3 Actions (from recommendations, with owner)\n"
            "Tone: Crisp, no jargon, numbers first. If RAG Red, start with escalation. No invented data."
        ),
    },
    {
        "key": "pm_detailed_report",
        "label": "PM Detailed Report",
        "description": "Detailed markdown for PM with all sections.",
        "prompt_template": (
            "You are PMO report writer for {{project_name}}.\n"
            "Context: health={{health_json}} forecast={{forecast_json}} causes={{causes_json}} recs={{recs_json}}\n"
            "Task: Write markdown ~500 words, 9 sections exact headings: ### 1 Data Completeness (missing_roles), ### 2 KPI Snapshot (completion, SV sums, last weekly), ### 3 EVM (PV/EV/AC/SPI/CPI/VAC/TCPI), ### 4 Forecast (completion_date, budget_overrun, risk_escalation, resource_overload), ### 5 RAID Summary, ### 6 Milestones (late/avg delay), ### 7 Resources (utilization, top overloaded), ### 8 Root Causes (all), ### 9 Recommendations (all prioritized).\n"
            "Constraints: Factual, tables where helpful, cite numbers, no hallucination."
        ),
    },
    {
        "key": "client_report_tone",
        "label": "Client Report Tone",
        "description": "Client-friendly narrative with RAG-based tone.",
        "prompt_template": (
            "You are Client Communication Lead. RAG={{rag}} Health={{health_json}}\n"
            "Task: Write client-facing update 150 words: 1 line status per RAG (Green='Tracking well', Amber='Watching closely, mitigation in progress', Red='Material attention, leadership engaged'), then 3 bullets: Progress (completion %), Risks (non-alarmist, 1 line), Next Steps (2 items). Tone warm, professional, avoid internal jargon (SPI/CPI). No invented milestones."
        ),
    },
    {
        "key": "portfolio_insight",
        "label": "Portfolio Insight",
        "description": "Cross-project comparison narrative for portfolio dashboard.",
        "prompt_template": (
            "You are Portfolio Analyst. Portfolio JSON={{portfolio_json}} (projects, by_rag, avg SPI, top risky, trends)\n"
            "Task: 3-4 sentence insight: Sentence1 overall health (e.g. 7/10 Green, avg completion 68%), Sentence2 top 2 at-risk projects with reason (SPI 0.85, risk_score 6), Sentence3 one cross-project correlation (e.g. same resource overload across 3 projects), Sentence4 one suggested portfolio action.\n"
            "Rules: Use only provided numbers, name projects exactly as in JSON, no invented projects."
        ),
    },
    {
        "key": "email_draft",
        "label": "Governance Email Draft",
        "description": "Polished governance email draft for stakeholders.",
        "prompt_template": (
            "You are Governance PM drafting email. Project={{project_name}} RAG={{rag}}\n"
            "Health={{health_json}} Forecast headline={{forecast_headline}} Top recs={{recs_json}}\n"
            "Task: Output Subject: [RAG] ProjectName - headline (60 chars) + Body 180 words: Greeting, 2 lines status (completion/SPI/CPI), 3 bullet next steps with owner + due hint, closing + disclaimer 'Data as of uploaded files'. Professional tone.\n"
            "No new risks beyond provided."
        ),
    },
    {
        "key": "chat_with_project",
        "label": "Chat with Project",
        "description": "System prompt for natural language Q&A about a project.",
        "prompt_template": (
            "You are ProjectPilot AI Assistant for {{project_name}}.\n"
            "You have ONLY this context: health={{health_json}} forecast={{forecast_json}} risks={{risks_json}}.\n"
            "Rules: 1) Answer ONLY from context, cite metric (e.g. SPI 0.92) when relevant. 2) If question asks for data not in context (e.g. specific person, date not uploaded), say 'I don't have that in uploaded files — please upload latest tracker/RAID'. 3) Be concise (2-4 sentences + bullets if needed), helpful, no hallucination, no disallowed content. 4) If RAG Red, mention escalation.\n"
            "Question: {{question}}"
        ),
    },
]


def get_all_prompts(db: Session) -> list[AiPrompt]:
    rows = db.query(AiPrompt).order_by(AiPrompt.key).all()
    return rows


def get_prompt(db: Session, key: str) -> AiPrompt | None:
    return db.get(AiPrompt, key)


def get_prompt_template(db: Session, key: str) -> str | None:
    row = db.get(AiPrompt, key)
    if row and row.is_active and row.prompt_template.strip():
        return row.prompt_template
    # fallback to default
    for d in DEFAULT_PROMPTS:
        if d["key"] == key:
            return d["prompt_template"]
    return None


def ensure_ai_prompt_migrations(db: Session) -> None:
    try:
        from sqlalchemy import inspect

        bind = db.get_bind()
        insp = inspect(bind)
        if "ai_prompts" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("ai_prompts")}
        dialect = bind.dialect.name

        def run(sqlite_sql: str, pg_sql: str) -> None:
            if dialect == "postgresql":
                db.execute(text(pg_sql))
            else:
                db.execute(text(sqlite_sql))
            db.commit()

        if "description" not in cols:
            run(
                "ALTER TABLE ai_prompts ADD COLUMN description TEXT DEFAULT ''",
                "ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''",
            )
        if "is_active" not in cols:
            run(
                "ALTER TABLE ai_prompts ADD COLUMN is_active BOOLEAN DEFAULT 1",
                "ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT 1",
            )
        if "version" not in cols:
            run(
                "ALTER TABLE ai_prompts ADD COLUMN version INTEGER DEFAULT 1",
                "ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1",
            )
    except Exception:
        logger.exception("ensure_ai_prompt_migrations failed")
        db.rollback()


def seed_default_prompts(db: Session) -> None:
    try:
        existing = {r.key: r for r in db.query(AiPrompt).all()}
        to_add: list[AiPrompt] = []
        for d in DEFAULT_PROMPTS:
            if d["key"] not in existing:
                to_add.append(
                    AiPrompt(
                        key=d["key"],
                        label=d["label"],
                        description=d["description"],
                        prompt_template=d["prompt_template"],
                        is_active=True,
                        version=1,
                        updated_at=datetime.now(timezone.utc),
                    )
                )
        if to_add:
            db.add_all(to_add)
            db.commit()
            # refresh after add
            existing = {r.key: r for r in db.query(AiPrompt).all()}
        # Upgrade existing rows that are still on old short templates (v1) to best-quality versions
        # Heuristic: if version==1 and template length < 500 or missing new markers, auto-upgrade
        for d in DEFAULT_PROMPTS:
            row = existing.get(d["key"])
            if not row:
                continue
            old = (row.prompt_template or "")
            new = d["prompt_template"]
            needs_upgrade = False
            if not old.strip():
                needs_upgrade = True
            elif row.version == 1 and len(old.strip()) < 500:
                # old prompts were <300 chars, new are >500
                needs_upgrade = True
            elif row.version == 1 and old.strip() != new.strip() and "Task:" not in old and "Task:" in new:
                needs_upgrade = True
            if needs_upgrade:
                row.prompt_template = new
                row.label = d["label"]
                row.description = d["description"]
                row.version = 2  # bump to indicate auto-upgraded to best-quality
                row.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        logger.exception("seed_default_prompts failed")
        db.rollback()
