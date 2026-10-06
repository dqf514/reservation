import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session, joinedload

from ..customer_util import upsert_customer
from ..database import get_db
from ..deps import ROLE_SUPER, require_staff, require_super_admin
from ..floor_logic import TERMINAL
from ..models import DiningTable, Reservation, TableLock, User
from ..reservation_admin_item import reservation_admin_item
from ..reservation_schema_compat import (
    ensure_assigned_staff_id_column,
    ensure_assigned_staff_name_column,
    ensure_assigned_table_ids_column,
    ensure_booking_source_column,
)
from ..reservation_datetime import (
    is_reservation_in_past,
    validate_staff_reservation_datetime,
)
from ..reservation_tables_util import (
    parse_assigned_table_ids,
    set_assigned_table_ids,
)
from ..note_quick_options_util import (
    NOTE_QUICK_OPTIONS_MAX,
    read_note_quick_options,
    write_note_quick_options,
)
from ..schemas import (
    AdminReservationCreate,
    NoteQuickOptionsUpdate,
    ReservationAdminItem,
    ReservationListResponse,
)
from ..sms_notify import (
    notify_reservation_cancelled,
    notify_reservation_submitted,
)
from ..log_util import write_operation_log

router = APIRouter(
    prefix="/api/admin/reservations",
    tags=["admin-reservations"],
)
logger = logging.getLogger(__name__)

_item = reservation_admin_item


@router.get("/note-quick-options", response_model=list[str])
def get_note_quick_options(
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    """全店共享的备注快捷备选项（任意员工可读）。"""
    return read_note_quick_options(db)


@router.put("/note-quick-options", response_model=list[str])
def put_note_quick_options(
    body: NoteQuickOptionsUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    """更新备注快捷备选项（任意员工可改，最多 20 条，全店同步）。"""
    if len(body.items) > NOTE_QUICK_OPTIONS_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"最多 {NOTE_QUICK_OPTIONS_MAX} 条备选项",
        )
    try:
        return write_note_quick_options(db, body.items)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/assignee-suggestions", response_model=list[str])
def list_assignee_suggestions(
    q: str | None = None,
    limit: int = Query(80, ge=1, le=200),
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    """历史预订中出现过的接单人姓名，供输入框点选；也可手工输入新姓名。"""
    ensure_assigned_staff_name_column(db)
    query = (
        db.query(Reservation.assigned_staff_name)
        .filter(Reservation.assigned_staff_name.isnot(None))
        .filter(Reservation.assigned_staff_name != "")
    )
    if q and q.strip():
        pat = f"%{q.strip()}%"
        query = query.filter(Reservation.assigned_staff_name.ilike(pat))
    rows = query.distinct().limit(limit * 4).all()
    seen: set[str] = set()
    out: list[str] = []
    for (name,) in rows:
        s = (name or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) >= limit:
            break
    return sorted(out, key=lambda x: x.lower())


@router.get("", response_model=ReservationListResponse)
def list_reservations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    flow_status: str | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_assigned_table_ids_column(db)
    ensure_assigned_staff_id_column(db)
    ensure_assigned_staff_name_column(db)
    query = db.query(Reservation).options(joinedload(Reservation.table))
    if q and q.strip():
        s = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Reservation.customer_name.ilike(s),
                Reservation.phone.ilike(s),
            )
        )
    if date_from:
        query = query.filter(Reservation.reservation_date >= date_from)
    if date_to:
        query = query.filter(Reservation.reservation_date <= date_to)
    if flow_status:
        if flow_status == "waiting":
            query = query.filter(
                Reservation.flow_status.in_(("waiting", "pending_confirm"))
            )
        elif flow_status == "confirmed":
            query = query.filter(Reservation.flow_status == "confirmed")
        elif flow_status == "arrived":
            query = query.filter(
                Reservation.flow_status.in_(("arrived", "seated"))
            )
        elif flow_status == "cancelled":
            query = query.filter(
                Reservation.flow_status.in_(("cancelled", "noshow"))
            )
        else:
            query = query.filter(Reservation.flow_status == flow_status)

    total_count = query.count()
    rows = (
        query.order_by(
            desc(Reservation.reservation_date),
            desc(Reservation.time_slot),
            desc(Reservation.id),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [_item(db, r) for r in rows]
    phones = sorted({x.phone for x in items if x.phone})
    cnt_map: dict[str, int] = {}
    if phones:
        cnt_rows = (
            db.query(Reservation.phone, func.count(Reservation.id))
            .filter(Reservation.phone.in_(phones))
            .group_by(Reservation.phone)
            .all()
        )
        cnt_map = {str(p): int(c) for p, c in cnt_rows}
    for it in items:
        # 历史次数不包含当前这条预订本身（与桌台客人列表一致）
        phone_total = cnt_map.get(it.phone, 0)
        it.reservation_count = max(0, int(phone_total) - 1)

    return ReservationListResponse(
        items=items,
        total=total_count,
        page=page,
        page_size=page_size,
    )


@router.get("/{rid}", response_model=ReservationAdminItem)
def get_reservation(
    rid: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_assigned_table_ids_column(db)
    ensure_assigned_staff_id_column(db)
    ensure_assigned_staff_name_column(db)
    r = (
        db.query(Reservation)
        .options(joinedload(Reservation.table))
        .filter(Reservation.id == rid)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="预订不存在")
    return _item(db, r)


@router.post("", response_model=ReservationAdminItem)
def create_reservation_admin(
    body: AdminReservationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    ensure_booking_source_column(db)
    ensure_assigned_table_ids_column(db)
    ensure_assigned_staff_id_column(db)
    ensure_assigned_staff_name_column(db)
    requested_codes = [
        c.strip()
        for c in (body.assigned_table_codes or [])
        if isinstance(c, str) and c.strip()
    ]
    if not requested_codes and body.assigned_table_code:
        requested_codes = [body.assigned_table_code.strip()]
    requested_codes = list(dict.fromkeys(requested_codes))
    requested_ids: list[int] = []
    for code in requested_codes:
        t = db.query(DiningTable).filter(DiningTable.code == code).first()
        if not t:
            raise HTTPException(status_code=400, detail=f"桌台编号不存在：{code}")
        lock = db.query(TableLock).filter(TableLock.table_id == t.id).first()
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

    flow = (body.flow_status or "confirmed").strip()
    validate_staff_reservation_datetime(
        flow,
        body.reservation_date,
        body.time_slot.strip(),
    )

    staff_label = (body.assigned_staff_name or "").strip()
    if not staff_label:
        raise HTTPException(status_code=400, detail="请填写接单人")

    r = Reservation(
        customer_name=body.customer_name.strip(),
        phone=(body.phone or "").strip(),
        reservation_date=body.reservation_date,
        time_slot=body.time_slot.strip(),
        party_size=body.party_size,
        note=(body.note or "").strip() or None,
        # 管理员创建默认直接「已确认」
        flow_status=flow,
        booking_source="admin",
        tags=(body.tags or "").strip(),
        assigned_table_id=requested_ids[0] if requested_ids else None,
        assigned_staff_id=None,
        assigned_staff_name=staff_label,
    )
    set_assigned_table_ids(r, requested_ids)
    db.add(r)
    db.commit()
    db.refresh(r)
    if r.phone:
        upsert_customer(db, phone=r.phone, display_name=r.customer_name)
        db.commit()
    r = (
        db.query(Reservation)
        .options(joinedload(Reservation.table))
        .filter(Reservation.id == r.id)
        .first()
    )
    # 显式勾选发送短信 +「已确认」且时段未过时，才发送预订提醒短信。
    past = is_reservation_in_past(r.reservation_date, r.time_slot)
    if body.send_sms and r.flow_status == "confirmed" and not past:
        try:
            notify_reservation_submitted(db, r.id, "admin")
        except Exception as e:
            logger.warning("管理员新建预订短信发送失败（不影响保存）: %s", e)
    write_operation_log(
        db,
        actor=user,
        category="reservation",
        action="create",
        entity="reservations",
        entity_id=r.id,
        detail={
            "reservation_date": r.reservation_date,
            "time_slot": r.time_slot,
            "party_size": r.party_size,
            "phone": (r.phone or "").strip(),
            "assigned_table_ids": parse_assigned_table_ids(r),
        },
    )
    return _item(db, r)


@router.post("/{rid}/resend-success-sms")
def resend_success_sms(
    rid: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    r = (
        db.query(Reservation)
        .options(joinedload(Reservation.table))
        .filter(Reservation.id == rid)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="预订不存在")
    if r.flow_status in TERMINAL:
        raise HTTPException(status_code=400, detail="当前状态不可补发成功短信")
    try:
        result = notify_reservation_submitted(db, r.id, "admin")
    except Exception as e:
        logger.warning("补发预订成功短信异常: %s", e)
        return {
            "ok": False,
            "result": {"sent": False, "reason": "exception", "error": str(e)},
            "message": "补发失败（已给出原因）",
        }
    if result and result.get("sent") is False:
        # 让前端知道“为什么没发”，便于你定位设置项
        return {"ok": False, "result": result, "message": "补发失败（已给出原因）"}
    write_operation_log(
        db,
        actor=user,
        category="sms",
        action="resend_success_sms",
        entity="reservations",
        entity_id=rid,
        detail={"result": result},
    )
    return {"ok": True, "result": result, "message": "补发成功短信已提交"}


@router.delete("/{rid}")
def delete_reservation(
    rid: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
):
    ensure_assigned_table_ids_column(db)
    ensure_assigned_staff_id_column(db)
    ensure_assigned_staff_name_column(db)
    r = (
        db.query(Reservation)
        .options(joinedload(Reservation.table))
        .filter(Reservation.id == rid)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="预订不存在")
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
    try:
        result = notify_reservation_cancelled(db, r)
        if result and result.get("sent") is False:
            logger.info(
                "删除预订时取消短信未发出: %s",
                result.get("reason"),
            )
    except Exception as e:
        logger.warning("删除预订取消短信异常（不影响删除）: %s", e)
    for tid in parse_assigned_table_ids(r):
        lock = db.query(TableLock).filter(TableLock.table_id == tid).first()
        if lock:
            db.delete(lock)
    db.delete(r)
    db.commit()
    write_operation_log(
        db,
        actor=user,
        category="reservation",
        action="delete",
        entity="reservations",
        entity_id=rid,
        detail={
            "reservation_date": r.reservation_date,
            "time_slot": r.time_slot,
            "phone": (r.phone or "").strip(),
        },
    )
    return {"ok": True}
