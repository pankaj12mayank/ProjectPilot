"""Non-breaking AI enhancer — enriches rule-based intelligence when AI is enabled, else noop."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.db.models import AiSettings
from app.services.ai_prompt_service import get_prompt_template
from app.services.ai_client import chat_completion, render_prompt

logger = logging.getLogger(__name__)


async def enhance_forecast_narrative(
    db: Session,
    settings: Settings,
    ai_row: AiSettings,
    health: dict[str, Any],
    forecast: dict[str, Any],
    project_name: str,
) -> dict[str, Any] | None:
    if not ai_row.enabled:
        return None
    tmpl = get_prompt_template(db, "forecast_narrative")
    if not tmpl:
        return None
    prompt = render_prompt(tmpl, {"health_json": health, "forecast_json": forecast, "project_name": project_name})
    messages = [{"role": "user", "content": prompt}]
    content = await chat_completion(settings, ai_row, messages, temperature=0.7, max_tokens=400)
    if not content:
        return None
    return {"ai_narrative": content, "source": f"{ai_row.provider}:{ai_row.model}"}


async def enhance_recommendations(
    db: Session,
    settings: Settings,
    ai_row: AiSettings,
    health: dict[str, Any],
    forecast: dict[str, Any],
    causes: list[dict[str, Any]],
    rule_recs: list[dict[str, Any]],
    project_name: str,
) -> list[dict[str, Any]] | None:
    if not ai_row.enabled:
        return None
    tmpl = get_prompt_template(db, "recommendation_generator")
    if not tmpl:
        return None
    prompt = render_prompt(
        tmpl,
        {
            "health_json": health,
            "forecast_json": forecast,
            "causes_json": causes,
            "existing_recs_json": rule_recs,
            "project_name": project_name,
        },
    )
    messages = [{"role": "user", "content": prompt}]
    content = await chat_completion(settings, ai_row, messages, temperature=0.7, max_tokens=1200)
    if not content:
        return None
    # Try to parse JSON list from AI, else fallback to wrapping as single rec
    try:
        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed[:8]
    except Exception:
        pass
    # If not JSON, return as single AI rec
    return [
        {
            "priority": 1,
            "title": "AI recommendation",
            "detail": content[:800],
            "owner_hint": "AI",
            "metric_refs": [],
            "root_cause_ids": [],
            "engine": f"ai:{ai_row.provider}",
        }
    ]


async def chat_with_project(
    db: Session,
    settings: Settings,
    ai_row: AiSettings,
    health: dict[str, Any],
    forecast: dict[str, Any],
    risks: list[dict[str, Any]],
    project_name: str,
    user_question: str,
) -> str | None:
    if not ai_row.enabled:
        return None
    tmpl = get_prompt_template(db, "chat_with_project")
    if not tmpl:
        tmpl = "You are ProjectPilot AI. Context: health {{health_json}} forecast {{forecast_json}} risks {{risks_json}}. Question: {{question}}"
    system = render_prompt(
        tmpl,
        {"health_json": health, "forecast_json": forecast, "risks_json": risks, "project_name": project_name},
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_question},
    ]
    content = await chat_completion(settings, ai_row, messages, temperature=0.6, max_tokens=800)
    return content
