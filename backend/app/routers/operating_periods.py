from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models import OperatingPeriodItem
from ..operating_period_util import list_operating_periods, validate_period_items
from ..schemas import (
    OperatingPeriodItemDTO,
    OperatingPeriodsPublic,
    OperatingPeriodsUpdate,
)

router = APIRouter(tags=["operating-periods"])


def _to_public_rows(rows: list[OperatingPeriodItem]) -> OperatingPeriodsPublic:
    return OperatingPeriodsPublic(
        periods=[
            OperatingPeriodItemDTO(
                period_key=r.period_key,
                label=r.label,
                start_time=r.start_time,
                end_time=r.end_time,
                sort_order=r.sort_order,
                color=r.color,
                icon=r.icon,
                enabled=r.enabled,
            )
            for r in rows
        ]
    )


@router.get("/api/operating-periods", response_model=OperatingPeriodsPublic)
def get_operating_periods(db: Session = Depends(get_db)):
    rows = list_operating_periods(db)
    return _to_public_rows(rows)


@router.put("/api/admin/operating-periods", response_model=OperatingPeriodsPublic)
def put_operating_periods(
    payload: OperatingPeriodsUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    try:
        items = validate_period_items([x.model_dump() for x in payload.periods])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    db.query(OperatingPeriodItem).delete()
    for it in items:
        db.add(OperatingPeriodItem(**it))
    db.commit()
    return _to_public_rows(list_operating_periods(db))
