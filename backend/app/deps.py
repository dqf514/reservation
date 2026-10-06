from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_token
from .customer_schema_compat import ensure_customer_alias_columns
from .user_schema_compat import ensure_user_profile_columns

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    ensure_user_profile_columns(db)
    ensure_customer_alias_columns(db)
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="未登录或令牌无效")
    payload = decode_token(creds.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="未登录或令牌无效")
    username = str(payload["sub"])
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


ROLE_SUPER = "admin"
ROLE_MANAGER = "manager"


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    """超级管理员：系统与品牌、运营时段、上传、维护、员工账号等。"""
    if user.role != ROLE_SUPER:
        raise HTTPException(status_code=403, detail="需要超级管理员权限")
    return user


def require_staff(user: User = Depends(get_current_user)) -> User:
    """员工：超级管理员 + 预订管理员（日常预订与桌台业务）。"""
    if user.role not in (ROLE_SUPER, ROLE_MANAGER):
        raise HTTPException(status_code=403, detail="需要员工权限")
    return user


# 兼容旧命名：仅超级管理员
require_admin = require_super_admin


def require_data_management_user(
    user: User = Depends(require_super_admin),
) -> User:
    """数据管理（备份/导入/清空等）：仅允许登录名为 admin 的账号。"""
    if (user.username or "").strip().lower() != "admin":
        raise HTTPException(status_code=403, detail="数据管理仅允许指定账号使用")
    return user


def require_primary_admin_account(
    user: User = Depends(require_super_admin),
) -> User:
    """审计类能力（如访问日志查询）：仅允许登录名为 admin 的主账号。"""
    if (user.username or "").strip().lower() != "admin":
        raise HTTPException(status_code=403, detail="仅主管理员账号可查看访问日志")
    return user
