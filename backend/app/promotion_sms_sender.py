"""推广短信发送队列：按顺序逐条发送，间隔 2 秒。"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
from datetime import datetime

from sqlalchemy.orm import Session

from .database import SessionLocal
from .log_util import write_sms_send_log
from .models import PromotionSmsMessage, PromotionSmsQueueItem
from .sms_settings_util import (
    FIXED_SIGNATURE_PREFIX,
    effective_password_md5,
    effective_sp_id,
    get_or_create_sms_settings,
    normalize_sms_text,
)
from .sms_xinxinyun import send_sms_batch

logger = logging.getLogger(__name__)

PROMOTION_SEND_INTERVAL_SECONDS = 2
_PHONE_RE = re.compile(r"^1\d{10}$")

_worker_thread: threading.Thread | None = None
_worker_stop = threading.Event()
_worker_wake = threading.Event()


def normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D+", "", (raw or "").strip())
    if _PHONE_RE.fullmatch(digits):
        return digits
    return None


def finalize_promotion_content(body: str) -> str:
    t = re.sub(r"^【[^】]*】\s*", "", (body or "").strip())
    return normalize_sms_text(f"{FIXED_SIGNATURE_PREFIX}{t}")


def _md5_if_needed(raw: str) -> str:
    s = raw.strip()
    if re.fullmatch(r"[a-fA-F0-9]{32}", s, re.I):
        return s.lower()
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def _provider_error_reason(ret: dict) -> str | None:
    if ret.get("failed_data"):
        return "failed_data"
    code = ret.get("code")
    if code is None:
        return "missing_code"
    if str(code) != "0" and code != 0:
        return "code_not_zero"
    return None


def _refresh_message_counts(db: Session, msg: PromotionSmsMessage) -> None:
    sent = (
        db.query(PromotionSmsQueueItem)
        .filter(
            PromotionSmsQueueItem.message_id == msg.id,
            PromotionSmsQueueItem.status == "sent",
        )
        .count()
    )
    failed = (
        db.query(PromotionSmsQueueItem)
        .filter(
            PromotionSmsQueueItem.message_id == msg.id,
            PromotionSmsQueueItem.status == "failed",
        )
        .count()
    )
    pending = (
        db.query(PromotionSmsQueueItem)
        .filter(
            PromotionSmsQueueItem.message_id == msg.id,
            PromotionSmsQueueItem.status == "pending",
        )
        .count()
    )
    msg.sent_count = sent
    msg.failed_count = failed
    msg.pending_count = pending
    msg.updated_at = datetime.now()


def _send_one_item(db: Session, msg: PromotionSmsMessage, item: PromotionSmsQueueItem) -> None:
    row = get_or_create_sms_settings(db)
    content = finalize_promotion_content(msg.content)

    if not row.enabled:
        item.status = "failed"
        item.reason = "sms_disabled"
        item.sent_at = datetime.now()
        write_sms_send_log(
            db,
            kind="promotion",
            purpose="marketing",
            phone=item.phone,
            content=content,
            status="blocked",
            reason="sms_disabled",
        )
        return

    sp = effective_sp_id(db)
    pwd = effective_password_md5(db)
    if not sp or not pwd:
        item.status = "failed"
        item.reason = "sms_not_configured"
        item.sent_at = datetime.now()
        write_sms_send_log(
            db,
            kind="promotion",
            purpose="marketing",
            phone=item.phone,
            content=content,
            status="blocked",
            reason="sms_not_configured",
        )
        return

    try:
        ret = send_sms_batch(
            sp_id=sp,
            password_md5=_md5_if_needed(pwd),
            mobiles=item.phone,
            content=content,
            send_url=(row.send_url or "").strip() or None,
        )
        err = _provider_error_reason(ret)
        item.provider_json = json.dumps(ret, ensure_ascii=False, separators=(",", ":"))
        item.sent_at = datetime.now()
        if err:
            item.status = "failed"
            item.reason = err
            write_sms_send_log(
                db,
                kind="promotion",
                purpose="marketing",
                phone=item.phone,
                content=content,
                status="failed",
                reason=err,
                provider=ret,
            )
        else:
            item.status = "sent"
            item.reason = "ok"
            write_sms_send_log(
                db,
                kind="promotion",
                purpose="marketing",
                phone=item.phone,
                content=content,
                status="sent",
                reason="ok",
                provider=ret,
            )
    except Exception as e:
        logger.warning("推广短信发送异常: %s", e)
        item.status = "failed"
        item.reason = "exception"
        item.sent_at = datetime.now()
        item.provider_json = json.dumps({"error": str(e)}, ensure_ascii=False)
        write_sms_send_log(
            db,
            kind="promotion",
            purpose="marketing",
            phone=item.phone,
            content=content,
            status="failed",
            reason="exception",
            provider={"error": str(e)},
        )


def _process_next() -> bool:
    """处理下一条待发项，返回是否执行了发送。"""
    db: Session = SessionLocal()
    try:
        msg = (
            db.query(PromotionSmsMessage)
            .filter(PromotionSmsMessage.status.in_(["queued", "sending"]))
            .order_by(
                PromotionSmsMessage.started_at.asc().nullsfirst(),
                PromotionSmsMessage.id.asc(),
            )
            .first()
        )
        if not msg:
            return False

        if msg.status == "queued":
            msg.status = "sending"
            if msg.started_at is None:
                msg.started_at = datetime.now()
            msg.updated_at = datetime.now()
            db.commit()

        item = (
            db.query(PromotionSmsQueueItem)
            .filter(
                PromotionSmsQueueItem.message_id == msg.id,
                PromotionSmsQueueItem.status == "pending",
            )
            .order_by(PromotionSmsQueueItem.sort_order.asc(), PromotionSmsQueueItem.id.asc())
            .first()
        )
        if not item:
            msg.status = "completed"
            msg.completed_at = datetime.now()
            _refresh_message_counts(db, msg)
            db.commit()
            return True

        _send_one_item(db, msg, item)
        _refresh_message_counts(db, msg)
        db.commit()
        return True
    except Exception as e:
        logger.warning("推广短信队列处理异常: %s", e)
        db.rollback()
        return False
    finally:
        db.close()


def _worker_loop() -> None:
    while not _worker_stop.is_set():
        did_work = _process_next()
        if did_work:
            _worker_wake.wait(timeout=PROMOTION_SEND_INTERVAL_SECONDS)
            _worker_wake.clear()
        else:
            _worker_wake.wait(timeout=5.0)
            _worker_wake.clear()


def start_promotion_sms_worker() -> None:
    global _worker_thread
    if _worker_thread is not None and _worker_thread.is_alive():
        return
    _worker_stop.clear()
    _worker_thread = threading.Thread(target=_worker_loop, daemon=True, name="promotion-sms")
    _worker_thread.start()
    _worker_wake.set()


def stop_promotion_sms_worker() -> None:
    _worker_stop.set()
    _worker_wake.set()


def wake_promotion_sms_worker() -> None:
    _worker_wake.set()
