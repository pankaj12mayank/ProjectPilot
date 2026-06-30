from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.db.models import Plan, Subscription, User


class PaymentGatewayError(RuntimeError):
    pass


class BasePaymentGateway(ABC):
    """Abstract interface for payment gateway integrations."""

    code: str

    @abstractmethod
    def create_checkout_session(
        self,
        user: User,
        plan: Plan,
        success_url: str,
        cancel_url: str,
        subscription: Subscription | None = None,
    ) -> dict[str, Any]:
        """Create a checkout session and return {url, session_id}."""
        ...

    @abstractmethod
    def create_customer_portal_link(
        self,
        user: User,
        subscription: Subscription,
        return_url: str,
    ) -> str:
        """Create a customer portal/manage-billing link."""
        ...

    @abstractmethod
    def cancel_subscription(self, gateway_subscription_id: str) -> dict[str, Any]:
        """Cancel at period end. Return gateway response."""
        ...

    @abstractmethod
    def update_subscription_plan(
        self,
        gateway_subscription_id: str,
        new_plan: Plan,
    ) -> dict[str, Any]:
        """Change the plan/price on an existing subscription."""
        ...

    @abstractmethod
    def process_webhook(self, payload: bytes, signature: str | None) -> dict[str, Any]:
        """Parse and verify webhook. Return {event_type, data}."""
        ...

    @abstractmethod
    def get_subscription_status(self, gateway_subscription_id: str) -> dict[str, Any]:
        """Fetch current status from gateway. Return {status, current_period_end, cancel_at_period_end}."""
        ...
