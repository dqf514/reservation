"""推广短信：草稿、发件队列、已发送。"""

from __future__ import annotations

import json
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..customer_schema_compat import ensure_customer_alias_columns
from ..database import get_db
from ..deps import ROLE_SUPER, require_staff
from ..models import Customer, PromotionSmsMessage, PromotionSmsQueueItem, Reservation, User
from ..promotion_sms_sender import normalize_phone, wake_promotion_sms_worker
from ..sms_settings_util import (
    FIXED_SIGNATURE_PREFIX,
    assert_sms_text_within_limit,
    effective_promotion_sms_max_recipients,
    effective_promotion_sms_staff_max_recipients,
)
from ..schemas import (
    PromotionSmsMessageCreate,
    PromotionSmsMessageItem,
    PromotionSmsMessageListResponse,
    PromotionSmsMessageUpdate,
    PromotionSmsQueueItemOut,
    PromotionSmsQueueResponse,
    PromotionSmsRecipient,
    PromotionSmsRecipientCandidate,
    PromotionSmsRecipientSearchRequest,
    PromotionSmsRecipientSearchResponse,
    PromotionSmsSendLimits,
)

router = APIRouter(prefix="/api/admin/promotion-sms", tags=["admin-promotion-sms"])


def _validate_promotion_body(content: str, *, allow_empty: bool = False) -> None:
    body = re.sub(r"^【[^】]*】\s*", "", (content or "").strip())
    if not body:
        if allow_empty:
            return
        raise HTTPException(status_code=400, detail="短信内容不能为空")
    try:
        assert_sms_text_within_limit(f"{FIXED_SIGNATURE_PREFIX}{body}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _parse_recipients(raw: str) -> list[PromotionSmsRecipient]:
    try:
        arr = json.loads(raw or "[]")
        if not isinstance(arr, list):
            return []
        out: list[PromotionSmsRecipient] = []
        for x in arr:
            if not isinstance(x, dict):
                continue
            phone = str(x.get("phone") or "").strip()
            if not phone:
                continue
            out.append(
                PromotionSmsRecipient(
                    phone=phone,
                    display_name=str(x.get("display_name") or "").strip(),
                    source=str(x.get("source") or "manual").strip() or "manual",
                )
            )
        return out
    except Exception:
        return []


def _parse_filter(raw: str) -> dict | None:
    if not (raw or "").strip():
        return None
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def _dt_str(v: datetime | None) -> str | None:
    if v is None:
        return None
    return v.strftime("%Y-%m-%d %H:%M:%S")


def _item(row: PromotionSmsMessage) -> PromotionSmsMessageItem:
    return PromotionSmsMessageItem(
        id=row.id,
        subject=row.subject or "",
        content=row.content or "",
        status=row.status or "draft",
        recipients=_parse_recipients(row.recipients_json),
        filter_snapshot=_parse_filter(row.filter_snapshot_json),
        created_by_username=row.created_by_username or "",
        total_recipients=int(row.total_recipients or 0),
        sent_count=int(row.sent_count or 0),
        failed_count=int(row.failed_count or 0),
        pending_count=int(row.pending_count or 0),
        created_at=_dt_str(row.created_at) or "",
        updated_at=_dt_str(row.updated_at) or "",
        started_at=_dt_str(row.started_at),
        completed_at=_dt_str(row.completed_at),
    )


def _dedupe_recipients(recipients: list[PromotionSmsRecipient]) -> list[PromotionSmsRecipient]:
    seen: set[str] = set()
    out: list[PromotionSmsRecipient] = []
    for r in recipients:
        phone = normalize_phone(r.phone)
        if not phone or phone in seen:
            continue
        seen.add(phone)
        out.append(
            PromotionSmsRecipient(
                phone=phone,
                display_name=(r.display_name or "").strip(),
                source=(r.source or "manual").strip() or "manual",
            )
        )
    return out


def _folder_filter(folder: str):
    f = (folder or "draft").strip().lower()
    if f == "draft":
        return PromotionSmsMessage.status == "draft"
    if f == "outbox":
        return PromotionSmsMessage.status.in_(["queued", "sending"])
    if f == "sent":
        return PromotionSmsMessage.status == "completed"
    raise HTTPException(status_code=400, detail="无效的文件夹")


@router.get("/send-limits", response_model=PromotionSmsSendLimits)
def get_send_limits(
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    return PromotionSmsSendLimits(
        promotion_max_recipients=effective_promotion_sms_max_recipients(db),
        staff_max_recipients=effective_promotion_sms_staff_max_recipients(db),
    )


@router.get("/messages", response_model=PromotionSmsMessageListResponse)
def list_messages(
    folder: str = Query("draft"),
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    query = db.query(PromotionSmsMessage).filter(_folder_filter(folder))
    if q and q.strip():
        s = f"%{q.strip()}%"
        query = query.filter(
            or_(
                PromotionSmsMessage.subject.ilike(s),
                PromotionSmsMessage.content.ilike(s),
            )
        )
    total = query.count()
    rows = (
        query.order_by(PromotionSmsMessage.updated_at.desc(), PromotionSmsMessage.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PromotionSmsMessageListResponse(
        items=[_item(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/messages/{mid}", response_model=PromotionSmsMessageItem)
def get_message(
    mid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    row = db.get(PromotionSmsMessage, mid)
    if not row:
        raise HTTPException(status_code=404, detail="短信不存在")
    return _item(row)


@router.post("/messages", response_model=PromotionSmsMessageItem)
def create_message(
    body: PromotionSmsMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    recipients = _dedupe_recipients(body.recipients or [])
    content = (body.content or "").strip()
    _validate_promotion_body(content, allow_empty=True)
    row = PromotionSmsMessage(
        subject=(body.subject or "").strip(),
        content=content,
        status="draft",
        recipients_json=json.dumps(
            [r.model_dump() for r in recipients],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        filter_snapshot_json=(
            json.dumps(body.filter_snapshot, ensure_ascii=False, separators=(",", ":"))
            if body.filter_snapshot
            else ""
        ),
        created_by_user_id=int(user.id),
        created_by_username=(user.username or "").strip(),
        total_recipients=len(recipients),
        pending_count=0,
        sent_count=0,
        failed_count=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _item(row)


@router.put("/messages/{mid}", response_model=PromotionSmsMessageItem)
def update_message(
    mid: int,
    body: PromotionSmsMessageUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    row = db.get(PromotionSmsMessage, mid)
    if not row:
        raise HTTPException(status_code=404, detail="短信不存在")
    if row.status != "draft":
        raise HTTPException(status_code=400, detail="仅草稿可编辑")
    if body.subject is not None:
        row.subject = body.subject.strip()
    if body.content is not None:
        content = body.content.strip()
        _validate_promotion_body(content, allow_empty=True)
        row.content = content
    if body.recipients is not None:
        recipients = _dedupe_recipients(body.recipients)
        row.recipients_json = json.dumps(
            [r.model_dump() for r in recipients],
            ensure_ascii=False,
            separators=(",", ":"),
        )
        row.total_recipients = len(recipients)
    if body.filter_snapshot is not None:
        row.filter_snapshot_json = (
            json.dumps(body.filter_snapshot, ensure_ascii=False, separators=(",", ":"))
            if body.filter_snapshot
            else ""
        )
    row.updated_at = datetime.now()
    db.commit()
    db.refresh(row)
    return _item(row)


@router.delete("/messages/{mid}")
def delete_message(
    mid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    row = db.get(PromotionSmsMessage, mid)
    if not row:
        raise HTTPException(status_code=404, detail="短信不存在")
    if row.status != "draft":
        raise HTTPException(status_code=400, detail="仅草稿可删除")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/messages/{mid}/duplicate", response_model=PromotionSmsMessageItem)
def duplicate_message(
    mid: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    row = db.get(PromotionSmsMessage, mid)
    if not row:
        raise HTTPException(status_code=404, detail="短信不存在")
    copy = PromotionSmsMessage(
        subject=(row.subject or "").strip(),
        content=(row.content or "").strip(),
        status="draft",
        recipients_json=row.recipients_json or "[]",
        filter_snapshot_json=row.filter_snapshot_json or "",
        created_by_user_id=int(user.id),
        created_by_username=(user.username or "").strip(),
        total_recipients=int(row.total_recipients or 0),
        pending_count=0,
        sent_count=0,
        failed_count=0,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return _item(copy)


@router.post("/messages/{mid}/send", response_model=PromotionSmsMessageItem)
def send_message(
    mid: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    row = db.get(PromotionSmsMessage, mid)
    if not row:
        raise HTTPException(status_code=404, detail="短信不存在")
    if row.status != "draft":
        raise HTTPException(status_code=400, detail="仅草稿可发送")
    recipients = _dedupe_recipients(_parse_recipients(row.recipients_json))
    if not recipients:
        raise HTTPException(status_code=400, detail="请至少添加一位收件人")
    promo_max = effective_promotion_sms_max_recipients(db)
    staff_max = effective_promotion_sms_staff_max_recipients(db)
    if len(recipients) > promo_max:
        raise HTTPException(
            status_code=400,
            detail=f"单次最多发送 {promo_max} 位收件人",
        )
    if len(recipients) > staff_max and user.role != ROLE_SUPER:
        raise HTTPException(
            status_code=403,
            detail=(
                f"超过 {staff_max} 位收件人的群发仅超级管理员可操作，"
                f"请先将收件人控制在 {staff_max} 位以内做测试发送"
            ),
        )
    if not (row.content or "").strip():
        raise HTTPException(status_code=400, detail="短信内容不能为空")
    _validate_promotion_body(row.content)

    row.total_recipients = len(recipients)
    row.pending_count = len(recipients)
    row.sent_count = 0
    row.failed_count = 0
    row.status = "queued"
    row.started_at = datetime.now()
    row.updated_at = datetime.now()
    row.recipients_json = json.dumps(
        [r.model_dump() for r in recipients],
        ensure_ascii=False,
        separators=(",", ":"),
    )

    for idx, r in enumerate(recipients):
        db.add(
            PromotionSmsQueueItem(
                message_id=row.id,
                phone=r.phone,
                display_name=r.display_name,
                sort_order=idx,
                status="pending",
            )
        )
    db.commit()
    db.refresh(row)
    wake_promotion_sms_worker()
    return _item(row)


@router.get("/messages/{mid}/queue", response_model=PromotionSmsQueueResponse)
def get_message_queue(
    mid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    row = db.get(PromotionSmsMessage, mid)
    if not row:
        raise HTTPException(status_code=404, detail="短信不存在")
    items = (
        db.query(PromotionSmsQueueItem)
        .filter(PromotionSmsQueueItem.message_id == mid)
        .order_by(PromotionSmsQueueItem.sort_order.asc(), PromotionSmsQueueItem.id.asc())
        .all()
    )
    return PromotionSmsQueueResponse(
        items=[
            PromotionSmsQueueItemOut(
                id=x.id,
                phone=x.phone,
                display_name=x.display_name or "",
                status=x.status or "",
                reason=x.reason or "",
                sent_at=_dt_str(x.sent_at),
            )
            for x in items
        ],
        total=len(items),
    )


@router.post("/recipients/search", response_model=PromotionSmsRecipientSearchResponse)
def search_recipients(
    body: PromotionSmsRecipientSearchRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    ensure_customer_alias_columns(db)
    cnt_subq = (
        db.query(
            Reservation.phone.label("phone"),
            func.count(Reservation.id).label("reservation_count"),
            func.max(Reservation.reservation_date).label("last_booking_date"),
        )
        .group_by(Reservation.phone)
        .subquery()
    )
    query = (
        db.query(
            Customer,
            func.coalesce(cnt_subq.c.reservation_count, 0).label("reservation_count"),
            cnt_subq.c.last_booking_date,
        )
        .outerjoin(cnt_subq, cnt_subq.c.phone == Customer.phone)
    )
    if body.q and body.q.strip():
        s = f"%{body.q.strip()}%"
        query = query.filter(
            or_(Customer.phone.ilike(s), Customer.display_name.ilike(s))
        )
    if body.min_reservation_count is not None:
        query = query.filter(
            func.coalesce(cnt_subq.c.reservation_count, 0) >= body.min_reservation_count
        )
    if body.last_booking_after:
        query = query.filter(cnt_subq.c.last_booking_date >= body.last_booking_after.strip())
    if body.last_booking_before:
        query = query.filter(cnt_subq.c.last_booking_date <= body.last_booking_before.strip())

    total = query.count()
    rows = (
        query.order_by(
            func.coalesce(cnt_subq.c.reservation_count, 0).desc(),
            Customer.updated_at.desc(),
        )
        .offset((body.page - 1) * body.page_size)
        .limit(body.page_size)
        .all()
    )
    items: list[PromotionSmsRecipientCandidate] = []
    for c, reservation_count, last_booking_date in rows:
        phone = normalize_phone(c.phone)
        if not phone:
            continue
        items.append(
            PromotionSmsRecipientCandidate(
                phone=phone,
                display_name=(c.display_name or c.last_seen_name or "").strip(),
                reservation_count=int(reservation_count or 0),
                last_booking_date=str(last_booking_date) if last_booking_date else None,
            )
        )
    return PromotionSmsRecipientSearchResponse(
        items=items,
        total=total,
        page=body.page,
        page_size=body.page_size,
    )
