from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session


def ensure_user_profile_columns(db: Session) -> None:
    """兼容旧库：确保 users 具备姓名/手机/邮箱字段。"""
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    cols = {str(c.get("name")) for c in insp.get_columns("users")}

    if "full_name" not in cols:
        db.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(120)"))
        db.commit()
    if "phone" not in cols:
        db.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(32)"))
        db.commit()
    if "email" not in cols:
        db.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(120)"))
        db.commit()
