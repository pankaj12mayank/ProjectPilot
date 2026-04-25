"""Persist normalized ingested rows for a project role (after successful validation)."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.models import ProjectDataRow

logger = logging.getLogger(__name__)

MAX_INGESTION_ROWS = 50_000
BATCH_FLUSH = 500


def _jsonable_value(v: Any) -> Any:
    import pandas as pd

    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if hasattr(v, "item"):
        try:
            return _jsonable_value(v.item())
        except (ValueError, TypeError, AttributeError):
            return str(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    if isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


def dataframe_to_records(df: Any) -> list[dict[str, Any]]:
    """One dict per row with string keys and JSON-friendly values."""
    out: list[dict[str, Any]] = []
    for _, row in df.reset_index(drop=True).iterrows():
        rec: dict[str, Any] = {}
        for col in df.columns:
            rec[str(col)] = _jsonable_value(row[col])
        out.append(rec)
    return out


def replace_ingested_rows_for_role(
    db: Session,
    project_id: str,
    project_file_id: str,
    file_role: str,
    df: Any,
) -> int:
    """Delete existing rows for this project+role and insert current dataframe. Caller should commit."""
    db.execute(
        delete(ProjectDataRow).where(
            ProjectDataRow.project_id == project_id,
            ProjectDataRow.file_role == file_role,
        ),
    )
    records = dataframe_to_records(df)
    if len(records) > MAX_INGESTION_ROWS:
        records = records[:MAX_INGESTION_ROWS]
        logger.warning("Ingestion truncated to %s rows for project=%s role=%s", MAX_INGESTION_ROWS, project_id, file_role)

    batch: list[ProjectDataRow] = []
    total = 0
    for i, rec in enumerate(records):
        try:
            payload = json.dumps(rec, default=str, ensure_ascii=False)
        except (TypeError, ValueError) as exc:
            logger.warning("Skipping non-serializable row %s: %s", i, exc)
            continue
        batch.append(
            ProjectDataRow(
                id=str(uuid.uuid4()),
                project_id=project_id,
                project_file_id=project_file_id,
                file_role=file_role,
                row_index=i,
                payload_json=payload,
            ),
        )
        total += 1
        if len(batch) >= BATCH_FLUSH:
            db.add_all(batch)
            db.flush()
            batch.clear()
    if batch:
        db.add_all(batch)
        db.flush()
    return total
