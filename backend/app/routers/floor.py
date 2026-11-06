from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ROLE_SUPER, require_staff
from ..floor_policy_util import get_or_create_floor_policy_settings
from ..floor_logic import (
    build_floor_tables,
    list_guests_for_date,
    swap_table_assignments,
)
from ..models import (
    DiningTable,
    Reservation,
    TableLock,
    TableOccupancy,
    User,
)
from ..reservation_schema_compat import (
    ensure_assigned_staff_id_column,
    ensure_assigned_staff_name_column,
    ensure_assigned_table_ids_column,
)
from ..reservation_tables_util import parse_assigned_table_ids
from ..schemas import (
    FloorLockBody,
    FloorSwapBody,
    FloorWalkinLeaveBody,
    FloorWalkinSeatBody,
)
from ..table_capacity_util import (
    assert_room_capacity,
    enabled_periods,
    is_room_table,
)

router = APIRouter(prefix="/api/admin/floor", tags=["floor"])

_WALKIN_NAMES = ("walk-in", "walkin", "散客")


def _is_walkin_name(name: str | None) -> bool:
    return (name or "").strip().lower() in _WALKIN_NAMES


def _get_table_by_code(db: Session, table_code: str) -> DiningTable:
    t = (
        db.query(DiningTable)
        .filter(DiningTable.code == table_code.strip())
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="桌台不存在")
    return t


def _ensure_can_mutate_lock(db: Session, t: DiningTable, user: User) -> None:
    lock = db.query(TableLock).filter(TableLock.table_id == t.id).first()
    if not lock:
        return
    if user.role == ROLE_SUPER:
        return
    if lock.locked_by_user_id == user.id:
        return
    raise HTTPException(
        status_code=403,
        detail=f"桌台已被 {lock.locked_by_username} 锁定，您无权操作",
    )


def _release_table_lock(db: Session, table_id: int) -> None:
    row = db.query(TableLock).filter(TableLock.table_id == table_id).first()
    if row:
        db.delete(row)
        db.commit()


@router.get("")
def get_floor(
    date: str,
    period: str,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_assigned_table_ids_column(db)
    ensure_assigned_staff_id_column(db)
    ensure_assigned_staff_name_column(db)
    policy = get_or_create_floor_policy_settings(db)
    now = datetime.now()
    rows = (
        db.query(Reservation)
        .filter(
            Reservation.reservation_date == date,
            Reservation.flow_status.in_(["waiting"]),
        )
        .all()
    )
    changed = False
    for r in rows:
        try:
            dt = datetime.strptime(
                f"{r.reservation_date} {r.time_slot.strip()}",
                "%Y-%m-%d %H:%M",
            )
        except ValueError:
            continue
        if now >= dt + timedelta(minutes=policy.auto_cancel_minutes):
            r.flow_status = "cancelled"
            for tid in parse_assigned_table_ids(r):
                _release_table_lock(db, tid)
            db.add(r)
            changed = True
    if changed:
        db.commit()

    tables = build_floor_tables(db, reservation_date=date, period=period)
    guests = list_guests_for_date(
        db,
        reservation_date=date,
        period=period,
        search=search,
    )
    return {"tables": tables, "guests": guests}


@router.post("/swap")
def post_swap(
    body: FloorSwapBody,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_assigned_table_ids_column(db)
    ensure_assigned_staff_id_column(db)
    ensure_assigned_staff_name_column(db)
    ok = swap_table_assignments(
        db,
        reservation_date=body.reservation_date,
        period=body.period,
        table_code_a=body.table_code_a,
        table_code_b=body.table_code_b,
    )
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="无法完成交换：请确认日期、时段正确，且至少有一侧存在有效预订。",
        )
    return {"ok": True}


@router.post("/lock")
def post_lock(
    body: FloorLockBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    t = _get_table_by_code(db, body.table_code)
    _ensure_can_mutate_lock(db, t, user)
    policy = get_or_create_floor_policy_settings(db)
    now = datetime.now()
    lock = db.query(TableLock).filter(TableLock.table_id == t.id).first()
    if lock:
        lock.locked_by_user_id = user.id
        lock.locked_by_username = user.username
        lock.lock_until = now + timedelta(minutes=policy.lock_ttl_minutes)
        db.add(lock)
    else:
        db.add(
            TableLock(
                table_id=t.id,
                locked_by_user_id=user.id,
                locked_by_username=user.username,
                lock_until=now + timedelta(minutes=policy.lock_ttl_minutes),
            )
        )
    db.commit()
    return {"ok": True}


@router.post("/unlock")
def post_unlock(
    body: FloorLockBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    t = _get_table_by_code(db, body.table_code)
    _ensure_can_mutate_lock(db, t, user)
    _release_table_lock(db, t.id)
    return {"ok": True}


@router.post("/walkin/seat")
def post_walkin_seat(
    body: FloorWalkinSeatBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    t = _get_table_by_code(db, body.table_code)
    _ensure_can_mutate_lock(db, t, user)
    now = datetime.now()

    if is_room_table(t):
        # 房间：允许多组散客同时在场，按「时段座位池」合并计算（预订 + 散客）。
        if body.party_size > t.capacity:
            raise HTTPException(status_code=400, detail="人数超过该房间座位数")
        assert_room_capacity(
            db,
            table=t,
            reservation_date=body.reservation_date,
            time_slot=now.strftime("%H:%M"),
            party_size=body.party_size,
            periods=enabled_periods(db),
        )
        db.add(
            TableOccupancy(
                table_id=t.id,
                business_date=body.reservation_date,
                time_slot=now.strftime("%H:%M"),
                party_size=body.party_size,
                note=(body.note or "").strip() or None,
                status="seated",
                created_by_user_id=user.id,
                created_by_username=user.username,
            )
        )
        db.commit()
        return {"ok": True}

    if body.party_size > t.capacity:
        raise HTTPException(status_code=400, detail="人数超过该桌台容量")

    occ = (
        db.query(TableOccupancy)
        .filter(
            TableOccupancy.table_id == t.id,
            TableOccupancy.business_date == body.reservation_date,
            TableOccupancy.status == "seated",
        )
        .first()
    )
    if occ:
        raise HTTPException(status_code=400, detail="该桌台已有散客入席")

    policy = get_or_create_floor_policy_settings(db)
    if body.reservation_date == now.strftime("%Y-%m-%d"):
        before = now + timedelta(minutes=policy.walkin_block_before_minutes)
        rows = (
            db.query(Reservation)
            .filter(
                Reservation.reservation_date == body.reservation_date,
                Reservation.flow_status.in_(["waiting"]),
            )
            .all()
        )
        for r in rows:
            if t.id not in parse_assigned_table_ids(r):
                continue
            try:
                dt = datetime.strptime(
                    f"{r.reservation_date} {r.time_slot.strip()}",
                    "%Y-%m-%d %H:%M",
                )
            except ValueError:
                continue
            if now <= dt <= before:
                raise HTTPException(
                    status_code=400,
                    detail="该桌台在未来限制时段内已有预订，不可安排散客入席",
                )

    db.add(
        TableOccupancy(
            table_id=t.id,
            business_date=body.reservation_date,
            time_slot=now.strftime("%H:%M"),
            party_size=body.party_size,
            note=(body.note or "").strip() or None,
            status="seated",
            created_by_user_id=user.id,
            created_by_username=user.username,
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/walkin/leave")
def post_walkin_leave(
    body: FloorWalkinLeaveBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    t = _get_table_by_code(db, body.table_code)
    _ensure_can_mutate_lock(db, t, user)

    # 1) 指定散客占位记录
    if body.occupancy_id is not None:
        occ = db.get(TableOccupancy, body.occupancy_id)
        if not occ or int(occ.table_id) != int(t.id) or occ.status != "seated":
            raise HTTPException(status_code=400, detail="该桌台当前无此散客入席")
        occ.status = "left"
        occ.ended_at = datetime.now()
        db.add(occ)
        db.commit()
        _release_table_lock(db, t.id)
        return {"ok": True}

    # 2) 指定预订（前台「散客入席」实际以 Walk-in 预订记录）
    if body.reservation_id is not None:
        r = db.get(Reservation, body.reservation_id)
        if (
            not r
            or int(t.id) not in parse_assigned_table_ids(r)
            or r.flow_status in ("left", "noshow", "cancelled")
        ):
            raise HTTPException(status_code=400, detail="该桌台当前无此散客入席")
        r.flow_status = "left"
        db.add(r)
        db.commit()
        return {"ok": True}

    # 3) 兜底：该桌台最近一条散客占位记录
    occ = (
        db.query(TableOccupancy)
        .filter(
            TableOccupancy.table_id == t.id,
            TableOccupancy.status == "seated",
        )
        .order_by(TableOccupancy.id.desc())
        .first()
    )
    if occ:
        occ.status = "left"
        occ.ended_at = datetime.now()
        db.add(occ)
        db.commit()
        _release_table_lock(db, t.id)
        return {"ok": True}

    # 4) 兜底：该桌台最近一条「已入座」的散客预订
    rows = (
        db.query(Reservation)
        .filter(
            Reservation.reservation_date == datetime.now().strftime("%Y-%m-%d"),
            Reservation.flow_status == "arrived",
        )
        .order_by(Reservation.id.desc())
        .all()
    )
    for row in rows:
        if int(t.id) not in parse_assigned_table_ids(row):
            continue
        if not _is_walkin_name(row.customer_name):
            continue
        row.flow_status = "left"
        db.add(row)
        db.commit()
        return {"ok": True}

    raise HTTPException(status_code=400, detail="该桌台当前无散客入席")
