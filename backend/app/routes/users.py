from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.deps.auth import get_current_user, require_admin
from app.schemas.user import UserCreate, UserOut, UserSelfUpdate, UserUpdate
from app.services import user_service

router = APIRouter()


@router.get("/me", response_model=UserOut)
def read_me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserSelfUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserOut:
    try:
        updated = user_service.update_self(
            db,
            user,
            full_name=body.full_name,
            email=str(body.email) if body.email is not None else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserOut.model_validate(updated)


@router.get("/", response_model=list[UserOut])
def list_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    return [UserOut.model_validate(u) for u in user_service.list_users(db)]


@router.post("/", response_model=UserOut)
def create_user_invite(
    body: UserCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    if user_service.get_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = user_service.create_user(
        db,
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        role=body.role,
    )
    return UserOut.model_validate(user)


@router.get("/{user_id}", response_model=UserOut)
def read_user(
    user_id: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    target = user_service.get_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(target)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    if user_id == admin.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate yourself")
    target = user_service.get_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    updated = user_service.update_user_admin(
        db,
        target,
        full_name=body.full_name,
        role=body.role,
        is_active=body.is_active,
    )
    return UserOut.model_validate(updated)


@router.delete("/{user_id}", status_code=204)
def deactivate_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")
    target = user_service.get_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    user_service.update_user_admin(db, target, full_name=None, role=None, is_active=False)
