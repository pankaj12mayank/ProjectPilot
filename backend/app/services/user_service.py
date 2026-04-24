from __future__ import annotations

import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants.roles import ADMIN, MEMBER, SYSTEM_OWNER, is_valid_role
from app.db.models import ActivityLog, AuditLog, BrandingSettings, NotificationLog, Project, User
from app.schemas.user import UserSelfUpdate
from app.security import hash_password, verify_password

logger = logging.getLogger(__name__)

# Active users with these roles count toward "last administrator" safety.
_PLATFORM_ADMIN_ROLES: frozenset[str] = frozenset({SYSTEM_OWNER, ADMIN})


def _other_active_platform_admin_count(db: Session, exclude_user_id: str) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(
                User.is_active.is_(True),
                User.role.in_(_PLATFORM_ADMIN_ROLES),
                User.id != exclude_user_id,
            ),
        )
        or 0,
    )


def validate_admin_update_user(
    db: Session,
    actor: User,
    target: User,
    *,
    role: str | None,
    is_active: bool | None,
) -> None:
    """Enforce 'last admin' safety. Call before applying updates."""
    if target.role == SYSTEM_OWNER and actor.role != SYSTEM_OWNER:
        raise ValueError("Only the system owner may change this account")
    if target.role == SYSTEM_OWNER and role is not None:
        raise ValueError("The system owner role cannot be changed")
    if role is not None and role == SYSTEM_OWNER:
        raise ValueError("The system_owner role cannot be assigned via the API")
    if is_active is False and target.is_active and target.role in _PLATFORM_ADMIN_ROLES:
        if _other_active_platform_admin_count(db, target.id) < 1:
            raise ValueError("Cannot deactivate the last active platform administrator")
    if role is not None and target.role in _PLATFORM_ADMIN_ROLES and role not in _PLATFORM_ADMIN_ROLES:
        if _other_active_platform_admin_count(db, target.id) < 1:
            raise ValueError("Cannot demote the last active platform administrator")


def validate_admin_deactivate_user(db: Session, actor: User, target: User) -> None:
    if target.role == SYSTEM_OWNER and actor.role != SYSTEM_OWNER:
        raise ValueError("Only the system owner may deactivate this account")
    if target.is_active and target.role in _PLATFORM_ADMIN_ROLES:
        if _other_active_platform_admin_count(db, target.id) < 1:
            raise ValueError("Cannot deactivate the last active platform administrator")


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalars(select(User).where(func.lower(User.email) == email.lower())).first()


def get_by_id(db: Session, user_id: str) -> User | None:
    uid = (user_id or "").strip()
    if not uid:
        return None
    return db.get(User, uid)


def _normalize_legacy_user_roles(db: Session) -> None:
    """Map removed role slugs to the current canonical set (idempotent)."""
    from sqlalchemy import text

    pairs = (
        ("super_admin", ADMIN),
        ("delivery_manager", "project_manager"),
        ("manager", MEMBER),
    )
    for old, new in pairs:
        db.execute(text("UPDATE users SET role = :new WHERE role = :old"), {"new": new, "old": old})
    db.commit()
    _promote_legacy_system_owner(db)


def _promote_legacy_system_owner(db: Session) -> None:
    """If no system_owner exists, promote the earliest-created admin to system_owner (one row)."""
    from sqlalchemy import text

    n_so = int(db.scalar(select(func.count()).select_from(User).where(User.role == SYSTEM_OWNER)) or 0)
    if n_so > 0:
        return
    n_adm = int(db.scalar(select(func.count()).select_from(User).where(User.role == ADMIN)) or 0)
    if n_adm == 0:
        return
    oldest = db.scalars(select(User).where(User.role == ADMIN).order_by(User.created_at.asc()).limit(1)).first()
    if oldest is None:
        return
    oldest.role = SYSTEM_OWNER
    db.add(oldest)
    db.commit()


def ensure_user_migrations(db: Session) -> None:
    """Add columns introduced after first deploy (SQLite / PostgreSQL)."""
    try:
        from sqlalchemy import inspect, text

        bind = db.get_bind()
        insp = inspect(bind)
        cols = {c["name"] for c in insp.get_columns("users")}
        dialect = bind.dialect.name
        if "theme_preference" not in cols:
            if dialect == "postgresql":
                db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(16)"))
            else:
                db.execute(text("ALTER TABLE users ADD COLUMN theme_preference VARCHAR(16)"))
            db.commit()
        _normalize_legacy_user_roles(db)
        migrate_projectpilot_system_owner_remove_localhost(db)
    except Exception:
        logger.exception("ensure_user_migrations failed")
        db.rollback()


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
    if not is_valid_role(role):
        raise ValueError("Invalid role")
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
    role = SYSTEM_OWNER if count_users(db) == 0 else MEMBER
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


def update_self(db: Session, user: User, body: UserSelfUpdate) -> User:
    data = body.model_dump(exclude_unset=True)
    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"]
    if "email" in data and data["email"] is not None:
        email = str(data["email"]).lower()
        if get_by_email(db, email) and email != user.email.lower():
            raise ValueError("Email already in use")
        user.email = email
    if "theme_preference" in data:
        user.theme_preference = data["theme_preference"]
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
        if role == SYSTEM_OWNER:
            raise ValueError("The system_owner role cannot be assigned via the API")
        if not is_valid_role(role):
            raise ValueError("Invalid role")
        target.role = role
    if is_active is not None:
        target.is_active = is_active
    target.updated_at = datetime.now(timezone.utc)
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def validate_admin_permanent_delete(db: Session, actor: User, target: User) -> None:
    if actor.id == target.id:
        raise ValueError("You cannot delete your own account")
    if target.role == SYSTEM_OWNER:
        raise ValueError("The system owner account cannot be deleted")
    if target.is_active and target.role in _PLATFORM_ADMIN_ROLES:
        if _other_active_platform_admin_count(db, target.id) < 1:
            raise ValueError("Cannot delete the last active platform administrator")


def _purge_user_row_and_reassign(db: Session, victim_id: str, assign_to_id: str) -> None:
    """Re-point FKs away from victim_id, then delete that user row. Caller must commit."""
    tid, aid = victim_id, assign_to_id
    db.execute(update(Project).where(Project.owner_id == tid).values(owner_id=aid))
    for proj in db.scalars(select(Project)).all():
        raw = getattr(proj, "team_user_ids_json", None) or "[]"
        try:
            team = json.loads(raw)
        except json.JSONDecodeError:
            team = []
        if not isinstance(team, list) or tid not in team:
            continue
        next_team = [str(x) for x in team if str(x) != tid]
        proj.team_user_ids_json = json.dumps(next_team)
        db.add(proj)
    db.execute(update(AuditLog).where(AuditLog.actor_user_id == tid).values(actor_user_id=None))
    db.execute(update(ActivityLog).where(ActivityLog.actor_user_id == tid).values(actor_user_id=aid))
    db.execute(delete(NotificationLog).where(NotificationLog.user_id == tid))
    db.execute(
        update(BrandingSettings).where(BrandingSettings.updated_by_user_id == tid).values(
            updated_by_user_id=None,
        ),
    )
    db.flush()
    db.execute(delete(User).where(User.id == tid))


def delete_user_permanent(db: Session, actor: User, target_id: str) -> None:
    target = get_by_id(db, target_id)
    if target is None:
        raise ValueError("User not found")
    validate_admin_permanent_delete(db, actor, target)
    tid, aid = target.id, actor.id
    try:
        _purge_user_row_and_reassign(db, tid, aid)
        db.commit()
        db.expire_all()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Could not delete this user: the database still has linked records. "
            "Try deactivating the account instead, or contact support.",
        ) from exc


def migrate_projectpilot_system_owner_remove_localhost(db: Session) -> None:
    """Idempotent: promote admin@projectpilot.com to system_owner and remove admin@localhost from DB.

    Run from app startup migrations so dev bootstrap (localhost) can be retired in favour of a
    real admin email without manual SQL.
    """
    local_email = "admin@localhost"
    target_email = "admin@projectpilot.com"
    new = get_by_email(db, target_email)
    if not new:
        return
    old = get_by_email(db, local_email)
    need_promote = new.role != SYSTEM_OWNER or not new.is_active
    need_remove = old is not None and old.id != new.id
    if not need_promote and not need_remove:
        return
    try:
        if need_promote:
            new.role = SYSTEM_OWNER
            new.is_active = True
            db.add(new)
        if need_remove:
            db.flush()
            _purge_user_row_and_reassign(db, old.id, new.id)
        db.commit()
        logger.info(
            "System owner migration: target=%s promote=%s removed_localhost=%s",
            target_email,
            need_promote,
            need_remove,
        )
    except Exception:
        logger.exception("migrate_projectpilot_system_owner_remove_localhost failed")
        db.rollback()
