from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.middleware.auth_context import AttachJwtContextMiddleware
from app.db.base import Base
import app.db.models  # noqa: F401 — register ORM tables with Base.metadata
from sqlalchemy.orm import sessionmaker

from app.db.session import get_engine
from app.routes import build_api_router
from app.services.bootstrap import seed_bootstrap_admin
from app.services.branding_service import seed_default_if_missing
from app.services.email_settings_service import (
    ensure_email_settings_migrations,
    seed_default_if_missing as seed_email_settings_if_missing,
)
from app.services import project_service, user_service
from app.utils.logging_config import setup_logging


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging()
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        user_service.ensure_user_migrations(db)
        project_service.ensure_project_schema(db)
        seed_bootstrap_admin(db)
        seed_default_if_missing(db)
        ensure_email_settings_migrations(db)
        seed_email_settings_if_missing(db)
    finally:
        db.close()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="ProjectPilot API", lifespan=lifespan)
    app.add_middleware(AttachJwtContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(build_api_router(), prefix=settings.api_prefix)
    return app


app = create_app()
