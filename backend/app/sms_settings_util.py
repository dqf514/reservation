"""短信配置（单门店单行 id=1）。"""

from __future__ import annotations

import os
import re

from sqlalchemy.orm import Session

from .models import SmsSettings

DEFAULT_PROMOTION_SMS_MAX_RECIPIENTS = 300
DEFAULT_PROMOTION_SMS_STAFF_MAX_RECIPIENTS = 1

FIXED_SIGNATURE_PREFIX = "【音昱上海】"

DEFAULT_TEMPLATE_SUCCESS = (
    "尊敬的{name}，您的预订已确认：{date} {time}，{party}位。"
    "预订编号{id}。桌台：{table}。如需变更请致电门店，感谢您的理解与配合。"
)

DEFAULT_TEMPLATE_CANCEL = (
    "尊敬的{name}，您于{date} {time}的预订（编号{id}）已取消。"
    "如需重新预订请通过线上渠道或致电门店，感谢您的理解与配合。"
)


def get_or_create_sms_settings(db: Session) -> SmsSettings:
    from .sms_settings_schema_compat import ensure_sms_settings_promotion_columns

    ensure_sms_settings_promotion_columns(db)
    row = db.get(SmsSettings, 1)
    if row:
        return row
    row = SmsSettings(id=1)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def effective_sp_id(db: Session) -> str:
    row = get_or_create_sms_settings(db)
    return (row.sp_id or "").strip() or os.environ.get(
        "SMS_XINXINYUN_SP_ID", ""
    ).strip()


def effective_password_md5(db: Session) -> str:
    row = get_or_create_sms_settings(db)
    return (row.password_md5 or "").strip() or os.environ.get(
        "SMS_XINXINYUN_PASSWORD_MD5", ""
    ).strip()


def sanitize_sms_gateway_words(content: str) -> str:
    """网关敏感词：「小姐」易被拦截，发送前替换为「女士」（如 张小姐→张女士）。"""
    return (content or "").replace("小姐", "女士")


def normalize_sms_text(content: str | None, *, max_len: int = 180) -> str:
    """
    发送前统一清洗：保留换行（\\n），合并行内多余空白；超长截断。
    历史上曾将换行压成单行以降低运营商策略风险；若模板需要多行展示，应保留换行。
    """
    c = (content or "").replace("\r\n", "\n").replace("\r", "\n")
    lines: list[str] = []
    for line in c.split("\n"):
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            lines.append(line)
    out = sanitize_sms_gateway_words("\n".join(lines))
    if len(out) <= max_len:
        return out
    return out[:max_len]


SMS_MAX_TEXT_LEN = 180


def normalized_sms_len(content: str | None) -> int:
    """规范化后的字数（截断前，与 normalize_sms_text 一致）。"""
    c = (content or "").replace("\r\n", "\n").replace("\r", "\n")
    lines: list[str] = []
    for line in c.split("\n"):
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            lines.append(line)
    return len(sanitize_sms_gateway_words("\n".join(lines)))


def assert_sms_text_within_limit(
    content: str | None,
    *,
    max_len: int = SMS_MAX_TEXT_LEN,
) -> None:
    n = normalized_sms_len(content)
    if n > max_len:
        raise ValueError(f"短信内容不能超过 {max_len} 字（含签名），当前 {n} 字")


def effective_promotion_sms_max_recipients(db: Session) -> int:
    row = get_or_create_sms_settings(db)
    raw = int(getattr(row, "promotion_sms_max_recipients", 0) or 0)
    if raw < 1:
        raw = DEFAULT_PROMOTION_SMS_MAX_RECIPIENTS
    return min(raw, 10000)


def effective_promotion_sms_staff_max_recipients(db: Session) -> int:
    row = get_or_create_sms_settings(db)
    promo_max = effective_promotion_sms_max_recipients(db)
    raw = int(getattr(row, "promotion_sms_staff_max_recipients", 0) or 0)
    if raw < 1:
        raw = DEFAULT_PROMOTION_SMS_STAFF_MAX_RECIPIENTS
    return min(raw, promo_max)
