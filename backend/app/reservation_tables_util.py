from __future__ import annotations

from .models import Reservation


def _dedupe_keep_order(values: list[int]) -> list[int]:
    out: list[int] = []
    seen: set[int] = set()
    for v in values:
        if v <= 0 or v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out


def parse_table_ids_csv(
    assigned_table_id: int | None,
    assigned_table_ids: str | None,
) -> list[int]:
    """解析「首桌 id + CSV 多桌 id」为去重后的桌台 id 列表。

    与 :func:`parse_assigned_table_ids` 语义一致，但不依赖 ORM 实例，
    可用于仅 select 少数字段的轻量查询。
    """
    values: list[int] = []
    if assigned_table_id is not None and int(assigned_table_id) > 0:
        values.append(int(assigned_table_id))
    raw = (assigned_table_ids or "").strip()
    if raw:
        for part in raw.split(","):
            p = part.strip()
            if not p or not p.isdigit():
                continue
            values.append(int(p))
    return _dedupe_keep_order(values)


def parse_assigned_table_ids(reservation: Reservation) -> list[int]:
    """返回预订关联的全部桌台 id（兼容旧字段 assigned_table_id）。"""
    return parse_table_ids_csv(
        reservation.assigned_table_id,
        reservation.assigned_table_ids,
    )


def set_assigned_table_ids(reservation: Reservation, table_ids: list[int]) -> None:
    """写入多桌台并维护旧字段镜像（首桌写入 assigned_table_id）。"""
    ids = _dedupe_keep_order([int(x) for x in table_ids if int(x) > 0])
    reservation.assigned_table_id = ids[0] if ids else None
    reservation.assigned_table_ids = ",".join(str(x) for x in ids)
