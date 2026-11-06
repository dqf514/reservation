from __future__ import annotations

import random
import re

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .models import (
    DiningTable,
    Reservation,
    SmsSendLog,
    TableLock,
    TableOccupancy,
)
from .operating_period_util import list_operating_periods
from .periods import (
    period_key_for_time_slot,
    time_in_period_db,
    time_in_period_with_periods,
)
from .reservation_status import TERMINAL  # noqa: F401  (兼容既有 `floor_logic.TERMINAL` 导入)
from .reservation_tables_util import (
    parse_assigned_table_ids,
    set_assigned_table_ids,
)
from .table_capacity_util import (
    compute_room_usage,
    enabled_periods,
    is_room_table,
    room_has_free_seat,
)
_PHONE_RE = re.compile(r"^1\d{10}$")


def _period_matches(db: Session, time_slot: str, period: str) -> bool:
    if (period or "").strip().lower() == "all":
        return True
    return time_in_period_db(db, time_slot, period)


def _build_table_to_active_reservation(
    rows: list[Reservation],
    periods_enabled: list,
    period: str,
) -> dict[int, Reservation]:
    """按预订遍历顺序，记录每张桌首次出现的有效预订（与 active_reservation_for_table 语义一致）。"""
    table_to_res: dict[int, Reservation] = {}
    for r in rows:
        if r.flow_status in TERMINAL:
            continue
        if not time_in_period_with_periods(periods_enabled, r.time_slot, period):
            continue
        for tid in parse_assigned_table_ids(r):
            if tid not in table_to_res:
                table_to_res[tid] = r
    return table_to_res


def flow_to_table_status(flow: str) -> str | None:
    if flow in TERMINAL:
        return None
    if flow == "pending_confirm":
        return "pending_confirm"
    if flow == "waiting":
        return "reserved"
    if flow == "confirmed":
        return "reserved"
    if flow == "arrived":
        return "arrived"
    if flow == "seated":
        return "arrived"
    return None


def active_reservation_for_table(
    db: Session,
    *,
    table_id: int,
    reservation_date: str,
    period: str,
) -> Reservation | None:
    rows = (
        db.query(Reservation)
        .filter(
            Reservation.reservation_date == reservation_date,
        )
        .all()
    )
    for r in rows:
        if table_id not in parse_assigned_table_ids(r):
            continue
        if r.flow_status in TERMINAL:
            continue
        if _period_matches(db, r.time_slot, period):
            return r
    return None


def _table_shape(dt: DiningTable) -> str:
    return dt.shape if dt.shape in ("circle", "square", "rect_h", "rect_v") else "circle"


def _build_room_node(
    dt: DiningTable,
    *,
    reservation_date: str,
    periods: list,
    period: str,
    day_rows: list,
    occ_rows: list,
    lock: TableLock | None,
) -> dict:
    """房间节点：同一时段内多组客人共享座位池，展示聚合计数。"""
    usage = compute_room_usage(
        table=dt,
        reservation_date=reservation_date,
        periods=periods,
        period=period,
        reservations=day_rows,
        occupancies=occ_rows,
    )
    if usage.occupancy_count > 0:
        status = "arrived"
    elif usage.reservation_count > 0:
        status = "reserved"
    elif usage.capacity > 0 and usage.used_seats >= usage.capacity:
        status = "unavailable"
    else:
        status = "empty"

    times: list[str] = []
    for r in day_rows:
        if r.flow_status in TERMINAL:
            continue
        if int(dt.id) not in parse_assigned_table_ids(r):
            continue
        if not time_in_period_with_periods(periods, r.time_slot, period):
            continue
        times.append(r.time_slot)
    for occ in occ_rows:
        if int(occ.table_id) != int(dt.id):
            continue
        if not time_in_period_with_periods(periods, occ.time_slot, period):
            continue
        times.append(occ.time_slot)
    times.sort()

    return {
        "id": dt.code,
        "dbId": dt.id,
        "label": dt.label,
        "x": dt.pos_x,
        "y": dt.pos_y,
        "size": dt.pos_size,
        "capacity": dt.capacity,
        "shape": _table_shape(dt),
        "status": status,
        "time": times[0] if times else None,
        "ratio": f"{usage.used_seats}/{usage.capacity}",
        "guestHint": f"{usage.party_count} 桌" if usage.party_count else None,
        "isLocked": bool(lock),
        "lockedBy": lock.locked_by_username if lock else None,
        "tableType": "room",
        "roomUsage": usage.to_dict(),
    }


def build_floor_tables(
    db: Session, *, reservation_date: str, period: str
) -> list[dict]:
    periods_enabled = enabled_periods(db)
    day_rows = (
        db.query(Reservation)
        .filter(Reservation.reservation_date == reservation_date)
        .order_by(Reservation.id)
        .all()
    )
    table_to_res = _build_table_to_active_reservation(
        day_rows, periods_enabled, period
    )

    occ_rows = (
        db.query(TableOccupancy)
        .filter(
            TableOccupancy.business_date == reservation_date,
            TableOccupancy.status == "seated",
        )
        .order_by(TableOccupancy.id.desc())
        .all()
    )
    occ_by_table: dict[int, TableOccupancy] = {}
    for occ in occ_rows:
        if occ.table_id not in occ_by_table:
            occ_by_table[occ.table_id] = occ

    lock_rows = db.query(TableLock).all()
    locks_by_table = {lk.table_id: lk for lk in lock_rows}

    tables = (
        db.query(DiningTable)
        .order_by(DiningTable.sort_order, DiningTable.id)
        .all()
    )
    out: list[dict] = []
    for dt in tables:
        if not dt.is_active:
            node = {
                "id": dt.code,
                "dbId": dt.id,
                "label": dt.label,
                "x": dt.pos_x,
                "y": dt.pos_y,
                "size": dt.pos_size,
                "capacity": dt.capacity,
                "shape": _table_shape(dt),
                "status": "unavailable",
                "tableType": "standard",
            }
            out.append(node)
            continue

        lock = locks_by_table.get(dt.id)

        if is_room_table(dt):
            out.append(
                _build_room_node(
                    dt,
                    reservation_date=reservation_date,
                    periods=periods_enabled,
                    period=period,
                    day_rows=day_rows,
                    occ_rows=occ_rows,
                    lock=lock,
                )
            )
            continue

        res = table_to_res.get(dt.id)
        occ = occ_by_table.get(dt.id)
        st = "empty"
        time_s: str | None = None
        ratio: str | None = None
        guest_hint: str | None = None
        if occ:
            st = "arrived"
            time_s = occ.time_slot
            guest_hint = "散客入席"
            ratio = f"{occ.party_size}/{dt.capacity}"
        elif res:
            mapped = flow_to_table_status(res.flow_status)
            if mapped:
                st = mapped
                time_s = res.time_slot
                guest_hint = res.customer_name
                ratio = f"{res.party_size}/{dt.capacity}"

        out.append(
            {
                "id": dt.code,
                "dbId": dt.id,
                "label": dt.label,
                "x": dt.pos_x,
                "y": dt.pos_y,
                "size": dt.pos_size,
                "capacity": dt.capacity,
                "shape": _table_shape(dt),
                "status": st,
                "time": time_s,
                "ratio": ratio,
                "guestHint": guest_hint,
                "isLocked": bool(lock),
                "lockedBy": lock.locked_by_username if lock else None,
                "tableType": "standard",
            }
        )
    return out


def pick_random_idle_table(
    db: Session,
    *,
    reservation_date: str,
    time_slot: str,
    party_size: int,
) -> DiningTable | None:
    """在指定时刻随机选择一个空闲桌台并返回。

    空闲判定：该桌台在该日期与时段内没有处于非终态的预订。
    房间型桌台（room）只在没有普通桌可用时作为兜底，且需同时段仍有空余座位。
    """

    period = period_key_for_time_slot(db, time_slot)
    if not period:
        return None

    periods_enabled = enabled_periods(db)
    day_rows = (
        db.query(Reservation)
        .filter(Reservation.reservation_date == reservation_date)
        .order_by(Reservation.id)
        .all()
    )
    table_to_res = _build_table_to_active_reservation(
        day_rows, periods_enabled, period
    )

    tables = (
        db.query(DiningTable)
        .filter(DiningTable.is_active == True)  # noqa: E712
        .order_by(DiningTable.sort_order, DiningTable.id)
        .all()
    )
    standard_candidates: list[DiningTable] = []
    room_candidates: list[DiningTable] = []
    for dt in tables:
        if dt.capacity < party_size:
            continue
        if is_room_table(dt):
            if room_has_free_seat(
                db,
                table=dt,
                reservation_date=reservation_date,
                time_slot=time_slot,
                party_size=party_size,
                periods=periods_enabled,
            ):
                room_candidates.append(dt)
            continue
        if dt.id not in table_to_res:
            standard_candidates.append(dt)
    candidates = standard_candidates or room_candidates
    if not candidates:
        return None
    return random.choice(candidates)


def list_guests_for_date(
    db: Session,
    *,
    reservation_date: str,
    period: str,
    search: str | None,
) -> list[dict]:
    periods_enabled = [p for p in list_operating_periods(db) if p.enabled]
    table_code_map = {
        t.id: t.code for t in db.query(DiningTable.id, DiningTable.code).all()
    }
    rows = (
        db.query(Reservation)
        .options(joinedload(Reservation.table))
        .filter(Reservation.reservation_date == reservation_date)
        .order_by(Reservation.time_slot)
        .all()
    )
    reservation_ids = [int(r.id) for r in rows]
    phones = sorted(
        {(r.phone or "").strip() for r in rows if (r.phone or "").strip()}
    )
    phone_count_map: dict[str, int] = {}
    if phones:
        count_rows = (
            db.query(Reservation.phone, func.count(Reservation.id))
            .filter(Reservation.phone.in_(phones))
            .group_by(Reservation.phone)
            .all()
        )
        phone_count_map = {str(p): int(c) for p, c in count_rows}
    sent_success_ids: set[int] = set()
    if reservation_ids:
        sent_rows = (
            db.query(SmsSendLog.reservation_id)
            .filter(
                SmsSendLog.reservation_id.in_(reservation_ids),
                SmsSendLog.purpose == "reservation_success",
                SmsSendLog.status == "sent",
            )
            .distinct()
            .all()
        )
        sent_success_ids = {
            int(row[0]) for row in sent_rows if row and row[0] is not None
        }
    guests: list[dict] = []
    s = (search or "").strip().lower()
    for r in rows:
        if not time_in_period_with_periods(periods_enabled, r.time_slot, period):
            continue
        if s:
            blob = (
                f"{r.customer_name} {r.phone} "
                f"{(r.table.label if r.table else '')}"
            ).lower()
            if s not in blob:
                continue
        tags = [t for t in (r.tags or "").split(",") if t.strip()]
        flow = r.flow_status
        # 预定状态简化展示：pending_confirm->waiting；seated->arrived；noshow->cancelled
        if flow == "pending_confirm":
            flow = "waiting"
        if flow == "seated":
            flow = "arrived"
        if flow == "noshow":
            flow = "cancelled"

        assigned_table_ids = parse_assigned_table_ids(r)
        first_tid = assigned_table_ids[0] if assigned_table_ids else None
        table_code = table_code_map.get(first_tid) if first_tid is not None else None
        guests.append(
            {
                "id": str(r.id),
                "name": r.customer_name,
                "reservation_date": r.reservation_date,
                "time": r.time_slot,
                "tags": tags,
                "party": str(r.party_size),
                # 用桌台 code 以便前端在“选中桌台”时准确定位到对应预订
                "table": table_code,
                "flow": flow,
                "phone": r.phone,
                # 历史次数不包含当前这条预订本身
                "reservation_count": max(
                    0, phone_count_map.get((r.phone or "").strip(), 0) - 1
                ),
                "note": r.note,
                # 仅当当前仍有有效手机号时，才显示“已发送短信”图标，避免误导。
                "sms_confirm_sent": (
                    int(r.id) in sent_success_ids
                    and bool(_PHONE_RE.match((r.phone or "").strip()))
                ),
            }
        )
    occ_rows = (
        db.query(TableOccupancy)
        .filter(
            TableOccupancy.business_date == reservation_date,
            TableOccupancy.status == "seated",
        )
        .order_by(TableOccupancy.time_slot)
        .all()
    )
    for occ in occ_rows:
        if not time_in_period_with_periods(periods_enabled, occ.time_slot, period):
            continue
        guests.append(
            {
                "id": f"walkin-{occ.id}",
                "name": "散客",
                "time": occ.time_slot,
                "tags": [],
                "party": str(occ.party_size),
                "table": table_code_map.get(occ.table_id),
                # 作为“入座”展示（不算预定）
                "flow": "arrived",
                "phone": None,
                "note": occ.note,
            }
        )
    return guests


def swap_table_assignments(
    db: Session,
    *,
    reservation_date: str,
    period: str,
    table_code_a: str,
    table_code_b: str,
) -> bool:
    ta = db.query(DiningTable).filter(DiningTable.code == table_code_a).first()
    tb = db.query(DiningTable).filter(DiningTable.code == table_code_b).first()
    if not ta or not tb or ta.id == tb.id:
        return False

    ra = active_reservation_for_table(
        db, table_id=ta.id, reservation_date=reservation_date, period=period
    )
    rb = active_reservation_for_table(
        db, table_id=tb.id, reservation_date=reservation_date, period=period
    )

    if ra and rb:
        ra_ids = parse_assigned_table_ids(ra)
        rb_ids = parse_assigned_table_ids(rb)
        ra_new = [tb.id if x == ta.id else x for x in ra_ids]
        rb_new = [ta.id if x == tb.id else x for x in rb_ids]
        set_assigned_table_ids(ra, ra_new)
        set_assigned_table_ids(rb, rb_new)
    elif ra and not rb:
        if active_reservation_for_table(
            db,
            table_id=tb.id,
            reservation_date=reservation_date,
            period=period,
        ):
            return False
        ra_ids = parse_assigned_table_ids(ra)
        set_assigned_table_ids(
            ra, [tb.id if x == ta.id else x for x in ra_ids]
        )
    elif rb and not ra:
        if active_reservation_for_table(
            db,
            table_id=ta.id,
            reservation_date=reservation_date,
            period=period,
        ):
            return False
        rb_ids = parse_assigned_table_ids(rb)
        set_assigned_table_ids(
            rb, [ta.id if x == tb.id else x for x in rb_ids]
        )
    else:
        return False

    db.commit()
    return True
