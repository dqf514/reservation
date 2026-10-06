from __future__ import annotations

import json

from sqlalchemy.orm import Session

from .customer_schema_compat import ensure_customer_alias_columns
from .models import Customer


def upsert_customer(db: Session, *, phone: str, display_name: str) -> Customer:
    ensure_customer_alias_columns(db)
    phone = phone.strip()
    name = (display_name or "").strip()
    is_walkin = name.strip().lower() in ("walk-in", "walkin")
    c = db.query(Customer).filter(Customer.phone == phone).first()
    if c:
        if name:
            c.last_seen_name = name

        if not is_walkin and name:
            old = (c.display_name or "").strip()
            if old and old != name:
                try:
                    arr = json.loads(c.alias_names_json or "[]")
                    if not isinstance(arr, list):
                        arr = []
                except Exception:
                    arr = []
                # 记录旧名与新名为别名池（去重，保序）
                seen = {str(x).strip() for x in arr if str(x).strip()}
                for cand in (old, name):
                    cc = (cand or "").strip()
                    if not cc or cc in seen:
                        continue
                    arr.append(cc)
                    seen.add(cc)
                c.alias_names_json = json.dumps(arr, ensure_ascii=False)

            # 更新展示名规则：
            # - 现有展示名为空 -> 用新名
            # - 现有展示名为 Walk-in -> 用新名
            # - 否则保留原展示名（避免频繁被不同写法覆盖）
            if not old or old.strip().lower() in ("walk-in", "walkin"):
                c.display_name = name
        return c
    c = Customer(
        phone=phone,
        display_name="" if is_walkin else name,
        last_seen_name=name,
        alias_names_json=json.dumps([name], ensure_ascii=False)
        if (name and not is_walkin)
        else "",
    )
    db.add(c)
    db.flush()
    return c


def backfill_customers_from_reservations(db: Session) -> int:
    """从预订表补齐客户档案（按手机号去重）"""
    from .models import Reservation

    rows = (
        db.query(Reservation.phone, Reservation.customer_name).distinct().all()
    )
    n = 0
    for phone, customer_name in rows:
        if not phone:
            continue
        c = db.query(Customer).filter(Customer.phone == phone.strip()).first()
        if not c:
            db.add(
                Customer(
                    phone=phone.strip(),
                    display_name=(customer_name or "").strip(),
                )
            )
            n += 1
    if n:
        db.commit()
    return n
