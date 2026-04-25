"""Query audit, activity, and notification logs with search, filters, and counts."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import ActivityLog, AuditLog, NotificationLog, Project, User


def _detail(obj: str) -> dict[str, Any]:
    try:
        return json.loads(obj) if obj else {}
    except json.JSONDecodeError:
        return {}


@dataclass
class LogQuery:
    q: str | None = None
    project_id: str | None = None
    kind: str | None = None
    action: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    actor_user_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    limit: int = 100
    offset: int = 0


def _audit_predicates(f: LogQuery) -> list[Any]:
    preds: list[Any] = []
    if f.q and f.q.strip():
        pat = f"%{f.q.strip()}%"
        preds.append(
            or_(
                AuditLog.action.ilike(pat),
                AuditLog.entity_type.ilike(pat),
                AuditLog.detail_json.ilike(pat),
                AuditLog.entity_id.isnot(None) & AuditLog.entity_id.ilike(pat),
            ),
        )
    if f.action and f.action.strip():
        preds.append(AuditLog.action.ilike(f"%{f.action.strip()}%"))
    if f.entity_type and f.entity_type.strip():
        preds.append(AuditLog.entity_type.ilike(f"%{f.entity_type.strip()}%"))
    if f.entity_id and f.entity_id.strip():
        preds.append(AuditLog.entity_id == f.entity_id.strip())
    if f.actor_user_id and str(f.actor_user_id).strip():
        preds.append(AuditLog.actor_user_id == str(f.actor_user_id).strip())
    if f.date_from is not None:
        preds.append(AuditLog.created_at >= f.date_from)
    if f.date_to is not None:
        preds.append(AuditLog.created_at <= f.date_to)
    return preds


def list_audit_logs(db: Session, f: LogQuery) -> tuple[list[dict[str, Any]], int]:
    preds = _audit_predicates(f)
    cnt_stmt = select(func.count(AuditLog.id)).select_from(AuditLog)
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if preds:
        w = and_(*preds)
        cnt_stmt = cnt_stmt.where(w)
        stmt = stmt.where(w)
    total = int(db.scalar(cnt_stmt) or 0)
    rows = list(db.scalars(stmt.offset(f.offset).limit(f.limit)).all())
    items = [
        {
            "id": r.id,
            "created_at": r.created_at,
            "actor_user_id": r.actor_user_id,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "detail": _detail(r.detail_json),
            "ip_address": r.ip_address,
        }
        for r in rows
    ]
    return items, total


def _activity_predicates(f: LogQuery) -> list[Any]:
    preds: list[Any] = []
    if f.q and f.q.strip():
        pat = f"%{f.q.strip()}%"
        preds.append(
            or_(
                ActivityLog.kind.ilike(pat),
                ActivityLog.summary.ilike(pat),
                ActivityLog.detail_json.ilike(pat),
            ),
        )
    if f.project_id and f.project_id.strip():
        preds.append(ActivityLog.project_id == f.project_id.strip())
    if f.kind and f.kind.strip():
        preds.append(ActivityLog.kind.ilike(f"%{f.kind.strip()}%"))
    if f.date_from is not None:
        preds.append(ActivityLog.created_at >= f.date_from)
    if f.date_to is not None:
        preds.append(ActivityLog.created_at <= f.date_to)
    return preds


def list_activity_logs(db: Session, viewer: User, f: LogQuery) -> tuple[list[dict[str, Any]], int]:
    """Product activity: each user sees only rows they performed (actor_user_id)."""
    preds = [ActivityLog.actor_user_id == viewer.id, *_activity_predicates(f)]

    cnt_stmt = select(func.count(ActivityLog.id)).select_from(ActivityLog).outerjoin(Project, Project.id == ActivityLog.project_id)
    stmt = (
        select(ActivityLog, Project.name)
        .outerjoin(Project, Project.id == ActivityLog.project_id)
        .order_by(ActivityLog.created_at.desc())
    )
    if preds:
        w = and_(*preds)
        cnt_stmt = cnt_stmt.where(w)
        stmt = stmt.where(w)
    total = int(db.scalar(cnt_stmt) or 0)
    rows = list(db.execute(stmt.offset(f.offset).limit(f.limit)).all())
    items = []
    for row in rows:
        r, pname = row[0], row[1]
        items.append(
            {
                "id": r.id,
                "created_at": r.created_at,
                "actor_user_id": r.actor_user_id,
                "project_id": r.project_id,
                "project_name": pname,
                "kind": r.kind,
                "summary": r.summary,
                "detail": _detail(r.detail_json),
            },
        )
    return items, total


def list_activity_logs_admin(db: Session, admin: User, f: LogQuery) -> tuple[list[dict[str, Any]], int]:
    """Platform admins: optional actor_user_id narrows to one user; otherwise all actors."""
    from app.constants.roles import is_platform_admin

    if not is_platform_admin(admin.role):
        return [], 0
    preds = _activity_predicates(f)
    if f.actor_user_id and str(f.actor_user_id).strip():
        preds.insert(0, ActivityLog.actor_user_id == str(f.actor_user_id).strip())

    cnt_stmt = select(func.count(ActivityLog.id)).select_from(ActivityLog).outerjoin(Project, Project.id == ActivityLog.project_id)
    stmt = (
        select(ActivityLog, Project.name)
        .outerjoin(Project, Project.id == ActivityLog.project_id)
        .order_by(ActivityLog.created_at.desc())
    )
    if preds:
        w = and_(*preds)
        cnt_stmt = cnt_stmt.where(w)
        stmt = stmt.where(w)
    total = int(db.scalar(cnt_stmt) or 0)
    rows = list(db.execute(stmt.offset(f.offset).limit(f.limit)).all())
    items = []
    for row in rows:
        r, pname = row[0], row[1]
        items.append(
            {
                "id": r.id,
                "created_at": r.created_at,
                "actor_user_id": r.actor_user_id,
                "project_id": r.project_id,
                "project_name": pname,
                "kind": r.kind,
                "summary": r.summary,
                "detail": _detail(r.detail_json),
            },
        )
    return items, total


def _notification_predicates(user_id: str, f: LogQuery) -> list[Any]:
    preds: list[Any] = [NotificationLog.user_id == user_id]
    if f.q and f.q.strip():
        pat = f"%{f.q.strip()}%"
        preds.append(
            or_(
                NotificationLog.title.ilike(pat),
                NotificationLog.detail_json.ilike(pat),
            ),
        )
    if f.date_from is not None:
        preds.append(NotificationLog.created_at >= f.date_from)
    if f.date_to is not None:
        preds.append(NotificationLog.created_at <= f.date_to)
    return preds


def list_notification_logs(db: Session, viewer: User, f: LogQuery) -> tuple[list[dict[str, Any]], int]:
    preds = _notification_predicates(viewer.id, f)
    w = and_(*preds)
    cnt_stmt = select(func.count(NotificationLog.id)).select_from(NotificationLog).where(w)
    total = int(db.scalar(cnt_stmt) or 0)
    rows = list(
        db.scalars(
            select(NotificationLog)
            .where(w)
            .order_by(NotificationLog.created_at.desc())
            .offset(f.offset)
            .limit(f.limit),
        ).all(),
    )
    items = [
        {
            "id": r.id,
            "created_at": r.created_at,
            "user_id": r.user_id,
            "channel": r.channel,
            "title": r.title,
            "detail": _detail(r.detail_json),
            "read_at": r.read_at,
        }
        for r in rows
    ]
    return items, total
