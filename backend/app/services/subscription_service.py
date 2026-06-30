from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Plan, Subscription, User
from app.services.gateway_service import get_gateway_by_code
from app.services.payment import PaymentGatewayError
from app.services.payment.resolver import resolve_gateway
from app.services.plan_service import get_plan_by_slug


def get_user_subscription(db: Session, user: User) -> Subscription | None:
    return db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.status.in_(["active", "trialing", "past_due"]),
        ).order_by(Subscription.created_at.desc())
    )


def get_user_subscription_with_plan(db: Session, user: User) -> tuple[Plan, Subscription | None]:
    sub = get_user_subscription(db, user)
    if sub:
        plan = db.get(Plan, sub.plan_id)
        if plan and plan.is_active:
            return plan, sub
    free_plan = db.scalar(select(Plan).where(Plan.is_free.is_(True), Plan.is_active.is_(True)))
    if free_plan:
        return free_plan, None
    raise HTTPException(status_code=503, detail="No active plan available")


def create_checkout_session(
    db: Session,
    user: User,
    plan_slug: str,
    gateway_code: str,
    success_url: str,
    cancel_url: str,
) -> dict[str, Any]:
    plan = get_plan_by_slug(db, plan_slug)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Plan not found or inactive")
    if plan.is_free:
        _assign_free_plan(db, user, plan)
        return {"url": success_url, "session_id": None, "is_free": True}

    gateway = resolve_gateway(db, gateway_code)
    existing_sub = get_user_subscription(db, user)

    result = gateway.create_checkout_session(
        user=user,
        plan=plan,
        success_url=success_url,
        cancel_url=cancel_url,
        subscription=existing_sub,
    )

    sub = Subscription(
        id=str(uuid.uuid4()),
        user_id=user.id,
        plan_id=plan.id,
        gateway_id=_get_gateway_id(db, gateway_code),
        status="incomplete",
        gateway_subscription_id=result.get("session_id"),
        gateway_customer_id=result.get("customer_id"),
    )
    db.add(sub)
    db.commit()

    return {"url": result["url"], "session_id": result["session_id"], "is_free": False}


def create_portal_link(db: Session, user: User, return_url: str) -> str:
    sub = get_user_subscription(db, user)
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")
    if not sub.gateway_id:
        raise HTTPException(status_code=400, detail="Free plan has no billing portal")
    gateway = resolve_gateway_by_id(db, sub.gateway_id)
    return gateway.create_customer_portal_link(user, sub, return_url)


def cancel_subscription(db: Session, user: User) -> dict[str, Any]:
    sub = get_user_subscription(db, user)
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")
    if not sub.gateway_id:
        sub.cancel_at_period_end = True
        sub.status = "canceled"
        db.commit()
        return {"status": "canceled", "message": "Free plan subscription cancelled"}
    gateway = resolve_gateway_by_id(db, sub.gateway_id)
    result = gateway.cancel_subscription(sub.gateway_subscription_id)
    sub.cancel_at_period_end = True
    if result.get("status") in ("canceled", "cancelled"):
        sub.status = "canceled"
    db.commit()
    return {"status": sub.status, "message": "Subscription will end at current period"}


def change_plan(db: Session, user: User, plan_slug: str, gateway_code: str | None = None) -> dict[str, Any]:
    new_plan = get_plan_by_slug(db, plan_slug)
    if not new_plan or not new_plan.is_active:
        raise HTTPException(status_code=404, detail="Plan not found or inactive")

    sub = get_user_subscription(db, user)
    if new_plan.is_free:
        if sub:
            sub.status = "canceled"
            sub.cancel_at_period_end = True
        _assign_free_plan(db, user, new_plan)
        return {"status": "active", "message": "Downgraded to free plan"}

    if sub and sub.gateway_id:
        gateway = resolve_gateway_by_id(db, sub.gateway_id)
        result = gateway.update_subscription_plan(sub.gateway_subscription_id, new_plan)
        sub.plan_id = new_plan.id
        db.commit()
        return {"status": result.get("status", "active"), "message": "Plan changed"}
    elif sub and not sub.gateway_id:
        sub.status = "canceled"
        db.commit()
        gateway_code = gateway_code or _find_enabled_gateway_code(db)
        gateway = resolve_gateway(db, gateway_code)
        result = gateway.create_checkout_session(
            user=user,
            plan=new_plan,
            success_url="",
            cancel_url="",
        )
        new_sub = Subscription(
            id=str(uuid.uuid4()),
            user_id=user.id,
            plan_id=new_plan.id,
            gateway_id=_get_gateway_id(db, gateway_code),
            status="incomplete",
            gateway_subscription_id=result.get("session_id"),
        )
        db.add(new_sub)
        db.commit()
        return {"url": result["url"], "message": "Redirect to checkout"}
    else:
        gateway_code = gateway_code or _find_enabled_gateway_code(db)
        return create_checkout_session(db, user, plan_slug, gateway_code, "", "")


def handle_webhook(db: Session, gateway_code: str, payload: bytes, signature: str | None) -> dict[str, Any]:
    gateway = resolve_gateway(db, gateway_code)
    event = gateway.process_webhook(payload, signature)
    event_type = event["event_type"]
    data = event["data"]

    if "checkout.session.completed" in event_type or "subscription.activated" in event_type:
        sub_id = data.get("subscription") or data.get("id")
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id") or _find_user_by_stripe_sub(db, sub_id)
        plan_slug = metadata.get("plan_slug")
        if sub_id and user_id:
            _activate_subscription(db, sub_id, user_id, plan_slug, data)

    elif "subscription.updated" in event_type or "subscription.charged" in event_type:
        sub_id = data.get("id")
        status = data.get("status")
        if sub_id:
            db_sub = db.scalar(
                select(Subscription).where(Subscription.gateway_subscription_id == sub_id)
            )
            if db_sub:
                db_sub.status = status if status in ("active", "past_due", "canceled", "trialing") else db_sub.status
                if data.get("cancel_at_period_end"):
                    db_sub.cancel_at_period_end = True
                period_end = data.get("current_period_end")
                if period_end:
                    try:
                        db_sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
                    except (OSError, ValueError):
                        pass
                db.commit()

    elif "subscription.cancelled" in event_type or "subscription.deleted" in event_type:
        sub_id = data.get("id")
        if sub_id:
            db_sub = db.scalar(
                select(Subscription).where(Subscription.gateway_subscription_id == sub_id)
            )
            if db_sub:
                db_sub.status = "canceled"
                db_sub.cancel_at_period_end = True
                db.commit()

    elif "invoice.paid" in event_type:
        sub_id = data.get("subscription")
        if sub_id:
            db_sub = db.scalar(
                select(Subscription).where(Subscription.gateway_subscription_id == sub_id)
            )
            if db_sub and db_sub.status == "incomplete":
                db_sub.status = "active"
                period_start = data.get("period_start") or data.get("current_period_start")
                period_end = data.get("period_end") or data.get("current_period_end")
                if period_start:
                    try:
                        db_sub.current_period_start = datetime.fromtimestamp(period_start, tz=timezone.utc)
                    except (OSError, ValueError):
                        pass
                if period_end:
                    try:
                        db_sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
                    except (OSError, ValueError):
                        pass
                db.commit()

    return {"received": True, "event_type": event_type}


def _activate_subscription(db: Session, gateway_sub_id: str, user_id: str, plan_slug: str | None, data: dict[str, Any]) -> None:
    db_sub = db.scalar(
        select(Subscription).where(Subscription.gateway_subscription_id == gateway_sub_id)
    )
    if db_sub:
        db_sub.status = "active"
        period_start = data.get("current_period_start") or data.get("created")
        period_end = data.get("current_period_end")
        if period_start:
            try:
                db_sub.current_period_start = datetime.fromtimestamp(period_start, tz=timezone.utc)
            except (OSError, ValueError):
                pass
        if period_end:
            try:
                db_sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
            except (OSError, ValueError):
                pass
        db.commit()


def _assign_free_plan(db: Session, user: User, plan: Plan) -> None:
    existing = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.status == "active",
        )
    )
    if existing:
        return
    sub = Subscription(
        id=str(uuid.uuid4()),
        user_id=user.id,
        plan_id=plan.id,
        status="active",
    )
    db.add(sub)
    db.commit()


def _get_gateway_id(db: Session, code: str) -> str | None:
    gw = get_gateway_by_code(db, code)
    return gw.id if gw else None


def _find_enabled_gateway_code(db: Session) -> str:
    from app.services.gateway_service import get_enabled_gateways

    gateways = get_enabled_gateways(db)
    if not gateways:
        raise HTTPException(status_code=400, detail="No payment gateway is enabled")
    return gateways[0].code


def resolve_gateway_by_id(db: Session, gateway_id: str) -> Any:
    from app.services.payment.resolver import resolve_gateway_by_id

    return resolve_gateway_by_id(db, gateway_id)


def _find_user_by_stripe_sub(db: Session, sub_id: str) -> str | None:
    db_sub = db.scalar(
        select(Subscription).where(Subscription.gateway_subscription_id == sub_id)
    )
    return db_sub.user_id if db_sub else None


def get_all_subscriptions(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        select(Subscription, Plan)
        .join(Plan, Subscription.plan_id == Plan.id, isouter=True)
        .order_by(Subscription.created_at.desc())
        .limit(100)
    ).all()
    return [
        {
            "id": sub.id,
            "user_id": sub.user_id,
            "plan_id": sub.plan_id,
            "plan_name": plan.name if plan else "Unknown",
            "status": sub.status,
            "gateway_subscription_id": sub.gateway_subscription_id,
            "current_period_end": sub.current_period_end,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "trial_end": sub.trial_end,
            "created_at": sub.created_at,
        }
        for sub, plan in rows
    ]
