from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.db.models import User
from app.schemas.portfolio import (
    PortfolioComparisonOut,
    PortfolioDashboardOut,
    PortfolioOpenRiskRow,
    PortfolioReportHistoryRow,
    PortfolioSummaryOut,
    RiskHeatmapOut,
)
from app.services import risk_service
from app.services.portfolio_service import (
    build_cross_project_comparison,
    build_portfolio_dashboard,
    build_portfolio_report_history,
    build_portfolio_summary,
    build_risk_heatmap,
)

router = APIRouter()


@router.get("/open-risks", response_model=list[PortfolioOpenRiskRow])
def portfolio_open_risks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(40, ge=1, le=100),
) -> list[PortfolioOpenRiskRow]:
    """Open registered project risks across projects visible to the viewer (dashboard)."""
    rows = risk_service.list_open_risks_for_viewer(db, user, limit=limit)
    return [PortfolioOpenRiskRow.model_validate(r) for r in rows]


@router.get("/summary", response_model=PortfolioSummaryOut)
def portfolio_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortfolioSummaryOut:
    """Portfolio-wide aggregates and top risky projects (latest metrics per project)."""
    data = build_portfolio_summary(db, user)
    return PortfolioSummaryOut.model_validate(data)


@router.get("/risk-heatmap", response_model=RiskHeatmapOut)
def portfolio_risk_heatmap(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RiskHeatmapOut:
    """Normalized risk / schedule / cost / RAG stress per project for heatmap UI."""
    data = build_risk_heatmap(db, user)
    return RiskHeatmapOut.model_validate(data)


@router.get("/dashboard", response_model=PortfolioDashboardOut)
def portfolio_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortfolioDashboardOut:
    """PMO portfolio: latest metrics per project plus time-series for trends."""
    data = build_portfolio_dashboard(db, user)
    return PortfolioDashboardOut.model_validate(data)


@router.get("/comparison", response_model=PortfolioComparisonOut)
def portfolio_comparison(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortfolioComparisonOut:
    """Cross-project comparison with simple ranks on completion, SPI, and risk."""
    data = build_cross_project_comparison(db, user)
    return PortfolioComparisonOut.model_validate(data)


@router.get("/report-history", response_model=list[PortfolioReportHistoryRow])
def portfolio_report_history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=200),
    project_id: str | None = Query(None, description="Restrict to one project (must be in your scope)"),
) -> list[PortfolioReportHistoryRow]:
    """All intelligence report runs across projects visible to the viewer."""
    rows = build_portfolio_report_history(db, user, limit=limit, project_id=project_id)
    return [PortfolioReportHistoryRow.model_validate(r) for r in rows]
