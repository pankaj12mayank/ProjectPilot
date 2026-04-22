"""Bundle forecast, root causes, recommendations, and markdown summaries."""

from __future__ import annotations

from typing import Any

from app.services.intelligence.forecast_engine import build_forecast
from app.services.intelligence.recommendation_engine import build_recommendations
from app.services.intelligence.root_cause_engine import build_root_causes
from app.services.intelligence.summaries import client_report, executive_summary, pm_detailed_report


def build_intelligence_core(health: dict[str, Any]) -> dict[str, Any]:
    """Forecast, root causes, and recommendations only (no markdown file bodies)."""
    forecast = build_forecast(health)
    root_causes = build_root_causes(health)
    recommendations = build_recommendations(health, forecast, root_causes)
    return {
        "forecast": forecast,
        "root_causes": root_causes,
        "recommendations": recommendations,
    }


def build_intelligence_bundle(project_name: str, health: dict[str, Any]) -> dict[str, Any]:
    core = build_intelligence_core(health)
    forecast = core["forecast"]
    root_causes = core["root_causes"]
    recommendations = core["recommendations"]
    return {
        **core,
        "executive_summary_markdown": executive_summary(
            project_name,
            health,
            forecast,
            root_causes,
            recommendations,
        ),
        "pm_detailed_report_markdown": pm_detailed_report(
            project_name,
            health,
            forecast,
            root_causes,
            recommendations,
        ),
        "client_report_markdown": client_report(project_name, health, forecast, recommendations),
    }
