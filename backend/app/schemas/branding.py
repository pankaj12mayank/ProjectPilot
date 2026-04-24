from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator


class SocialLinksIn(BaseModel):
    twitter: str | None = None
    linkedin: str | None = None
    facebook: str | None = None
    github: str | None = None
    youtube: str | None = None


class BrandingPublicOut(BaseModel):
    meta_title: str
    meta_description: str
    social: dict[str, str | None]
    asset_version: int
    asset_urls: dict[str, str | None]
    files_base: str
    accent_color: str = ""


class BrandingAdminOut(BrandingPublicOut):
    assets: dict[str, str | None]
    updated_at: str | None = None
    updated_by_user_id: str | None = None
    max_upload_mb: int = 5


def _empty_str_to_none(v: Any) -> Any:
    if isinstance(v, str) and not v.strip():
        return None
    return v


class BrandingUpdateIn(BaseModel):
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=500)
    social: SocialLinksIn | None = None
    accent_color: str | None = Field(default=None, max_length=16)

    @field_validator("accent_color", mode="before")
    @classmethod
    def accent_hex_optional(cls, v: Any) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return ""
        if not re.match(r"^#[0-9A-Fa-f]{6}$", s):
            raise ValueError("Accent color must be empty or #RRGGBB (six hex digits)")
        return s.lower()


class BrandingUploadOut(BaseModel):
    slot: str
    filename: str
    url: str
    asset_version: int
