from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ProjectIntelligenceOut(BaseModel):
    """Live intelligence from stored project uploads (same pipeline as report generation)."""

    project_id: str
    project_name: str
    data_complete: bool
    missing_roles: list[str]
    forecast: dict[str, Any]
    root_causes: list[dict[str, Any]]
    recommendations: list[dict[str, Any]]


class ReportRunSummaryOut(BaseModel):
    job_id: str
    created_at: datetime
    rag_status: str
    forecast_headline: str | None


class ProjectReportPackageOut(BaseModel):
    """Intelligence bundle plus markdown bodies and relative paths under repo root."""

    job_id: str
    project_id: str
    intelligence: dict[str, Any] = Field(description="forecast, root_causes, recommendations")
    summaries_markdown: dict[str, str] = Field(
        description="executive, pm_detailed, client markdown bodies",
    )
    outputs: dict[str, str | None] = Field(
        description="Relative file paths (posix-style segments); None if a writer failed",
    )
