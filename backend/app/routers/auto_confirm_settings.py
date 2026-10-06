"""网上预约通道配置（仅超级管理员）。"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_super_admin
from ..online_reservation_settings_util import (
    get_or_create_online_reservation_settings,
)
from ..schemas import (
    OnlineReservationSettingsPublic,
    OnlineReservationSettingsUpdate,
)

router = APIRouter(prefix="/api/admin/online-reservation", tags=["online-reservation"])


@router.get("", response_model=OnlineReservationSettingsPublic)
def get_online_reservation_settings(
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    row = get_or_create_online_reservation_settings(db)
    return OnlineReservationSettingsPublic(enabled=row.enabled)


@router.put("", response_model=OnlineReservationSettingsPublic)
def put_online_reservation_settings(
    body: OnlineReservationSettingsUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    row = get_or_create_online_reservation_settings(db)
    if body.enabled is not None:
        row.enabled = body.enabled
    db.add(row)
    db.commit()
    db.refresh(row)
    return OnlineReservationSettingsPublic(enabled=row.enabled)
