from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    is_archived: bool | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str | None
    owner_id: str
    created_at: datetime
    updated_at: datetime
    is_archived: bool

    model_config = {"from_attributes": True}


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
