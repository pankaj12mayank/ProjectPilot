import pandas as pd

from app.constants.columns import RaidColumns, StatusColumns


def calculate_metrics(status_df: pd.DataFrame) -> tuple[float, float, float]:
    df = status_df.copy()
    df["Schedule Variance"] = df[StatusColumns.ACTUAL_PCT] - df[StatusColumns.PLANNED_PCT]
    df["Effort Variance"] = df[StatusColumns.ACTUAL_HOURS] - df[StatusColumns.PLANNED_HOURS]

    overall_completion = float(df[StatusColumns.ACTUAL_PCT].mean())
    total_sv = float(df["Schedule Variance"].sum())
    total_ev = float(df["Effort Variance"].sum())

    return overall_completion, total_sv, total_ev


def calculate_evm(status_df: pd.DataFrame) -> tuple[float, float]:
    df = status_df.copy()
    df["PV"] = df[StatusColumns.PLANNED_PCT] * df[StatusColumns.PLANNED_BUDGET]
    df["EV"] = df[StatusColumns.ACTUAL_PCT] * df[StatusColumns.PLANNED_BUDGET]
    df["AC"] = df[StatusColumns.ACTUAL_COST]

    total_pv = float(df["PV"].sum())
    total_ev = float(df["EV"].sum())
    total_ac = float(df["AC"].sum())

    spi = total_ev / total_pv if total_pv else 0.0
    cpi = total_ev / total_ac if total_ac else 0.0

    return spi, cpi


def calculate_risk_score(raid_df: pd.DataFrame) -> int:
    df = raid_df.copy()
    mask = (
        df[RaidColumns.TYPE].astype(str).str.lower().eq("risk")
        & df[RaidColumns.SEVERITY].astype(str).str.lower().eq("high")
        & df[RaidColumns.STATUS].astype(str).str.lower().eq("open")
    )
    return int(mask.sum())
