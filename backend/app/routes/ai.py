from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.models import User
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.deps.project import fetch_accessible_project
from app.services.ai_prompt_service import get_prompt_template
from app.services.ai_settings_service import get_or_create as get_ai_settings
from app.services.ai_client import render_prompt, chat_completion
from app.services.analytics.project_health import build_project_health_payload

router = APIRouter()


class ChatIn(BaseModel):
    question: str


class ChatOut(BaseModel):
    answer: str
    provider: str
    model: str
    fallback: bool = False


@router.post("/projects/{project_id}/ai/chat", response_model=ChatOut)
async def project_ai_chat(
    project_id: str,
    body: ChatIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    settings = get_settings()
    ai_row = get_ai_settings(db)
    if not ai_row.enabled:
        raise HTTPException(status_code=400, detail="AI is disabled. Enable it in Admin -> AI Configuration.")

    project = fetch_accessible_project(db, project_id, user)
    health = build_project_health_payload(db, project_id, settings)
    # Get forecast for context without AI to avoid recursion
    from app.services.intelligence.package import build_intelligence_core

    core = build_intelligence_core(health)
    forecast = core.get("forecast") or {}
    risks = (health.get("registered_risks") or [])[:10]

    tmpl = get_prompt_template(db, "chat_with_project")
    if not tmpl:
        tmpl = "You are ProjectPilot AI. Project {{project_name}} health {{health_json}} forecast {{forecast_json}} risks {{risks_json}}. Question: {{question}}"
    system = render_prompt(
        tmpl,
        {
            "health_json": health,
            "forecast_json": forecast,
            "risks_json": risks,
            "project_name": project.name,
            "question": body.question,
        },
    )
    # If template already contains question placeholder, just use system as single user message; else add user question
    messages = []
    if "{{question}}" in (tmpl or ""):
        messages = [{"role": "user", "content": system}]
    else:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": body.question},
        ]

    content = await chat_completion(settings, ai_row, messages, temperature=0.6, max_tokens=900)
    if not content:
        # Fallback: rule-based answer
        rag = (health.get("rag") or {}).get("status", "Unknown")
        fallback_msg = f"AI is currently unavailable (provider: {ai_row.provider}). Rule-based context: RAG={rag}, risk_score={(health.get('risk') or {}).get('risk_score')}, SPI={(health.get('evm') or {}).get('spi')}. Please try again later or contact admin to check AI Configuration -> Test Connection."
        return ChatOut(answer=fallback_msg, provider=ai_row.provider, model=ai_row.model, fallback=True)

    return ChatOut(answer=content, provider=ai_row.provider, model=ai_row.model, fallback=False)


@router.get("/projects/{project_id}/ai/intelligence")
async def project_ai_intelligence(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    settings = get_settings()
    ai_row = get_ai_settings(db)
    project = fetch_accessible_project(db, project_id, user)
    health = build_project_health_payload(db, project_id, settings)
    from app.services.intelligence.package import build_intelligence_core

    core = build_intelligence_core(health)  # rule-based

    if not ai_row.enabled:
        return {**core, "ai_enabled": False, "ai_enhanced": False}

    # Try to enhance forecast narrative and recommendations with AI (non-blocking, fallback to rule)
    from app.services.ai_enhancer import enhance_forecast_narrative, enhance_recommendations

    try:
        ai_narrative = await enhance_forecast_narrative(db, settings, ai_row, health, core.get("forecast") or {}, project.name)
        ai_recs = await enhance_recommendations(db, settings, ai_row, health, core.get("forecast") or {}, core.get("root_causes") or [], core.get("recommendations") or [], project.name)
    except Exception:
        ai_narrative = None
        ai_recs = None

    out: dict = {**core, "ai_enabled": True, "ai_enhanced": bool(ai_narrative or ai_recs), "ai_provider": ai_row.provider, "ai_model": ai_row.model}
    if ai_narrative:
        out["forecast_ai"] = ai_narrative
    if ai_recs:
        # Merge: AI recs first, then rule recs deduped
        seen = {r.get("title") for r in ai_recs}
        merged = list(ai_recs)
        for r in core.get("recommendations") or []:
            if r.get("title") not in seen:
                merged.append(r)
        out["recommendations_ai"] = merged[:12]
    return out
