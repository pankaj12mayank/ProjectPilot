from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any

import razorpay

from app.db.models import Plan, Subscription, User
from app.services.payment import BasePaymentGateway, PaymentGatewayError

logger = logging.getLogger(__name__)


class RazorpayGateway(BasePaymentGateway):
    code = "razorpay"

    def __init__(self, api_key: str, secret_key: str, webhook_secret: str) -> None:
        self.api_key = api_key
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret
        self.client = razorpay.Client(auth=(api_key, secret_key))

    def _get_or_create_customer(self, user: User) -> str:
        customers = self.client.customer.all({"count": 1, "email": user.email})
        if customers.get("items"):
            return customers["items"][0]["id"]
        customer = self.client.customer.create({
            "email": user.email,
            "name": user.full_name,
            "notes": {"user_id": user.id},
        })
        return customer["id"]

    def _get_plan_id(self, plan: Plan) -> str:
        if not plan.price_monthly:
            raise PaymentGatewayError(f"Plan '{plan.slug}' has no monthly price configured")
        plans = self.client.plan.all({"count": 100})
        for p in plans.get("items", []):
            if p.get("notes", {}).get("plan_slug") == plan.slug:
                return p["id"]
        rp_plan = self.client.plan.create({
            "period": "monthly",
            "interval": 1,
            "item": {
                "name": plan.name,
                "amount": int(plan.price_monthly * 100),
                "currency": plan.currency,
                "description": plan.description or "",
            },
            "notes": {"plan_slug": plan.slug, "plan_id": plan.id},
        })
        return rp_plan["id"]

    def create_checkout_session(
        self,
        user: User,
        plan: Plan,
        success_url: str,
        cancel_url: str,
        subscription: Subscription | None = None,
    ) -> dict[str, Any]:
        plan_id = self._get_plan_id(plan)
        customer_id = self._get_or_create_customer(user)
        try:
            sub = self.client.subscription.create({
                "plan_id": plan_id,
                "customer_id": customer_id,
                "total_count": 1,
                "quantity": 1,
                "notify_info": {"email": user.email},
                "notes": {"plan_slug": plan.slug, "plan_id": plan.id, "user_id": user.id},
            })
            short_url = sub.get("short_url", "")
            return {"url": short_url, "session_id": sub["id"]}
        except razorpay.errors.BadRequestError as e:
            raise PaymentGatewayError(f"Razorpay subscription error: {e}") from e

    def create_customer_portal_link(
        self,
        user: User,
        subscription: Subscription,
        return_url: str,
    ) -> str:
        raise PaymentGatewayError("Razorpay does not provide a customer portal. Contact support for billing changes.")

    def cancel_subscription(self, gateway_subscription_id: str) -> dict[str, Any]:
        try:
            sub = self.client.subscription.cancel(gateway_subscription_id)
            status = sub.get("status", "cancelled")
            return {"status": status, "cancel_at_period_end": True, "current_period_end": int(datetime.now(timezone.utc).timestamp())}
        except razorpay.errors.BadRequestError as e:
            raise PaymentGatewayError(f"Razorpay cancel error: {e}") from e

    def update_subscription_plan(
        self,
        gateway_subscription_id: str,
        new_plan: Plan,
    ) -> dict[str, Any]:
        plan_id = self._get_plan_id(new_plan)
        try:
            sub = self.client.subscription.update(gateway_subscription_id, {
                "plan_id": plan_id,
                "notes": {"plan_slug": new_plan.slug, "plan_id": new_plan.id},
            })
            return {"status": sub.get("status", "active"), "current_period_end": sub.get("current_end") or 0}
        except razorpay.errors.BadRequestError as e:
            raise PaymentGatewayError(f"Razorpay update error: {e}") from e

    def process_webhook(self, payload: bytes, signature: str | None) -> dict[str, Any]:
        if not self.webhook_secret:
            raise PaymentGatewayError("Razorpay webhook secret not configured")
        if not signature:
            raise PaymentGatewayError("Missing Razorpay signature")
        expected = hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise PaymentGatewayError("Razorpay webhook signature mismatch")
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            raise PaymentGatewayError(f"Invalid Razorpay webhook payload: {e}") from e
        event_type = data.get("event", "")
        payload_data = data.get("payload", {}).get("subscription", {}).get("entity", {})
        return {"event_type": event_type, "data": payload_data}

    def get_subscription_status(self, gateway_subscription_id: str) -> dict[str, Any]:
        try:
            sub = self.client.subscription.fetch(gateway_subscription_id)
            return {
                "status": sub.get("status", "unknown"),
                "current_period_end": sub.get("current_end") or 0,
                "cancel_at_period_end": sub.get("ended_at") is not None,
            }
        except razorpay.errors.BadRequestError as e:
            raise PaymentGatewayError(f"Razorpay retrieve error: {e}") from e
