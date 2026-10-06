from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from .models import OperationLog, SmsSendLog, User


def write_operation_log(
    db: Session,
    *,
    actor: User | None,
    category: str,
    action: str,
    entity: str,
    entity_id: str | int | None = None,
    detail: dict | list | str | None = None,
    ip: str | None = None,
) -> None:
    try:
        row = OperationLog(
            actor_user_id=int(actor.id) if actor else None,
            actor_username=(actor.username if actor else "") or "",
            actor_role=(actor.role if actor else "") or "",
            category=(category or "").strip(),
            action=(action or "").strip(),
            entity=(entity or "").strip(),
            entity_id=str(entity_id or ""),
            detail_json=(
                json.dumps(detail, ensure_ascii=False, separators=(",", ":"))
                if detail is not None
                else ""
            ),
            ip=(ip or "").strip(),
            created_at=datetime.now(),
        )
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()


def write_sms_send_log(
    db: Session,
    *,
    kind: str,
    purpose: str,
    phone: str,
    content: str,
    status: str,
    reason: str = "",
    reservation_id: int | None = None,
    provider: dict | list | str | None = None,
) -> None:
    try:
        row = SmsSendLog(
            kind=(kind or "").strip(),
            purpose=(purpose or "").strip(),
            reservation_id=reservation_id,
            phone=(phone or "").strip(),
            content=(content or "").strip(),
            status=(status or "").strip(),
            reason=(reason or "").strip(),
            provider_json=(
                json.dumps(provider, ensure_ascii=False, separators=(",", ":"))
                if provider is not None
                else ""
            ),
            created_at=datetime.now(),
        )
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()
