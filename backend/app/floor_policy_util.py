from __future__ import annotations

from sqlalchemy.orm import Session

from .models import FloorPolicySettings


def get_or_create_floor_policy_settings(db: Session) -> FloorPolicySettings:
    row = db.get(FloorPolicySettings, 1)
    if row:
        return row
    row = FloorPolicySettings(id=1)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
