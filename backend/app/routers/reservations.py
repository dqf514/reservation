import re
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from ..customer_util import upsert_customer
from ..database import get_db
from ..deps import ROLE_SUPER, require_staff
from ..floor_logic import TERMINAL, pick_random_idle_table
from ..models import DiningTable, Reservation, TableLock
from ..models import User
from ..online_reservation_settings_util import (
    get_or_create_online_reservation_settings,
)
from ..reservation_schema_compat import (
    ensure_assigned_staff_id_column,
    ensure_assigned_staff_name_column,
)
from ..reservation_schema_compat import ensure_assigned_table_ids_column
from ..reservation_schema_compat import ensure_booking_source_column
from ..reservation_datetime import (
    is_reservation_in_past,
    validate_public_reservation_datetime,
    validate_staff_reservation_datetime,
)
from ..reservation_tables_util import (
    parse_assigned_table_ids,
    set_assigned_table_ids,
)
from ..schemas import AdminReservationPatch, ReservationCreate, ReservationMine
from ..sms_notify import (
    notify_reservation_cancelled,
    notify_reservation_submitted,
)

router = APIRouter(tags=["reservations"])
logger = logging.getLogger(__name__)


@router.post("/api/reservations")
def create_public(body: ReservationCreate, db: Session = Depends(get_db)):
    ensure_booking_source_column(db)
    ensure_assigned_table_ids_column(db)
    online_cfg = get_or_create_online_reservation_settings(db)
    if not online_cfg.enabled:
        raise HTTPException(status_code=403, detail="网上预约通道已关闭")

    validate_public_reservation_datetime(
        body.reservation_date.strip(),
        body.time_slot.strip(),
    )

    r = Reservation(
        customer_name=body.customer_name.strip(),
        phone=body.phone.strip(),
        reservation_date=body.reservation_date,
        time_slot=body.time_slot,
        party_size=body.party_size,
        note=(body.note or "").strip() or None,
        # 简化后：预定提交直接进入「待处理」
        flow_status="waiting",
        booking_source="public",
        tags="",
        assigned_table_id=None,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    upsert_customer(
        db, phone=r.phone, display_name=r.customer_name
    )
    db.commit()

    # 自动分配空闲桌台后保持「待处理」状态，再发送已提交短信
    t = pick_random_idle_table(
        db,
        reservation_date=r.reservation_date,
        time_slot=r.time_slot,
        party_size=r.party_size,
    )
    if not t:
        return {"id": r.id, "message": "预订已提交"}

    set_assigned_table_ids(r, [int(t.id)])
    r.flow_status = "waiting"
    db.add(r)
    db.commit()
    db.refresh(r)

    notify_reservation_submitted(db, r.id, "public")
    return {"id": r.id, "message": "预订已提交，等待确认"}


@router.get("/api/reservations/mine", response_model=list[ReservationMine])
def list_mine(phone: str, db: Session = Depends(get_db)):
    if not re.match(r"^1\d{10}$", phone.strip()):
        raise HTTPException(status_code=400, detail="手机号格式不正确")
    rows = (
        db.query(Reservation)
        .filter(Reservation.phone == phone.strip())
        .order_by(
            desc(Reservation.reservation_date), desc(Reservation.time_slot)
        )
        .limit(80)
        .all()
    )
    return [
        ReservationMine(
            id=r.id,
            reservation_date=r.reservation_date,
            time_slot=r.time_slot,
            party_size=r.party_size,
            flow_status=r.flow_status,
            note=r.note,
        )
        for r in rows
    ]


@router.patch("/api/admin/reservations/{rid}")
def admin_patch_reservation(
    rid: int,
    body: AdminReservationPatch,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    ensure_assigned_table_ids_column(db)
    ensure_assigned_staff_id_column(db)
    ensure_assigned_staff_name_column(db)
    r = db.get(Reservation, rid)
    if not r:
        raise HTTPException(status_code=404, detail="预订不存在")
    old_flow = r.flow_status
    old_table_ids = parse_assigned_table_ids(r)

    # 锁定权限校验：除管理员外，只有锁定人可变更该桌台对应的预订
    for tid in parse_assigned_table_ids(r):
        lock = db.query(TableLock).filter(TableLock.table_id == tid).first()
        if (
            lock
            and user.role != ROLE_SUPER
            and lock.locked_by_user_id != user.id
        ):
            raise HTTPException(
                status_code=403,
                detail=f"桌台已被 {lock.locked_by_username} 锁定",
            )
    if body.flow_status is not None:
        r.flow_status = body.flow_status
    requested_codes: list[str] | None = None
    if body.assigned_table_codes is not None:
        requested_codes = [
            c.strip()
            for c in body.assigned_table_codes
            if isinstance(c, str) and c.strip()
        ]
    elif body.assigned_table_code is not None:
        code = body.assigned_table_code.strip()
        requested_codes = [code] if code else []
    if requested_codes is not None and r.flow_status not in TERMINAL:
        requested_codes = list(dict.fromkeys(requested_codes))
        requested_ids: list[int] = []
        for code in requested_codes:
            t = db.query(DiningTable).filter(DiningTable.code == code).first()
            if not t:
                raise HTTPException(
                    status_code=400,
                    detail=f"桌台编号不存在：{code}",
                )
            lock = (
                db.query(TableLock)
                .filter(TableLock.table_id == t.id)
                .first()
            )
            if (
                lock
                and user.role != ROLE_SUPER
                and lock.locked_by_user_id != user.id
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"桌台已被 {lock.locked_by_username} 锁定",
                )
            requested_ids.append(int(t.id))
        set_assigned_table_ids(r, requested_ids)
    if body.customer_name is not None:
        r.customer_name = body.customer_name.strip()
    if body.phone is not None:
        p = body.phone.strip()
        if p and not re.match(r"^1\d{10}$", p):
            raise HTTPException(status_code=400, detail="手机号格式不正确")
        r.phone = p
    if body.reservation_date is not None:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", body.reservation_date.strip()):
            raise HTTPException(status_code=400, detail="日期格式须为 YYYY-MM-DD")
        r.reservation_date = body.reservation_date.strip()
    if body.time_slot is not None:
        r.time_slot = body.time_slot.strip()
    if body.party_size is not None:
        r.party_size = body.party_size
    if body.note is not None:
        r.note = (body.note or "").strip() or None
    if body.tags is not None:
        r.tags = body.tags.strip()
    patch_data = body.model_dump(exclude_unset=True)
    if "assigned_staff_name" in patch_data:
        v = patch_data["assigned_staff_name"]
        if v is None:
            r.assigned_staff_name = None
            r.assigned_staff_id = None
        else:
            label = (v or "").strip() or None
            r.assigned_staff_name = label
            r.assigned_staff_id = None
    validate_staff_reservation_datetime(
        r.flow_status,
        r.reservation_date,
        r.time_slot,
    )
    db.add(r)
    db.commit()

    if r.flow_status in TERMINAL:
        for tid in parse_assigned_table_ids(r):
            lock = (
                db.query(TableLock)
                .filter(TableLock.table_id == tid)
                .first()
            )
            if lock:
                db.delete(lock)
        db.commit()
    db.refresh(r)
    if r.phone:
        upsert_customer(db, phone=r.phone, display_name=r.customer_name)
        db.commit()

    response: dict[str, object] = {"ok": True}

    # 当预订首次分配桌台（无桌台 -> 有桌台）且为「已确认」、时段未过时，
    # 发送预订提醒短信（确保短信包含桌台信息）。
    if (
        not old_table_ids
        and r.flow_status == "confirmed"
        and parse_assigned_table_ids(r)
        and not is_reservation_in_past(r.reservation_date, r.time_slot)
    ):
        src = (
            "admin"
            if (r.booking_source or "").strip() == "admin"
            else "public"
        )
        try:
            notify_reservation_submitted(db, r.id, src)
        except Exception as e:
            logger.warning("预订分配桌台后短信发送失败（不影响保存）: %s", e)
    if (
        body.flow_status == "cancelled"
        and old_flow != "cancelled"
    ):
        r2 = (
            db.query(Reservation)
            .options(joinedload(Reservation.table))
            .filter(Reservation.id == rid)
            .first()
        )
        if r2:
            try:
                result = notify_reservation_cancelled(db, r2)
                if result is not None:
                    response["cancel_sms"] = result
                if result and result.get("sent") is False:
                    logger.info(
                        "预订取消短信未发出: %s",
                        result.get("reason"),
                    )
            except Exception as e:
                logger.warning("预订取消短信异常（不影响保存）: %s", e)
                response["cancel_sms"] = {
                    "sent": False,
                    "reason": "exception",
                    "error": str(e),
                }
    return response
