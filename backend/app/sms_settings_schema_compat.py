from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session


def ensure_sms_settings_promotion_columns(db: Session) -> None:
    """兼容旧库：sms_settings 推广短信收件人上限字段。"""
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    cols = {str(c.get("name")) for c in insp.get_columns("sms_settings")}

    if "promotion_sms_max_recipients" not in cols:
        db.execute(
            text(
                "ALTER TABLE sms_settings ADD COLUMN "
                "promotion_sms_max_recipients INTEGER DEFAULT 300"
            )
        )
        db.commit()
    if "promotion_sms_staff_max_recipients" not in cols:
        db.execute(
            text(
                "ALTER TABLE sms_settings ADD COLUMN "
                "promotion_sms_staff_max_recipients INTEGER DEFAULT 1"
            )
        )
        db.commit()
