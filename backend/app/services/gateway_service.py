from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import PaymentGateway


GATEWAY_CODES = frozenset({"stripe", "razorpay"})


def seed_gateways(db: Session) -> None:
    for code in GATEWAY_CODES:
        existing = db.scalar(select(PaymentGateway).where(PaymentGateway.code == code))
        if existing:
            continue
        label = {"stripe": "Stripe", "razorpay": "Razorpay"}.get(code, code.title())
        gw = PaymentGateway(
            id=str(uuid.uuid4()),
            code=code,
            label=label,
            is_enabled=False,
            is_test_mode=True,
        )
        db.add(gw)
    db.commit()


def get_all_gateways(db: Session) -> list[PaymentGateway]:
    return list(db.scalars(select(PaymentGateway).order_by(PaymentGateway.code)).all())


def get_enabled_gateways(db: Session) -> list[PaymentGateway]:
    return list(
        db.scalars(
            select(PaymentGateway).where(PaymentGateway.is_enabled.is_(True)).order_by(PaymentGateway.code)
        ).all()
    )


def get_gateway(db: Session, gateway_id: str) -> PaymentGateway | None:
    return db.get(PaymentGateway, gateway_id)


def get_gateway_by_code(db: Session, code: str) -> PaymentGateway | None:
    return db.scalar(select(PaymentGateway).where(PaymentGateway.code == code))


def update_gateway(db: Session, gw: PaymentGateway, data: dict[str, Any]) -> PaymentGateway:
    sensitive = {"api_key", "secret_key", "webhook_secret"}
    for field in ("is_enabled", "api_key", "secret_key", "webhook_secret", "extra_config_json", "is_test_mode", "label"):
        if field in data:
            val = data[field]
            if field in sensitive and val is not None:
                val = str(val).strip()
            setattr(gw, field, val)
    gw.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(gw)
    return gw


def to_admin_out(gw: PaymentGateway) -> dict[str, Any]:
    return {
        "id": gw.id,
        "code": gw.code,
        "label": gw.label,
        "is_enabled": gw.is_enabled,
        "is_test_mode": gw.is_test_mode,
        "api_key": gw.api_key,
        "secret_key": gw.secret_key,
        "webhook_secret": gw.webhook_secret,
        "extra_config_json": gw.extra_config_json,
        "created_at": gw.created_at,
        "updated_at": gw.updated_at,
    }


def to_public_out(gw: PaymentGateway) -> dict[str, Any]:
    return {
        "code": gw.code,
        "label": gw.label,
        "is_enabled": gw.is_enabled,
        "is_test_mode": gw.is_test_mode,
    }
