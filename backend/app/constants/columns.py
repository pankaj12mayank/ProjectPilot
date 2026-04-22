"""Expected column names for ingested spreadsheets (single source of truth)."""


class StatusColumns:
    TASK = "Task"
    PLANNED_HOURS = "Planned Hours"
    ACTUAL_HOURS = "Actual Hours"
    PLANNED_PCT = "Planned %"
    ACTUAL_PCT = "Actual %"
    PLANNED_BUDGET = "Planned Budget"
    ACTUAL_COST = "Actual Cost"


class RaidColumns:
    TYPE = "Type"
    SEVERITY = "Severity"
    STATUS = "Status"


class WeeklyHistoryColumns:
    WEEK = "Week"
    COMPLETION = "Completion"
