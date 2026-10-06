"""启动时初始化：管理员、品牌、餐位与演示预订。

餐位（dining_tables）为唯一数据源：桌台平面图、餐位管理、预订分配下拉均读同一张表，无单独「假数据」。
仅当某表为空时写入；要应用新版餐位布局需清空该表（或删除 SQLite 后重启）再跑种子。
"""

from __future__ import annotations

import json
import os
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from .customer_util import backfill_customers_from_reservations
from .database import SessionLocal, engine, Base
from .models import (
    BrandingSettings,
    OnlineReservationSettings,
    FloorPolicySettings,
    NoteQuickOptionsSettings,
    Deposit,
    DiningTable,
    HomePromotion,
    OperatingPeriodItem,
    Reservation,
    SmsSettings,
    User,
)
from .security import hash_password
from .demo_content import HOME_PROMOTIONS
from .note_quick_options_util import DEFAULT_NOTE_QUICK_OPTIONS
from .sms_settings_schema_compat import ensure_sms_settings_promotion_columns
from .sms_settings_util import DEFAULT_TEMPLATE_CANCEL, DEFAULT_TEMPLATE_SUCCESS

# 餐位演示数据：与「餐位管理」「桌台平面图」同一表 dining_tables；code 固定以便下方演示预订关联
# 元组：code, 展示名, pos_x%, pos_y%, pos_size%, shape, 容纳人数
TABLE_SEED: list[tuple[str, str, float, float, float, str, int]] = [
    # —— 临窗散台（北侧）——
    ("t1", "临窗①", 12.0, 14.0, 11.5, "circle", 4),
    ("t2", "临窗②", 26.0, 12.0, 11.0, "circle", 4),
    ("t3", "临窗③", 40.0, 16.0, 12.0, "square", 4),
    ("t4", "临窗④", 54.0, 11.0, 11.0, "circle", 4),
    ("t5", "临窗⑤", 68.0, 15.0, 11.5, "circle", 4),
    # —— 大厅中部 ——
    ("t6", "大厅A", 18.0, 38.0, 12.0, "square", 4),
    ("t7", "大厅B", 36.0, 34.0, 11.0, "circle", 4),
    ("t8", "大厅C", 52.0, 30.0, 12.5, "square", 4),
    ("t9", "大厅D", 66.0, 36.0, 11.0, "circle", 4),
    ("t10", "大厅E", 78.0, 32.0, 11.0, "circle", 4),
    # —— 卡座 / 靠墙 ——
    ("t11", "卡座甲", 14.0, 54.0, 11.0, "circle", 4),
    ("t12", "卡座乙", 30.0, 52.0, 13.0, "square", 8),
    ("t13", "靠墙①", 48.0, 56.0, 11.0, "square", 4),
    ("t14", "靠墙②", 62.0, 54.0, 12.0, "circle", 4),
    ("t15", "靠墙③", 76.0, 58.0, 11.5, "circle", 4),
    # —— 内侧 / 长桌 ——
    ("t16", "长桌①", 22.0, 72.0, 11.0, "square", 6),
    ("t17", "长桌②", 42.0, 70.0, 11.0, "circle", 4),
    ("t18", "长桌③", 58.0, 74.0, 11.0, "circle", 4),
    ("t19", "长桌④", 74.0, 72.0, 12.0, "square", 4),
    # —— 右侧包厢区（靠墙一列）——
    ("v1", "包厢·梅", 90.0, 10.0, 14.0, "square", 8),
    ("v2", "包厢·兰", 90.0, 30.0, 13.0, "square", 6),
    ("v3", "包厢·竹", 90.0, 48.0, 14.0, "square", 8),
    ("v4", "包厢·菊", 90.0, 66.0, 13.0, "square", 6),
    # v5 停用：模拟维护/翻台
    ("v5", "维护暂闭", 8.0, 88.0, 12.0, "square", 4),
    ("v6", "露台间", 28.0, 90.0, 14.0, "square", 8),
]


def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _tomorrow() -> str:
    from datetime import timedelta

    return (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")


def _add_demo_deposits(db: Session, today: str) -> None:
    """与预订手机号、日期一致，供待办/订金页联调；同一桌台同一时段仅一条有效预订。"""
    if db.query(Deposit).count() > 0:
        return
    specs: list[tuple[str, str, float, str]] = [
        # 待确认 + 待付订金
        ("13800001003", today, 200.0, "pending"),
        # 已确认 + 已收订金
        ("13800001002", today, 500.0, "paid"),
        # 晚餐待确认 + 待付
        ("13800001010", today, 100.0, "pending"),
    ]
    for phone, day, amount, status in specs:
        r = db.query(Reservation).filter(Reservation.phone == phone, Reservation.reservation_date == day).first()
        if not r:
            continue
        paid_at = None
        if status == "paid":
            paid_at = datetime.now().replace(microsecond=0)
        db.add(
            Deposit(
                reservation_id=r.id,
                customer_phone=phone,
                amount_yuan=amount,
                status=status,
                note="演示订金（与预订关联）",
                paid_at=paid_at,
            )
        )
    db.commit()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def run_seed() -> None:
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        ensure_sms_settings_promotion_columns(db)

        # 默认不再自动灌入演示数据；仅当显式开启时才写入。
        demo_enabled = _env_bool("SEED_DEMO_DATA", False)

        if db.query(User).count() == 0:
            db.add(
                User(
                    username="admin",
                    password_hash=hash_password("admin123"),
                    role="admin",
                )
            )
            db.commit()

        if db.query(BrandingSettings).count() == 0:
            db.add(
                BrandingSettings(
                    id=1,
                    company_name="TFF 演示门店",
                    app_name="TFF",
                    login_title="员工登录",
                    login_subtitle="请使用管理员账号登录后台管理系统",
                    customer_hero_title="今晚，为您留一盏灯",
                    customer_hero_subtitle="主厨推荐 · 本地时令食材",
                )
            )
            db.commit()

        if db.query(OperatingPeriodItem).count() == 0:
            db.add_all(
                [
                    OperatingPeriodItem(
                        period_key="lunch",
                        label="午餐",
                        start_time="11:00",
                        end_time="14:30",
                        sort_order=0,
                        color="#f97316",
                        icon="午",
                        enabled=True,
                    ),
                    OperatingPeriodItem(
                        period_key="afternoon",
                        label="下午茶",
                        start_time="14:30",
                        end_time="17:00",
                        sort_order=1,
                        color="#f59e0b",
                        icon="茶",
                        enabled=True,
                    ),
                    OperatingPeriodItem(
                        period_key="dinner",
                        label="晚餐",
                        start_time="17:00",
                        end_time="22:00",
                        sort_order=2,
                        color="#ef4444",
                        icon="晚",
                        enabled=True,
                    ),
                ]
            )
            db.commit()

        if demo_enabled and db.query(HomePromotion).count() == 0:
            for i, x in enumerate(HOME_PROMOTIONS):
                db.add(
                    HomePromotion(
                        title=x["title"],
                        sub=x["sub"],
                        tone=x["tone"],
                        image_filename=None,
                        sort_order=i,
                        enabled=True,
                    )
                )
            db.commit()

        if db.query(SmsSettings).count() == 0:
            db.add(
                SmsSettings(
                    id=1,
                    template_success=DEFAULT_TEMPLATE_SUCCESS,
                    template_cancel=DEFAULT_TEMPLATE_CANCEL,
                )
            )
            db.commit()

        if db.query(OnlineReservationSettings).count() == 0:
            db.add(OnlineReservationSettings(id=1, enabled=True))
            db.commit()

        if db.query(FloorPolicySettings).count() == 0:
            db.add(
                FloorPolicySettings(
                    id=1,
                    lock_ttl_minutes=5,
                    auto_cancel_minutes=60,
                    walkin_block_before_minutes=60,
                )
            )
            db.commit()

        if db.query(NoteQuickOptionsSettings).count() == 0:
            db.add(
                NoteQuickOptionsSettings(
                    id=1,
                    options_json=json.dumps(
                        DEFAULT_NOTE_QUICK_OPTIONS,
                        ensure_ascii=False,
                    ),
                )
            )
            db.commit()

        if db.query(DiningTable).count() == 0:
            for i, (code, label, x, y, size, shape, cap) in enumerate(TABLE_SEED):
                db.add(
                    DiningTable(
                        code=code,
                        label=label,
                        pos_x=x,
                        pos_y=y,
                        pos_size=size,
                        shape=shape,
                        sort_order=i,
                        capacity=cap,
                        is_active=code != "v5",
                    )
                )
            db.commit()

        # 轻量迁移：给旧库补 reservation.booking_source 字段
        try:
            if db.bind and db.bind.dialect.name == "sqlite":
                cols = db.execute(text("PRAGMA table_info(reservations)")).fetchall()
                names = {str(x[1]) for x in cols}
                if "booking_source" not in names:
                    db.execute(
                        text(
                            "ALTER TABLE reservations "
                            "ADD COLUMN booking_source VARCHAR(20) DEFAULT 'admin'"
                        )
                    )
                    db.commit()
            else:
                db.execute(
                    text(
                        "ALTER TABLE reservations "
                        "ADD COLUMN IF NOT EXISTS booking_source VARCHAR(20) DEFAULT 'admin'"
                    )
                )
                db.commit()
            db.execute(
                text(
                    "UPDATE reservations SET booking_source='admin' "
                    "WHERE booking_source IS NULL OR TRIM(booking_source)=''"
                )
            )
            db.commit()
        except Exception:
            db.rollback()

        if demo_enabled and db.query(Reservation).count() == 0:
            day = _today()
            nxt = _tomorrow()
            code_to_id = {t.code: t.id for t in db.query(DiningTable).all()}

            def tid(code: str | None) -> int | None:
                return code_to_id.get(code) if code else None

            # 时段：午餐 11:00–14:30、下午茶 14:30–17:00、晚餐 17:00–22:00；每桌每时段最多一条有效预订
            samples: list[dict] = [
                # —— 今日午餐 ——
                {
                    "customer_name": "张先生",
                    "phone": "13800001001",
                    "reservation_date": day,
                    "time_slot": "12:30",
                    "party_size": 4,
                    "flow_status": "waiting",
                    "tags": "K,M",
                    "table": "t3",
                },
                {
                    "customer_name": "李女士",
                    "phone": "13800001002",
                    "reservation_date": day,
                    "time_slot": "12:00",
                    "party_size": 6,
                    "flow_status": "waiting",
                    "tags": "P,G",
                    "table": "v1",
                },
                {
                    "customer_name": "王女士",
                    "phone": "13800001003",
                    "reservation_date": day,
                    "time_slot": "12:45",
                    "party_size": 4,
                    "flow_status": "waiting",
                    "tags": "M",
                    "table": "t8",
                },
                {
                    "customer_name": "陈先生",
                    "phone": "13800001004",
                    "reservation_date": day,
                    "time_slot": "13:00",
                    "party_size": 2,
                    "flow_status": "waiting",
                    "tags": "K",
                    "table": "t15",
                },
                {
                    "customer_name": "刘女士",
                    "phone": "13800001005",
                    "reservation_date": day,
                    "time_slot": "12:15",
                    "party_size": 3,
                    "flow_status": "arrived",
                    "tags": "",
                    "table": "t6",
                },
                {
                    "customer_name": "团体预订",
                    "phone": "13800001006",
                    "reservation_date": day,
                    "time_slot": "12:10",
                    "party_size": 12,
                    "flow_status": "seated",
                    "tags": "G",
                    "table": "t12",
                },
                {
                    "customer_name": "赵先生",
                    "phone": "13800001007",
                    "reservation_date": day,
                    "time_slot": "11:50",
                    "party_size": 2,
                    "flow_status": "left",
                    "tags": "",
                    "table": "v2",
                },
                # —— 今日晚餐 ——
                {
                    "customer_name": "孙先生",
                    "phone": "13800001008",
                    "reservation_date": day,
                    "time_slot": "18:30",
                    "party_size": 2,
                    "flow_status": "waiting",
                    "tags": "",
                    "table": "t4",
                },
                {
                    "customer_name": "周先生",
                    "phone": "13800001009",
                    "reservation_date": day,
                    "time_slot": "19:00",
                    "party_size": 6,
                    "flow_status": "arrived",
                    "tags": "K",
                    "table": "t5",
                },
                {
                    "customer_name": "吴女士",
                    "phone": "13800001010",
                    "reservation_date": day,
                    "time_slot": "19:30",
                    "party_size": 4,
                    "flow_status": "waiting",
                    "tags": "M",
                    "table": "t7",
                },
                # —— 终态（不占桌台展示）——
                {
                    "customer_name": "郑女士",
                    "phone": "13800001020",
                    "reservation_date": day,
                    "time_slot": "12:00",
                    "party_size": 2,
                    "flow_status": "noshow",
                    "tags": "",
                    "table": None,
                },
                {
                    "customer_name": "冯先生",
                    "phone": "13800001021",
                    "reservation_date": day,
                    "time_slot": "13:30",
                    "party_size": 4,
                    "flow_status": "cancelled",
                    "tags": "M",
                    "table": None,
                },
                # —— 明日（日历 / 明日统计）——
                {
                    "customer_name": "钱女士",
                    "phone": "13800001011",
                    "reservation_date": nxt,
                    "time_slot": "12:00",
                    "party_size": 4,
                    "flow_status": "waiting",
                    "tags": "K",
                    "table": "t1",
                },
                {
                    "customer_name": "蒋先生",
                    "phone": "13800001012",
                    "reservation_date": nxt,
                    "time_slot": "18:00",
                    "party_size": 2,
                    "flow_status": "waiting",
                    "tags": "",
                    "table": "t2",
                },
                {
                    "customer_name": "沈女士",
                    "phone": "13800001013",
                    "reservation_date": nxt,
                    "time_slot": "13:00",
                    "party_size": 5,
                    "flow_status": "waiting",
                    "tags": "P",
                    "table": "t9",
                },
                {
                    "customer_name": "韩先生",
                    "phone": "13800001014",
                    "reservation_date": nxt,
                    "time_slot": "16:00",
                    "party_size": 3,
                    "flow_status": "waiting",
                    "tags": "",
                    "table": "t10",
                },
            ]
            for s in samples:
                db.add(
                    Reservation(
                        customer_name=s["customer_name"],
                        phone=s["phone"],
                        reservation_date=s["reservation_date"],
                        time_slot=s["time_slot"],
                        party_size=s["party_size"],
                        note=None,
                        flow_status=s["flow_status"],
                        tags=s["tags"],
                        assigned_table_id=tid(s.get("table")),
                    )
                )
            db.commit()

            _add_demo_deposits(db, day)

        # 历史版本品牌名迁移（旧库仍为 Tablera 时改为 TFF）
        b = db.query(BrandingSettings).filter(BrandingSettings.id == 1).first()
        if b and (b.app_name or "").strip() == "Tablera":
            b.app_name = "TFF"
            db.commit()

        try:
            backfill_customers_from_reservations(db)
        except Exception:
            pass
    finally:
        db.close()
