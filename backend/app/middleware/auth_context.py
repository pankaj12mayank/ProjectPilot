"""Lightweight JWT decode for request context (logging / future use). Authorization still enforced via Depends."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.security import decode_access_token


class AttachJwtContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request.state.jwt_sub = None
        request.state.jwt_role = None
        auth = request.headers.get("authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth[7:].strip()
            try:
                payload = decode_access_token(token)
                request.state.jwt_sub = payload.get("sub")
                request.state.jwt_role = payload.get("role")
            except Exception:
                pass
        return await call_next(request)
