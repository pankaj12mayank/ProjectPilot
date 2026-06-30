from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PlanFeatureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    feature_key: str
    feature_label: str
    value: str


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: str | None
    price_monthly: float | None
    price_yearly: float | None
    currency: str
    sort_order: int
    is_active: bool
    is_free: bool
    features: list[PlanFeatureOut]
    created_at: datetime
    updated_at: datetime


class PlanCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    description: str | None = None
    price_monthly: float | None = None
    price_yearly: float | None = None
    currency: str = "GBP"
    sort_order: int = 0
    is_active: bool = True
    is_free: bool = False


class PlanUpdateIn(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    price_monthly: float | None = None
    price_yearly: float | None = None
    currency: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    is_free: bool | None = None


class PlanFeatureUpdateIn(BaseModel):
    features: list[dict[str, str]] = Field(..., description="List of {feature_key, feature_label, value}")


class PaymentGatewayOut(BaseModel):
    id: str
    code: str
    label: str
    is_enabled: bool
    is_test_mode: bool
    created_at: datetime
    updated_at: datetime


class PaymentGatewayAdminOut(PaymentGatewayOut):
    api_key: str | None
    secret_key: str | None
    webhook_secret: str | None
    extra_config_json: str


class PaymentGatewayUpdateIn(BaseModel):
    is_enabled: bool | None = None
    api_key: str | None = None
    secret_key: str | None = None
    webhook_secret: str | None = None
    extra_config_json: str | None = None
    is_test_mode: bool | None = None


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    plan_id: str
    gateway_id: str | None
    status: str
    gateway_subscription_id: str | None
    gateway_customer_id: str | None
    current_period_start: datetime | None
    current_period_end: datetime | None
    cancel_at_period_end: bool
    trial_end: datetime | None
    plan: PlanOut | None = None
    created_at: datetime
    updated_at: datetime


class SubscriptionCheckoutIn(BaseModel):
    plan_slug: str
    gateway_code: str = "stripe"


class SubscriptionChangeIn(BaseModel):
    plan_slug: str
    gateway_code: str | None = None
