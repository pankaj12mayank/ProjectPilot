from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

SidebarLogoFilter = Literal["auto", "invert", "original"]


class SocialLinksIn(BaseModel):
    twitter: str | None = None
    linkedin: str | None = None
    facebook: str | None = None
    github: str | None = None
    youtube: str | None = None


class BrandingPublicOut(BaseModel):
    product_name: str
    product_tagline: str
    footer_text: str
    support_email: str
    company_address: str
    social: dict[str, str | None]
    meta_title: str
    meta_description: str
    default_domain_url: str
    company_website_url: str
    public_api_url: str
    public_app_url: str
    asset_version: int
    asset_urls: dict[str, str | None]
    files_base: str
    sidebar_logo_filter: SidebarLogoFilter = "auto"
    accent_color_light: str = ""
    accent_color_dark: str = ""


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
    product_name: str | None = Field(default=None, min_length=1, max_length=200)
    product_tagline: str | None = Field(default=None, max_length=500)
    footer_text: str | None = Field(default=None, max_length=500)
    support_email: str | None = Field(default=None, max_length=255)
    company_address: str | None = Field(default=None, max_length=4000)
    social: SocialLinksIn | None = None
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=500)
    default_domain_url: str | None = Field(default=None, max_length=512)
    company_website_url: str | None = Field(default=None, max_length=512)
    public_api_url: str | None = Field(default=None, max_length=512)
    public_app_url: str | None = Field(default=None, max_length=512)
    sidebar_logo_filter: SidebarLogoFilter | None = None
    accent_color_light: str | None = Field(default=None, max_length=16)
    accent_color_dark: str | None = Field(default=None, max_length=16)

    @field_validator(
        "default_domain_url",
        "company_website_url",
        "public_api_url",
        "public_app_url",
        mode="before",
    )
    @classmethod
    def blank_url_to_none(cls, v: Any) -> Any:
        return _empty_str_to_none(v)

    @field_validator("accent_color_light", "accent_color_dark", mode="before")
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
