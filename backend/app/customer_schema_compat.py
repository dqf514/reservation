from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session


def ensure_customer_alias_columns(db: Session) -> None:
    """兼容旧库：确保 customers 具备 last_seen_name / alias_names_json 字段。"""
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    cols = {str(c.get("name")) for c in insp.get_columns("customers")}

    if "last_seen_name" not in cols:
        db.execute(
            text(
                "ALTER TABLE customers ADD COLUMN last_seen_name VARCHAR(120) "
                "DEFAULT ''"
            )
        )
        db.commit()
    if "alias_names_json" not in cols:
        db.execute(
            text(
                "ALTER TABLE customers ADD COLUMN alias_names_json TEXT "
                "DEFAULT ''"
            )
        )
        db.commit()

