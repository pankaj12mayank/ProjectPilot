from datetime import datetime
from config.settings import OUTPUT_FOLDER
import os

def generate_email(metrics, rag, evm):

    completion, total_sv, total_ev, risk_score = metrics
    SPI, CPI = evm

    insight = "Project progressing steadily."
    if rag == "Red":
        insight = "Immediate leadership intervention required."
    elif rag == "Amber":
        insight = "Close monitoring recommended."

    content = f"""
Subject: Weekly Project Governance Update

Dear Leadership Team,

Overall Completion: {round(completion,2)}%
Schedule Variance: {round(total_sv,2)}
Effort Variance: {round(total_ev,2)}
High Open Risks: {risk_score}
SPI: {round(SPI,2)}
CPI: {round(CPI,2)}

Overall Health: {rag}

Insight:
{insight}

Regards,
Project Management Office
"""

    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    path = f"{OUTPUT_FOLDER}/Executive_Email_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

    with open(path, "w") as f:
        f.write(content)

    return path
