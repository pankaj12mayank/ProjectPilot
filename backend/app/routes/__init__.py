from fastapi import APIRouter

from app.routes import auth, governance, health, projects, users


def build_api_router() -> APIRouter:
    api = APIRouter()
    api.include_router(health.router, tags=["health"])
    api.include_router(auth.router, prefix="/auth", tags=["auth"])
    api.include_router(users.router, prefix="/users", tags=["users"])
    api.include_router(projects.router, prefix="/projects", tags=["projects"])
    api.include_router(governance.router, prefix="/governance", tags=["governance"])
    return api
