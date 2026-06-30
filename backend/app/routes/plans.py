from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.plans import PlanOut
from app.services.plan_service import get_active_plans

router = APIRouter()


@router.get("", response_model=list[PlanOut])
def public_list_plans(db: Session = Depends(get_db)) -> list[PlanOut]:
    plans = get_active_plans(db)
    return [
        PlanOut(
            id=p.id,
            name=p.name,
            slug=p.slug,
            description=p.description,
            price_monthly=p.price_monthly,
            price_yearly=p.price_yearly,
            currency=p.currency,
            sort_order=p.sort_order,
            is_active=p.is_active,
            is_free=p.is_free,
            features=[
                {
                    "id": f.id,
                    "feature_key": f.feature_key,
                    "feature_label": f.feature_label,
                    "value": f.value,
                }
                for f in p.features
            ],
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in plans
    ]
