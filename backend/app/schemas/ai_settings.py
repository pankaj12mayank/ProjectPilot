"""Admin API models for AI provider configuration and prompts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProviderLiteral = Literal["openai", "anthropic", "gemini", "ollama", "custom"]


class AiSettingsAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    provider: str = "openai"
    base_url: str = ""
    model: str = "gpt-4o-mini"
    enabled: bool = False
    temperature: float = 0.7
    max_tokens: int = 1024
    timeout_ms: int = 15000
    api_key_configured: bool = False
    api_key_masked: str = ""  # e.g. sk-****abcd
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None


class AiSettingsUpdateIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    provider: str | None = Field(default=None, max_length=64)
    base_url: str | None = Field(default=None, max_length=512)
    model: str | None = Field(default=None, max_length=128)
    enabled: bool | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, ge=16, le=8192)
    timeout_ms: int | None = Field(default=None, ge=1000, le=120000)
    api_key: str | None = Field(
        default=None,
        max_length=4096,
        description="Include only when changing. Empty string clears stored key.",
    )


class AiSettingsPostIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    provider: str = Field("openai", max_length=64)
    base_url: str = Field("", max_length=512)
    model: str = Field("gpt-4o-mini", max_length=128)
    enabled: bool = False
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(1024, ge=16, le=8192)
    timeout_ms: int = Field(15000, ge=1000, le=120000)
    api_key: str | None = Field(default=None, max_length=4096)


class AiTestOut(BaseModel):
    ok: bool
    message: str
    latency_ms: int | None = None
    model: str | None = None


class AiPromptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    description: str
    prompt_template: str
    is_active: bool
    version: int
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None


class AiPromptUpdateIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    prompt_template: str | None = Field(default=None, min_length=10, max_length=20000)
    is_active: bool | None = None
    label: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class AiModelsFetchIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    provider: str | None = Field(default=None, max_length=64)
    base_url: str | None = Field(default=None, max_length=512)
    api_key: str | None = Field(default=None, max_length=4096)
    # If not provided, uses saved settings


class AiModelsOut(BaseModel):
    ok: bool
    message: str
    models: list[dict] = Field(default_factory=list)
