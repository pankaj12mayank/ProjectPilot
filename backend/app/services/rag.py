def calculate_rag(
    total_sv: float,
    risk_score: int,
    thresholds: dict[str, float | int],
) -> str:
    if risk_score >= thresholds["red_risk"] or total_sv <= thresholds["red_sv"]:
        return "Red"
    if risk_score >= thresholds["amber_risk"] or total_sv <= thresholds["amber_sv"]:
        return "Amber"
    return "Green"
