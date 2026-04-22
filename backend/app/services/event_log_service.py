"""Persist audit, activity, and notification history."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ActivityLog, AuditLog, NotificationLog

logger = logging.getLogger(__name__)


def _dump(detail: dict[str, Any] | None) -> str:
    if not detail:
        return "{}"
    try:
        return json.dumps(detail, default=str)[:8000]
    except (TypeError, ValueError):
        return "{}"


def write_audit(
    db: Session,
    *,
    actor_user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None,
    detail: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> None:
    try:
        row = AuditLog(
            id=str(uuid.uuid4()),
            actor_user_id=actor_user_id,
            action=action[:128],
            entity_type=entity_type[:64],
            entity_id=entity_id[:36] if entity_id else None,
            detail_json=_dump(detail),
            ip_address=ip_address[:64] if ip_address else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(row)
        db.commit()
    except Exception:
        logger.exception("write_audit failed action=%s", action)
        db.rollback()


def write_activity(
    db: Session,
    *,
    actor_user_id: str,
    project_id: str | None,
    kind: str,
    summary: str,
    detail: dict[str, Any] | None = None,
) -> None:
    try:
        row = ActivityLog(
            id=str(uuid.uuid4()),
            actor_user_id=actor_user_id,
            project_id=project_id[:36] if project_id else None,
            kind=kind[:64],
            summary=summary[:512],
            detail_json=_dump(detail),
            created_at=datetime.now(timezone.utc),
        )
        db.add(row)
        db.commit()
    except Exception:
        logger.exception("write_activity failed kind=%s", kind)
        db.rollback()


def write_notification(
    db: Session,
    *,
    user_id: str,
    channel: str,
    title: str,
    detail: dict[str, Any] | None = None,
) -> None:
    try:
        row = NotificationLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            channel=channel[:32],
            title=title[:256],
            detail_json=_dump(detail),
            created_at=datetime.now(timezone.utc),
        )
        db.add(row)
        db.commit()
    except Exception:
        logger.exception("write_notification failed")
        db.rollback()
