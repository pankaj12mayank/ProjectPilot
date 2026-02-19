from config.settings import RAG_THRESHOLDS

def calculate_rag(total_sv, risk_score):

    if risk_score >= RAG_THRESHOLDS["red_risk"] or total_sv <= RAG_THRESHOLDS["red_sv"]:
        return "Red"
    elif risk_score >= RAG_THRESHOLDS["amber_risk"] or total_sv <= RAG_THRESHOLDS["amber_sv"]:
        return "Amber"
    else:
        return "Green"
