from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class MetricsSnapshotOut(BaseModel):
    snapshot_id: str
    created_at: str


class PortfolioReportHistoryRow(BaseModel):
    job_id: str
    project_id: str
    project_name: str
    created_at: str
    rag_status: str
    forecast_headline: str | None


class PortfolioDashboardOut(BaseModel):
    projects: list[dict[str, Any]]
    trends: dict[str, list[dict[str, Any]]]


class PortfolioComparisonOut(BaseModel):
    rows: list[dict[str, Any]]
    trends: dict[str, list[dict[str, Any]]]


class PortfolioSummaryOut(BaseModel):
    totals: dict[str, Any]
    by_rag: dict[str, int]
    average_risk_score: float | None
    top_risky_projects: list[dict[str, Any]]
    projects: list[dict[str, Any]]


class RiskHeatmapOut(BaseModel):
    projects: list[dict[str, Any]]
    dimensions: list[str]


class ProjectHistoryOut(BaseModel):
    project_id: str
    project_name: str | None = None
    events: list[dict[str, Any]]
