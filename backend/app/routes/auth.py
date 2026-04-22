import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.session import get_db
from app.db.models import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserOut
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.services import event_log_service, user_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/register", response_model=UserOut)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> UserOut:
    try:
        user = user_service.register_user(db, body.email, body.password, body.full_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    event_log_service.write_audit(
        db,
        actor_user_id=user.id,
        action="auth.register",
        entity_type="user",
        entity_id=user.id,
        detail={"email": user.email},
    )
    event_log_service.write_activity(
        db,
        actor_user_id=user.id,
        project_id=None,
        kind="auth.register",
        summary=f"Registered account {user.email}",
        detail={"user_id": user.id},
    )
    return UserOut.model_validate(user)


def _issue_tokens(user: User) -> TokenResponse:
    access = create_access_token(user_id=user.id, email=user.email, role=user.role)
    refresh = create_refresh_token(user_id=user.id)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = user_service.authenticate(db, body.email, body.password)
    if user is None:
        ip = request.client.host if request.client else None
        event_log_service.write_audit(
            db,
            actor_user_id=None,
            action="auth.login.failed",
            entity_type="credentials",
            entity_id=None,
            detail={"email_hint": (body.email[:2] + "***") if len(body.email) > 2 else "***"},
            ip_address=ip,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    ip = request.client.host if request.client else None
    event_log_service.write_audit(
        db,
        actor_user_id=user.id,
        action="auth.login.success",
        entity_type="user",
        entity_id=user.id,
        detail={},
        ip_address=ip,
    )
    event_log_service.write_activity(
        db,
        actor_user_id=user.id,
        project_id=None,
        kind="auth.login",
        summary=f"Signed in {user.email}",
        detail={},
    )
    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        payload = decode_refresh_token(body.refresh_token)
    except (InvalidTokenError, ExpiredSignatureError, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token") from None
    uid = payload.get("sub")
    if not uid or not isinstance(uid, str):
        raise HTTPException(status_code=401, detail="Invalid refresh payload")
    user = db.get(User, uid)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return _issue_tokens(user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    settings = get_settings()
    user = user_service.get_by_email(db, body.email)
    dev_token: str | None = None
    if user is not None:
        token = user_service.set_password_reset(db, user)
        logger.info("Password reset requested for %s", body.email)
        if settings.dev_return_reset_token:
            dev_token = token
    return ForgotPasswordResponse(
        message="If an account exists for that email, password reset instructions have been recorded.",
        dev_reset_token=dev_token,
    )


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        user_service.reset_password_with_token(db, body.token, body.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "Password updated. You can sign in with your new password."}
