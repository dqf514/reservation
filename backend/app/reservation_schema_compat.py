from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session


def ensure_booking_source_column(db: Session) -> None:
    """兼容旧库：确保 reservations.booking_source 字段存在。"""
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    cols = {str(c.get("name")) for c in insp.get_columns("reservations")}
    if "booking_source" in cols:
        return

    db.execute(
        text(
            "ALTER TABLE reservations "
            "ADD COLUMN booking_source VARCHAR(20) DEFAULT 'admin'"
        )
    )
    db.commit()
    db.execute(
        text(
            "UPDATE reservations SET booking_source='admin' "
            "WHERE booking_source IS NULL OR TRIM(booking_source)=''"
        )
    )
    db.commit()


def ensure_assigned_staff_id_column(db: Session) -> None:
    """兼容旧库：确保 reservations.assigned_staff_id 字段存在。"""
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    cols = {str(c.get("name")) for c in insp.get_columns("reservations")}
    if "assigned_staff_id" in cols:
        return
    # 仅加 INTEGER 列，避免部分 SQLite 对 ADD COLUMN … REFERENCES 支持不一致
    db.execute(text("ALTER TABLE reservations ADD COLUMN assigned_staff_id INTEGER"))
    db.commit()


def ensure_assigned_staff_name_column(db: Session) -> None:
    """兼容旧库：确保 reservations.assigned_staff_name 字段存在。"""
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    cols = {str(c.get("name")) for c in insp.get_columns("reservations")}
    if "assigned_staff_name" in cols:
        return
    db.execute(
        text("ALTER TABLE reservations ADD COLUMN assigned_staff_name VARCHAR(120)")
    )
    db.commit()


def ensure_assigned_table_ids_column(db: Session) -> None:
    """兼容旧库：确保 reservations.assigned_table_ids 字段存在并回填首桌。"""
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    cols = {str(c.get("name")) for c in insp.get_columns("reservations")}
    if "assigned_table_ids" not in cols:
        db.execute(
            text(
                "ALTER TABLE reservations "
                "ADD COLUMN assigned_table_ids VARCHAR(500) DEFAULT ''"
            )
        )
        db.commit()
    db.execute(
        text(
            "UPDATE reservations "
            "SET assigned_table_ids = CAST(assigned_table_id AS TEXT) "
            "WHERE (assigned_table_ids IS NULL "
            "OR TRIM(assigned_table_ids)='') "
            "AND assigned_table_id IS NOT NULL"
        )
    )
    db.commit()
