from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..demo_content import HOME_PROMOTIONS
from ..models import HomePromotion, Reservation
from ..schemas import HomePromotionItem, HomeSummaryResponse

router = APIRouter(tags=["home"])


@router.get("/api/home/summary", response_model=HomeSummaryResponse)
def home_summary(db: Session = Depends(get_db)):
    """公开接口：首页活动卡片文案 + 今明两日预订单数（与后台/我的预订同源）。"""
    today = datetime.now().strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    r_today = (
        db.query(func.count(Reservation.id))
        .filter(Reservation.reservation_date == today)
        .scalar()
        or 0
    )
    r_tomorrow = (
        db.query(func.count(Reservation.id))
        .filter(Reservation.reservation_date == tomorrow)
        .scalar()
        or 0
    )
    promos = (
        db.query(HomePromotion)
        .filter(HomePromotion.enabled == True)  # noqa: E712
        .order_by(HomePromotion.sort_order, HomePromotion.id)
        .all()
    )

    if not promos:
        # 兼容旧版本：当数据库尚无记录时，回退到演示内容
        promo_items = [HomePromotionItem(**x) for x in HOME_PROMOTIONS]
    else:
        promo_items = [
            HomePromotionItem(
                title=p.title,
                sub=p.sub,
                tone=p.tone,
                image_url=(
                    f"/uploads/{p.image_filename}"
                    if p.image_filename
                    else None
                ),
            )
            for p in promos
        ]

    return HomeSummaryResponse(
        promotions=promo_items,
        reservations_today=int(r_today),
        reservations_tomorrow=int(r_tomorrow),
    )
