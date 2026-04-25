import os
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _repo_root() -> Path:
    """Runtime data root: repo root in dev, or `/work` in the default Docker layout."""
    override = os.environ.get("PROJECT_ROOT", "").strip()
    if override:
        return Path(override).resolve()
    # backend/app/config/settings.py -> parents[3] == repository root (parent of `backend/`)
    return Path(__file__).resolve().parents[3]


def _env_files() -> tuple[str, ...]:
    """Load env from repo root first, then backend/.env (later files override)."""
    root = _repo_root()
    paths: list[str] = []
    for name in (".env",):
        p = root / name
        if p.is_file():
            paths.append(str(p))
        bp = root / "backend" / name
        if bp.is_file() and str(bp) not in paths:
            paths.append(str(bp))
    return tuple(paths)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    chart_dpi: int = Field(default=300, validation_alias="CHART_DPI")
    rag_red_risk: int = Field(default=5, validation_alias="RAG_RED_RISK")
    rag_amber_risk: int = Field(default=3, validation_alias="RAG_AMBER_RISK")
    rag_red_sv: float = Field(default=-10.0, validation_alias="RAG_RED_SV")
    rag_amber_sv: float = Field(default=-5.0, validation_alias="RAG_AMBER_SV")
    api_prefix: str = Field(default="/api/v1", validation_alias="API_PREFIX")
    cors_origins: str = Field(
        default="http://127.0.0.1:5173,http://localhost:5173",
        validation_alias="CORS_ORIGINS",
    )
    jwt_secret_key: str = Field(
        default="dev-only-set-JWT_SECRET_KEY-in-env",
        validation_alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_access_expire_minutes: int = Field(
        default=30,
        validation_alias=AliasChoices("JWT_ACCESS_EXPIRE_MINUTES", "JWT_EXPIRE_MINUTES"),
    )
    jwt_refresh_expire_days: int = Field(default=7, validation_alias="JWT_REFRESH_EXPIRE_DAYS")
    bootstrap_admin_email: str | None = Field(
        default=None,
        validation_alias=AliasChoices("BOOTSTRAP_ADMIN_EMAIL", "ADMIN_EMAIL"),
    )
    bootstrap_admin_password: str | None = Field(
        default=None,
        validation_alias=AliasChoices("BOOTSTRAP_ADMIN_PASSWORD", "ADMIN_PASSWORD"),
    )
    bootstrap_admin_name: str = Field(default="Administrator", validation_alias="BOOTSTRAP_ADMIN_NAME")
    dev_return_reset_token: bool = Field(default=False, validation_alias="DEV_RETURN_RESET_TOKEN")
    #: Optional Fernet key (urlsafe base64, 32 bytes) for encrypting SMTP passwords in DB. If unset, derived from JWT_SECRET_KEY.
    email_encryption_key: str | None = Field(default=None, validation_alias="EMAIL_ENCRYPTION_KEY")

    public_api_url: str | None = Field(default=None, validation_alias="PUBLIC_API_URL")
    public_app_url: str | None = Field(default=None, validation_alias="PUBLIC_APP_URL")
    branding_max_upload_mb: int = Field(default=5, ge=1, le=100, validation_alias="BRANDING_MAX_UPLOAD_MB")
    project_upload_max_mb: int = Field(default=30, ge=1, le=200, validation_alias="PROJECT_UPLOAD_MAX_MB")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def repo_root(self) -> Path:
        return _repo_root()

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url and self.database_url.strip():
            return self.database_url.strip()
        data_dir = self.repo_root / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{(data_dir / 'app.db').as_posix()}"

    @property
    def logs_dir(self) -> Path:
        p = self.repo_root / "logs"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def outputs_dir(self) -> Path:
        p = self.repo_root / "outputs"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def uploads_dir(self) -> Path:
        p = self.repo_root / "uploads"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def branding_upload_dir(self) -> Path:
        p = self.uploads_dir / "branding"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def branding_defaults_dir(self) -> Path:
        p = self.repo_root / "branding_defaults"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def branding_max_upload_bytes(self) -> int:
        return int(self.branding_max_upload_mb) * 1024 * 1024

    @property
    def project_upload_max_bytes(self) -> int:
        return int(self.project_upload_max_mb) * 1024 * 1024

    def rag_thresholds(self) -> dict[str, float | int]:
        return {
            "red_risk": self.rag_red_risk,
            "amber_risk": self.rag_amber_risk,
            "red_sv": self.rag_red_sv,
            "amber_sv": self.rag_amber_sv,
        }

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
