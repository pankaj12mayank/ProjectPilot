from __future__ import annotations

import logging
from typing import Any

import stripe

from app.db.models import Plan, Subscription, User
from app.services.payment import BasePaymentGateway, PaymentGatewayError

logger = logging.getLogger(__name__)


class StripeGateway(BasePaymentGateway):
    code = "stripe"

    def __init__(self, api_key: str, webhook_secret: str) -> None:
        self.api_key = api_key
        self.webhook_secret = webhook_secret
        stripe.api_key = api_key

    def _get_or_create_customer(self, user: User) -> str:
        customers = stripe.Customer.list(email=user.email, limit=1)
        if customers.data:
            return customers.data[0].id
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
            metadata={"user_id": user.id},
        )
        return customer.id

    def _get_price_id(self, plan: Plan) -> str:
        if not plan.price_monthly:
            raise PaymentGatewayError(f"Plan '{plan.slug}' has no monthly price configured")
        price_id = f"price_placeholder_{plan.slug}"
        try:
            prices = stripe.Price.list(metadata={"plan_slug": plan.slug}, limit=1, active=True)
            if prices.data:
                price_id = prices.data[0].id
            else:
                product = stripe.Product.create(
                    name=plan.name,
                    metadata={"plan_slug": plan.slug, "plan_id": plan.id},
                )
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=int(plan.price_monthly * 100),
                    currency=plan.currency.lower(),
                    recurring={"interval": "month"},
                    metadata={"plan_slug": plan.slug},
                )
                price_id = price.id
        except stripe.StripeError as e:
            raise PaymentGatewayError(f"Stripe price error: {e.user_message or str(e)}") from e
        return price_id

    def create_checkout_session(
        self,
        user: User,
        plan: Plan,
        success_url: str,
        cancel_url: str,
        subscription: Subscription | None = None,
    ) -> dict[str, Any]:
        customer_id = self._get_or_create_customer(user)
        price_id = self._get_price_id(plan)
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    "plan_slug": plan.slug,
                    "plan_id": plan.id,
                    "user_id": user.id,
                },
                subscription_data={
                    "metadata": {
                        "plan_slug": plan.slug,
                        "plan_id": plan.id,
                        "user_id": user.id,
                    },
                },
            )
            return {"url": session.url, "session_id": session.id}
        except stripe.StripeError as e:
            raise PaymentGatewayError(f"Stripe checkout error: {e.user_message or str(e)}") from e

    def create_customer_portal_link(
        self,
        user: User,
        subscription: Subscription,
        return_url: str,
    ) -> str:
        if not subscription.gateway_customer_id:
            customers = stripe.Customer.list(email=user.email, limit=1)
            if not customers.data:
                raise PaymentGatewayError("No Stripe customer found")
            customer_id = customers.data[0].id
        else:
            customer_id = subscription.gateway_customer_id
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            return session.url
        except stripe.StripeError as e:
            raise PaymentGatewayError(f"Stripe portal error: {e.user_message or str(e)}") from e

    def cancel_subscription(self, gateway_subscription_id: str) -> dict[str, Any]:
        try:
            sub = stripe.Subscription.modify(
                gateway_subscription_id,
                cancel_at_period_end=True,
            )
            return {"status": sub.status, "cancel_at_period_end": sub.cancel_at_period_end, "current_period_end": sub.current_period_end}
        except stripe.StripeError as e:
            raise PaymentGatewayError(f"Stripe cancel error: {e.user_message or str(e)}") from e

    def update_subscription_plan(
        self,
        gateway_subscription_id: str,
        new_plan: Plan,
    ) -> dict[str, Any]:
        price_id = self._get_price_id(new_plan)
        try:
            sub = stripe.Subscription.modify(
                gateway_subscription_id,
                items=[{"id": sub_item.id, "price": price_id}],
                metadata={"plan_slug": new_plan.slug, "plan_id": new_plan.id},
            )
            return {"status": sub.status, "current_period_end": sub.current_period_end}
        except stripe.StripeError as e:
            raise PaymentGatewayError(f"Stripe update error: {e.user_message or str(e)}") from e

    def process_webhook(self, payload: bytes, signature: str | None) -> dict[str, Any]:
        if not self.webhook_secret:
            raise PaymentGatewayError("Stripe webhook secret not configured")
        if not signature:
            raise PaymentGatewayError("Missing Stripe signature")
        try:
            event = stripe.Webhook.construct_event(payload, signature, self.webhook_secret)
        except (stripe.SignatureVerificationError, ValueError) as e:
            raise PaymentGatewayError(f"Stripe webhook verification failed: {e}") from e
        event_type = event.get("type", "")
        data = event.get("data", {}).get("object", {})
        return {"event_type": event_type, "data": data}

    def get_subscription_status(self, gateway_subscription_id: str) -> dict[str, Any]:
        try:
            sub = stripe.Subscription.retrieve(gateway_subscription_id)
            return {
                "status": sub.status,
                "current_period_end": sub.current_period_end,
                "cancel_at_period_end": sub.cancel_at_period_end,
            }
        except stripe.StripeError as e:
            raise PaymentGatewayError(f"Stripe retrieve error: {e.user_message or str(e)}") from e
