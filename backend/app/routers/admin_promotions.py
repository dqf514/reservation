from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_super_admin
from ..models import HomePromotion
from ..schemas import (
    HomePromotionAdminItem,
    HomePromotionCreate,
    HomePromotionUpdate,
)

router = APIRouter(prefix="/api/admin/promotions", tags=["admin-promotions"])


def _to_public(p: HomePromotion) -> HomePromotionAdminItem:
    return HomePromotionAdminItem(
        id=p.id,
        title=p.title,
        sub=p.sub,
        tone=p.tone,
        image_url=f"/uploads/{p.image_filename}" if p.image_filename else None,
        enabled=p.enabled,
        sort_order=p.sort_order,
    )


@router.get("", response_model=list[HomePromotionAdminItem])
def list_promotions(
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    rows = (
        db.query(HomePromotion)
        .order_by(HomePromotion.sort_order, HomePromotion.id)
        .all()
    )
    return [_to_public(p) for p in rows]


@router.post("", response_model=HomePromotionAdminItem)
def create_promotion(
    body: HomePromotionCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    p = HomePromotion(
        title=body.title.strip(),
        sub=body.sub.strip(),
        tone=body.tone.strip(),
        image_filename=body.image_filename,
        sort_order=body.sort_order,
        enabled=body.enabled,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_public(p)


@router.patch("/{pid}", response_model=HomePromotionAdminItem)
def patch_promotion(
    pid: int,
    body: HomePromotionUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    p = db.get(HomePromotion, pid)
    if not p:
        raise HTTPException(status_code=404, detail="活动不存在")
    data = body.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        p.title = data["title"].strip()
    if "sub" in data and data["sub"] is not None:
        p.sub = data["sub"].strip()
    if "tone" in data and data["tone"] is not None:
        p.tone = data["tone"].strip()
    if "image_filename" in data:
        p.image_filename = data["image_filename"]
    if "sort_order" in data and data["sort_order"] is not None:
        p.sort_order = int(data["sort_order"])
    if "enabled" in data and data["enabled"] is not None:
        p.enabled = bool(data["enabled"])

    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_public(p)


@router.delete("/{pid}")
def delete_promotion(
    pid: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_super_admin),
):
    p = db.get(HomePromotion, pid)
    if not p:
        raise HTTPException(status_code=404, detail="活动不存在")
    db.delete(p)
    db.commit()
    return {"ok": True}
