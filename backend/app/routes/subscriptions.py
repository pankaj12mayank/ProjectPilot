from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.models import Plan, Subscription, User
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.schemas.plans import PlanOut, SubscriptionCheckoutIn, SubscriptionChangeIn, SubscriptionOut
from app.services import event_log_service
from app.services.subscription_service import (
    cancel_subscription,
    change_plan,
    create_checkout_session,
    create_portal_link,
    get_user_subscription,
    get_user_subscription_with_plan,
    get_all_subscriptions,
)

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    c = request.client
    return c.host if c else None


@router.get("/my", response_model=SubscriptionOut | None)
def my_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubscriptionOut | None:
    plan, sub = get_user_subscription_with_plan(db, user)
    if not sub:
        return SubscriptionOut(
            id="",
            user_id=user.id,
            plan_id=plan.id,
            gateway_id=None,
            status="active",
            gateway_subscription_id=None,
            gateway_customer_id=None,
            current_period_start=None,
            current_period_end=None,
            cancel_at_period_end=False,
            trial_end=None,
            plan=PlanOut.model_validate(plan),
            created_at=plan.created_at,
            updated_at=plan.updated_at,
        )
    result = SubscriptionOut.model_validate(sub)
    result.plan = PlanOut.model_validate(plan)
    return result


@router.post("/checkout")
def checkout(
    body: SubscriptionCheckoutIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    settings = None
    try:
        from app.config.settings import get_settings
        settings = get_settings()
    except Exception:
        pass
    public_url = str(settings.public_app_url).rstrip("/") if settings and settings.public_app_url else str(request.base_url).rstrip("/")
    success_url = f"{public_url}/dashboard/subscription?checkout=success"
    cancel_url = f"{public_url}/dashboard/subscription?checkout=cancel"
    result = create_checkout_session(
        db=db,
        user=user,
        plan_slug=body.plan_slug,
        gateway_code=body.gateway_code,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    event_log_service.write_audit(
        db,
        actor_user_id=user.id,
        action="subscription.checkout",
        entity_type="subscription",
        detail={"plan_slug": body.plan_slug, "gateway": body.gateway_code, "is_free": result.get("is_free")},
        ip_address=_client_ip(request),
    )
    return result


@router.post("/portal")
def billing_portal(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    settings = None
    try:
        from app.config.settings import get_settings
        settings = get_settings()
    except Exception:
        pass
    return_url = str(settings.public_app_url).rstrip("/") if settings and settings.public_app_url else str(request.base_url).rstrip("/")
    return_url = f"{return_url}/dashboard/subscription"
    url = create_portal_link(db, user, return_url)
    return {"url": url}


@router.post("/cancel")
def cancel(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    result = cancel_subscription(db, user)
    event_log_service.write_audit(
        db,
        actor_user_id=user.id,
        action="subscription.cancel",
        entity_type="subscription",
        detail={"status": result.get("status")},
        ip_address=_client_ip(request),
    )
    return result


@router.post("/change")
def change(
    body: SubscriptionChangeIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    result = change_plan(db, user, body.plan_slug, body.gateway_code)
    event_log_service.write_audit(
        db,
        actor_user_id=user.id,
        action="subscription.change",
        entity_type="subscription",
        detail={"plan_slug": body.plan_slug, "result": result.get("message")},
        ip_address=_client_ip(request),
    )
    return result


@router.post("/webhook/{gateway_code}")
async def webhook(
    gateway_code: str,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    body_bytes = await request.body()
    signature = request.headers.get("stripe-signature") or request.headers.get("x-razorpay-signature")
    from app.services.subscription_service import handle_webhook
    return handle_webhook(db, gateway_code, body_bytes, signature)
