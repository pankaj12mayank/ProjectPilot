"""Load ingested project rows from the database into DataFrames."""

from __future__ import annotations

import json
import logging

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ProjectDataRow

logger = logging.getLogger(__name__)


def load_role_dataframe(db: Session, project_id: str, file_role: str) -> pd.DataFrame | None:
    rows = db.scalars(
        select(ProjectDataRow)
        .where(ProjectDataRow.project_id == project_id, ProjectDataRow.file_role == file_role)
        .order_by(ProjectDataRow.row_index),
    ).all()
    if not rows:
        return None
    records: list[dict] = []
    for r in rows:
        try:
            records.append(json.loads(r.payload_json))
        except (json.JSONDecodeError, TypeError) as exc:
            logger.warning("Bad payload_json for row id=%s: %s", r.id, exc)
    if not records:
        return None
    try:
        return pd.DataFrame.from_records(records)
    except Exception as exc:
        logger.exception("Could not build DataFrame for project=%s role=%s: %s", project_id, file_role, exc)
        return None
