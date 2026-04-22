from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Project, ProjectReportRun, User


def admin_dashboard_counts(db: Session) -> dict[str, int]:
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
