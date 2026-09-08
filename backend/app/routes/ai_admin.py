from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.models import User
from app.db.session import get_db
from app.deps.auth import require_admin
from app.schemas.ai_settings import (
    AiModelsFetchIn,
    AiModelsOut,
    AiPromptOut,
    AiPromptUpdateIn,
    AiSettingsAdminOut,
    AiSettingsPostIn,
    AiSettingsUpdateIn,
    AiTestOut,
)
from app.services import ai_prompt_service, ai_settings_service, event_log_service
from app.utils.email_crypto import decrypt_secret, encrypt_secret

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    c = request.client
    return c.host if c else None


# -------- AI Settings --------


@router.get("/ai-settings", response_model=AiSettingsAdminOut)
def get_ai_settings(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AiSettingsAdminOut:
    settings = get_settings()
    row = ai_settings_service.get_or_create(db)
    return ai_settings_service.to_admin_out(row, settings)


@router.post("/ai-settings", response_model=AiSettingsAdminOut)
def post_ai_settings(
    body: AiSettingsPostIn,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AiSettingsAdminOut:
    settings = get_settings()
    row = ai_settings_service.get_or_create(db)

    # Allow free-form provider (any string, lowercased)
    prov = (body.provider or "openai").strip().lower() or "openai"
    row.provider = prov
    row.base_url = (body.base_url or "").strip()
    row.model = (body.model or "").strip() or "gpt-4o-mini"
    row.enabled = bool(body.enabled)
    row.temperature = float(body.temperature)
    row.max_tokens = int(body.max_tokens)
    row.timeout_ms = int(body.timeout_ms)

    if body.api_key is not None:
        raw = (body.api_key or "").strip()
        if raw == "":
            row.api_key_encrypted = None
        else:
            row.api_key_encrypted = encrypt_secret(settings, raw)

    # Validate if enabled
    gap = ai_settings_service.describe_ready_gap(row, settings)
    # Allow saving disabled even if gap, but if enabled and gap -> 400 unless ollama
    if row.enabled and gap and "could not be decrypted" in gap:
        raise HTTPException(status_code=400, detail=gap)
    # For custom provider, base_url required
    if row.enabled and row.provider == "custom" and not (row.base_url or "").strip():
        raise HTTPException(status_code=400, detail="Base URL is required for custom provider")

    from datetime import datetime, timezone

    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_id = admin.id
    db.add(row)
    db.commit()
    db.refresh(row)

    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.ai_settings.post",
        entity_type="ai_settings",
        entity_id="default",
        detail={"provider": row.provider, "model": row.model, "enabled": row.enabled},
        ip_address=_client_ip(request),
    )

    return ai_settings_service.to_admin_out(row, settings)


@router.patch("/ai-settings", response_model=AiSettingsAdminOut)
def patch_ai_settings(
    body: AiSettingsUpdateIn,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AiSettingsAdminOut:
    settings = get_settings()
    row = ai_settings_service.get_or_create(db)
    fs = body.model_fields_set

    if "provider" in fs and body.provider is not None:
        p = (body.provider or "openai").strip().lower() or "openai"
        row.provider = p
    if "base_url" in fs:
        row.base_url = (body.base_url or "").strip()
    if "model" in fs and body.model is not None:
        row.model = (body.model or "").strip() or "gpt-4o-mini"
    if "enabled" in fs and body.enabled is not None:
        row.enabled = bool(body.enabled)
    if "temperature" in fs and body.temperature is not None:
        row.temperature = float(body.temperature)
    if "max_tokens" in fs and body.max_tokens is not None:
        row.max_tokens = int(body.max_tokens)
    if "timeout_ms" in fs and body.timeout_ms is not None:
        row.timeout_ms = int(body.timeout_ms)
    if "api_key" in fs:
        raw = body.api_key
        if raw is None or (isinstance(raw, str) and raw.strip() == ""):
            # If explicitly sent as "" -> clear; if not in fields_set we wouldn't be here
            # need to distinguish: if key is "" we clear, if None we clear as well (admin chose clear)
            # To keep existing, frontend omits the key from JSON (not in model_fields_set)
            row.api_key_encrypted = None
        else:
            row.api_key_encrypted = encrypt_secret(settings, raw.strip())

    # Validate
    if row.enabled and row.provider == "custom" and not (row.base_url or "").strip():
        raise HTTPException(status_code=400, detail="Base URL is required for custom provider")
    # If enabled and api key missing for non-ollama, allow but warn via describe_ready_gap -> not blocking save? We'll allow save but test will fail.
    # Only block if decryption failed
    gap = ai_settings_service.describe_ready_gap(row, settings)
    if gap and "could not be decrypted" in gap:
        raise HTTPException(status_code=400, detail=gap)

    from datetime import datetime, timezone

    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_id = admin.id
    db.add(row)
    db.commit()
    db.refresh(row)

    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.ai_settings.patch",
        entity_type="ai_settings",
        entity_id="default",
        detail={"fields": sorted(fs)},
        ip_address=_client_ip(request),
    )

    return ai_settings_service.to_admin_out(row, settings)


@router.post("/ai-settings/test", response_model=AiTestOut)
async def test_ai_settings(
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AiTestOut:
    settings = get_settings()
    row = ai_settings_service.get_or_create(db)

    # Use stored settings; if not enabled, still test but warn
    from app.services.ai_client import test_connection

    result = await test_connection(settings, row)

    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.ai_settings.test",
        entity_type="ai_settings",
        entity_id="default",
        detail={"ok": result.get("ok"), "provider": row.provider, "model": row.model},
        ip_address=_client_ip(request),
    )

    return AiTestOut(
        ok=bool(result.get("ok")),
        message=str(result.get("message") or ""),
        latency_ms=result.get("latency_ms"),
        model=result.get("model"),
    )


@router.post("/ai-settings/models", response_model=AiModelsOut)
async def fetch_ai_models(
    body: AiModelsFetchIn | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AiModelsOut:
    """Fetch available models from provider's /models endpoint using saved or provided creds."""
    settings = get_settings()
    row = ai_settings_service.get_or_create(db)

    # Use provided overrides if given, else saved row
    prov = (body.provider if body and body.provider else row.provider) if body else row.provider
    bu = (body.base_url if body and body.base_url is not None else row.base_url) if body else row.base_url
    # For api_key: if body provides non-empty, use it; else use saved
    api_key_override: str | None = None
    if body and "api_key" in body.model_fields_set:
        if body.api_key is not None and body.api_key.strip() != "":
            api_key_override = body.api_key.strip()
        elif body.api_key == "":
            api_key_override = ""  # explicit clear -> treat as empty
        else:
            api_key_override = None  # keep saved
    # If api_key_override is None, fetch_models will use saved

    from app.services.ai_client import fetch_models

    result = await fetch_models(
        settings,
        row,
        provider=prov,
        base_url=bu,
        api_key=api_key_override if api_key_override is not None else None,
        timeout_ms=row.timeout_ms,
    )
    return AiModelsOut(ok=bool(result.get("ok")), message=str(result.get("message") or ""), models=result.get("models") or [])


# -------- AI Prompts --------


@router.get("/ai-prompts", response_model=list[AiPromptOut])
def list_ai_prompts(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AiPromptOut]:
    rows = ai_prompt_service.get_all_prompts(db)
    return [AiPromptOut.model_validate(r) for r in rows]


@router.get("/ai-prompts/{key}", response_model=AiPromptOut)
def get_ai_prompt(
    key: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AiPromptOut:
    row = ai_prompt_service.get_prompt(db, key)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return AiPromptOut.model_validate(row)


@router.patch("/ai-prompts/{key}", response_model=AiPromptOut)
def patch_ai_prompt(
    key: str,
    body: AiPromptUpdateIn,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AiPromptOut:
    row = ai_prompt_service.get_prompt(db, key)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    fs = body.model_fields_set
    if "prompt_template" in fs and body.prompt_template is not None:
        tmpl = (body.prompt_template or "").strip()
        if len(tmpl) < 10:
            raise HTTPException(status_code=400, detail="Prompt template too short (min 10 chars)")
        row.prompt_template = tmpl
    if "is_active" in fs and body.is_active is not None:
        row.is_active = bool(body.is_active)
    if "label" in fs and body.label is not None:
        row.label = (body.label or "").strip() or row.label
    if "description" in fs and body.description is not None:
        row.description = (body.description or "").strip()

    from datetime import datetime, timezone

    row.version = int(row.version or 1) + 1
    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_user_id = admin.id
    db.add(row)
    db.commit()
    db.refresh(row)

    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.ai_prompt.update",
        entity_type="ai_prompt",
        entity_id=key,
        detail={"fields": sorted(fs), "version": row.version},
        ip_address=_client_ip(request),
    )

    return AiPromptOut.model_validate(row)


@router.post("/ai-prompts/reseed", response_model=list[AiPromptOut])
def reseed_ai_prompts(
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AiPromptOut]:
    from app.db.models import AiPrompt

    # Delete all and reseed defaults
    for r in db.query(AiPrompt).all():
        db.delete(r)
    db.flush()
    ai_prompt_service.seed_default_prompts(db)

    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.ai_prompts.reseed",
        entity_type="ai_prompt",
        entity_id="*",
        detail={},
        ip_address=_client_ip(request),
    )

    rows = ai_prompt_service.get_all_prompts(db)
    return [AiPromptOut.model_validate(r) for r in rows]
