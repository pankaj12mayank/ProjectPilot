"""Lightweight cleaning: strip strings, trim column names, coerce key numerics."""

from __future__ import annotations

import warnings

from app.constants.columns import RaidColumns, StatusColumns, WeeklyHistoryColumns


def strip_column_names(df: object) -> object:
    out = df.copy()
    out.columns = [str(c).strip() for c in out.columns]
    return out


def clean_string_cells(df: object) -> object:
    out = df.copy()
    for col in out.columns:
        if out[col].dtype == object:
            out[col] = out[col].apply(lambda x: x.strip() if isinstance(x, str) else x)
    return out


def _coerce_numeric(series: object) -> object:
    import pandas as pd

    return pd.to_numeric(series, errors="coerce")


def clean_status_dataframe(df: object) -> tuple[object, list[str]]:
    warnings_list: list[str] = []
    out = strip_column_names(df)
    out = clean_string_cells(out)
    for col in (
        StatusColumns.PLANNED_HOURS,
        StatusColumns.ACTUAL_HOURS,
        StatusColumns.PLANNED_PCT,
        StatusColumns.ACTUAL_PCT,
        StatusColumns.PLANNED_BUDGET,
        StatusColumns.ACTUAL_COST,
    ):
        if col in out.columns:
            out[col] = _coerce_numeric(out[col])
    if StatusColumns.PLANNED_PCT in out.columns:
        bad = out[StatusColumns.PLANNED_PCT].notna() & ((out[StatusColumns.PLANNED_PCT] < 0) | (out[StatusColumns.PLANNED_PCT] > 100))
        if bad.any():
            warnings_list.append("Some Planned % values are outside 0–100; they were kept as-is for review.")
    if StatusColumns.ACTUAL_PCT in out.columns:
        bad = out[StatusColumns.ACTUAL_PCT].notna() & ((out[StatusColumns.ACTUAL_PCT] < 0) | (out[StatusColumns.ACTUAL_PCT] > 100))
        if bad.any():
            warnings_list.append("Some Actual % values are outside 0–100; they were kept as-is for review.")
    return out, warnings_list


def clean_raid_dataframe(df: object) -> tuple[object, list[str]]:
    out = strip_column_names(df)
    out = clean_string_cells(out)
    return out, []


def clean_history_dataframe(df: object) -> tuple[object, list[str]]:
    out = strip_column_names(df)
    out = clean_string_cells(out)
    if WeeklyHistoryColumns.COMPLETION in out.columns:
        out[WeeklyHistoryColumns.COMPLETION] = _coerce_numeric(out[WeeklyHistoryColumns.COMPLETION])
    return out, []


def clean_for_role(df: object, role: str) -> tuple[object, list[str]]:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=FutureWarning)
        if role == "status_tracker":
            return clean_status_dataframe(df)
        if role == "raid_log":
            return clean_raid_dataframe(df)
        if role == "weekly_history":
            return clean_history_dataframe(df)
    return df.copy(), []
