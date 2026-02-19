def calculate_metrics(status_df):

    status_df["Schedule Variance"] = status_df["Actual %"] - status_df["Planned %"]
    status_df["Effort Variance"] = status_df["Actual Hours"] - status_df["Planned Hours"]

    overall_completion = status_df["Actual %"].mean()
    total_sv = status_df["Schedule Variance"].sum()
    total_ev = status_df["Effort Variance"].sum()

    return overall_completion, total_sv, total_ev


def calculate_evm(status_df):

    status_df["PV"] = status_df["Planned %"] * status_df["Planned Budget"]
    status_df["EV"] = status_df["Actual %"] * status_df["Planned Budget"]
    status_df["AC"] = status_df["Actual Cost"]

    total_PV = status_df["PV"].sum()
    total_EV = status_df["EV"].sum()
    total_AC = status_df["AC"].sum()

    SPI = total_EV / total_PV if total_PV else 0
    CPI = total_EV / total_AC if total_AC else 0

    return SPI, CPI


def calculate_risk_score(raid_df):
    high_open = raid_df[
        (raid_df["Type"].str.lower() == "risk") &
        (raid_df["Severity"].str.lower() == "high") &
        (raid_df["Status"].str.lower() == "open")
    ]
    return len(high_open)
