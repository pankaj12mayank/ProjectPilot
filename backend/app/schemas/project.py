from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.constants.columns import RaidColumns, StatusColumns, WeeklyHistoryColumns


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    planned_start_date: datetime | None = None
    planned_end_date: datetime | None = None
    team_user_ids: list[str] | None = None
    template_key: str | None = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def check_date_order(self) -> "ProjectCreate":
        if self.planned_start_date and self.planned_end_date:
            if self.planned_end_date < self.planned_start_date:
                raise ValueError("planned_end_date must be on or after planned_start_date")
        return self


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    is_archived: bool | None = None
    planned_start_date: datetime | None = None
    planned_end_date: datetime | None = None
    team_user_ids: list[str] | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str | None
    owner_id: str
    created_at: datetime
    updated_at: datetime
    is_archived: bool
    is_active: bool = True
    planned_start_date: datetime | None = None
    planned_end_date: datetime | None = None
    team_user_ids: list[str] = Field(default_factory=list)
    has_ingested_data: bool = False
    latest_report_job_id: str | None = None
    latest_report_at: datetime | None = None

    model_config = {"from_attributes": True}


class AssignableUserOut(BaseModel):
    id: str
    email: str
    full_name: str

    model_config = {"from_attributes": True}


class FormatGuideSlotOut(BaseModel):
    role: str
    title: str
    columns: list[str]
    preview_rows: list[list[str]]


class FormatGuideOut(BaseModel):
    slots: list[FormatGuideSlotOut]


class ProjectTemplateOut(BaseModel):
    key: str
    name: str
    summary: str
    checklist: list[str]
    suggested_description: str


def format_guide_payload() -> dict[str, object]:
    """Static column + sample row hints for the creation wizard (matches validation expectations)."""
    return {
        "slots": [
            {
                "role": "status_tracker",
                "title": "Status tracker",
                "columns": [
                    StatusColumns.TASK,
                    StatusColumns.PLANNED_HOURS,
                    StatusColumns.ACTUAL_HOURS,
                    StatusColumns.PLANNED_PCT,
                    StatusColumns.ACTUAL_PCT,
                    StatusColumns.PLANNED_BUDGET,
                    StatusColumns.ACTUAL_COST,
                ],
                "preview_rows": [
                    ["Discovery", "24", "20", "10", "8", "4000", "3500"],
                    ["Build sprint 1", "80", "72", "40", "35", "12000", "10800"],
                ],
            },
            {
                "role": "raid_log",
                "title": "RAID log",
                "columns": [RaidColumns.TYPE, RaidColumns.SEVERITY, RaidColumns.STATUS],
                "preview_rows": [
                    ["Risk", "High", "Open"],
                    ["Issue", "Medium", "In progress"],
                ],
            },
            {
                "role": "weekly_history",
                "title": "Weekly completion history",
                "columns": [WeeklyHistoryColumns.WEEK, WeeklyHistoryColumns.COMPLETION],
                "preview_rows": [
                    ["2025-W01", "12"],
                    ["2025-W02", "18"],
                ],
            },
        ],
    }


class FileSlotError(BaseModel):
    code: str
    message: str
    row: int | None = None
    column: str | None = None


class FileAnalyzeSlot(BaseModel):
    role: str
    filename: str | None
    valid: bool
    errors: list[FileSlotError]
    warnings: list[str]
    column_mapping: dict[str, str]
    preview_columns: list[str]
    preview_rows: list[list[str | float | int | bool | None]]
    sheet_used: str | None = None
    data_row_count: int | None = None
    persisted_row_count: int | None = None


class AnalyzeUploadResponse(BaseModel):
    project_id: str
    files: list[FileAnalyzeSlot]


class ProjectFileOut(BaseModel):
    id: str
    project_id: str
    file_role: str
    original_filename: str
    stored_path: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}
