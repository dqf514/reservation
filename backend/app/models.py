from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="admin")
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
    )


class SmsOtpCode(Base):
    __tablename__ = "sms_otp_codes"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    phone: Mapped[str] = mapped_column(String(32), index=True)
    purpose: Mapped[str] = mapped_column(String(32), index=True)
    code: Mapped[str] = mapped_column(String(6))
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        index=True,
    )


class BrandingSettings(Base):
    """单门店品牌与登录/启动页配置（单行 id=1）"""

    __tablename__ = "branding_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    company_name: Mapped[str] = mapped_column(String(200), default="")
    app_name: Mapped[str] = mapped_column(String(200), default="TFF")
    logo_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    favicon_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    login_title: Mapped[str] = mapped_column(String(200), default="员工登录")
    login_subtitle: Mapped[str] = mapped_column(
        String(500),
        default="请使用管理员账号登录后台",
    )
    login_bg_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    login_primary_color: Mapped[str] = mapped_column(
        String(20),
        default="#1c1917",
    )
    login_accent_color: Mapped[str] = mapped_column(
        String(20),
        default="#e85d4c",
    )
    login_card_opacity: Mapped[float] = mapped_column(Float, default=0.92)
    login_footer_text: Mapped[str] = mapped_column(
        String(500),
        default="© 本地部署 · 数据存储于 SQLite",
    )
    login_show_powered: Mapped[bool] = mapped_column(Boolean, default=True)

    splash_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    splash_image_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    splash_seconds: Mapped[float] = mapped_column(Float, default=2.5)
    splash_for_customer: Mapped[bool] = mapped_column(Boolean, default=True)
    splash_for_staff: Mapped[bool] = mapped_column(Boolean, default=True)

    customer_hero_title: Mapped[str] = mapped_column(
        String(300),
        default="今晚，为您留一盏灯",
    )
    customer_hero_subtitle: Mapped[str] = mapped_column(
        String(500),
        default="主厨推荐 · 本地时令食材",
    )
    customer_primary_color: Mapped[str] = mapped_column(
        String(20),
        default="#e85d4c",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class DiningTable(Base):
    __tablename__ = "dining_tables"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(32))
    shape: Mapped[str] = mapped_column(String(16), default="circle")
    pos_x: Mapped[float] = mapped_column(Float)
    pos_y: Mapped[float] = mapped_column(Float)
    pos_size: Mapped[float] = mapped_column(Float)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    capacity: Mapped[int] = mapped_column(Integer, default=4)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # standard=普通桌（同时段一桌一单，独占）；room=房间/包厢（同时段多组客人共享座位池）
    table_type: Mapped[str] = mapped_column(
        String(16),
        default="standard",
        index=True,
    )

    reservations: Mapped[list["Reservation"]] = relationship(
        back_populates="table",
    )


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    customer_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(32), index=True)
    reservation_date: Mapped[str] = mapped_column(String(10), index=True)
    time_slot: Mapped[str] = mapped_column(String(8))
    party_size: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    flow_status: Mapped[str] = mapped_column(
        String(32),
        default="waiting",
        index=True,
    )
    # 预订来源：public=顾客自主预订，admin=管理员后台录入
    booking_source: Mapped[str] = mapped_column(String(20), default="admin")
    tags: Mapped[str] = mapped_column(String(300), default="")
    # 多桌台分配（CSV: "1,3,8"），兼容旧字段 assigned_table_id（首桌镜像）
    assigned_table_ids: Mapped[str] = mapped_column(String(500), default="")
    assigned_table_id: Mapped[int | None] = mapped_column(
        ForeignKey("dining_tables.id"),
        nullable=True,
    )
    # 接单人（历史：员工账号 id；新数据请用 assigned_staff_name）
    assigned_staff_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    # 接单人姓名（自由文本，可与员工账号无关）
    assigned_staff_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    table: Mapped["DiningTable | None"] = relationship(
        back_populates="reservations",
    )
    deposits: Mapped[list["Deposit"]] = relationship(
        back_populates="reservation",
        cascade="all, delete-orphan",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class Customer(Base):
    """门店客户档案（按手机号唯一）"""

    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120), default="")
    # 最近一次在预订中出现的姓名（用于识别“同号不同名”）
    last_seen_name: Mapped[str] = mapped_column(String(120), default="")
    # 历史别名（JSON array），用于展示与搜索提示
    alias_names_json: Mapped[str] = mapped_column(Text, default="")
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tags: Mapped[str] = mapped_column(String(300), default="")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class Deposit(Base):
    """订金记录（可关联预订）"""

    __tablename__ = "deposits"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    reservation_id: Mapped[int | None] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    customer_phone: Mapped[str] = mapped_column(String(32), index=True)
    amount_yuan: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        index=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
    )

    reservation: Mapped["Reservation | None"] = relationship(
        back_populates="deposits",
    )


class OperatingPeriodItem(Base):
    """自定义运营时段列表（可增删改，不交叉）。"""

    __tablename__ = "operating_period_items"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    period_key: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(32), default="时段")
    start_time: Mapped[str] = mapped_column(String(5), default="11:00")
    end_time: Mapped[str] = mapped_column(String(5), default="14:00")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(20), default="#e85d4c")
    icon: Mapped[str] = mapped_column(String(8), default="餐")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class HomePromotion(Base):
    """顾客端首页“门店活动”卡片内容（超级管理员可编辑）。"""

    __tablename__ = "home_promotions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    title: Mapped[str] = mapped_column(String(60))
    sub: Mapped[str] = mapped_column(String(200))
    tone: Mapped[str] = mapped_column(
        String(120),
        default="from-amber-700/90 to-orange-600/85",
    )
    # 存储上传后的文件名（filename），对外通过 /uploads/<filename> 访问
    image_filename: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class SmsSettings(Base):
    """欣欣云短信（单门店单行 id=1）。密钥可用环境变量 SMS_XINXINYUN_* 覆盖。"""

    __tablename__ = "sms_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    sp_id: Mapped[str] = mapped_column(String(32), default="")
    password_md5: Mapped[str] = mapped_column(String(64), default="")
    send_url: Mapped[str] = mapped_column(
        String(500),
        default="https://sms.shxinxinyun.com/api/send-sms-batch",
    )
    balance_url: Mapped[str] = mapped_column(
        String(500),
        default="https://sms.shxinxinyun.com/api/balance",
    )
    notify_public_submit: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_admin_create: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_cancel: Mapped[bool] = mapped_column(Boolean, default=True)
    signature_prefix: Mapped[str] = mapped_column(String(32), default="【音昱上海】")
    template_success: Mapped[str] = mapped_column(Text, default="")
    template_cancel: Mapped[str] = mapped_column(Text, default="")
    promotion_sms_max_recipients: Mapped[int] = mapped_column(Integer, default=300)
    promotion_sms_staff_max_recipients: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class OnlineReservationSettings(Base):
    """网上预约通道开关（单行 id=1）。"""

    __tablename__ = "online_reservation_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class NoteQuickOptionsSettings(Base):
    """备注快捷备选项（全店共享，单行 id=1）。"""

    __tablename__ = "note_quick_options_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    options_json: Mapped[str] = mapped_column(Text, default="[]")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class FloorPolicySettings(Base):
    """桌台与现场策略配置（单行 id=1）。"""

    __tablename__ = "floor_policy_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    lock_ttl_minutes: Mapped[int] = mapped_column(Integer, default=5)
    auto_cancel_minutes: Mapped[int] = mapped_column(
        Integer,
        default=60,
    )
    walkin_block_before_minutes: Mapped[int] = mapped_column(Integer, default=60)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class TableLock(Base):
    """桌台锁定（同员工可操作，管理员可覆盖；可手动释放）。"""

    __tablename__ = "table_locks"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    table_id: Mapped[int] = mapped_column(
        ForeignKey("dining_tables.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    locked_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    locked_by_username: Mapped[str] = mapped_column(String(80), default="")
    lock_until: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class TableOccupancy(Base):
    """散客入席记录（与预订独立）。"""

    __tablename__ = "table_occupancies"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    table_id: Mapped[int] = mapped_column(
        ForeignKey("dining_tables.id", ondelete="CASCADE"),
        index=True,
    )
    business_date: Mapped[str] = mapped_column(String(10), index=True)
    time_slot: Mapped[str] = mapped_column(String(8))
    party_size: Mapped[int] = mapped_column(Integer, default=1)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="seated", index=True)
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    created_by_username: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )
    actor_username: Mapped[str] = mapped_column(
        String(80),
        default="",
        index=True,
    )
    actor_role: Mapped[str] = mapped_column(String(20), default="", index=True)
    category: Mapped[str] = mapped_column(String(40), default="", index=True)
    action: Mapped[str] = mapped_column(String(40), default="", index=True)
    entity: Mapped[str] = mapped_column(String(40), default="", index=True)
    entity_id: Mapped[str] = mapped_column(String(60), default="", index=True)
    detail_json: Mapped[str] = mapped_column(Text, default="")
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        index=True,
    )


class PromotionSmsMessage(Base):
    """推广短信（草稿 / 发件队列 / 已发送）。"""

    __tablename__ = "promotion_sms_messages"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    subject: Mapped[str] = mapped_column(String(120), default="", index=True)
    content: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(
        String(20),
        default="draft",
        index=True,
    )
    recipients_json: Mapped[str] = mapped_column(Text, default="[]")
    filter_snapshot_json: Mapped[str] = mapped_column(Text, default="")
    created_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )
    created_by_username: Mapped[str] = mapped_column(String(80), default="")
    total_recipients: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    pending_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    queue_items: Mapped[list["PromotionSmsQueueItem"]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
    )


class PromotionSmsQueueItem(Base):
    """推广短信发送队列（逐条排队，间隔 2 秒）。"""

    __tablename__ = "promotion_sms_queue_items"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    message_id: Mapped[int] = mapped_column(
        ForeignKey("promotion_sms_messages.id", ondelete="CASCADE"),
        index=True,
    )
    phone: Mapped[str] = mapped_column(String(32), index=True)
    display_name: Mapped[str] = mapped_column(String(120), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        index=True,
    )
    reason: Mapped[str] = mapped_column(String(80), default="")
    provider_json: Mapped[str] = mapped_column(Text, default="")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
    )

    message: Mapped["PromotionSmsMessage"] = relationship(
        back_populates="queue_items",
    )


class SmsSendLog(Base):
    __tablename__ = "sms_send_logs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    purpose: Mapped[str] = mapped_column(String(40), default="", index=True)
    kind: Mapped[str] = mapped_column(String(20), default="", index=True)
    reservation_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )
    phone: Mapped[str] = mapped_column(String(32), default="", index=True)
    content: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="", index=True)
    reason: Mapped[str] = mapped_column(String(80), default="", index=True)
    provider_json: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        index=True,
    )


class AccessLog(Base):
    """后台路由访问记录（由前端上报 SPA 路径）。"""

    __tablename__ = "access_logs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    username: Mapped[str] = mapped_column(String(80), index=True)
    role: Mapped[str] = mapped_column(String(20), default="", index=True)
    path: Mapped[str] = mapped_column(String(512), default="", index=True)
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        index=True,
    )


class BackupPlanSettings(Base):
    __tablename__ = "backup_plan_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    daily_time_hm: Mapped[str] = mapped_column(String(5), default="03:00")
    keep_last: Mapped[int] = mapped_column(Integer, default=30)
    last_run_date: Mapped[str] = mapped_column(String(10), default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )
