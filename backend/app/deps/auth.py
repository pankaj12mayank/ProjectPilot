from collections.abc import Callable

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.orm import Session

from app.constants.roles import ADMIN, MANAGER, MEMBER
from app.db.models import User
from app.db.session import get_db
from app.security import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_access_token(creds.credentials)
    except (InvalidTokenError, ExpiredSignatureError, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None
    uid = payload.get("sub")
    if not uid or not isinstance(uid, str):
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.get(User, uid)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_roles(*allowed: str) -> Callable[..., User]:
    allowed_set = frozenset(allowed)

    async def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_set:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return _dep


require_admin = require_roles(ADMIN)
require_manager_or_admin = require_roles(ADMIN, MANAGER)
