"""短信（欣欣云）配置：仅超级管理员。"""

from __future__ import annotations

import hashlib
import os
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_super_admin
from ..models import SmsSettings
from ..schemas import SmsSettingsPublic, SmsSettingsUpdate, SmsTestBody
from ..sms_settings_util import (
    DEFAULT_TEMPLATE_SUCCESS,
    FIXED_SIGNATURE_PREFIX,
    effective_promotion_sms_max_recipients,
    effective_promotion_sms_staff_max_recipients,
    get_or_create_sms_settings,
    normalize_sms_text,
)
from ..sms_xinxinyun import query_balance, send_sms_batch

router = APIRouter(prefix="/api/admin/sms-settings", tags=["sms-settings"])
_LEADING_SIGNATURE_RE = re.compile(r"^\s*【[^】]+】")


def _strip_leading_signature(text: str | None) -> str:
    return _LEADING_SIGNATURE_RE.sub("", (text or "").strip(), count=1).strip()


def _build_test_content(row: SmsSettings) -> str:
    template = _strip_leading_signature(row.template_success)
    if not template:
        template = _strip_leading_signature(DEFAULT_TEMPLATE_SUCCESS)
    sample = {
        "name": "测试用户",
        "date": "2099-12-31",
        "time": "18:30",
        "party": "2",
        "id": "999999",
        "table": "测试桌（T01）",
    }

    class _SafeDict(dict):
        def __missing__(self, key: str) -> str:
            return ""

    rendered = template.format_map(_SafeDict(sample)).strip()
    return f"{FIXED_SIGNATURE_PREFIX}{rendered}"


def _build_basic_test_content() -> str:
    # 基础连通性文案：尽量简短、纯中文，降低运营商策略拦截概率
    return (
        f"{FIXED_SIGNATURE_PREFIX}这是一条门店短信连通性测试消息，"
        "若非本人操作请忽略。"
    )


def _md5_store(raw: str) -> str:
    s = raw.strip()
    if re.fullmatch(r"[a-fA-F0-9]{32}", s, re.I):
        return s.lower()
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def _to_public(row: SmsSettings, db: Session) -> SmsSettingsPublic:
    env_pwd = bool(os.environ.get("SMS_XINXINYUN_PASSWORD_MD5", "").strip())
    pwd_set = bool((row.password_md5 or "").strip()) or env_pwd
    return SmsSettingsPublic(
        enabled=row.enabled,
        sp_id=row.sp_id or "",
        password_set=pwd_set,
        send_url=(
            row.send_url or "https://sms.shxinxinyun.com/api/send-sms-batch"
        ),
        balance_url=(
            row.balance_url or "https://sms.shxinxinyun.com/api/balance"
        ),
        notify_public_submit=row.notify_public_submit,
        notify_admin_create=row.notify_admin_create,
        notify_cancel=row.notify_cancel,
        signature_prefix=FIXED_SIGNATURE_PREFIX,
        template_success=_strip_leading_signature(row.template_success),
        template_cancel=_strip_leading_signature(row.template_cancel),
        promotion_sms_max_recipients=effective_promotion_sms_max_recipients(db),
        promotion_sms_staff_max_recipients=effective_promotion_sms_staff_max_recipients(db),
    )


@router.get("", response_model=SmsSettingsPublic)
def get_sms_settings(
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    row = get_or_create_sms_settings(db)
    return _to_public(row, db)


@router.put("", response_model=SmsSettingsPublic)
def put_sms_settings(
    body: SmsSettingsUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    row = get_or_create_sms_settings(db)
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        pwd = data.pop("password")
        if pwd is not None and str(pwd).strip():
            row.password_md5 = _md5_store(str(pwd))
    # 签名前缀已固定，忽略外部修改，避免报备签名被误改
    data.pop("signature_prefix", None)
    template_success = data.get("template_success")
    if isinstance(template_success, str) and _LEADING_SIGNATURE_RE.match(
        template_success
    ):
        raise HTTPException(
            status_code=400,
            detail="成功短信模板不要填写签名，系统会自动加上【音昱上海】",
        )
    template_cancel = data.get("template_cancel")
    if isinstance(template_cancel, str) and _LEADING_SIGNATURE_RE.match(
        template_cancel
    ):
        raise HTTPException(
            status_code=400,
            detail="取消短信模板不要填写签名，系统会自动加上【音昱上海】",
        )
    for k, v in data.items():
        setattr(row, k, v)
    if "promotion_sms_max_recipients" in data or "promotion_sms_staff_max_recipients" in data:
        promo_raw = int(getattr(row, "promotion_sms_max_recipients", 0) or 0)
        staff_raw = int(getattr(row, "promotion_sms_staff_max_recipients", 0) or 0)
        if promo_raw < 1:
            raise HTTPException(status_code=400, detail="推广短信收件人上限至少为 1")
        if promo_raw > 10000:
            raise HTTPException(status_code=400, detail="推广短信收件人上限不能超过 10000")
        if staff_raw < 1:
            raise HTTPException(status_code=400, detail="普通预订人员收件人上限至少为 1")
        if staff_raw > promo_raw:
            raise HTTPException(
                status_code=400,
                detail="普通预订人员收件人上限不能大于推广短信收件人上限",
            )
        row.promotion_sms_max_recipients = promo_raw
        row.promotion_sms_staff_max_recipients = staff_raw
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_public(row, db)


@router.post("/test")
def test_sms(
    body: SmsTestBody,
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    row = get_or_create_sms_settings(db)
    sp = (row.sp_id or "").strip() or os.environ.get(
        "SMS_XINXINYUN_SP_ID", ""
    ).strip()
    pwd = (row.password_md5 or "").strip() or os.environ.get(
        "SMS_XINXINYUN_PASSWORD_MD5", ""
    ).strip()
    if not sp or not pwd:
        raise HTTPException(status_code=400, detail="请先配置 sp_id 与接口密码（或环境变量）")
    # 使用当前“预订提交成功模板”发送测试短信，便于验证模板内容与签名合规性。
    content = normalize_sms_text(_build_test_content(row))
    try:
        ret = send_sms_batch(
            sp_id=sp,
            password_md5=_md5_store(pwd),
            mobiles=body.phone.strip(),
            content=content,
            send_url=(row.send_url or "").strip() or None,
        )
    except Exception as e:
        return {
            "ok": False,
            "message": "短信网关调用异常",
            "result": {
                "reason": "exception",
                "error": str(e),
                "content": content,
            },
        }

    # 运营商接口有时会返回 code=0 但 failed_data 里包含失败原因
    code = ret.get("code")
    failed_data = ret.get("failed_data")
    if failed_data:
        return {
            "ok": False,
            "message": "短信投递失败（运营商返回 failed_data）",
            "result": {
                "reason": "failed_data",
                "code": code,
                "provider": ret,
                "content": content,
            },
        }
    if str(code) != "0" and code != 0:
        return {
            "ok": False,
            "message": "短信接口返回失败状态",
            "result": {
                "reason": "code_not_zero",
                "code": code,
                "provider": ret,
                "content": content,
            },
        }
    return {
        "ok": True,
        "message": "测试短信已提交",
        "result": {"provider": ret, "content": content},
    }


@router.post("/test-basic")
def test_sms_basic(
    body: SmsTestBody,
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    row = get_or_create_sms_settings(db)
    sp = (row.sp_id or "").strip() or os.environ.get(
        "SMS_XINXINYUN_SP_ID", ""
    ).strip()
    pwd = (row.password_md5 or "").strip() or os.environ.get(
        "SMS_XINXINYUN_PASSWORD_MD5", ""
    ).strip()
    if not sp or not pwd:
        raise HTTPException(status_code=400, detail="请先配置 sp_id 与接口密码（或环境变量）")
    content = normalize_sms_text(_build_basic_test_content())
    try:
        ret = send_sms_batch(
            sp_id=sp,
            password_md5=_md5_store(pwd),
            mobiles=body.phone.strip(),
            content=content,
            send_url=(row.send_url or "").strip() or None,
        )
    except Exception as e:
        return {
            "ok": False,
            "message": "短信网关调用异常",
            "result": {
                "reason": "exception",
                "error": str(e),
                "content": content,
            },
        }

    code = ret.get("code")
    failed_data = ret.get("failed_data")
    if failed_data:
        return {
            "ok": False,
            "message": "短信投递失败（运营商返回 failed_data）",
            "result": {
                "reason": "failed_data",
                "code": code,
                "provider": ret,
                "content": content,
            },
        }
    if str(code) != "0" and code != 0:
        return {
            "ok": False,
            "message": "短信接口返回失败状态",
            "result": {
                "reason": "code_not_zero",
                "code": code,
                "provider": ret,
                "content": content,
            },
        }
    return {
        "ok": True,
        "message": "基础连通性短信已提交",
        "result": {"provider": ret, "content": content},
    }


@router.get("/balance")
def balance_sms(
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    row = get_or_create_sms_settings(db)
    sp = (row.sp_id or "").strip() or os.environ.get(
        "SMS_XINXINYUN_SP_ID", ""
    ).strip()
    pwd = (row.password_md5 or "").strip() or os.environ.get(
        "SMS_XINXINYUN_PASSWORD_MD5", ""
    ).strip()
    if not sp or not pwd:
        raise HTTPException(status_code=400, detail="请先配置 sp_id 与接口密码（或环境变量）")
    try:
        ret = query_balance(
            sp_id=sp,
            password_md5=_md5_store(pwd),
            balance_url=(row.balance_url or "").strip() or None,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"ok": True, "provider": ret}
