from __future__ import annotations

import json

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.constants.roles import ADMIN, ROLES_WITH_ALL_PROJECTS_READ, SYSTEM_OWNER
from app.db.models import Project, User
from app.db.session import get_db
from app.deps.auth import get_current_user


def _project_team_user_ids(project: Project) -> list[str]:
    try:
        data = json.loads(getattr(project, "team_user_ids_json", None) or "[]")
        if isinstance(data, list):
            return [str(x) for x in data if x]
    except json.JSONDecodeError:
        pass
    return []


def fetch_owned_project(db: Session, project_id: str, user: User) -> Project:
    """Load project or raise 404 / 403 (no FastAPI Depends — safe to call from route bodies)."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id and user.role not in ROLES_WITH_ALL_PROJECTS_READ:
        raise HTTPException(status_code=403, detail="You do not have access to this project")
    return project


def fetch_accessible_project(db: Session, project_id: str, user: User) -> Project:
    """Owner, admin/system-wide visibility roles, or explicit project team member (read / upload / analytics)."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id == user.id:
        return project
    if user.role in ROLES_WITH_ALL_PROJECTS_READ:
        return project
    if user.id in _project_team_user_ids(project):
        return project
    raise HTTPException(status_code=403, detail="You do not have access to this project")


def fetch_deletable_project(db: Session, project_id: str, user: User) -> Project:
    """Owner or admin/system_owner may delete."""
    project = fetch_owned_project(db, project_id, user)
    if project.owner_id != user.id and user.role not in (SYSTEM_OWNER, ADMIN):
        raise HTTPException(
            status_code=403,
            detail="Only the project owner or an administrator can delete this project",
        )
    return project


def get_owned_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    return fetch_owned_project(db, project_id, user)


def get_accessible_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    return fetch_accessible_project(db, project_id, user)


def get_owned_project_deletable(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    return fetch_deletable_project(db, project_id, user)
