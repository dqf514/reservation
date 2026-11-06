from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginBody(BaseModel):
    username: str
    password: str


class LoginSmsBody(BaseModel):
    phone: str = Field(pattern=r"^1\d{10}$")
    code: str = Field(pattern=r"^\d{6}$")


class UserPublic(BaseModel):
    id: int
    username: str
    role: str
    full_name: str | None = None
    phone: str | None = None
    email: str | None = None


class ChangePasswordBody(BaseModel):
    old_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=6, max_length=200)


class SmsOtpSendBody(BaseModel):
    phone: str = Field(pattern=r"^1\d{10}$")
    purpose: str = Field(pattern=r"^(staff_login)$")


class UserProfileUpdateBody(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = None
    email: str | None = Field(default=None, max_length=120)


class BrandingPublic(BaseModel):
    company_name: str
    app_name: str
    logo_url: str | None
    favicon_url: str | None
    login_title: str
    login_subtitle: str
    login_bg_url: str | None
    login_primary_color: str
    login_accent_color: str
    login_card_opacity: float
    login_footer_text: str
    login_show_powered: bool
    splash_enabled: bool
    splash_image_url: str | None
    splash_seconds: float
    splash_for_customer: bool
    splash_for_staff: bool
    customer_hero_title: str
    customer_hero_subtitle: str
    customer_primary_color: str


class HomePromotionItem(BaseModel):
    title: str
    sub: str
    tone: str
    image_url: str | None = None


class HomePromotionAdminItem(HomePromotionItem):
    id: int
    enabled: bool
    sort_order: int


class HomePromotionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    sub: str = Field(min_length=1, max_length=200)
    tone: str = Field(min_length=1, max_length=120)
    image_filename: str | None = None
    sort_order: int = Field(default=0)
    enabled: bool = True


class HomePromotionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=60)
    sub: str | None = Field(default=None, min_length=1, max_length=200)
    tone: str | None = Field(default=None, min_length=1, max_length=120)
    image_filename: str | None = None
    sort_order: int | None = None
    enabled: bool | None = None


class HomeSummaryResponse(BaseModel):
    """顾客端首页汇总：活动文案 + 预订统计（统计来自真实预订表）。"""

    promotions: list[HomePromotionItem]
    reservations_today: int
    reservations_tomorrow: int


class SmsSettingsPublic(BaseModel):
    enabled: bool
    sp_id: str
    password_set: bool
    send_url: str
    balance_url: str
    notify_public_submit: bool
    notify_admin_create: bool
    notify_cancel: bool
    signature_prefix: str
    template_success: str
    template_cancel: str
    promotion_sms_max_recipients: int = 300
    promotion_sms_staff_max_recipients: int = 1


class SmsSettingsUpdate(BaseModel):
    enabled: bool | None = None
    sp_id: str | None = None
    password: str | None = None
    send_url: str | None = None
    balance_url: str | None = None
    notify_public_submit: bool | None = None
    notify_admin_create: bool | None = None
    notify_cancel: bool | None = None
    signature_prefix: str | None = None
    template_success: str | None = None
    template_cancel: str | None = None
    promotion_sms_max_recipients: int | None = Field(default=None, ge=1, le=10000)
    promotion_sms_staff_max_recipients: int | None = Field(default=None, ge=1, le=10000)


class PromotionSmsSendLimits(BaseModel):
    promotion_max_recipients: int
    staff_max_recipients: int


class SmsTestBody(BaseModel):
    phone: str = Field(pattern=r"^1\d{10}$")


class OnlineReservationSettingsPublic(BaseModel):
    enabled: bool


class OnlineReservationSettingsUpdate(BaseModel):
    enabled: bool


class FloorPolicySettingsPublic(BaseModel):
    lock_ttl_minutes: int
    auto_cancel_minutes: int
    walkin_block_before_minutes: int


class FloorPolicySettingsUpdate(BaseModel):
    lock_ttl_minutes: int = Field(ge=1, le=240)
    auto_cancel_minutes: int = Field(ge=0, le=720)
    walkin_block_before_minutes: int = Field(ge=0, le=240)


class NoteQuickOptionsUpdate(BaseModel):
    items: list[str] = Field(min_length=1, max_length=20)


class FloorLockBody(BaseModel):
    table_code: str = Field(min_length=1, max_length=32)


class FloorWalkinLeaveBody(BaseModel):
    """散客离席：房间可有多组散客，需指定要离席的那一组。"""

    table_code: str = Field(min_length=1, max_length=32)
    occupancy_id: int | None = None
    reservation_id: int | None = None


class FloorWalkinSeatBody(BaseModel):
    table_code: str = Field(min_length=1, max_length=32)
    reservation_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    party_size: int = Field(ge=1, le=99)
    note: str | None = None


class DiningTableItem(BaseModel):
    """餐位主数据（平面图坐标为相对百分比 0–100）。"""

    id: int
    code: str
    label: str
    shape: str
    pos_x: float
    pos_y: float
    pos_size: float
    sort_order: int
    capacity: int
    is_active: bool
    # standard=普通桌（一桌一单）；room=房间/包厢（同时段多组客人共享座位池）
    table_type: str = "standard"


class DiningTableCreate(BaseModel):
    code: str = Field(
        min_length=1,
        max_length=32,
        pattern=r"^[a-zA-Z0-9_-]{1,32}$",
    )
    label: str = Field(min_length=1, max_length=32)
    shape: str = Field(
        default="circle", pattern=r"^(circle|square|rect_h|rect_v)$"
    )
    pos_x: float = Field(default=50.0, ge=0, le=100)
    pos_y: float = Field(default=50.0, ge=0, le=100)
    pos_size: float = Field(default=10.0, ge=2, le=45)
    sort_order: int = Field(default=0, ge=-9999, le=9999)
    capacity: int = Field(default=4, ge=1, le=99)
    is_active: bool = True
    table_type: str = Field(default="standard", pattern=r"^(standard|room)$")


class DiningTableUpdate(BaseModel):
    code: str | None = Field(
        default=None,
        min_length=1,
        max_length=32,
        pattern=r"^[a-zA-Z0-9_-]{1,32}$",
    )
    label: str | None = Field(default=None, min_length=1, max_length=32)
    shape: str | None = Field(
        default=None, pattern=r"^(circle|square|rect_h|rect_v)$"
    )
    pos_x: float | None = Field(default=None, ge=0, le=100)
    pos_y: float | None = Field(default=None, ge=0, le=100)
    pos_size: float | None = Field(default=None, ge=2, le=45)
    sort_order: int | None = Field(default=None, ge=-9999, le=9999)
    capacity: int | None = Field(default=None, ge=1, le=99)
    is_active: bool | None = None
    table_type: str | None = Field(default=None, pattern=r"^(standard|room)$")


class BrandingUpdate(BaseModel):
    company_name: str | None = None
    app_name: str | None = None
    logo_path: str | None = None
    favicon_path: str | None = None
    login_title: str | None = None
    login_subtitle: str | None = None
    login_bg_path: str | None = None
    login_primary_color: str | None = None
    login_accent_color: str | None = None
    login_card_opacity: float | None = Field(default=None, ge=0.3, le=1)
    login_footer_text: str | None = None
    login_show_powered: bool | None = None
    splash_enabled: bool | None = None
    splash_image_path: str | None = None
    splash_seconds: float | None = Field(default=None, ge=0.5, le=12)
    splash_for_customer: bool | None = None
    splash_for_staff: bool | None = None
    customer_hero_title: str | None = None
    customer_hero_subtitle: str | None = None
    customer_primary_color: str | None = None


class ReservationCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(pattern=r"^1\d{10}$")
    reservation_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time_slot: str
    party_size: int = Field(ge=1, le=99)
    note: str | None = None


class ReservationMine(BaseModel):
    id: int
    reservation_date: str
    time_slot: str
    party_size: int
    flow_status: str
    note: str | None = None


class FloorSwapBody(BaseModel):
    reservation_date: str
    period: str
    table_code_a: str
    table_code_b: str


class AdminReservationPatch(BaseModel):
    flow_status: str | None = None
    assigned_table_code: str | None = None
    assigned_table_codes: list[str] | None = None
    customer_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )
    phone: str | None = None
    reservation_date: str | None = None
    time_slot: str | None = None
    party_size: int | None = Field(default=None, ge=1, le=99)
    note: str | None = None
    tags: str | None = None
    assigned_staff_name: str | None = Field(default=None, max_length=120)


class AdminReservationCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    phone: str | None = None
    reservation_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time_slot: str
    party_size: int = Field(ge=1, le=99)
    note: str | None = None
    send_sms: bool = False
    # 管理员新建默认直接「已确认」
    flow_status: str = "confirmed"
    tags: str = ""
    assigned_table_code: str | None = None
    assigned_table_codes: list[str] | None = None
    assigned_staff_name: str = Field(min_length=1, max_length=120)


class ReservationAdminItem(BaseModel):
    id: int
    customer_name: str
    phone: str
    reservation_date: str
    time_slot: str
    party_size: int
    note: str | None
    flow_status: str
    tags: str
    table_code: str | None
    table_label: str | None
    table_codes: list[str] = Field(default_factory=list)
    table_labels: list[str] = Field(default_factory=list)
    reservation_count: int | None = None
    created_at: str | None = None
    # 历史数据可能仅有此项（旧版按员工 id 存储）
    assigned_staff_id: int | None = None
    assigned_staff_name: str | None = None
    # 仅 /api/admin/todos 等待办接口填充：原因文案与高亮锚点（flow|tables|phone）
    todo_reasons: list[str] | None = None
    todo_highlight: str | None = None


class ReservationListResponse(BaseModel):
    items: list[ReservationAdminItem]
    total: int
    page: int
    page_size: int


class CustomerItem(BaseModel):
    id: int
    phone: str
    display_name: str
    last_seen_name: str = ""
    alias_names: list[str] = Field(default_factory=list)
    email: str | None
    tags: str
    note: str | None
    reservation_count: int = 0


class CustomerListResponse(BaseModel):
    items: list[CustomerItem]
    total: int
    page: int
    page_size: int


class CustomerProfileResponse(BaseModel):
    customer: CustomerItem | None
    phone: str
    reservation_count: int
    reservations: list[ReservationAdminItem]


class CustomerCreate(BaseModel):
    phone: str = Field(pattern=r"^1\d{10}$")
    display_name: str = ""
    email: str | None = None
    tags: str = ""
    note: str | None = None


class CustomerUpdate(BaseModel):
    display_name: str | None = None
    email: str | None = None
    tags: str | None = None
    note: str | None = None


class DepositItem(BaseModel):
    id: int
    reservation_id: int | None
    customer_phone: str
    amount_yuan: float
    status: str
    note: str | None
    paid_at: str | None
    created_at: str | None = None


class DepositListResponse(BaseModel):
    items: list[DepositItem]
    total: int
    page: int
    page_size: int


class DepositCreate(BaseModel):
    reservation_id: int | None = None
    customer_phone: str = Field(pattern=r"^1\d{10}$")
    amount_yuan: float = Field(gt=0, le=1_000_000)
    note: str | None = None


class DepositUpdate(BaseModel):
    status: str | None = None
    amount_yuan: float | None = Field(default=None, gt=0, le=1_000_000)
    note: str | None = None


class DashboardSummary(BaseModel):
    pending_confirm_reservations: int
    pending_deposits: int
    customers_total: int
    reservations_today: int


class CalendarPeriodCount(BaseModel):
    period_key: str
    label: str
    count: int = 0
    party: int = 0


class CalendarDayCount(BaseModel):
    date: str
    count: int
    party: int = 0
    by_period: list[CalendarPeriodCount] = Field(default_factory=list)


class CalendarTableTotal(BaseModel):
    """日历下拉用：某桌台在当前查看月份内的总量。"""

    table_code: str
    table_label: str
    table_type: str = "standard"
    count: int = 0
    party: int = 0


class CalendarMonthResponse(BaseModel):
    year: int
    month: int
    days: list[CalendarDayCount]
    month_total_count: int = 0
    month_total_party: int = 0
    # 按桌台统计时的过滤条件（None=全店）
    table_code: str | None = None
    table_label: str | None = None
    # 不受桌台过滤影响的全店本月总量（供下拉框「全部」项展示）
    all_month_total_count: int = 0
    all_month_total_party: int = 0
    # 各桌台本月总量（供下拉框展示总人数）
    table_totals: list[CalendarTableTotal] = Field(default_factory=list)


class CalendarMonthlyTrendItem(BaseModel):
    ym: str
    label: str
    count: int = 0
    party: int = 0


class CalendarMonthlyTrendResponse(BaseModel):
    items: list[CalendarMonthlyTrendItem] = Field(default_factory=list)
    # 按桌台统计时的过滤条件（None=全店）
    table_code: str | None = None
    table_label: str | None = None


class OperatingPeriodItemDTO(BaseModel):
    period_key: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=32)
    start_time: str
    end_time: str
    sort_order: int = 0
    color: str = Field(default="#e85d4c", min_length=4, max_length=20)
    icon: str = Field(default="餐", min_length=1, max_length=8)
    enabled: bool = True


class OperatingPeriodsPublic(BaseModel):
    periods: list[OperatingPeriodItemDTO]


class OperatingPeriodsUpdate(BaseModel):
    periods: list[OperatingPeriodItemDTO] = Field(min_length=2, max_length=8)


class UserListItem(BaseModel):
    id: int
    username: str
    role: str
    full_name: str | None = None
    phone: str | None = None
    email: str | None = None
    created_at: str | None = None


class AdminUserCreate(BaseModel):
    """仅可创建预订管理员账号（role=manager）。"""

    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=6, max_length=128)
    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = None
    email: str | None = Field(default=None, max_length=120)


class AdminUserPatch(BaseModel):
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role: str | None = Field(default=None, pattern=r"^(admin|manager)$")
    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = None
    email: str | None = Field(default=None, max_length=120)


class PromotionSmsRecipient(BaseModel):
    phone: str
    display_name: str = ""
    source: str = "manual"


class PromotionSmsMessageItem(BaseModel):
    id: int
    subject: str
    content: str
    status: str
    recipients: list[PromotionSmsRecipient] = Field(default_factory=list)
    filter_snapshot: dict | None = None
    created_by_username: str = ""
    total_recipients: int = 0
    sent_count: int = 0
    failed_count: int = 0
    pending_count: int = 0
    created_at: str
    updated_at: str
    started_at: str | None = None
    completed_at: str | None = None


class PromotionSmsMessageListResponse(BaseModel):
    items: list[PromotionSmsMessageItem]
    total: int
    page: int
    page_size: int


class PromotionSmsMessageCreate(BaseModel):
    subject: str = Field(default="", max_length=120)
    content: str = ""
    recipients: list[PromotionSmsRecipient] = Field(default_factory=list)
    filter_snapshot: dict | None = None


class PromotionSmsMessageUpdate(BaseModel):
    subject: str | None = Field(default=None, max_length=120)
    content: str | None = None
    recipients: list[PromotionSmsRecipient] | None = None
    filter_snapshot: dict | None = None


class PromotionSmsQueueItemOut(BaseModel):
    id: int
    phone: str
    display_name: str
    status: str
    reason: str = ""
    sent_at: str | None = None


class PromotionSmsQueueResponse(BaseModel):
    items: list[PromotionSmsQueueItemOut]
    total: int


class PromotionSmsRecipientSearchRequest(BaseModel):
    min_reservation_count: int | None = Field(default=None, ge=0)
    last_booking_after: str | None = None
    last_booking_before: str | None = None
    q: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=50)


class PromotionSmsRecipientCandidate(BaseModel):
    phone: str
    display_name: str
    reservation_count: int
    last_booking_date: str | None = None


class PromotionSmsRecipientSearchResponse(BaseModel):
    items: list[PromotionSmsRecipientCandidate]
    total: int
    page: int
    page_size: int
