from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.constants.roles import ADMIN, MANAGER, SUPER_ADMIN
from app.db.models import Project, User
from app.db.session import get_db
from app.deps.auth import get_current_user


def get_owned_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id and user.role not in (SUPER_ADMIN, ADMIN, MANAGER):
        raise HTTPException(status_code=403, detail="You do not have access to this project")
    return project
