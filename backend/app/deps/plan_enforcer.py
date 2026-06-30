from __future__ import annotations

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Plan, PlanFeature, Subscription, User
from app.db.session import get_db
from app.deps.auth import get_current_user


def get_user_subscription(db: Session, user: User) -> tuple[Plan, Subscription | None]:
    """Return the active plan and subscription for a user. Falls back to the free plan."""
    sub = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.status == "active",
        )
    )
    if sub:
        plan = db.get(Plan, sub.plan_id)
        if plan and plan.is_active:
            return plan, sub
    free_plan = db.scalar(select(Plan).where(Plan.is_free.is_(True), Plan.is_active.is_(True)))
    if free_plan:
        return free_plan, None
    raise HTTPException(status_code=503, detail="No active plan available")


def get_feature_value(plan: Plan, feature_key: str) -> str | None:
    for f in plan.features:
        if f.feature_key == feature_key:
            return f.value
    return None


def require_plan_feature(feature_key: str):
    """Dependency factory: checks that the user's plan has a specific feature enabled."""

    def _check(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
        plan, _ = get_user_subscription(db, user)
        val = get_feature_value(plan, feature_key)
        if val is None or val.lower() in ("false", "0", "no", ""):
            raise HTTPException(
                status_code=403,
                detail=f"Your plan does not include '{feature_key}'. Upgrade to enable this feature.",
            )

    return _check


def check_project_limit(user: User, db: Session) -> None:
    """Check if user has reached their plan's project limit."""
    from app.db.models import Project

    plan, _ = get_user_subscription(db, user)
    val = get_feature_value(plan, "max_projects")
    if val is None or val.lower() == "unlimited":
        return
    try:
        limit = int(val)
    except (ValueError, TypeError):
        return
    count = db.scalar(
        select(Project).where(Project.owner_id == user.id, Project.is_archived.is_(False))
    )
    current = 0
    if count is not None:
        current = int(count)
    if current >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Project limit reached ({limit}). Archive a project or upgrade your plan.",
        )


def check_report_limit(project_id: str, user: User, db: Session) -> None:
    """Check if user has reached their plan's report limit per project."""
    from app.db.models import ProjectReportRun

    plan, _ = get_user_subscription(db, user)
    val = get_feature_value(plan, "reports_per_project")
    if val is None or val.lower() == "unlimited":
        return
    try:
        limit = int(val)
    except (ValueError, TypeError):
        return
    count = db.scalar(
        select(ProjectReportRun).where(ProjectReportRun.project_id == project_id)
    )
    current = 0
    if count is not None:
        current = int(count)
    if current >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Report limit reached ({limit}) for this project. Upgrade to generate more.",
        )
