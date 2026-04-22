"""Map messy spreadsheet headers to canonical column names per file role."""

from __future__ import annotations

import re
import unicodedata

import pandas as pd

from app.constants.columns import RaidColumns, StatusColumns, WeeklyHistoryColumns

FileRole = str  # status_tracker | raid_log | weekly_history


def _normalize_header(name: str) -> str:
    s = unicodedata.normalize("NFKC", str(name))
    s = s.replace("\ufeff", "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


# normalized synonym -> canonical column name
STATUS_HEADER_MAP: dict[str, str] = {
    "task": StatusColumns.TASK,
    "task name": StatusColumns.TASK,
    "activity": StatusColumns.TASK,
    "wbs": StatusColumns.TASK,
    "planned hours": StatusColumns.PLANNED_HOURS,
    "actual hours": StatusColumns.ACTUAL_HOURS,
    "planned %": StatusColumns.PLANNED_PCT,
    "planned pct": StatusColumns.PLANNED_PCT,
    "planned percent": StatusColumns.PLANNED_PCT,
    "actual %": StatusColumns.ACTUAL_PCT,
    "actual pct": StatusColumns.ACTUAL_PCT,
    "actual percent": StatusColumns.ACTUAL_PCT,
    "planned budget": StatusColumns.PLANNED_BUDGET,
    "actual cost": StatusColumns.ACTUAL_COST,
}

RAID_HEADER_MAP: dict[str, str] = {
    "id": "ID",
    "type": RaidColumns.TYPE,
    "raid type": RaidColumns.TYPE,
    "category": RaidColumns.TYPE,
    "severity": RaidColumns.SEVERITY,
    "priority": RaidColumns.SEVERITY,
    "status": RaidColumns.STATUS,
    "state": RaidColumns.STATUS,
}

HISTORY_HEADER_MAP: dict[str, str] = {
    "week": WeeklyHistoryColumns.WEEK,
    "completion": WeeklyHistoryColumns.COMPLETION,
    "completion %": WeeklyHistoryColumns.COMPLETION,
    "completion percent": WeeklyHistoryColumns.COMPLETION,
}


def _build_rename_map(columns: list[str], synonym_map: dict[str, str]) -> dict[str, str]:
    rename: dict[str, str] = {}
    for raw in columns:
        key = _normalize_header(raw)
        if key in synonym_map:
            rename[raw] = synonym_map[key]
    return rename


def map_dataframe_columns(df: pd.DataFrame, role: FileRole) -> tuple[pd.DataFrame, dict[str, str]]:
    """Return a copy with columns renamed to canonical names where synonyms match."""
    if role == "status_tracker":
        sm = STATUS_HEADER_MAP
    elif role == "raid_log":
        sm = RAID_HEADER_MAP
    elif role == "weekly_history":
        sm = HISTORY_HEADER_MAP
    else:
        return df.copy(), {}

    rename = _build_rename_map(list(df.columns), sm)
    out = df.rename(columns=rename)
    mapping = {str(k): str(v) for k, v in rename.items()}
    return out, mapping
