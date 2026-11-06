from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session


def ensure_table_type_column(db: Session) -> None:
    """兼容旧库：确保 dining_tables.table_type 字段存在（默认 standard）。"""
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    cols = {str(c.get("name")) for c in insp.get_columns("dining_tables")}
    if "table_type" in cols:
        return
    db.execute(
        text(
            "ALTER TABLE dining_tables "
            "ADD COLUMN table_type VARCHAR(16) DEFAULT 'standard'"
        )
    )
    db.commit()
    db.execute(
        text(
            "UPDATE dining_tables SET table_type='standard' "
            "WHERE table_type IS NULL OR TRIM(table_type)=''"
        )
    )
    db.commit()
