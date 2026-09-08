"""Provider-agnostic AI client (OpenAI-compatible). Non-blocking, fallback-safe."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.config.settings import Settings
from app.db.models import AiSettings
from app.services.ai_settings_service import api_key_plain, effective_base_url

logger = logging.getLogger(__name__)


def _chat_completions_url(base_url: str, provider: str) -> str:
    bu = (base_url or "").strip().rstrip("/")
    if not bu:
        return ""
    # All our providers use OpenAI-compatible /chat/completions
    # Anthropic native is /v1/messages but we use OpenAI-compatible proxy path for simplicity;
    # custom/ollama also expose /chat/completions
    if provider == "anthropic" and "/v1" not in bu:
        bu = bu + "/v1"
    if not bu.endswith("/chat/completions"):
        # If user gave e.g. https://api.openai.com/v1, append correctly
        if bu.endswith("/v1"):
            return bu + "/chat/completions"
        return bu + "/chat/completions"
    return bu


async def test_connection(settings: Settings, row: AiSettings) -> dict[str, Any]:
    """Try a minimal chat completion to validate provider connectivity."""
    provider = (row.provider or "openai").strip().lower()
    model = (row.model or "gpt-4o-mini").strip()
    base_url = effective_base_url(row)
    api_key = api_key_plain(settings, row)

    # Ollama local may not require key
    if provider not in ("ollama",) and not api_key:
        return {"ok": False, "message": "API key not configured"}

    if provider == "custom" and not base_url:
        return {"ok": False, "message": "Base URL required for custom provider"}

    url = _chat_completions_url(base_url or "https://api.openai.com/v1", provider)
    if provider == "gemini":
        # Gemini uses different endpoint; for test we treat as OpenAI-compatible if user provided custom base_url,
        # otherwise advise to use custom provider with proper base_url
        if "generativelanguage.googleapis.com" in (base_url or "") and "openai" not in base_url:
            return {"ok": False, "message": "For Gemini, set Base URL to an OpenAI-compatible proxy (e.g. https://generativelanguage.googleapis.com/v1/openai) or use Custom provider"}

    payload: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 5,
        "temperature": 0,
    }
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        # Anthropic uses x-api-key header but we keep Bearer for OpenAI-compatible proxies
        if provider == "anthropic":
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"
        else:
            headers["Authorization"] = f"Bearer {api_key}"

    timeout = max(2.0, min(30.0, (row.timeout_ms or 15000) / 1000.0))
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
        latency = int((time.monotonic() - start) * 1000)
        if resp.status_code == 200:
            data = resp.json()
            # Try to extract content for confirmation
            try:
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            except Exception:
                content = ""
            return {"ok": True, "message": f"Connected to {provider} ({model})" + (f": {content[:60]}" if content else ""), "latency_ms": latency, "model": model}
        else:
            body = resp.text[:500]
            # Common error hints
            if resp.status_code == 401:
                return {"ok": False, "message": f"Authentication failed (401): check API key. {body}"}
            if resp.status_code == 404:
                return {"ok": False, "message": f"Endpoint not found (404): check Base URL. {body}"}
            return {"ok": False, "message": f"Provider returned {resp.status_code}: {body}"}
    except httpx.TimeoutException:
        return {"ok": False, "message": f"Connection timed out after {int(timeout)}s — check Base URL and network"}
    except Exception as e:
        logger.warning("AI test connection failed: %s", e)
        return {"ok": False, "message": f"Connection failed: {e}"}


async def fetch_models(
    settings: Settings,
    row: AiSettings | None = None,
    *,
    provider: str | None = None,
    base_url: str | None = None,
    api_key: str | None = None,
    timeout_ms: int | None = None,
) -> dict[str, Any]:
    """Fetch available models from provider's /models endpoint. Returns {ok, models:[{id, is_free}], message}."""
    # Resolve from row if not explicitly passed
    prov = (provider or (row.provider if row else "openai") or "openai").strip().lower()
    bu = (base_url if base_url is not None else (effective_base_url(row) if row else "")) or ""
    if not bu:
        bu = effective_base_url(row) if row else "https://api.openai.com/v1"
        if not bu and prov == "custom":
            return {"ok": False, "message": "Base URL required for custom provider", "models": []}
    bu = bu.strip().rstrip("/")
    # Build models URL
    if bu.endswith("/chat/completions"):
        models_url = bu.replace("/chat/completions", "/models")
    elif bu.endswith("/v1"):
        models_url = bu + "/models"
    else:
        models_url = bu + "/models" if not bu.endswith("/models") else bu

    # Resolve api key
    key = api_key
    if key is None and row is not None:
        key = api_key_plain(settings, row)
    # Ollama may not need key
    if prov not in ("ollama",) and not key:
        return {"ok": False, "message": "API key not configured", "models": []}

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if key:
        if prov == "anthropic":
            headers["x-api-key"] = key
            headers["anthropic-version"] = "2023-06-01"
        else:
            headers["Authorization"] = f"Bearer {key}"

    timeout = max(3.0, min(15.0, (timeout_ms or (row.timeout_ms if row else 15000) or 15000) / 1000.0))
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(models_url, headers=headers)
        if resp.status_code != 200:
            body = resp.text[:600]
            if resp.status_code == 401:
                return {"ok": False, "message": f"Authentication failed (401): check API key. {body}", "models": []}
            if resp.status_code == 404:
                return {"ok": False, "message": f"Models endpoint not found (404): check Base URL. Tried {models_url}. {body}", "models": []}
            return {"ok": False, "message": f"Provider returned {resp.status_code}: {body}", "models": []}
        data = resp.json()
        raw_models: list[dict[str, Any]] = []
        if isinstance(data, dict):
            if "data" in data and isinstance(data["data"], list):
                raw_models = data["data"]
            elif "models" in data and isinstance(data["models"], list):
                raw_models = data["models"]
            elif "data" not in data and "models" not in data:
                # Ollama /api/tags format: {"models": [{"name": "llama3.1"}]}
                if "models" in data:
                    raw_models = data["models"]
        # Normalize to {id, is_free}
        free_keywords = {"free", "mini", "flash", "turbo", "llama", "mistral", "qwen", "gemma", "phi"}
        # Known free tier models
        known_free = {
            "gpt-4o-mini", "gpt-3.5-turbo", "gemini-1.5-flash", "gemini-pro", "llama3.1", "llama3", "mistral", "qwen2", "phi-3",
            "gpt-4o-mini-2024-07-18", "gemini-1.5-flash-002",
        }
        normalized: list[dict[str, Any]] = []
        for m in raw_models:
            mid = str(m.get("id") or m.get("name") or m.get("model") or "").strip()
            if not mid:
                continue
            low = mid.lower()
            is_free = any(k in low for k in free_keywords) or low in known_free or "free" in low
            normalized.append({"id": mid, "is_free": is_free, "raw": m})
        # Sort: free first, then alphabetical
        normalized.sort(key=lambda x: (0 if x["is_free"] else 1, x["id"].lower()))
        return {"ok": True, "message": f"Found {len(normalized)} models", "models": normalized}
    except httpx.TimeoutException:
        return {"ok": False, "message": f"Timed out after {int(timeout)}s — check Base URL", "models": []}
    except Exception as e:
        logger.warning("fetch_models failed: %s", e)
        return {"ok": False, "message": f"Failed to fetch models: {e}", "models": []}


def render_prompt(template: str, variables: dict[str, Any]) -> str:
    """Simple {{var}} replacement (no eval)."""
    out = template
    for k, v in variables.items():
        placeholder = "{{" + k + "}}"
        if placeholder in out:
            # Serialize complex values to compact JSON string
            if isinstance(v, (dict, list)):
                import json

                try:
                    sval = json.dumps(v, ensure_ascii=False)[:8000]
                except Exception:
                    sval = str(v)[:8000]
            else:
                sval = str(v) if v is not None else ""
            out = out.replace(placeholder, sval)
    return out


async def chat_completion(
    settings: Settings,
    row: AiSettings,
    messages: list[dict[str, str]],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str | None:
    """Call provider and return assistant content string, or None on disabled/failure (caller falls back)."""
    if not row.enabled:
        return None
    provider = (row.provider or "openai").strip().lower()
    model = (row.model or "gpt-4o-mini").strip()
    base_url = effective_base_url(row)
    api_key = api_key_plain(settings, row)
    if provider not in ("ollama",) and not api_key:
        logger.info("AI chat skipped: api key not configured")
        return None
    url = _chat_completions_url(base_url or "https://api.openai.com/v1", provider)
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        if provider == "anthropic":
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"
        else:
            headers["Authorization"] = f"Bearer {api_key}"
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": float(temperature if temperature is not None else row.temperature or 0.7),
        "max_tokens": int(max_tokens if max_tokens is not None else row.max_tokens or 1024),
    }
    timeout = max(2.0, min(30.0, (row.timeout_ms or 15000) / 1000.0))
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            logger.warning("AI chat non-200 %s: %s", resp.status_code, resp.text[:400])
            return None
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
        return None
    except Exception as e:
        logger.warning("AI chat failed: %s", e)
        return None
