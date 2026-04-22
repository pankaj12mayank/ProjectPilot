from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants.roles import ADMIN, MEMBER
from app.db.models import User
from app.security import hash_password, verify_password


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalars(select(User).where(func.lower(User.email) == email.lower())).first()


def get_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def count_users(db: Session) -> int:
    return int(db.scalar(select(func.count()).select_from(User)) or 0)


def create_user(
    db: Session,
    *,
    email: str,
    password: str,
    full_name: str,
    role: str = MEMBER,
) -> User:
    user = User(
        id=str(uuid.uuid4()),
        email=email.lower(),
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
        is_active=True,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def register_user(db: Session, email: str, password: str, full_name: str) -> User:
    if get_by_email(db, email):
        raise ValueError("Email already registered")
    role = ADMIN if count_users(db) == 0 else MEMBER
    return create_user(db, email=email, password=password, full_name=full_name, role=role)


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = get_by_email(db, email)
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def set_password_reset(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    user.password_reset_token = token
    user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    return token


def reset_password_with_token(db: Session, token: str, new_password: str) -> None:
    user = db.scalars(select(User).where(User.password_reset_token == token)).first()
    if user is None:
        raise ValueError("Invalid or expired reset token")
    if user.password_reset_expires is None or user.password_reset_expires < datetime.now(timezone.utc):
        raise ValueError("Invalid or expired reset token")
    user.hashed_password = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())


def update_self(db: Session, user: User, *, full_name: str | None, email: str | None) -> User:
    if full_name is not None:
        user.full_name = full_name
    if email is not None:
        if get_by_email(db, email) and email.lower() != user.email.lower():
            raise ValueError("Email already in use")
        user.email = email.lower()
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user_admin(
    db: Session,
    target: User,
    *,
    full_name: str | None,
    role: str | None,
    is_active: bool | None,
) -> User:
    if full_name is not None:
        target.full_name = full_name
    if role is not None:
        target.role = role
    if is_active is not None:
        target.is_active = is_active
    target.updated_at = datetime.now(timezone.utc)
    db.add(target)
    db.commit()
    db.refresh(target)
    return target
