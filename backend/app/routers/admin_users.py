import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_super_admin
from ..models import User
from ..schemas import AdminUserCreate, AdminUserPatch, UserListItem
from ..security import hash_password
from ..user_schema_compat import ensure_user_profile_columns

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


def _count_super(db: Session) -> int:
    return db.query(User).filter(User.role == "admin").count()


def _item(u: User) -> UserListItem:
    return UserListItem(
        id=u.id,
        username=u.username,
        role=u.role,
        full_name=(u.full_name or "").strip() or None,
        phone=(u.phone or "").strip() or None,
        email=(u.email or "").strip() or None,
        created_at=(
            u.created_at.strftime("%Y-%m-%d %H:%M:%S")
            if u.created_at
            else None
        ),
    )


@router.get("", response_model=list[UserListItem])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    ensure_user_profile_columns(db)
    rows = db.query(User).order_by(User.id).all()
    return [_item(u) for u in rows]


@router.post("", response_model=UserListItem)
def create_user(
    body: AdminUserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    ensure_user_profile_columns(db)
    uname = body.username.strip()
    if db.query(User).filter(User.username == uname).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    phone = (body.phone or "").strip()
    if phone and not re.match(r"^1\d{10}$", phone):
        raise HTTPException(status_code=400, detail="手机号格式不正确")
    u = User(
        username=uname,
        password_hash=hash_password(body.password),
        role="manager",
        full_name=(body.full_name or "").strip() or None,
        phone=phone or None,
        email=(body.email or "").strip() or None,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return _item(u)


@router.patch("/{uid}", response_model=UserListItem)
def patch_user(
    uid: int,
    body: AdminUserPatch,
    db: Session = Depends(get_db),
    current: User = Depends(require_super_admin),
):
    ensure_user_profile_columns(db)
    u = db.get(User, uid)
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    data = body.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        u.password_hash = hash_password(data["password"])
    if "role" in data and data["role"] is not None:
        new_role = data["role"]
        if (
            new_role == "manager"
            and u.role == "admin"
            and _count_super(db) <= 1
        ):
            raise HTTPException(status_code=400, detail="不能将最后一个超级管理员降为预订管理员")
        u.role = new_role
    if "full_name" in data:
        u.full_name = (data["full_name"] or "").strip() or None
    if "phone" in data:
        phone = (data["phone"] or "").strip()
        if phone and not re.match(r"^1\d{10}$", phone):
            raise HTTPException(status_code=400, detail="手机号格式不正确")
        u.phone = phone or None
    if "email" in data:
        u.email = (data["email"] or "").strip() or None
    db.add(u)
    db.commit()
    db.refresh(u)
    return _item(u)


@router.delete("/{uid}")
def delete_user(
    uid: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_super_admin),
):
    ensure_user_profile_columns(db)
    u = db.get(User, uid)
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.id == current.id:
        raise HTTPException(status_code=400, detail="不能删除当前登录账号")
    if u.role == "admin" and _count_super(db) <= 1:
        raise HTTPException(status_code=400, detail="不能删除最后一个超级管理员")
    db.delete(u)
    db.commit()
    return {"ok": True}
