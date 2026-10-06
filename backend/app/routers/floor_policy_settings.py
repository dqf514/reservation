from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_super_admin
from ..floor_policy_util import get_or_create_floor_policy_settings
from ..schemas import FloorPolicySettingsPublic, FloorPolicySettingsUpdate

router = APIRouter(prefix="/api/admin/floor-policy", tags=["floor-policy"])


def _to_public(row) -> FloorPolicySettingsPublic:
    return FloorPolicySettingsPublic(
        lock_ttl_minutes=row.lock_ttl_minutes,
        auto_cancel_minutes=row.auto_cancel_minutes,
        walkin_block_before_minutes=row.walkin_block_before_minutes,
    )


@router.get("", response_model=FloorPolicySettingsPublic)
def get_floor_policy(
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    row = get_or_create_floor_policy_settings(db)
    return _to_public(row)


@router.put("", response_model=FloorPolicySettingsPublic)
def put_floor_policy(
    body: FloorPolicySettingsUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    row = get_or_create_floor_policy_settings(db)
    row.lock_ttl_minutes = body.lock_ttl_minutes
    row.auto_cancel_minutes = body.auto_cancel_minutes
    row.walkin_block_before_minutes = body.walkin_block_before_minutes
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_public(row)
