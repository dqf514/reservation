from datetime import datetime, timedelta
import hashlib
import random
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import SmsOtpCode, User
from ..schemas import (
    ChangePasswordBody,
    LoginSmsBody,
    LoginBody,
    SmsOtpSendBody,
    TokenResponse,
    UserProfileUpdateBody,
    UserPublic,
)
from ..security import create_access_token, hash_password, verify_password
from ..sms_settings_util import (
    FIXED_SIGNATURE_PREFIX,
    effective_password_md5,
    effective_sp_id,
    get_or_create_sms_settings,
)
from ..sms_xinxinyun import send_sms_batch
from ..user_schema_compat import ensure_user_profile_columns
from ..log_util import write_sms_send_log

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _md5_if_needed(raw: str) -> str:
    s = (raw or "").strip()
    if re.fullmatch(r"[a-fA-F0-9]{32}", s, re.I):
        return s.lower()
    return hashlib.md5(s.encode("utf-8")).hexdigest()


@router.post("/login", response_model=TokenResponse)
def login(body: LoginBody, db: Session = Depends(get_db)):
    ensure_user_profile_columns(db)
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    token = create_access_token(user.username, user.role)
    return TokenResponse(access_token=token)


@router.post("/login-sms", response_model=TokenResponse)
def login_sms(body: LoginSmsBody, db: Session = Depends(get_db)):
    ensure_user_profile_columns(db)
    now = datetime.now()
    phone = body.phone.strip()
    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        raise HTTPException(status_code=400, detail="手机号未绑定员工账号")
    row = (
        db.query(SmsOtpCode)
        .filter(
            SmsOtpCode.phone == phone,
            SmsOtpCode.purpose == "staff_login",
            SmsOtpCode.used_at.is_(None),
        )
        .order_by(SmsOtpCode.id.desc())
        .first()
    )
    if not row or row.code != body.code.strip() or row.expires_at < now:
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    row.used_at = now
    db.add(row)
    db.commit()
    token = create_access_token(user.username, user.role)
    return TokenResponse(access_token=token)


@router.post("/sms/send-code")
def send_sms_code(body: SmsOtpSendBody, db: Session = Depends(get_db)):
    ensure_user_profile_columns(db)
    phone = body.phone.strip()
    purpose = body.purpose.strip()
    now = datetime.now()
    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        raise HTTPException(status_code=400, detail="手机号未绑定员工账号")
    latest = (
        db.query(SmsOtpCode)
        .filter(
            SmsOtpCode.phone == phone,
            SmsOtpCode.purpose == purpose,
        )
        .order_by(SmsOtpCode.id.desc())
        .first()
    )
    if latest and (now - latest.created_at).total_seconds() < 60:
        wait = int(60 - (now - latest.created_at).total_seconds())
        write_sms_send_log(
            db,
            kind="login",
            purpose=purpose,
            phone=phone,
            content="",
            status="blocked",
            reason="cooldown",
            provider={"wait_seconds": max(wait, 1)},
        )
        raise HTTPException(
            status_code=429,
            detail=f"发送过于频繁，请 {max(wait, 1)} 秒后再试",
        )

    cfg = get_or_create_sms_settings(db)
    if not cfg.enabled:
        write_sms_send_log(
            db,
            kind="login",
            purpose=purpose,
            phone=phone,
            content="",
            status="blocked",
            reason="sms_disabled",
        )
        raise HTTPException(status_code=400, detail="短信功能未启用")
    sp = effective_sp_id(db)
    pwd = effective_password_md5(db)
    if not sp or not pwd:
        write_sms_send_log(
            db,
            kind="login",
            purpose=purpose,
            phone=phone,
            content="",
            status="blocked",
            reason="sms_not_configured",
        )
        raise HTTPException(status_code=400, detail="短信配置不完整")

    code = "".join(random.choice("0123456789") for _ in range(6))
    content = (
        f"{FIXED_SIGNATURE_PREFIX}员工登录验证码：{code}，5分钟内有效。"
        "如非本人操作请忽略。"
    )
    try:
        ret = send_sms_batch(
            sp_id=sp,
            password_md5=_md5_if_needed(pwd),
            mobiles=phone,
            content=content,
            send_url=(cfg.send_url or "").strip() or None,
        )
    except Exception as e:
        write_sms_send_log(
            db,
            kind="login",
            purpose=purpose,
            phone=phone,
            content=content,
            status="failed",
            reason="exception",
            provider={"error": str(e)},
        )
        raise HTTPException(
            status_code=502,
            detail=f"短信网关调用异常：{e}",
        ) from e
    if ret.get("failed_data"):
        write_sms_send_log(
            db,
            kind="login",
            purpose=purpose,
            phone=phone,
            content=content,
            status="failed",
            reason="failed_data",
            provider=ret,
        )
        raise HTTPException(status_code=502, detail="短信发送失败，请稍后重试")
    if str(ret.get("code")) != "0" and ret.get("code") != 0:
        write_sms_send_log(
            db,
            kind="login",
            purpose=purpose,
            phone=phone,
            content=content,
            status="failed",
            reason="code_not_zero",
            provider=ret,
        )
        raise HTTPException(status_code=502, detail="短信发送失败，请稍后重试")
    write_sms_send_log(
        db,
        kind="login",
        purpose=purpose,
        phone=phone,
        content=content,
        status="sent",
        reason="ok",
        provider=ret,
    )

    row = SmsOtpCode(
        phone=phone,
        purpose=purpose,
        code=code,
        expires_at=now + timedelta(minutes=5),
    )
    db.add(row)
    db.commit()
    return {"ok": True, "message": "验证码已发送"}


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)):
    return UserPublic(
        id=user.id,
        username=user.username,
        role=user.role,
        full_name=(user.full_name or "").strip() or None,
        phone=(user.phone or "").strip() or None,
        email=(user.email or "").strip() or None,
    )


@router.patch("/me/profile", response_model=UserPublic)
def patch_me_profile(
    body: UserProfileUpdateBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_user_profile_columns(db)
    data = body.model_dump(exclude_unset=True)
    if "full_name" in data:
        user.full_name = (data["full_name"] or "").strip() or None
    if "phone" in data:
        phone = (data["phone"] or "").strip()
        if phone and not re.match(r"^1\d{10}$", phone):
            raise HTTPException(status_code=400, detail="手机号格式不正确")
        user.phone = phone or None
    if "email" in data:
        email = (data["email"] or "").strip()
        user.email = email or None
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserPublic(
        id=user.id,
        username=user.username,
        role=user.role,
        full_name=(user.full_name or "").strip() or None,
        phone=(user.phone or "").strip() or None,
        email=(user.email or "").strip() or None,
    )


@router.post("/change-password")
def change_password(
    body: ChangePasswordBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="原密码不正确")
    user.password_hash = hash_password(body.new_password)
    db.add(user)
    db.commit()
    return {"ok": True}
