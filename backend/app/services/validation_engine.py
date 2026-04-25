"""Structural validation for governance-related uploads (after mapping + cleaning)."""

from __future__ import annotations

from typing import Any

from app.constants.columns import RaidColumns, StatusColumns, WeeklyHistoryColumns

FileRole = str

MAX_ISSUES = 100


class ValidationIssue(dict):
    """Serializable issue: code, message, optional row/column."""

    @staticmethod
    def err(code: str, message: str, row: int | None = None, column: str | None = None) -> dict[str, Any]:
        return {"code": code, "message": message, "row": row, "column": column}


def _cap(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(issues) <= MAX_ISSUES:
        return issues
    extra = len(issues) - MAX_ISSUES
    return issues[:MAX_ISSUES] + [
        ValidationIssue.err(
            "issue_limit",
            f"Showing first {MAX_ISSUES} issues only; {extra} additional issue(s) were omitted.",
        ),
    ]


def _excel_row_num(pos: Any) -> int | None:
    """1-based spreadsheet row index for default RangeIndex positions."""
    if isinstance(pos, int):
        return pos + 1
    return None


def _require_columns(df: Any, required: set[str], role_label: str) -> list[dict[str, Any]]:
    missing = sorted(required - set(df.columns))
    if not missing:
        return []
    return [
        ValidationIssue.err(
            "missing_columns",
            f"{role_label} is missing required column(s): {', '.join(missing)}",
            column=",".join(missing),
        ),
    ]


def _non_empty_dataframe(df: Any) -> Any:
    return df.dropna(how="all")


def _row_has_any_value(row: Any) -> bool:
    return bool(row.notna().any())


def _missing_required_cell_issues(
    df: Any,
    required: list[str],
    label: str,
    max_rows: int = 40,
) -> list[dict[str, Any]]:
    import pandas as pd

    issues: list[dict[str, Any]] = []
    data = _non_empty_dataframe(df)
    if data.empty:
        return issues
    count = 0
    for pos, row in data.iterrows():
        if not _row_has_any_value(row):
            continue
        for col in required:
            if col not in df.columns:
                continue
            v = row[col]
            if pd.isna(v) or (isinstance(v, str) and not v.strip()):
                issues.append(
                    ValidationIssue.err(
                        "missing_value",
                        f"{label}: required value is empty.",
                        row=_excel_row_num(pos),
                        column=col,
                    ),
                )
                count += 1
                if count >= max_rows:
                    return issues
    return issues


def _duplicate_row_issues(df: Any, subset: list[str], code: str, message: str) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    cols = [c for c in subset if c in df.columns]
    if not cols:
        return issues
    data = _non_empty_dataframe(df)
    if data.empty:
        return issues
    sub = data[cols].fillna("__NA__").astype(str).apply(lambda s: s.str.strip().str.casefold(), axis=0)
    dup_mask = sub.duplicated(keep=False)
    if not dup_mask.any():
        return issues
    shown = 0
    for pos in data.index[dup_mask]:
        issues.append(ValidationIssue.err(code, message, row=_excel_row_num(pos), column=",".join(cols)))
        shown += 1
        if shown >= 25:
            break
    return issues


def validate_status_tracker(df: Any) -> list[dict[str, Any]]:
    required = {
        StatusColumns.PLANNED_PCT,
        StatusColumns.ACTUAL_PCT,
        StatusColumns.PLANNED_HOURS,
        StatusColumns.ACTUAL_HOURS,
        StatusColumns.PLANNED_BUDGET,
        StatusColumns.ACTUAL_COST,
    }
    issues: list[dict[str, Any]] = []
    issues.extend(_require_columns(df, required, "Status tracker"))
    if issues:
        return _cap(issues)

    data = _non_empty_dataframe(df)
    if data.empty:
        issues.append(ValidationIssue.err("empty_sheet", "No data rows found in this sheet."))
        return _cap(issues)

    for col in required:
        if df[col].isna().all():
            issues.append(ValidationIssue.err("empty_column", f"Column '{col}' has no usable values.", column=col))

    if StatusColumns.TASK in df.columns:
        subset_dup = [StatusColumns.TASK] + sorted(required)
    else:
        subset_dup = sorted(required)
    issues.extend(
        _duplicate_row_issues(
            df,
            subset_dup,
            "duplicate_row",
            "Duplicate status row detected (same key columns).",
        ),
    )

    issues.extend(_missing_required_cell_issues(df, sorted(required), "Status tracker"))

    if StatusColumns.PLANNED_PCT in df.columns:
        s = df[StatusColumns.PLANNED_PCT]
        bad = s.notna() & ((s < 0) | (s > 100))
        for pos in list(df.index[bad])[:15]:
            issues.append(
                ValidationIssue.err(
                    "invalid_format",
                    "Planned % must be between 0 and 100.",
                    row=_excel_row_num(pos),
                    column=StatusColumns.PLANNED_PCT,
                ),
            )
    if StatusColumns.ACTUAL_PCT in df.columns:
        s = df[StatusColumns.ACTUAL_PCT]
        bad = s.notna() & ((s < 0) | (s > 100))
        for pos in list(df.index[bad])[:15]:
            issues.append(
                ValidationIssue.err(
                    "invalid_format",
                    "Actual % must be between 0 and 100.",
                    row=_excel_row_num(pos),
                    column=StatusColumns.ACTUAL_PCT,
                ),
            )

    return _cap(issues)


def validate_raid_log(df: Any) -> list[dict[str, Any]]:
    required = {RaidColumns.TYPE, RaidColumns.SEVERITY, RaidColumns.STATUS}
    issues: list[dict[str, Any]] = []
    issues.extend(_require_columns(df, required, "RAID log"))
    if issues:
        return _cap(issues)

    data = _non_empty_dataframe(df)
    if data.empty:
        issues.append(ValidationIssue.err("empty_sheet", "No data rows found in this sheet."))
        return _cap(issues)

    issues.extend(
        _duplicate_row_issues(
            df,
            [RaidColumns.TYPE, RaidColumns.SEVERITY, RaidColumns.STATUS],
            "duplicate_row",
            "Duplicate RAID row detected (same Type, Severity, and Status).",
        ),
    )
    issues.extend(_missing_required_cell_issues(df, sorted(required), "RAID log"))
    return _cap(issues)


def validate_weekly_history(df: Any) -> list[dict[str, Any]]:
    required = {WeeklyHistoryColumns.WEEK, WeeklyHistoryColumns.COMPLETION}
    issues: list[dict[str, Any]] = []
    issues.extend(_require_columns(df, required, "Weekly history"))
    if issues:
        return _cap(issues)

    data = _non_empty_dataframe(df)
    if data.empty:
        issues.append(ValidationIssue.err("empty_sheet", "No data rows found in this sheet."))
        return _cap(issues)

    issues.extend(
        _duplicate_row_issues(
            df,
            [WeeklyHistoryColumns.WEEK],
            "duplicate_row",
            "Duplicate week value detected.",
        ),
    )
    issues.extend(_missing_required_cell_issues(df, list(required), "Weekly history"))

    if WeeklyHistoryColumns.COMPLETION in df.columns:
        s = df[WeeklyHistoryColumns.COMPLETION]
        bad_mask = s.notna() & ((s < 0) | (s > 100))
        for pos in list(df.index[bad_mask])[:20]:
            issues.append(
                ValidationIssue.err(
                    "invalid_format",
                    "Completion must be between 0 and 100.",
                    row=_excel_row_num(pos),
                    column=WeeklyHistoryColumns.COMPLETION,
                ),
            )

    return _cap(issues)


def validate_dataframe(df: Any, role: FileRole) -> list[dict[str, Any]]:
    if role == "status_tracker":
        return validate_status_tracker(df)
    if role == "raid_log":
        return validate_raid_log(df)
    if role == "weekly_history":
        return validate_weekly_history(df)
    return [ValidationIssue.err("unknown_role", f"Unknown file role '{role}'.")]
