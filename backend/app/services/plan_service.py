from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Plan, PlanFeature, Subscription, User


def get_active_plans(db: Session) -> list[Plan]:
    return list(
        db.scalars(
            select(Plan)
            .where(Plan.is_active.is_(True))
            .order_by(Plan.sort_order, Plan.name)
        ).all()
    )


def get_all_plans(db: Session) -> list[Plan]:
    return list(
        db.scalars(
            select(Plan).order_by(Plan.sort_order, Plan.name)
        ).all()
    )


def get_plan_by_slug(db: Session, slug: str) -> Plan | None:
    return db.scalar(select(Plan).where(Plan.slug == slug))


def get_plan(db: Session, plan_id: str) -> Plan | None:
    return db.get(Plan, plan_id)


def _plan_to_dict(plan: Plan) -> dict[str, Any]:
    return {
        "id": plan.id,
        "name": plan.name,
        "slug": plan.slug,
        "description": plan.description,
        "price_monthly": plan.price_monthly,
        "price_yearly": plan.price_yearly,
        "currency": plan.currency,
        "sort_order": plan.sort_order,
        "is_active": plan.is_active,
        "is_free": plan.is_free,
        "features": [
            {
                "id": f.id,
                "feature_key": f.feature_key,
                "feature_label": f.feature_label,
                "value": f.value,
            }
            for f in plan.features
        ],
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
    }


def create_plan(db: Session, data: dict[str, Any]) -> Plan:
    if get_plan_by_slug(db, data["slug"]):
        raise HTTPException(status_code=409, detail=f"Plan with slug '{data['slug']}' already exists")
    plan = Plan(
        id=str(uuid.uuid4()),
        name=data["name"],
        slug=data["slug"],
        description=data.get("description"),
        price_monthly=data.get("price_monthly"),
        price_yearly=data.get("price_yearly"),
        currency=data.get("currency", "GBP"),
        sort_order=data.get("sort_order", 0),
        is_active=data.get("is_active", True),
        is_free=data.get("is_free", False),
    )
    db.add(plan)
    db.flush()
    _seed_default_features(db, plan)
    db.commit()
    db.refresh(plan)
    return plan


def _seed_default_features(db: Session, plan: Plan) -> None:
    defaults = [
        ("max_projects", "Maximum active projects", "2"),
        ("reports_per_project", "Reports per project", "1"),
        ("branding_enabled", "Custom branding", "false"),
        ("portfolio_access", "Portfolio dashboard", "false"),
        ("forecast_enabled", "Forecast charts", "false"),
        ("team_members", "Team members", "0"),
        ("risk_heatmap", "Risk heatmap", "false"),
        ("audit_log_retention_days", "Audit log retention (days)", "7"),
        ("priority_support", "Priority support", "false"),
        ("sso_enabled", "Single sign-on", "false"),
        ("api_access", "API access", "false"),
    ]
    for key, label, default_val in defaults:
        pf = PlanFeature(
            id=str(uuid.uuid4()),
            plan_id=plan.id,
            feature_key=key,
            feature_label=label,
            value=default_val,
        )
        db.add(pf)


def update_plan(db: Session, plan: Plan, data: dict[str, Any]) -> Plan:
    for field in ("name", "description", "price_monthly", "price_yearly", "currency", "sort_order", "is_active", "is_free"):
        if field in data:
            setattr(plan, field, data[field])
    plan.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plan)
    return plan


def update_plan_features(db: Session, plan: Plan, features: list[dict[str, str]]) -> list[PlanFeature]:
    existing = {f.feature_key: f for f in plan.features}
    updated = []
    for item in features:
        key = item["feature_key"]
        if key in existing:
            existing[key].feature_label = item.get("feature_label", existing[key].feature_label)
            existing[key].value = item.get("value", existing[key].value)
            updated.append(existing[key])
        else:
            pf = PlanFeature(
                id=str(uuid.uuid4()),
                plan_id=plan.id,
                feature_key=key,
                feature_label=item.get("feature_label", key),
                value=item.get("value", "true"),
            )
            db.add(pf)
            updated.append(pf)
    db.commit()
    return updated


def delete_plan(db: Session, plan: Plan) -> None:
    active_subs = db.scalar(
        select(Subscription).where(Subscription.plan_id == plan.id, Subscription.status == "active").limit(1)
    )
    if active_subs:
        raise HTTPException(status_code=400, detail="Cannot delete plan with active subscriptions. Deactivate it instead.")
    plan.is_active = False
    db.commit()


def seed_default_plans(db: Session) -> None:
    """Create starter/professional/enterprise plans if none exist."""
    existing = db.scalar(select(Plan).limit(1))
    if existing:
        return
    starter = create_plan(
        db,
        {
            "name": "Starter",
            "slug": "starter",
            "description": "For individual project managers who want to try governance reporting.",
            "price_monthly": None,
            "price_yearly": None,
            "currency": "GBP",
            "sort_order": 0,
            "is_free": True,
            "is_active": True,
        },
    )
    update_plan_features(db, starter, [
        {"feature_key": "max_projects", "feature_label": "Maximum active projects", "value": "2"},
        {"feature_key": "reports_per_project", "feature_label": "Reports per project", "value": "1"},
        {"feature_key": "branding_enabled", "feature_label": "Custom branding", "value": "false"},
        {"feature_key": "portfolio_access", "feature_label": "Portfolio dashboard", "value": "false"},
        {"feature_key": "forecast_enabled", "feature_label": "Forecast charts", "value": "false"},
        {"feature_key": "team_members", "feature_label": "Team members", "value": "0"},
        {"feature_key": "risk_heatmap", "feature_label": "Risk heatmap", "value": "false"},
        {"feature_key": "audit_log_retention_days", "feature_label": "Audit log retention (days)", "value": "7"},
        {"feature_key": "priority_support", "feature_label": "Priority support", "value": "false"},
        {"feature_key": "sso_enabled", "feature_label": "Single sign-on", "value": "false"},
        {"feature_key": "api_access", "feature_label": "API access", "value": "false"},
    ])
    professional = create_plan(
        db,
        {
            "name": "Professional",
            "slug": "professional",
            "description": "For PMOs managing multiple projects with regular reporting cycles.",
            "price_monthly": 29.0,
            "price_yearly": 290.0,
            "currency": "GBP",
            "sort_order": 1,
            "is_free": False,
            "is_active": True,
        },
    )
    update_plan_features(db, professional, [
        {"feature_key": "max_projects", "feature_label": "Maximum active projects", "value": "15"},
        {"feature_key": "reports_per_project", "feature_label": "Reports per project", "value": "unlimited"},
        {"feature_key": "branding_enabled", "feature_label": "Custom branding", "value": "true"},
        {"feature_key": "portfolio_access", "feature_label": "Portfolio dashboard", "value": "true"},
        {"feature_key": "forecast_enabled", "feature_label": "Forecast charts", "value": "true"},
        {"feature_key": "team_members", "feature_label": "Team members", "value": "10"},
        {"feature_key": "risk_heatmap", "feature_label": "Risk heatmap", "value": "true"},
        {"feature_key": "audit_log_retention_days", "feature_label": "Audit log retention (days)", "value": "90"},
        {"feature_key": "priority_support", "feature_label": "Priority support", "value": "false"},
        {"feature_key": "sso_enabled", "feature_label": "Single sign-on", "value": "false"},
        {"feature_key": "api_access", "feature_label": "API access", "value": "true"},
    ])
    enterprise = create_plan(
        db,
        {
            "name": "Enterprise",
            "slug": "enterprise",
            "description": "For organisations with complex governance requirements.",
            "price_monthly": None,
            "price_yearly": None,
            "currency": "GBP",
            "sort_order": 2,
            "is_free": False,
            "is_active": True,
        },
    )
    update_plan_features(db, enterprise, [
        {"feature_key": "max_projects", "feature_label": "Maximum active projects", "value": "unlimited"},
        {"feature_key": "reports_per_project", "feature_label": "Reports per project", "value": "unlimited"},
        {"feature_key": "branding_enabled", "feature_label": "Custom branding", "value": "true"},
        {"feature_key": "portfolio_access", "feature_label": "Portfolio dashboard", "value": "true"},
        {"feature_key": "forecast_enabled", "feature_label": "Forecast charts", "value": "true"},
        {"feature_key": "team_members", "feature_label": "Team members", "value": "unlimited"},
        {"feature_key": "risk_heatmap", "feature_label": "Risk heatmap", "value": "true"},
        {"feature_key": "audit_log_retention_days", "feature_label": "Audit log retention (days)", "value": "365"},
        {"feature_key": "priority_support", "feature_label": "Priority support", "value": "true"},
        {"feature_key": "sso_enabled", "feature_label": "Single sign-on", "value": "true"},
        {"feature_key": "api_access", "feature_label": "API access", "value": "true"},
    ])


DEFAULT_FEATURES: dict[str, tuple[str, str]] = {
    "max_projects": ("Maximum active projects", "2"),
    "reports_per_project": ("Reports per project", "1"),
    "branding_enabled": ("Custom branding", "false"),
    "portfolio_access": ("Portfolio dashboard", "false"),
    "forecast_enabled": ("Forecast charts", "false"),
    "team_members": ("Team members", "0"),
    "risk_heatmap": ("Risk heatmap", "false"),
    "audit_log_retention_days": ("Audit log retention (days)", "7"),
    "priority_support": ("Priority support", "false"),
    "sso_enabled": ("Single sign-on", "false"),
    "api_access": ("API access", "false"),
}
