import logging

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.services import user_service

logger = logging.getLogger(__name__)


def seed_bootstrap_admin(db: Session) -> None:
    """Create admin from env if that email is not registered yet.

    Previously we only seeded when the DB had zero users, so the first *register* user
    blocked ADMIN_EMAIL from ever being created — fixed by keying off email existence only.
    """
    settings = get_settings()
    email = (settings.bootstrap_admin_email or "").strip()
    password = (settings.bootstrap_admin_password or "").strip()
    if not email or not password:
        logger.info(
            "Bootstrap admin skipped: set ADMIN_EMAIL and ADMIN_PASSWORD (or BOOTSTRAP_*) in .env "
            "(repo root or backend/.env).",
        )
        return
    if user_service.get_by_email(db, email):
        logger.info(
            "Bootstrap admin skipped: %s is already registered — use that account's password, "
            "or delete the user / reset password if you changed ADMIN_PASSWORD in .env.",
            email,
        )
        return
    name = (settings.bootstrap_admin_name or "Administrator").strip() or "Administrator"
    user_service.create_user(
        db,
        email=email,
        password=password,
        full_name=name,
        role="admin",
    )
    logger.info("Bootstrap admin created for %s (restart not required for other users).", email)
