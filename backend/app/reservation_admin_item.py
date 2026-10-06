from __future__ import annotations

from sqlalchemy.orm import Session

from .models import DiningTable, Reservation, User
from .reservation_tables_util import parse_assigned_table_ids
from .schemas import ReservationAdminItem


def reservation_admin_item(db: Session, r: Reservation) -> ReservationAdminItem:
    flow = r.flow_status
    # 预定状态简化展示：pending_confirm->waiting；seated->arrived；noshow->cancelled
    if flow == "pending_confirm":
        flow = "waiting"
    if flow == "seated":
        flow = "arrived"
    if flow == "noshow":
        flow = "cancelled"
    table_ids = parse_assigned_table_ids(r)
    table_rows = (
        db.query(DiningTable.id, DiningTable.code, DiningTable.label)
        .filter(DiningTable.id.in_(table_ids))
        .all()
        if table_ids
        else []
    )
    code_map = {
        int(tid): (str(code), str(label))
        for tid, code, label in table_rows
    }
    table_codes = [code_map[tid][0] for tid in table_ids if tid in code_map]
    table_labels = [code_map[tid][1] for tid in table_ids if tid in code_map]
    first_code = table_codes[0] if table_codes else None
    first_label = table_labels[0] if table_labels else None
    stored_name = getattr(r, "assigned_staff_name", None)
    staff_name = (stored_name or "").strip() or None
    staff_id = getattr(r, "assigned_staff_id", None)
    if not staff_name and staff_id:
        su = db.get(User, int(staff_id))
        if su:
            staff_name = (su.full_name or "").strip() or su.username
    return ReservationAdminItem(
        id=r.id,
        customer_name=r.customer_name,
        phone=r.phone or "",
        reservation_date=r.reservation_date,
        time_slot=r.time_slot,
        party_size=r.party_size,
        note=r.note,
        flow_status=flow,
        tags=r.tags or "",
        table_code=first_code,
        table_label=first_label,
        table_codes=table_codes,
        table_labels=table_labels,
        created_at=(
            r.created_at.strftime("%Y-%m-%d %H:%M:%S")
            if r.created_at
            else None
        ),
        assigned_staff_id=int(staff_id) if staff_id else None,
        assigned_staff_name=staff_name,
    )
