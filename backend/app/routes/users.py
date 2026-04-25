from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from starlette.responses import FileResponse, Response

from app.config.settings import get_settings
from app.db.models import User
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.deps.rbac import require_platform_admin
from app.schemas.user import UserCreate, UserOut, UserPasswordChange, UserSelfUpdate, UserUpdate
from app.services import event_log_service, user_service

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
        updated = user_service.update_self(db, user, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserOut.model_validate(updated)


@router.post("/me/change-password", status_code=204)
def change_my_password(
    body: UserPasswordChange,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    try:
        user_service.change_password_for_user(
            db,
            user,
            current_password=body.current_password,
            new_password=body.new_password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(status_code=204)


@router.post("/me/avatar", response_model=UserOut)
async def upload_my_avatar(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    file: UploadFile = File(...),
) -> UserOut:
    settings = get_settings()
    raw = await file.read()
    try:
        user_service.save_user_avatar(
            db,
            user,
            content=raw,
            original_filename=file.filename or "",
            uploads_dir=settings.uploads_dir,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    fresh = user_service.get_by_id(db, user.id)
    assert fresh is not None
    return UserOut.model_validate(fresh)


@router.get("/public/avatar/{user_id}")
def get_public_avatar(user_id: str, db: Session = Depends(get_db)) -> FileResponse:
    """Public image URL for profile photos (suitable for <img src> without auth headers)."""
    settings = get_settings()
    target = user_service.get_by_id(db, user_id.strip())
    if target is None or not target.has_avatar:
        raise HTTPException(status_code=404, detail="Not found")
    path = user_service.avatar_disk_path(settings.uploads_dir, target)
    if path is None:
        raise HTTPException(status_code=404, detail="Not found")
    mt = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}.get(
        path.suffix.lower(),
        "application/octet-stream",
    )
    return FileResponse(path, media_type=mt)


@router.get("", response_model=list[UserOut])
@router.get("/", response_model=list[UserOut])
def list_users(
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    return [UserOut.model_validate(u) for u in user_service.list_users(db)]


@router.post("", response_model=UserOut)
@router.post("/", response_model=UserOut)
def create_user_invite(
    body: UserCreate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    if user_service.get_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    try:
        user = user_service.create_user(
            db,
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            role=body.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.user.create",
        entity_type="user",
        entity_id=user.id,
        detail={"email": user.email, "role": user.role},
    )
    return UserOut.model_validate(user)


@router.post("/delete/{user_id}", status_code=204)
def delete_user_permanent_post(
    user_id: str,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> Response:
    """Permanently remove a user (POST so path cannot be confused with `/users/{id}`)."""
    _delete_user_permanent_impl(user_id.strip(), admin, db)
    return Response(status_code=204)


@router.post("/{user_id}/delete", status_code=204)
def delete_user_permanent_under_user(
    user_id: str,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> Response:
    """Same as POST /delete/{id}; matches other /users/{id}/… routes (avoids routing issues)."""
    _delete_user_permanent_impl(user_id.strip(), admin, db)
    return Response(status_code=204)


@router.get("/{user_id}", response_model=UserOut)
def read_user(
    user_id: str,
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    target = user_service.get_by_id(db, user_id.strip())
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(target)


def _admin_update_user(
    user_id: str,
    body: UserUpdate,
    admin: User,
    db: Session,
) -> UserOut:
    user_id = user_id.strip()
    if user_id == admin.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate yourself")
    target = user_service.get_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        user_service.validate_admin_update_user(
            db,
            admin,
            target,
            role=body.role,
            is_active=body.is_active,
        )
        updated = user_service.update_user_admin(
            db,
            target,
            full_name=body.full_name,
            role=body.role,
            is_active=body.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.user.update",
        entity_type="user",
        entity_id=updated.id,
        detail={"is_active": updated.is_active, "role": updated.role},
    )
    return UserOut.model_validate(updated)


@router.patch("/{user_id}", response_model=UserOut)
def update_user_patch(
    user_id: str,
    body: UserUpdate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    return _admin_update_user(user_id, body, admin, db)


@router.put("/{user_id}", response_model=UserOut)
def update_user_put(
    user_id: str,
    body: UserUpdate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    return _admin_update_user(user_id, body, admin, db)


def _delete_user_permanent_impl(user_id: str, admin: User, db: Session) -> None:
    try:
        user_service.delete_user_permanent(db, admin, user_id)
    except ValueError as exc:
        msg = str(exc)
        if msg == "User not found":
            raise HTTPException(status_code=404, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    event_log_service.write_audit(
        db,
        actor_user_id=admin.id,
        action="admin.user.delete_permanent",
        entity_type="user",
        entity_id=user_id,
        detail={},
    )


@router.delete("/{user_id}", status_code=204)
def delete_user_permanent_route(
    user_id: str,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> Response:
    """Permanently remove a user row (projects they owned are reassigned to the actor)."""
    _delete_user_permanent_impl(user_id.strip(), admin, db)
    return Response(status_code=204)


