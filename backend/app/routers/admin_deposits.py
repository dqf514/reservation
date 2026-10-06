from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_staff
from ..log_util import write_operation_log
from ..models import Deposit, Reservation
from ..schemas import (
    DepositCreate,
    DepositItem,
    DepositListResponse,
    DepositUpdate,
)

router = APIRouter(prefix="/api/admin/deposits", tags=["admin-deposits"])


def _item(d: Deposit) -> DepositItem:
    return DepositItem(
        id=d.id,
        reservation_id=d.reservation_id,
        customer_phone=d.customer_phone,
        amount_yuan=d.amount_yuan,
        status=d.status,
        note=d.note,
        paid_at=(
            d.paid_at.strftime("%Y-%m-%d %H:%M:%S") if d.paid_at else None
        ),
        created_at=(
            d.created_at.strftime("%Y-%m-%d %H:%M:%S") if d.created_at else None
        ),
    )


@router.get("", response_model=DepositListResponse)
def list_deposits(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    phone: str | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    query = db.query(Deposit)
    if status:
        query = query.filter(Deposit.status == status)
    if phone and phone.strip():
        query = query.filter(Deposit.customer_phone.contains(phone.strip()))
    total = query.count()
    rows = (
        query.order_by(desc(Deposit.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return DepositListResponse(
        items=[_item(d) for d in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=DepositItem)
def create_deposit(
    body: DepositCreate,
    db: Session = Depends(get_db),
    user=Depends(require_staff),
):
    rid = body.reservation_id
    if rid is not None:
        r = db.get(Reservation, rid)
        if not r:
            raise HTTPException(status_code=400, detail="关联预订不存在")
    d = Deposit(
        reservation_id=rid,
        customer_phone=body.customer_phone.strip(),
        amount_yuan=body.amount_yuan,
        status="pending",
        note=(body.note or "").strip() or None,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    write_operation_log(
        db,
        actor=user,
        category="deposit",
        action="create",
        entity="deposits",
        entity_id=d.id,
        detail={
            "reservation_id": d.reservation_id,
            "customer_phone": d.customer_phone,
            "amount_yuan": d.amount_yuan,
            "status": d.status,
        },
    )
    return _item(d)


@router.patch("/{did}", response_model=DepositItem)
def update_deposit(
    did: int,
    body: DepositUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_staff),
):
    d = db.get(Deposit, did)
    if not d:
        raise HTTPException(status_code=404, detail="订金记录不存在")
    if body.amount_yuan is not None:
        d.amount_yuan = body.amount_yuan
    if body.note is not None:
        d.note = (body.note or "").strip() or None
    if body.status is not None:
        d.status = body.status.strip()
        if d.status == "paid" and not d.paid_at:
            d.paid_at = datetime.now().replace(microsecond=0)
        if d.status in ("pending", "cancelled", "refunded"):
            d.paid_at = None
    db.add(d)
    db.commit()
    db.refresh(d)
    write_operation_log(
        db,
        actor=user,
        category="deposit",
        action="update",
        entity="deposits",
        entity_id=did,
        detail={
            "reservation_id": d.reservation_id,
            "customer_phone": d.customer_phone,
            "amount_yuan": d.amount_yuan,
            "status": d.status,
        },
    )
    return _item(d)


@router.delete("/{did}")
def delete_deposit(
    did: int,
    db: Session = Depends(get_db),
    user=Depends(require_staff),
):
    d = db.get(Deposit, did)
    if not d:
        raise HTTPException(status_code=404, detail="订金记录不存在")
    db.delete(d)
    db.commit()
    write_operation_log(
        db,
        actor=user,
        category="deposit",
        action="delete",
        entity="deposits",
        entity_id=did,
        detail={
            "reservation_id": d.reservation_id,
            "customer_phone": d.customer_phone,
            "amount_yuan": d.amount_yuan,
            "status": d.status,
        },
    )
    return {"ok": True}
