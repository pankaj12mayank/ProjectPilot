from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user, require_admin
from app.db.models import AuditLog, ActivityLog, NotificationLog, User
from app.schemas.logs import (
    ActivityLogOut,
    AuditLogOut,
    NotificationLogOut,
    PaginatedActivityLogsOut,
    PaginatedAuditLogsOut,
    PaginatedNotificationLogsOut,
)
from app.services.logs_list_service import LogQuery, list_activity_logs, list_audit_logs, list_notification_logs

router = APIRouter()


def _parse_dt(value: str | None) -> datetime | None:
    if not value or not str(value).strip():
        return None
    t = str(value).strip().replace("Z", "+00:00")
    if len(t) == 10:
        t = f"{t}T00:00:00+00:00"
    return datetime.fromisoformat(t)


@router.get("/audit", response_model=PaginatedAuditLogsOut)
def get_audit_logs(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Search action, entity, detail JSON"),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    actor_user_id: str | None = Query(None, description="Filter by acting user id"),
    date_from: str | None = Query(None, description="ISO date/datetime (UTC)"),
    date_to: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedAuditLogsOut:
    f = LogQuery(
        q=q,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_user_id=actor_user_id,
        date_from=_parse_dt(date_from),
        date_to=_parse_dt(date_to),
        limit=limit,
        offset=offset,
    )
    items, total = list_audit_logs(db, f)
    return PaginatedAuditLogsOut(
        items=[AuditLogOut.model_validate(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/activity", response_model=PaginatedActivityLogsOut)
def get_activity_logs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Search kind, summary, detail"),
    project_id: str | None = Query(None, description="Filter by linked project_id"),
    kind: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedActivityLogsOut:
    f = LogQuery(
        q=q,
        project_id=project_id,
        kind=kind,
        date_from=_parse_dt(date_from),
        date_to=_parse_dt(date_to),
        limit=limit,
        offset=offset,
    )
    items, total = list_activity_logs(db, user, f)
    return PaginatedActivityLogsOut(
        items=[ActivityLogOut.model_validate(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/notifications", response_model=PaginatedNotificationLogsOut)
def get_notification_logs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Search title / detail"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedNotificationLogsOut:
    f = LogQuery(
        q=q,
        date_from=_parse_dt(date_from),
        date_to=_parse_dt(date_to),
        limit=limit,
        offset=offset,
    )
    items, total = list_notification_logs(db, user, f)
    return PaginatedNotificationLogsOut(
        items=[NotificationLogOut.model_validate(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/audit/bulk-delete")
def bulk_delete_audit_logs(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    ids: list[str] = Body(..., embed=True),
) -> dict:
    if not ids:
        return {"deleted": 0}
    # Hard delete
    q = db.query(AuditLog).filter(AuditLog.id.in_(ids))
    count = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return {"deleted": count}


@router.post("/activity/bulk-delete")
def bulk_delete_activity_logs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    ids: list[str] = Body(..., embed=True),
) -> dict:
    if not ids:
        return {"deleted": 0}
    from app.constants.roles import ADMIN, SYSTEM_OWNER

    q = db.query(ActivityLog).filter(ActivityLog.id.in_(ids))
    # Non-admin can only delete own logs
    if user.role not in (ADMIN, SYSTEM_OWNER):
        q = q.filter(ActivityLog.actor_user_id == user.id)
    count = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return {"deleted": count}


@router.post("/notifications/bulk-delete")
def bulk_delete_notification_logs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    ids: list[str] = Body(..., embed=True),
) -> dict:
    if not ids:
        return {"deleted": 0}
    q = db.query(NotificationLog).filter(NotificationLog.id.in_(ids), NotificationLog.user_id == user.id)
    count = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return {"deleted": count}
