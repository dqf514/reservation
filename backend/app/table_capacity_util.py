"""桌台类型与「房间型」桌台的容量池逻辑。

桌台有两种语义：

- ``standard``（普通桌）：一张桌在同一时段只承载一条预订（独占）。
- ``room``（房间 / 包厢）：同一时段内可同时容纳多组客人，共享 ``capacity``
  个座位；预订人数与散客人数**合并累加**，超出容量即拒绝再安排。

容量口径：**按时段（运营时段）计算**，每个时段独立享有 ``capacity`` 个座位。
因此午餐坐满不影响晚餐继续接待；同一时段的预订 + 散客则共享同一个池子。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Sequence

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import DiningTable, Reservation, TableOccupancy
from .operating_period_util import list_operating_periods
from .periods import period_key_for_periods_list
from .reservation_status import TERMINAL
from .reservation_tables_util import parse_assigned_table_ids

TABLE_TYPE_STANDARD = "standard"
TABLE_TYPE_ROOM = "room"
TABLE_TYPES = (TABLE_TYPE_STANDARD, TABLE_TYPE_ROOM)


def normalize_table_type(raw: object) -> str:
    """归一化桌台类型；未知值一律按普通桌处理。"""
    s = str(raw or "").strip().lower()
    return TABLE_TYPE_ROOM if s == TABLE_TYPE_ROOM else TABLE_TYPE_STANDARD


def is_room_table(table: DiningTable) -> bool:
    return normalize_table_type(getattr(table, "table_type", None)) == TABLE_TYPE_ROOM


def enabled_periods(db: Session) -> list:
    """已启用的运营时段（按 sort_order 排序）。"""
    return [p for p in list_operating_periods(db) if p.enabled]


@dataclass
class RoomUsage:
    """房间在某日某时段（或全天）的座位占用情况。"""

    capacity: int = 0
    reserved_seats: int = 0
    seated_seats: int = 0
    used_seats: int = 0
    reservation_count: int = 0
    occupancy_count: int = 0
    by_period: list[dict] = field(default_factory=list)

    @property
    def party_count(self) -> int:
        return self.reservation_count + self.occupancy_count

    @property
    def free_seats(self) -> int:
        return max(0, int(self.capacity) - int(self.used_seats))

    def to_dict(self) -> dict:
        return {
            "capacity": int(self.capacity),
            "reserved": int(self.reserved_seats),
            "seated": int(self.seated_seats),
            "used": int(self.used_seats),
            "free": self.free_seats,
            "reservations": int(self.reservation_count),
            "occupancies": int(self.occupancy_count),
            "parties": int(self.party_count),
            "by_period": self.by_period,
        }


def _period_buckets(periods: Sequence) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for p in periods:
        out[p.period_key] = {
            "period_key": p.period_key,
            "label": p.label,
            "sort_order": int(p.sort_order or 0),
            "reserved": 0,
            "seated": 0,
            "used": 0,
            "parties": 0,
        }
    return out


def compute_room_usage(
    *,
    table: DiningTable,
    reservation_date: str,
    periods: Sequence,
    period: str,
    reservations: Iterable[Reservation] = (),
    occupancies: Iterable[TableOccupancy] = (),
) -> RoomUsage:
    """统计房间在 ``reservation_date`` 当天、指定 ``period`` 的座位占用。

    ``period`` 传 ``"all"`` 表示不限时段（统计全天合计）；
    传具体 ``period_key`` 时只统计该时段。预订与散客合并计算。
    """
    usage = RoomUsage(capacity=int(table.capacity or 0))
    key = (period or "").strip().lower()
    period_list = list(periods)
    buckets = _period_buckets(period_list)

    def bucket_of(pk: str) -> dict:
        b = buckets.get(pk)
        if b is None:
            b = {
                "period_key": pk,
                "label": pk,
                "sort_order": 999,
                "reserved": 0,
                "seated": 0,
                "used": 0,
                "parties": 0,
            }
            buckets[pk] = b
        return b

    for r in reservations:
        if r.reservation_date != reservation_date:
            continue
        if r.flow_status in TERMINAL:
            continue
        if int(table.id) not in parse_assigned_table_ids(r):
            continue
        pk = period_key_for_periods_list(period_list, r.time_slot)
        if key != "all" and pk != key:
            continue
        seats = int(r.party_size or 0)
        usage.reserved_seats += seats
        usage.reservation_count += 1
        b = bucket_of(pk)
        b["reserved"] += seats
        b["parties"] += 1

    for occ in occupancies:
        if occ.business_date != reservation_date:
            continue
        if occ.status != "seated":
            continue
        if int(occ.table_id) != int(table.id):
            continue
        pk = period_key_for_periods_list(period_list, occ.time_slot)
        if key != "all" and pk != key:
            continue
        seats = int(occ.party_size or 0)
        usage.seated_seats += seats
        usage.occupancy_count += 1
        b = bucket_of(pk)
        b["seated"] += seats
        b["parties"] += 1

    usage.used_seats = usage.reserved_seats + usage.seated_seats
    for b in buckets.values():
        b["used"] = b["reserved"] + b["seated"]
    usage.by_period = [
        {k: v for k, v in b.items() if k != "sort_order"}
        for b in sorted(buckets.values(), key=lambda x: x["sort_order"])
    ]
    return usage


def period_used_seats(
    db: Session,
    *,
    table_id: int,
    reservation_date: str,
    time_slot: str,
    periods: Sequence,
    exclude_reservation_id: int | None = None,
) -> int:
    """指定时段内该桌台已占用的座位数（预订 + 散客，合并计算）。"""
    period_list = list(periods)
    pk = period_key_for_periods_list(period_list, time_slot)
    used = 0

    rows = (
        db.query(Reservation)
        .filter(Reservation.reservation_date == reservation_date)
        .all()
    )
    for r in rows:
        if r.flow_status in TERMINAL:
            continue
        if exclude_reservation_id is not None and int(r.id) == int(exclude_reservation_id):
            continue
        if int(table_id) not in parse_assigned_table_ids(r):
            continue
        if period_key_for_periods_list(period_list, r.time_slot) != pk:
            continue
        used += int(r.party_size or 0)

    occs = (
        db.query(TableOccupancy)
        .filter(
            TableOccupancy.business_date == reservation_date,
            TableOccupancy.status == "seated",
        )
        .all()
    )
    for occ in occs:
        if int(occ.table_id) != int(table_id):
            continue
        if period_key_for_periods_list(period_list, occ.time_slot) != pk:
            continue
        used += int(occ.party_size or 0)
    return used


def assert_room_capacity(
    db: Session,
    *,
    table: DiningTable,
    reservation_date: str,
    time_slot: str,
    party_size: int,
    periods: Sequence | None = None,
    exclude_reservation_id: int | None = None,
) -> None:
    """房间容量校验：同时段「已占用 + 本单人数」不得超过座位数。

    普通桌（standard）直接跳过，沿用「一桌一单」的独占语义。
    """
    if not is_room_table(table):
        return
    period_list = list(periods) if periods is not None else enabled_periods(db)
    capacity = int(table.capacity or 0)
    used = period_used_seats(
        db,
        table_id=int(table.id),
        reservation_date=reservation_date,
        time_slot=time_slot,
        periods=period_list,
        exclude_reservation_id=exclude_reservation_id,
    )
    need = int(party_size or 0)
    if used + need > capacity:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{table.label}（{table.code}）座位不足："
                f"该时段已占用 {used}/{capacity}，本单 {need} 人。"
            ),
        )


def room_has_free_seat(
    db: Session,
    *,
    table: DiningTable,
    reservation_date: str,
    time_slot: str,
    party_size: int,
    periods: Sequence | None = None,
) -> bool:
    """房间在该时段是否还能安排 ``party_size`` 人。"""
    period_list = list(periods) if periods is not None else enabled_periods(db)
    used = period_used_seats(
        db,
        table_id=int(table.id),
        reservation_date=reservation_date,
        time_slot=time_slot,
        periods=period_list,
    )
    return used + int(party_size or 0) <= int(table.capacity or 0)
