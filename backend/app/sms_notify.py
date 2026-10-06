"""预订相关短信：成功提交、取消（失败不影响主流程）。"""

from __future__ import annotations

import hashlib
import logging
import re
import threading
import time
from collections import defaultdict
from typing import Any, Literal

from sqlalchemy.orm import Session, joinedload

from .database import SessionLocal
from .floor_logic import TERMINAL
from .models import Reservation
from .models import DiningTable
from .reservation_tables_util import parse_assigned_table_ids
from .sms_settings_util import (
    DEFAULT_TEMPLATE_CANCEL,
    DEFAULT_TEMPLATE_SUCCESS,
    FIXED_SIGNATURE_PREFIX,
    effective_password_md5,
    effective_sp_id,
    get_or_create_sms_settings,
    normalize_sms_text,
)
from .sms_xinxinyun import send_sms_batch
from .log_util import write_sms_send_log

logger = logging.getLogger(__name__)

Source = Literal["public", "admin"]
_SMS_RATE_LIMIT_WINDOW_SECONDS = 60
_SMS_RATE_LIMIT_MAX_PER_WINDOW = 1
_SMS_RATE_LIMIT_RETRY_DELAY_SECONDS = 60
_sms_rate_limit_lock = threading.Lock()
# 成功 / 取消分用途限流；同一用途下按手机号分桶（避免全站每分钟只能发一条误伤多桌）
_sms_send_timestamps: dict[str, list[float]] = defaultdict(list)
_sms_retry_lock = threading.Lock()
_sms_retry_pending_keys: set[str] = set()

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
_PHONE_DIGITS_RE = re.compile(r"\D+")


def _rate_limit_key(
    purpose: Literal["reservation_success", "reservation_cancel"],
    phone: str,
) -> str:
    """按用途 + 手机号分桶，避免全站 60 秒内只能发一条（多桌台/多员工误伤）。"""
    digits = _PHONE_DIGITS_RE.sub("", (phone or "").strip())
    return f"{purpose}:{digits or '*'}"



def _md5_if_needed(raw: str) -> str:
    s = raw.strip()
    if re.fullmatch(r"[a-fA-F0-9]{32}", s, re.I):
        return s.lower()
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def _table_label(r: Reservation) -> str:
    table_ids = parse_assigned_table_ids(r)
    if not table_ids:
        return "待定"
    rows = (
        r._sa_instance_state.session.query(DiningTable.label, DiningTable.code)
        .filter(DiningTable.id.in_(table_ids))
        .all()
        if r._sa_instance_state.session is not None
        else []
    )
    if not rows:
        return "待定"
    return "、".join(f"{label}（{code}）" for label, code in rows)


def _ctx(r: Reservation) -> dict[str, str]:
    return {
        "name": r.customer_name.strip(),
        "date": r.reservation_date,
        "time": r.time_slot.strip(),
        "party": str(r.party_size),
        "id": str(r.id),
        "table": _table_label(r),
    }


def _render(tpl: str, r: Reservation) -> str:
    ctx = _ctx(r)
    placeholders = _PLACEHOLDER_RE.findall(tpl)
    missing = [p for p in placeholders if p not in ctx]
    if missing:
        # 运营商侧会校验参数格式，若模板中残留 {xxx} 可能触发参数校验错误
        logger.warning("短信模板存在未识别占位符，将置空：%s", sorted(set(missing)))

    class _SafeDict(dict):
        def __missing__(self, key: str) -> str:
            return ""

    return tpl.format_map(_SafeDict(ctx))


def _finalize_content(row_template: str, default_tpl: str) -> str:
    t = ((row_template or "").strip() or default_tpl).strip()

    # 强制固定签名，模板正文仅允许写内容，不允许带签名前缀。
    t = re.sub(r"^【[^】]*】\s*", "", t)
    return f"{FIXED_SIGNATURE_PREFIX}{t}"


def _acquire_sms_send_quota(
    purpose: Literal["reservation_success", "reservation_cancel"] = "reservation_success",
    *,
    phone: str = "",
) -> tuple[bool, int]:
    """按用途 + 手机号节流：同一号码同一用途 60 秒内最多 1 条。返回(是否可发, 需等待秒数)。"""
    key = _rate_limit_key(purpose, phone)
    now = time.time()
    with _sms_rate_limit_lock:
        alive = [
            ts
            for ts in _sms_send_timestamps[key]
            if now - ts < _SMS_RATE_LIMIT_WINDOW_SECONDS
        ]
        if len(alive) >= _SMS_RATE_LIMIT_MAX_PER_WINDOW:
            elapsed = now - alive[0]
            wait_seconds = int(_SMS_RATE_LIMIT_WINDOW_SECONDS - elapsed)
            return False, max(wait_seconds, 1)
        alive.append(now)
        _sms_send_timestamps[key] = alive
        return True, 0


def _provider_error_reason(ret: dict[str, Any]) -> str | None:
    """
    若运营商响应表示未成功受理/投递，返回原因标签（与短信设置页测试逻辑一致：先 failed_data，再 code）。
    成功则返回 None。
    """
    if ret.get("failed_data"):
        return "failed_data"
    code = ret.get("code")
    if code is None:
        return "missing_code"
    if str(code) != "0" and code != 0:
        return "code_not_zero"
    return None


def _queue_key(
    purpose: Literal["reservation_success", "reservation_cancel"],
    reservation_id: int,
) -> str:
    return f"{purpose}:{int(reservation_id)}"


def _deferred_send_sms(
    *,
    purpose: Literal["reservation_success", "reservation_cancel"],
    reservation_id: int,
    phone: str,
    content: str,
) -> None:
    db: Session = SessionLocal()
    try:
        row = get_or_create_sms_settings(db)
        if not row.enabled:
            write_sms_send_log(
                db,
                kind="reservation",
                purpose=purpose,
                phone=phone,
                content=content,
                status="blocked",
                reason="sms_disabled_deferred",
                reservation_id=reservation_id,
            )
            return
        sp = effective_sp_id(db)
        pwd = effective_password_md5(db)
        if not sp or not pwd:
            write_sms_send_log(
                db,
                kind="reservation",
                purpose=purpose,
                phone=phone,
                content=content,
                status="blocked",
                reason="sms_not_configured_deferred",
                reservation_id=reservation_id,
            )
            return
        ret = send_sms_batch(
            sp_id=sp,
            password_md5=_md5_if_needed(pwd),
            mobiles=phone,
            content=content,
            send_url=(row.send_url or "").strip() or None,
        )
        err = _provider_error_reason(ret)
        if err:
            write_sms_send_log(
                db,
                kind="reservation",
                purpose=purpose,
                phone=phone,
                content=content,
                status="failed",
                reason=f"{err}_deferred",
                reservation_id=reservation_id,
                provider=ret,
            )
            return
        write_sms_send_log(
            db,
            kind="reservation",
            purpose=purpose,
            phone=phone,
            content=content,
            status="sent",
            reason="ok_deferred",
            reservation_id=reservation_id,
            provider=ret,
        )
    except Exception as e:
        logger.warning("延迟短信发送异常: %s", e)
        write_sms_send_log(
            db,
            kind="reservation",
            purpose=purpose,
            phone=phone,
            content=content,
            status="failed",
            reason="exception_deferred",
            reservation_id=reservation_id,
            provider={"error": str(e)},
        )
    finally:
        db.close()
        with _sms_retry_lock:
            _sms_retry_pending_keys.discard(_queue_key(purpose, reservation_id))


def _enqueue_deferred_sms(
    *,
    purpose: Literal["reservation_success", "reservation_cancel"],
    reservation_id: int,
    phone: str,
    content: str,
) -> bool:
    key = _queue_key(purpose, reservation_id)
    with _sms_retry_lock:
        if key in _sms_retry_pending_keys:
            return False
        _sms_retry_pending_keys.add(key)

    db: Session = SessionLocal()
    try:
        write_sms_send_log(
            db,
            kind="reservation",
            purpose=purpose,
            phone=phone,
            content=content,
            status="queued",
            reason="rate_limited_deferred",
            reservation_id=reservation_id,
            provider={"delay_seconds": _SMS_RATE_LIMIT_RETRY_DELAY_SECONDS},
        )
    finally:
        db.close()
    timer = threading.Timer(
        _SMS_RATE_LIMIT_RETRY_DELAY_SECONDS,
        _deferred_send_sms,
        kwargs={
            "purpose": purpose,
            "reservation_id": reservation_id,
            "phone": phone,
            "content": content,
        },
    )
    timer.daemon = True
    timer.start()
    return True


def notify_reservation_submitted(
    db: Session, reservation_id: int, source: Source
) -> dict[str, object] | None:
    row = get_or_create_sms_settings(db)
    if not row.enabled:
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_success",
            phone="",
            content="",
            status="blocked",
            reason="sms_disabled",
            reservation_id=reservation_id,
        )
        return {"sent": False, "reason": "sms_disabled"}
    if source == "public" and not row.notify_public_submit:
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_success",
            phone="",
            content="",
            status="blocked",
            reason="notify_public_disabled",
            reservation_id=reservation_id,
        )
        return {"sent": False, "reason": "notify_public_disabled"}
    if source == "admin" and not row.notify_admin_create:
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_success",
            phone="",
            content="",
            status="blocked",
            reason="notify_admin_disabled",
            reservation_id=reservation_id,
        )
        return {"sent": False, "reason": "notify_admin_disabled"}
    sp = effective_sp_id(db)
    pwd = effective_password_md5(db)
    if not sp or not pwd:
        logger.info("短信未配置：请在后台填写 sp_id 与接口密码，或设置环境变量")
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_success",
            phone="",
            content="",
            status="blocked",
            reason="sms_not_configured",
            reservation_id=reservation_id,
        )
        return {"sent": False, "reason": "sms_not_configured"}

    r = (
        db.query(Reservation)
        .options(joinedload(Reservation.table))
        .filter(Reservation.id == reservation_id)
        .first()
    )
    if not r:
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_success",
            phone="",
            content="",
            status="blocked",
            reason="reservation_not_found",
            reservation_id=reservation_id,
        )
        return {"sent": False, "reason": "reservation_not_found"}
    if not (r.phone or "").strip():
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_success",
            phone="",
            content="",
            status="blocked",
            reason="phone_empty",
            reservation_id=reservation_id,
        )
        return {"sent": False, "reason": "phone_empty"}
    if r.flow_status in TERMINAL:
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_success",
            phone=r.phone.strip(),
            content="",
            status="blocked",
            reason="terminal_state",
            reservation_id=reservation_id,
        )
        return {"sent": False, "reason": "terminal_state"}

    tpl = _finalize_content(row.template_success, DEFAULT_TEMPLATE_SUCCESS)
    content = normalize_sms_text(_render(tpl, r))
    ok_to_send, wait_seconds = _acquire_sms_send_quota(
        "reservation_success", phone=r.phone.strip()
    )
    if not ok_to_send:
        logger.warning("预订成功短信触发限流，已入队延迟发送（约 %s 秒）", wait_seconds)
        queued = _enqueue_deferred_sms(
            purpose="reservation_success",
            reservation_id=reservation_id,
            phone=r.phone.strip(),
            content=content,
        )
        return {
            "sent": queued,
            "queued": queued,
            "reason": "queued_due_to_rate_limit",
            "wait_seconds": _SMS_RATE_LIMIT_RETRY_DELAY_SECONDS,
        }
    try:
        ret = send_sms_batch(
            sp_id=sp,
            password_md5=_md5_if_needed(pwd),
            mobiles=r.phone.strip(),
            content=content,
            send_url=(row.send_url or "").strip() or None,
        )
        err = _provider_error_reason(ret)
        code = ret.get("code")
        if err:
            logger.warning("预订成功短信未通过运营商校验（%s）：%s", err, ret)
            write_sms_send_log(
                db,
                kind="reservation",
                purpose="reservation_success",
                phone=r.phone.strip(),
                content=content,
                status="failed",
                reason=err,
                reservation_id=reservation_id,
                provider=ret,
            )
            return {
                "sent": False,
                "reason": err,
                "code": code,
                "provider": ret,
            }
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_success",
            phone=r.phone.strip(),
            content=content,
            status="sent",
            reason="ok",
            reservation_id=reservation_id,
            provider=ret,
        )
        return {"sent": True, "reason": "ok", "code": code, "provider": ret}
    except Exception as e:
        logger.warning("预订成功短信异常: %s", e)
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_success",
            phone=r.phone.strip(),
            content=content,
            status="failed",
            reason="exception",
            reservation_id=reservation_id,
            provider={"error": str(e)},
        )
        return {"sent": False, "reason": "exception", "error": str(e)}


def notify_reservation_cancelled(
    db: Session, reservation: Reservation
) -> dict[str, object] | None:
    """
    取消/删除预订时通知顾客。行为与 notify_reservation_submitted 对齐：尽早写短信日志、返回原因便于排查。
    失败原因常见：notify_cancel 关闭、模板未在运营商报备、failed_data、code 非 0（见 provider 日志）。
    """
    row = get_or_create_sms_settings(db)
    rid = int(reservation.id)
    phone_early = (reservation.phone or "").strip()

    def _blocked(reason: str, content: str = "") -> dict[str, object]:
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_cancel",
            phone=phone_early,
            content=content,
            status="blocked",
            reason=reason,
            reservation_id=rid,
        )
        return {"sent": False, "reason": reason}

    if not row.enabled:
        return _blocked("sms_disabled")
    if not row.notify_cancel:
        return _blocked("notify_cancel_disabled")

    sp = effective_sp_id(db)
    pwd = effective_password_md5(db)
    if not sp or not pwd:
        logger.info("取消短信未发送：请在后台填写 sp_id 与接口密码，或设置环境变量")
        return _blocked("sms_not_configured")

    r = (
        db.query(Reservation)
        .options(joinedload(Reservation.table))
        .filter(Reservation.id == rid)
        .first()
    )
    if not r:
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_cancel",
            phone=phone_early,
            content="",
            status="blocked",
            reason="reservation_not_found",
            reservation_id=rid,
        )
        return {"sent": False, "reason": "reservation_not_found"}
    if not (r.phone or "").strip():
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_cancel",
            phone="",
            content="",
            status="blocked",
            reason="phone_empty",
            reservation_id=rid,
        )
        return {"sent": False, "reason": "phone_empty"}

    tpl = _finalize_content(row.template_cancel, DEFAULT_TEMPLATE_CANCEL)
    content = normalize_sms_text(_render(tpl, r))
    ok_to_send, wait_seconds = _acquire_sms_send_quota(
        "reservation_cancel", phone=r.phone.strip()
    )
    if not ok_to_send:
        logger.warning("预订取消短信触发限流，已入队延迟发送（约 %s 秒）", wait_seconds)
        queued = _enqueue_deferred_sms(
            purpose="reservation_cancel",
            reservation_id=r.id,
            phone=r.phone.strip(),
            content=content,
        )
        return {
            "sent": queued,
            "queued": queued,
            "reason": "queued_due_to_rate_limit",
            "wait_seconds": _SMS_RATE_LIMIT_RETRY_DELAY_SECONDS,
        }
    try:
        ret = send_sms_batch(
            sp_id=sp,
            password_md5=_md5_if_needed(pwd),
            mobiles=r.phone.strip(),
            content=content,
            send_url=(row.send_url or "").strip() or None,
        )
        err = _provider_error_reason(ret)
        code = ret.get("code")
        if err:
            logger.warning("取消通知短信未通过运营商校验（%s）：%s", err, ret)
            write_sms_send_log(
                db,
                kind="reservation",
                purpose="reservation_cancel",
                phone=r.phone.strip(),
                content=content,
                status="failed",
                reason=err,
                reservation_id=r.id,
                provider=ret,
            )
            return {
                "sent": False,
                "reason": err,
                "code": code,
                "provider": ret,
            }
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_cancel",
            phone=r.phone.strip(),
            content=content,
            status="sent",
            reason="ok",
            reservation_id=r.id,
            provider=ret,
        )
        return {"sent": True, "reason": "ok", "code": code, "provider": ret}
    except Exception as e:
        logger.warning("取消通知短信异常: %s", e)
        write_sms_send_log(
            db,
            kind="reservation",
            purpose="reservation_cancel",
            phone=r.phone.strip(),
            content=content,
            status="failed",
            reason="exception",
            reservation_id=r.id,
            provider={"error": str(e)},
        )
        return {"sent": False, "reason": "exception", "error": str(e)}
