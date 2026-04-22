from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AuditLogOut(BaseModel):
    id: str
    created_at: datetime
    actor_user_id: str | None
    action: str
    entity_type: str
    entity_id: str | None
    detail: dict[str, Any] = Field(default_factory=dict)
    ip_address: str | None


class ActivityLogOut(BaseModel):
    id: str
    created_at: datetime
    actor_user_id: str
    project_id: str | None
    project_name: str | None = None
    kind: str
    summary: str
    detail: dict[str, Any] = Field(default_factory=dict)


class NotificationLogOut(BaseModel):
    id: str
    created_at: datetime
    user_id: str
    channel: str
    title: str
    detail: dict[str, Any] = Field(default_factory=dict)
    read_at: datetime | None


class PaginatedAuditLogsOut(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int


class PaginatedActivityLogsOut(BaseModel):
    items: list[ActivityLogOut]
    total: int
    limit: int
    offset: int


class PaginatedNotificationLogsOut(BaseModel):
    items: list[NotificationLogOut]
    total: int
    limit: int
    offset: int
