from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.constants.columns import RaidColumns, StatusColumns, WeeklyHistoryColumns
from app.db.models import GovernanceRun

logger = logging.getLogger(__name__)


class GovernanceService:
    def __init__(self, db: Session | None = None) -> None:
        self._db = db
        self._settings = get_settings()

    def generate_from_paths(
        self,
        status_path: Path,
        raid_path: Path,
        history_path: Path,
        job_id: str | None = None,
    ) -> dict:
        job = job_id or str(uuid.uuid4())
        out_dir = self._settings.outputs_dir / job
        out_dir.mkdir(parents=True, exist_ok=True)

        import pandas as pd

        from app.services import calculations, charts, email_generator, rag, report_generator

        status_df = pd.read_excel(status_path)
        raid_df = pd.read_excel(raid_path)
        history_df = pd.read_csv(history_path)
        self._validate_inputs(status_df, raid_df, history_df)

        completion, total_sv, total_ev = calculations.calculate_metrics(status_df)
        risk_score = calculations.calculate_risk_score(raid_df)
        spi, cpi = calculations.calculate_evm(status_df)
        rag_status = rag.calculate_rag(total_sv, risk_score, self._settings.rag_thresholds())

        dpi = self._settings.chart_dpi
        c1 = charts.generate_completion_chart(completion, out_dir, dpi)
        c2 = charts.generate_trend_chart(history_df, out_dir, dpi)

        metrics = (completion, total_sv, total_ev, risk_score)
        ppt = report_generator.generate_ppt(metrics, (c1, c2), rag_status, (spi, cpi), out_dir)
        email_path = email_generator.generate_email(metrics, rag_status, (spi, cpi), out_dir)

        rel = self._settings.repo_root
        result = {
            "job_id": job,
            "rag": rag_status,
            "metrics": {
                "completion_pct": completion,
                "schedule_variance_sum": total_sv,
                "effort_variance_sum": total_ev,
                "risk_score": risk_score,
                "spi": spi,
                "cpi": cpi,
            },
            "outputs": {
                "ppt": str(ppt.relative_to(rel)),
                "email": str(email_path.relative_to(rel)),
                "completion_chart": str(c1.relative_to(rel)),
                "trend_chart": str(c2.relative_to(rel)),
            },
        }

        if self._db is not None:
            row = GovernanceRun(
                id=job,
                rag_status=rag_status,
                completion_pct=completion,
                schedule_variance_sum=total_sv,
                effort_variance_sum=total_ev,
                risk_score=risk_score,
                spi=spi,
                cpi=cpi,
                ppt_path=str(ppt),
                email_path=str(email_path),
            )
            self._db.add(row)
            self._db.commit()
            logger.info("Governance run persisted id=%s rag=%s", job, rag_status)
        else:
            logger.info("Governance run completed id=%s rag=%s (no db session)", job, rag_status)

        return result

    def _validate_inputs(
        self,
        status_df: Any,
        raid_df: Any,
        history_df: Any,
    ) -> None:
        status_required = {
            StatusColumns.PLANNED_PCT,
            StatusColumns.ACTUAL_PCT,
            StatusColumns.PLANNED_HOURS,
            StatusColumns.ACTUAL_HOURS,
            StatusColumns.PLANNED_BUDGET,
            StatusColumns.ACTUAL_COST,
        }
        raid_required = {RaidColumns.TYPE, RaidColumns.SEVERITY, RaidColumns.STATUS}
        hist_required = {WeeklyHistoryColumns.WEEK, WeeklyHistoryColumns.COMPLETION}

        for name, df, req in (
            ("status tracker", status_df, status_required),
            ("RAID log", raid_df, raid_required),
            ("weekly history", history_df, hist_required),
        ):
            missing = req - set(df.columns)
            if missing:
                raise ValueError(f"{name} missing columns: {sorted(missing)}")
