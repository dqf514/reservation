from __future__ import annotations

from sqlalchemy.orm import Session

from .models import OnlineReservationSettings


def get_or_create_online_reservation_settings(
    db: Session,
) -> OnlineReservationSettings:
    row = db.get(OnlineReservationSettings, 1)
    if row:
        return row
    row = OnlineReservationSettings(id=1, enabled=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
