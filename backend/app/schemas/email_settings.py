"""Admin API models for transactional email (multi-provider)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

ProviderLiteral = Literal["smtp", "sendgrid"]


class EmailSettingsAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    provider: ProviderLiteral = "smtp"
    enabled: bool
    smtp_host: str
    smtp_port: int
    use_tls: bool
    use_ssl: bool
    smtp_user: str
    from_email: str
    from_name: str
    password_configured: bool
    api_key_configured: bool
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None


class EmailSettingsUpdateIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    provider: ProviderLiteral | None = None
    enabled: bool | None = None
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    use_tls: bool | None = None
    use_ssl: bool | None = None
    smtp_user: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = Field(
        default=None,
        max_length=512,
        description="Include only when changing password. Empty string clears stored password.",
    )
    api_key: str | None = Field(
        default=None,
        max_length=2048,
        description="Include only when changing API key. Empty string clears stored key.",
    )
    from_email: str | None = Field(default=None, max_length=255)
    from_name: str | None = Field(default=None, max_length=200)


class EmailSettingsPostIn(BaseModel):
    """Full save payload (admin UI). Omit secret keys from JSON to leave stored values unchanged."""

    model_config = ConfigDict(str_strip_whitespace=True)

    provider: ProviderLiteral = "smtp"
    enabled: bool = False
    smtp_host: str = Field("", max_length=255)
    smtp_port: int = Field(587, ge=1, le=65535)
    use_tls: bool = True
    use_ssl: bool = False
    smtp_user: str = Field("", max_length=255)
    from_email: str = Field("", max_length=255)
    from_name: str = Field("ProjectPilot", max_length=200)
    smtp_password: str | None = Field(default=None, max_length=512)
    api_key: str | None = Field(default=None, max_length=2048)


class EmailTestIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    to: EmailStr = Field(..., description="Recipient for a one-off test message")


class EmailTestOut(BaseModel):
    ok: bool
    message: str
