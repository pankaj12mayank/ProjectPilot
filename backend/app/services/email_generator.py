from datetime import datetime
from pathlib import Path


def generate_email(
    metrics: tuple[float, float, float, int],
    rag: str,
    evm: tuple[float, float],
    output_dir: Path,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    completion, total_sv, total_ev, risk_score = metrics
    spi, cpi = evm

    if rag == "Red":
        insight = "Immediate leadership intervention required."
    elif rag == "Amber":
        insight = "Close monitoring recommended."
    else:
        insight = "Project progressing steadily."

    content = f"""
Subject: Weekly Project Governance Update

Dear Leadership Team,

Overall Completion: {round(completion, 2)}%
Schedule Variance: {round(total_sv, 2)}
Effort Variance: {round(total_ev, 2)}
High Open Risks: {risk_score}
SPI: {round(spi, 2)}
CPI: {round(cpi, 2)}

Overall Health: {rag}

Insight:
{insight}

Regards,
Project Management Office
"""

    path = output_dir / f"Executive_Email_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    path.write_text(content.strip() + "\n", encoding="utf-8")
    return path
