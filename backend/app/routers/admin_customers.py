from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_staff
from ..customer_schema_compat import ensure_customer_alias_columns
from ..models import Customer, Reservation
from ..reservation_admin_item import reservation_admin_item
from ..schemas import (
    CustomerCreate,
    CustomerItem,
    CustomerListResponse,
    CustomerProfileResponse,
    CustomerUpdate,
)

router = APIRouter(prefix="/api/admin/customers", tags=["admin-customers"])


def _item(c: Customer, db: Session) -> CustomerItem:
    ensure_customer_alias_columns(db)
    cnt = (
        db.query(func.count(Reservation.id))
        .filter(Reservation.phone == c.phone)
        .scalar()
        or 0
    )
    alias_names: list[str] = []
    try:
        import json

        arr = json.loads(c.alias_names_json or "[]")
        if isinstance(arr, list):
            alias_names = [str(x).strip() for x in arr if str(x).strip()]
    except Exception:
        alias_names = []
    return CustomerItem(
        id=c.id,
        phone=c.phone,
        display_name=c.display_name,
        last_seen_name=(c.last_seen_name or "").strip(),
        alias_names=alias_names[:20],
        email=c.email,
        tags=c.tags or "",
        note=c.note,
        reservation_count=int(cnt),
    )


@router.get("", response_model=CustomerListResponse)
def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_customer_alias_columns(db)
    cnt_subq = (
        db.query(
            Reservation.phone.label("phone"),
            func.count(Reservation.id).label("reservation_count"),
        )
        .group_by(Reservation.phone)
        .subquery()
    )
    query = db.query(Customer).outerjoin(
        cnt_subq, cnt_subq.c.phone == Customer.phone
    )
    if q and q.strip():
        s = f"%{q.strip()}%"
        query = query.filter(
            or_(Customer.phone.ilike(s), Customer.display_name.ilike(s))
        )
    total = query.count()
    rows = (
        query.order_by(
            func.coalesce(cnt_subq.c.reservation_count, 0).desc(),
            Customer.updated_at.desc(),
            Customer.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return CustomerListResponse(
        items=[_item(c, db) for c in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=CustomerItem)
def create_customer(
    body: CustomerCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_customer_alias_columns(db)
    if db.query(Customer).filter(Customer.phone == body.phone.strip()).first():
        raise HTTPException(status_code=400, detail="该手机号已存在")
    c = Customer(
        phone=body.phone.strip(),
        display_name=(body.display_name or "").strip(),
        last_seen_name=(body.display_name or "").strip(),
        email=(body.email or "").strip() or None,
        tags=(body.tags or "").strip(),
        note=(body.note or "").strip() or None,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _item(c, db)


@router.get("/{cid}", response_model=CustomerItem)
def get_customer(
    cid: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_customer_alias_columns(db)
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(status_code=404, detail="客户不存在")
    return _item(c, db)


@router.patch("/{cid}", response_model=CustomerItem)
def update_customer(
    cid: int,
    body: CustomerUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_customer_alias_columns(db)
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(status_code=404, detail="客户不存在")
    old_display_name = (c.display_name or "").strip()
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if v is not None and isinstance(v, str):
            v = v.strip()
        setattr(c, k, v)
    # 后台手动修改称呼：同步 last_seen_name，并写入别名池（不覆盖旧别名）
    if "display_name" in data and isinstance(data.get("display_name"), str):
        new_name = (data.get("display_name") or "").strip()
        if new_name:
            c.last_seen_name = new_name
            if old_display_name and old_display_name != new_name:
                try:
                    import json

                    arr = json.loads(c.alias_names_json or "[]")
                    if not isinstance(arr, list):
                        arr = []
                except Exception:
                    arr = []
                seen = {str(x).strip() for x in arr if str(x).strip()}
                for cand in (old_display_name, new_name):
                    cc = (cand or "").strip()
                    if not cc or cc in seen:
                        continue
                    arr.append(cc)
                    seen.add(cc)
                c.alias_names_json = json.dumps(arr, ensure_ascii=False)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _item(c, db)


@router.delete("/{cid}")
def delete_customer(
    cid: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_customer_alias_columns(db)
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(status_code=404, detail="客户不存在")
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.get("/by-phone/{phone}", response_model=CustomerProfileResponse)
def get_customer_by_phone(
    phone: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_customer_alias_columns(db)
    p = (phone or "").strip()
    if not p or not p.isdigit():
        raise HTTPException(status_code=400, detail="手机号格式不正确")
    c = db.query(Customer).filter(Customer.phone == p).first()
    rows = (
        db.query(Reservation)
        .filter(Reservation.phone == p)
        .order_by(
            Reservation.reservation_date.desc(),
            Reservation.time_slot.desc(),
            Reservation.id.desc(),
        )
        .limit(80)
        .all()
    )
    reservations = [reservation_admin_item(db, r) for r in rows]
    return CustomerProfileResponse(
        customer=_item(c, db) if c else None,
        phone=p,
        reservation_count=len(rows),
        reservations=reservations,
    )
