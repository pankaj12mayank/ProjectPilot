from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="member")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    password_reset_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: Synced appearance: "light" | "dark" | "system"; null = use client default (e.g. localStorage).
    theme_preference: Mapped[str | None] = mapped_column(String(16), nullable=True)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    #: Optional planning window (shown in UI; does not drive calculations alone).
    planned_start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    planned_end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: JSON array of user ids invited to the project (informational; access still follows owner + role rules).
    team_user_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    #: Optional built-in template chosen at creation (`project_templates.SAMPLE_TEMPLATES`).
    template_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ProjectFile(Base):
    __tablename__ = "project_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), index=True)
    file_role: Mapped[str] = mapped_column(String(32))
    original_filename: Mapped[str] = mapped_column(String(512))
    stored_path: Mapped[str] = mapped_column(Text)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    last_validation_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class ProjectDataRow(Base):
    """Cleaned, validated tabular row for a project file role (JSON payload per canonical columns)."""

    __tablename__ = "project_data_rows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), index=True)
    project_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("project_files.id"), index=True)
    file_role: Mapped[str] = mapped_column(String(32), index=True)
    row_index: Mapped[int] = mapped_column(Integer, index=True)
    payload_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ProjectReportRun(Base):
    """One generated intelligence/report package for a project (multi-format outputs on disk)."""

    __tablename__ = "project_report_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    rag_status: Mapped[str] = mapped_column(String(16), default="Green")
    forecast_headline: Mapped[str | None] = mapped_column(Text, nullable=True)
    outputs_json: Mapped[str] = mapped_column(Text)


class ProjectMetricsSnapshot(Base):
    """Time-series metrics for portfolio trends (captured on report generation or manual snapshot)."""

    __tablename__ = "project_metrics_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), index=True)
    report_run_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("project_report_runs.id"), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(32), default="report_package")
    metrics_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class GeneratedReportArtifact(Base):
    """Indexed storage for each generated report file (always tied to project_id + report run)."""

    __tablename__ = "generated_report_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), index=True)
    report_run_id: Mapped[str] = mapped_column(String(36), ForeignKey("project_report_runs.id"), index=True)
    artifact_key: Mapped[str] = mapped_column(String(64), index=True)
    relative_path: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ProjectRisk(Base):
    """User-registered project risk (separate from ingested RAID rows); optional link to a report run."""

    __tablename__ = "project_risks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(16), default="medium", index=True)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    report_run_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("project_report_runs.id"),
        nullable=True,
        index=True,
    )
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class AuditLog(Base):
    """Security / compliance trail (admin-visible)."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    actor_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(128), index=True)
    entity_type: Mapped[str] = mapped_column(String(64), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    detail_json: Mapped[str] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)


class ActivityLog(Base):
    """User-visible product activity feed."""

    __tablename__ = "activity_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    actor_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(64), index=True)
    summary: Mapped[str] = mapped_column(String(512))
    detail_json: Mapped[str] = mapped_column(Text)


class NotificationLog(Base):
    """In-app / system notification history per user."""

    __tablename__ = "notification_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    channel: Mapped[str] = mapped_column(String(32), default="in_app")
    title: Mapped[str] = mapped_column(String(256))
    detail_json: Mapped[str] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GovernanceRun(Base):
    """Audit row for each governance report generation."""

    __tablename__ = "governance_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    rag_status: Mapped[str] = mapped_column(String(16))
    completion_pct: Mapped[float] = mapped_column(Float)
    schedule_variance_sum: Mapped[float] = mapped_column(Float)
    effort_variance_sum: Mapped[float] = mapped_column(Float)
    risk_score: Mapped[int] = mapped_column(Integer)
    spi: Mapped[float] = mapped_column(Float)
    cpi: Mapped[float] = mapped_column(Float)
    ppt_path: Mapped[str] = mapped_column(Text)
    email_path: Mapped[str] = mapped_column(Text)


class BrandingSettings(Base):
    """Singleton row (id=`default`) for platform branding and public URL hints."""

    __tablename__ = "branding_settings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    product_name: Mapped[str] = mapped_column(String(200), default="ProjectPilot")
    product_tagline: Mapped[str] = mapped_column(String(500), default="")
    footer_text: Mapped[str] = mapped_column(String(500), default="")
    support_email: Mapped[str] = mapped_column(String(255), default="")
    company_address: Mapped[str] = mapped_column(Text, default="")
    social_links_json: Mapped[str] = mapped_column(Text, default="{}")
    meta_title: Mapped[str] = mapped_column(String(200), default="")
    meta_description: Mapped[str] = mapped_column(String(500), default="")
    default_domain_url: Mapped[str] = mapped_column(String(512), default="")
    company_website_url: Mapped[str] = mapped_column(String(512), default="")
    public_api_url: Mapped[str] = mapped_column(String(512), default="")
    public_app_url: Mapped[str] = mapped_column(String(512), default="")
    assets_json: Mapped[str] = mapped_column(Text, default="{}")
    asset_version: Mapped[int] = mapped_column(Integer, default=1)
    #: How the sidebar logo is shown on the dark rail: auto (opaque → invert), invert, original.
    sidebar_logo_filter: Mapped[str] = mapped_column(String(16), default="auto")
    #: Optional #RRGGBB accent for light theme UI (charts, highlights); empty = palette default.
    accent_color_light: Mapped[str] = mapped_column(String(16), default="")
    #: Optional #RRGGBB accent for dark theme UI.
    accent_color_dark: Mapped[str] = mapped_column(String(16), default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
