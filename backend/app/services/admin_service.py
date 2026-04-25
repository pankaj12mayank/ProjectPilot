from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants.roles import ADMIN, SYSTEM_OWNER
from app.db.models import ActivityLog, AuditLog, GovernanceRun, Project, ProjectFile, ProjectReportRun, User
from app.services import portfolio_service


def _admin_dashboard_counts(db: Session) -> dict[str, int]:
    total_users = int(db.scalar(select(func.count()).select_from(User)) or 0)
    total_projects = int(db.scalar(select(func.count()).select_from(Project)) or 0)
    active_projects = int(
        db.scalar(select(func.count()).select_from(Project).where(Project.is_archived.is_(False))) or 0,
    )
    reports = int(db.scalar(select(func.count()).select_from(ProjectReportRun)) or 0)
    return {
        "total_users": total_users,
        "total_projects": total_projects,
        "active_projects": active_projects,
        "reports_generated": reports,
    }


def admin_dashboard_stats(db: Session, viewer: User) -> dict[str, object]:
    """Counts, portfolio risk summary, RAG histogram (report runs), and recent product activity for admin home."""
    base = _admin_dashboard_counts(db)
    inactive_projects = int(base["total_projects"]) - int(base["active_projects"])
    now = datetime.now(timezone.utc)
    seven_ago = now - timedelta(days=7)

    users_active = int(db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0)
    users_inactive = int(base["total_users"]) - users_active

    platform_admin_roles = (SYSTEM_OWNER, ADMIN)
    platform_admins_active = int(
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role.in_(platform_admin_roles), User.is_active.is_(True)),
        )
        or 0,
    )

    project_files_total = int(db.scalar(select(func.count()).select_from(ProjectFile)) or 0)
    projects_with_report_runs = int(
        db.scalar(select(func.count(func.distinct(ProjectReportRun.project_id))).select_from(ProjectReportRun)) or 0,
    )
    report_runs_last_7_days = int(
        db.scalar(
            select(func.count()).select_from(ProjectReportRun).where(ProjectReportRun.created_at >= seven_ago),
        )
        or 0,
    )
    latest_report_at: str | None = None
    lr = db.scalar(select(func.max(ProjectReportRun.created_at)))
    if lr is not None:
        latest_report_at = lr.isoformat() if hasattr(lr, "isoformat") else str(lr)

    audit_events_last_7_days = int(
        db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.created_at >= seven_ago)) or 0,
    )
    governance_runs_total = int(db.scalar(select(func.count()).select_from(GovernanceRun)) or 0)

    role_rows = db.execute(select(User.role, func.count(User.id)).group_by(User.role)).all()
    role_breakdown: dict[str, int] = {str(row[0]): int(row[1]) for row in role_rows}

    rag_rows = db.execute(
        select(ProjectReportRun.rag_status, func.count(ProjectReportRun.id)).group_by(ProjectReportRun.rag_status),
    ).all()
    rag_distribution: dict[str, int] = {str(row[0]): int(row[1]) for row in rag_rows}
    logs = list(db.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(15)).all())
    recent_activity: list[dict[str, str | None]] = []
    for a in logs:
        actor = db.get(User, a.actor_user_id)
        recent_activity.append(
            {
                "created_at": a.created_at.isoformat() if a.created_at else "",
                "kind": a.kind,
                "summary": a.summary,
                "actor_email": actor.email if actor else None,
            },
        )

    psum = portfolio_service.build_portfolio_summary(db, viewer)
    totals = psum.get("totals") or {}
    top_raw = psum.get("top_risky_projects") or []
    top_typed: list[dict[str, object]] = []
    for row in top_raw[:5]:
        if isinstance(row, dict):
            top_typed.append(
                {
                    "project_id": str(row.get("project_id") or ""),
                    "name": str(row.get("name") or "Project"),
                    "risk_score": int(row.get("risk_score") or 0),
                    "rag": row.get("rag"),
                },
            )
    risk_summary: dict[str, object] = {
        "projects_with_metrics": int(totals.get("projects") or 0),
        "average_risk_score": psum.get("average_risk_score"),
        "by_rag_latest_metrics": dict(psum.get("by_rag") or {}),
        "top_risky_projects": top_typed,
    }

    return {
        **base,
        "stats_computed_at": now.isoformat(),
        "audit_events_window_days": 7,
        "inactive_projects": inactive_projects,
        "users_active": users_active,
        "users_inactive": users_inactive,
        "platform_admins_active": platform_admins_active,
        "project_files_total": project_files_total,
        "projects_with_report_runs": projects_with_report_runs,
        "report_runs_last_7_days": report_runs_last_7_days,
        "latest_report_at": latest_report_at,
        "audit_events_last_7_days": audit_events_last_7_days,
        "governance_runs_total": governance_runs_total,
        "role_breakdown": role_breakdown,
        "rag_distribution": rag_distribution,
        "recent_activity": recent_activity,
        "risk_summary": risk_summary,
    }
