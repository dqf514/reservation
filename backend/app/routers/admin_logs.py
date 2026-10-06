from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_primary_admin_account, require_staff, require_super_admin
from ..models import AccessLog, OperationLog, SmsSendLog, User

router = APIRouter(prefix="/api/admin/logs", tags=["admin-logs"])


class AccessLogRecordBody(BaseModel):
    path: str = Field(default="", max_length=512)


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    raw = s.strip()
    if not raw:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(raw, fmt)
            return dt
        except ValueError:
            continue
    return None


@router.get("/operations")
def list_operation_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    username: str | None = None,
    category: str | None = None,
    action: str | None = None,
    entity: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    query = db.query(OperationLog)
    if username and username.strip():
        query = query.filter(OperationLog.actor_username == username.strip())
    if category and category.strip():
        query = query.filter(OperationLog.category == category.strip())
    if action and action.strip():
        query = query.filter(OperationLog.action == action.strip())
    if entity and entity.strip():
        query = query.filter(OperationLog.entity == entity.strip())
    dt_from = _parse_dt(date_from)
    dt_to = _parse_dt(date_to)
    if dt_from:
        query = query.filter(OperationLog.created_at >= dt_from)
    if dt_to:
        query = query.filter(OperationLog.created_at <= dt_to)
    total = query.count()
    rows = (
        query.order_by(desc(OperationLog.created_at), desc(OperationLog.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        {
            "id": r.id,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S")
            if r.created_at
            else None,
            "actor_username": r.actor_username,
            "actor_role": r.actor_role,
            "category": r.category,
            "action": r.action,
            "entity": r.entity,
            "entity_id": r.entity_id,
            "ip": r.ip,
            "detail_json": r.detail_json,
        }
        for r in rows
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/access")
def record_access(
    body: AccessLogRecordBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    """员工访问后台前端路由时由客户端上报（SPA）。"""
    raw = (body.path or "").strip()[:512]
    if not raw.startswith("/"):
        raw = "/" + raw.lstrip()
    xff = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = xff or (request.client.host if request.client else "") or ""
    row = AccessLog(
        user_id=int(user.id),
        username=(user.username or "")[:80],
        role=(user.role or "")[:20],
        path=raw,
        ip=ip[:64],
    )
    db.add(row)
    db.commit()
    return {"ok": True}


@router.get("/access")
def list_access_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    username: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_primary_admin_account),
):
    query = db.query(AccessLog)
    if username and username.strip():
        query = query.filter(AccessLog.username == username.strip())
    dt_from = _parse_dt(date_from)
    dt_to = _parse_dt(date_to)
    if dt_from:
        query = query.filter(AccessLog.created_at >= dt_from)
    if dt_to:
        query = query.filter(AccessLog.created_at <= dt_to)
    total_count = query.count()
    rows = (
        query.order_by(desc(AccessLog.created_at), desc(AccessLog.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        {
            "id": r.id,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S")
            if r.created_at
            else None,
            "username": r.username,
            "role": r.role,
            "path": r.path,
            "ip": r.ip,
        }
        for r in rows
    ]
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
    }


@router.get("/sms")
def list_sms_send_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    phone: str | None = None,
    kind: str | None = None,
    purpose: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    query = db.query(SmsSendLog)
    if phone and phone.strip():
        query = query.filter(SmsSendLog.phone.contains(phone.strip()))
    if kind and kind.strip():
        query = query.filter(SmsSendLog.kind == kind.strip())
    if purpose and purpose.strip():
        query = query.filter(SmsSendLog.purpose == purpose.strip())
    if status and status.strip():
        query = query.filter(SmsSendLog.status == status.strip())
    dt_from = _parse_dt(date_from)
    dt_to = _parse_dt(date_to)
    if dt_from:
        query = query.filter(SmsSendLog.created_at >= dt_from)
    if dt_to:
        query = query.filter(SmsSendLog.created_at <= dt_to)
    total = query.count()
    rows = (
        query.order_by(desc(SmsSendLog.created_at), desc(SmsSendLog.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        {
            "id": r.id,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S")
            if r.created_at
            else None,
            "kind": r.kind,
            "purpose": r.purpose,
            "reservation_id": r.reservation_id,
            "phone": r.phone,
            "status": r.status,
            "reason": r.reason,
            "content": r.content,
            "provider_json": r.provider_json,
        }
        for r in rows
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }

