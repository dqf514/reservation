from __future__ import annotations

import re
from sqlalchemy.orm import Session

from .models import OperatingPeriodItem

_HM_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")


def normalize_hm(raw: str) -> str:
    s = raw.strip()
    m = _HM_RE.match(s)
    if not m:
        raise ValueError("时间格式须为 HH:MM（24 小时制）")
    h, mi = int(m.group(1)), int(m.group(2))
    return f"{h:02d}:{mi:02d}"


def to_minutes(hm: str) -> int:
    h, m = hm.split(":")
    return int(h) * 60 + int(m)


def ensure_default_operating_periods(db: Session) -> None:
    if db.query(OperatingPeriodItem).count() > 0:
        return
    db.add_all(
        [
            OperatingPeriodItem(
                period_key="lunch",
                label="午餐",
                start_time="11:00",
                end_time="14:30",
                sort_order=0,
                color="#f97316",
                icon="午",
                enabled=True,
            ),
            OperatingPeriodItem(
                period_key="afternoon",
                label="下午茶",
                start_time="14:30",
                end_time="17:00",
                sort_order=1,
                color="#f59e0b",
                icon="茶",
                enabled=True,
            ),
            OperatingPeriodItem(
                period_key="dinner",
                label="晚餐",
                start_time="17:00",
                end_time="22:00",
                sort_order=2,
                color="#ef4444",
                icon="晚",
                enabled=True,
            ),
        ]
    )
    db.commit()


def list_operating_periods(db: Session) -> list[OperatingPeriodItem]:
    ensure_default_operating_periods(db)
    return (
        db.query(OperatingPeriodItem)
        .order_by(OperatingPeriodItem.sort_order, OperatingPeriodItem.id)
        .all()
    )


def validate_period_items(items: list[dict]) -> list[dict]:
    if len(items) < 2:
        raise ValueError("至少需要配置 2 个时段")
    normalized: list[dict] = []
    seen = set()
    for i, it in enumerate(items):
        key = str(it.get("period_key", "")).strip()
        if not key:
            raise ValueError(f"第 {i + 1} 个时段缺少 period_key")
        if key in seen:
            raise ValueError(f"时段标识重复：{key}")
        seen.add(key)
        start = normalize_hm(str(it.get("start_time", "")))
        end = normalize_hm(str(it.get("end_time", "")))
        if to_minutes(start) >= to_minutes(end):
            raise ValueError(f"时段 {key} 的开始时间必须小于结束时间")
        normalized.append(
            {
                "period_key": key,
                "label": str(it.get("label", "")).strip() or key,
                "start_time": start,
                "end_time": end,
                "sort_order": int(it.get("sort_order", i)),
                "color": str(it.get("color", "#e85d4c")).strip() or "#e85d4c",
                "icon": str(it.get("icon", "餐")).strip() or "餐",
                "enabled": bool(it.get("enabled", True)),
            }
        )
    normalized.sort(key=lambda x: x["sort_order"])
    for i in range(1, len(normalized)):
        prev = normalized[i - 1]
        cur = normalized[i]
        if to_minutes(cur["start_time"]) < to_minutes(prev["end_time"]):
            raise ValueError("时段不能交叉，请检查开始/结束时间")
    return normalized
