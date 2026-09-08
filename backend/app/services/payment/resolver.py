from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import PaymentGateway
from app.services.gateway_service import get_gateway_by_code
from app.services.payment import BasePaymentGateway, PaymentGatewayError

# NOTE: Gateway implementations are imported lazily inside _build_gateway
# to avoid crashing the entire API at startup when optional SDKs
# (stripe, razorpay) are not installed. See production fix below.


def resolve_gateway(db: Session, gateway_code: str) -> BasePaymentGateway:
    gw = get_gateway_by_code(db, gateway_code)
    if not gw:
        raise PaymentGatewayError(f"Gateway '{gateway_code}' not found")
    if not gw.is_enabled:
        raise PaymentGatewayError(f"Gateway '{gateway_code}' is not enabled")
    return _build_gateway(gw)


def resolve_gateway_by_id(db: Session, gateway_id: str) -> BasePaymentGateway:
    from app.services.gateway_service import get_gateway

    gw = get_gateway(db, gateway_id)
    if not gw:
        raise PaymentGatewayError("Gateway not found")
    if not gw.is_enabled:
        raise PaymentGatewayError("Gateway is not enabled")
    return _build_gateway(gw)


def _build_gateway(gw: PaymentGateway) -> BasePaymentGateway:
    if gw.code == "stripe":
        if not gw.secret_key:
            raise PaymentGatewayError("Stripe secret key not configured")
        try:
            from app.services.payment.stripe_gateway import StripeGateway
        except ImportError as e:  # pragma: no cover
            raise PaymentGatewayError(
                "Stripe SDK not installed. Run: pip install stripe>=7.0.0 and restart the API."
            ) from e
        return StripeGateway(
            api_key=gw.secret_key,
            webhook_secret=gw.webhook_secret or "",
        )
    elif gw.code == "razorpay":
        if not gw.api_key or not gw.secret_key:
            raise PaymentGatewayError("Razorpay API key or secret key not configured")
        try:
            from app.services.payment.razorpay_gateway import RazorpayGateway
        except ImportError as e:  # pragma: no cover
            raise PaymentGatewayError(
                "Razorpay SDK not installed. Run: pip install razorpay>=1.4.0 and restart the API."
            ) from e
        return RazorpayGateway(
            api_key=gw.api_key,
            secret_key=gw.secret_key,
            webhook_secret=gw.webhook_secret or "",
        )
    else:
        raise PaymentGatewayError(f"Unsupported gateway: {gw.code}")


def _parse_extra(raw: str) -> dict[str, Any]:
    if not raw or not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}
