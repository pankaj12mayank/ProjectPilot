from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


SeverityLevel = Literal["low", "medium", "high"]
RiskStatus = Literal["open", "closed"]


class ProjectRiskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=8000)
    severity: SeverityLevel = "medium"
    status: RiskStatus = "open"
    report_run_id: str | None = Field(
        default=None,
        description="Optional link to a report job for this project (must belong to the project).",
    )


class ProjectRiskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=8000)
    severity: SeverityLevel | None = None
    status: RiskStatus | None = None
    report_run_id: str | None = None


class ProjectRiskOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: str | None
    severity: str
    status: str
    report_run_id: str | None
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
