from fastapi import APIRouter

from app.routes import admin, auth, branding, governance, health, logs, portfolio, projects, users


def build_api_router() -> APIRouter:
    api = APIRouter()
    api.include_router(health.router, tags=["health"])
    api.include_router(auth.router, prefix="/auth", tags=["auth"])
    api.include_router(users.router, prefix="/users", tags=["users"])
    api.include_router(projects.router, prefix="/projects", tags=["projects"])
    api.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
    api.include_router(logs.router, prefix="/logs", tags=["logs"])
    api.include_router(governance.router, prefix="/governance", tags=["governance"])
    api.include_router(branding.router, prefix="/branding", tags=["branding"])
    api.include_router(admin.router, prefix="/admin", tags=["admin"])
    return api
