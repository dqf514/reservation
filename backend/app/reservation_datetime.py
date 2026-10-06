"""预订日期+时段与「当前本地时间」比较（服务器本地时区）。"""

from __future__ import annotations

import re
from datetime import datetime, timedelta

from fastapi import HTTPException

# 后台新建/编辑：仅当预订开始早于「当前本地时刻」超过此时长，才视为需用「已离席」补录的「过去」
STAFF_PAST_THRESHOLD = timedelta(days=1)

# 仅允许用「已离席」补录过去时段（到店记录等）
ALLOWED_PAST_RECORDING_FLOWS = frozenset({"left"})

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")


def parse_time_slot_hm(time_slot: str) -> tuple[int, int]:
    s = (time_slot or "").strip()
    m = _TIME_RE.match(s)
    if not m:
        raise ValueError("time_slot")
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 23 or mi > 59:
        raise ValueError("time_slot")
    return h, mi


def reservation_local_datetime(reservation_date: str, time_slot: str) -> datetime:
    d = (reservation_date or "").strip()
    if not _DATE_RE.match(d):
        raise ValueError("reservation_date")
    y, mo, day = map(int, d.split("-"))
    h, mi = parse_time_slot_hm(time_slot)
    return datetime(y, mo, day, h, mi, 0)


def is_reservation_in_past(reservation_date: str, time_slot: str) -> bool:
    """预订开始时间是否早于当前本地时刻（严格早于）。"""
    dt = reservation_local_datetime(reservation_date, time_slot)
    now = datetime.now().replace(microsecond=0)
    return dt < now


def is_reservation_before_staff_past_threshold(
    reservation_date: str, time_slot: str,
) -> bool:
    """
    是否早于「当前本地时刻」超过 STAFF_PAST_THRESHOLD（默认 24 小时）。
    用于后台编辑：仅在此情况下限制非「已离席」状态。
    """
    dt = reservation_local_datetime(reservation_date, time_slot)
    now = datetime.now().replace(microsecond=0)
    return dt < (now - STAFF_PAST_THRESHOLD)


def validate_public_reservation_datetime(reservation_date: str, time_slot: str) -> None:
    """顾客端新建：不允许过去时间。"""
    try:
        if not is_reservation_in_past(reservation_date, time_slot):
            return
    except ValueError:
        raise HTTPException(status_code=400, detail="时间格式须为 HH:MM")
    raise HTTPException(status_code=400, detail="预订时间不能早于当前时间")


def validate_staff_reservation_datetime(
    flow_status: str,
    reservation_date: str,
    time_slot: str,
) -> None:
    """
    后台新建/编辑：仅当预订开始早于当前超过一天（24 小时）时，非「已离席」不可保存；
    当日或近 24 小时内的时间可正常保存（含已入座等），避免编辑入席时间时被误拦。
    """
    try:
        too_old = is_reservation_before_staff_past_threshold(
            reservation_date, time_slot,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="时间格式须为 HH:MM")
    if not too_old:
        return
    fs = (flow_status or "").strip()
    if fs in ALLOWED_PAST_RECORDING_FLOWS:
        return
    raise HTTPException(
        status_code=400,
        detail="不可保存为早于当前超过一天的预订时间。如需补录更早记录，请将状态选为「已离席」。",
    )
