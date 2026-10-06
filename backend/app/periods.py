from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from .operating_period_util import list_operating_periods, to_minutes

if TYPE_CHECKING:
    from .models import OperatingPeriodItem


def period_key_for_periods_list(
    periods: list["OperatingPeriodItem"],
    time_slot: str,
) -> str:
    """与 period_key_for_time_slot 一致，但使用已加载的时段列表，避免重复查库。"""
    if not periods:
        return "default"
    t = to_minutes(time_slot.strip())
    last_sort = max(p.sort_order for p in periods)
    for p in periods:
        is_last = p.sort_order == last_sort
        if to_minutes(p.start_time) <= t <= to_minutes(p.end_time):
            if is_last:
                return p.period_key
            if t < to_minutes(p.end_time):
                return p.period_key
    if t < to_minutes(periods[0].start_time):
        return periods[0].period_key
    return periods[-1].period_key


def period_key_for_time_slot(db: Session, time_slot: str) -> str:
    periods = [p for p in list_operating_periods(db) if p.enabled]
    return period_key_for_periods_list(periods, time_slot)


def time_in_period_db(db: Session, time_slot: str, period: str) -> bool:
    return period_key_for_time_slot(db, time_slot) == period


def time_in_period_with_periods(
    periods: list["OperatingPeriodItem"],
    time_slot: str,
    period: str,
) -> bool:
    """时段是否属于当前筛选（period 为 all 时不过滤）。"""
    if (period or "").strip().lower() == "all":
        return True
    return period_key_for_periods_list(periods, time_slot) == (period or "").strip()
