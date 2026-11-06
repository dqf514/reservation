import re
from calendar import monthrange
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import require_staff
from ..floor_logic import TERMINAL
from ..models import Customer, Deposit, DiningTable, Reservation, TableOccupancy, User
from ..reservation_tables_util import parse_assigned_table_ids, parse_table_ids_csv
from ..operating_period_util import list_operating_periods
from ..periods import period_key_for_periods_list
from ..reservation_schema_compat import (
    ensure_assigned_staff_id_column,
    ensure_assigned_staff_name_column,
    ensure_assigned_table_ids_column,
)
from ..schemas import (
    CalendarDayCount,
    CalendarMonthResponse,
    CalendarMonthlyTrendItem,
    CalendarMonthlyTrendResponse,
    CalendarPeriodCount,
    DashboardSummary,
    DepositItem,
    ReservationAdminItem,
)

router = APIRouter(prefix="/api/admin", tags=["admin-dashboard"])

_PHONE_OK = re.compile(r"^1\d{10}$")

# 日历：今日及过去计实际到店（含离席、散客）；未来计有效预订（不含取消/爽约/离席）
_CALENDAR_ACTUAL_STATUSES = ("waiting", "confirmed", "arrived", "left")


def _calendar_count_status_filter(today: str):
    terminal = tuple(TERMINAL)
    return or_(
        and_(
            Reservation.reservation_date <= today,
            Reservation.flow_status.in_(_CALENDAR_ACTUAL_STATUSES),
        ),
        and_(
            Reservation.reservation_date > today,
            Reservation.flow_status.notin_(terminal),
        ),
    )


def _resolve_table_filter(db: Session, table_code: str | None) -> tuple[int | None, str | None]:
    """解析日历的桌台过滤条件：返回 (table_id, table_label)；未指定时为 (None, None)。"""
    code = (table_code or "").strip()
    if not code:
        return None, None
    t = db.query(DiningTable).filter(DiningTable.code == code).first()
    if not t:
        raise HTTPException(status_code=400, detail=f"桌台编号不存在：{code}")
    return int(t.id), (t.label or t.code)


def _walkin_count_status_ok(business_date: str, status: str, today: str) -> bool:
    """散客入席的统计口径，与预订一致。

    今日及过去：已发生的到店都计入（seated / left）；
    未来：仅计入仍在「已入席」的记录。
    """
    if business_date <= today:
        return True
    return status == "seated"


def _collect_calendar_events(
    db: Session,
    *,
    start: str,
    end: str,
    today: str,
    table_id: int | None,
) -> list[tuple[str, str, int]]:
    """返回 [(日期, 时间槽, 人数)]，含预订与散客入席，可按桌台过滤。"""
    events: list[tuple[str, str, int]] = []

    res_rows = (
        db.query(
            Reservation.reservation_date,
            Reservation.time_slot,
            Reservation.party_size,
            Reservation.assigned_table_id,
            Reservation.assigned_table_ids,
        )
        .filter(
            Reservation.reservation_date >= start,
            Reservation.reservation_date <= end,
            _calendar_count_status_filter(today),
        )
        .all()
    )
    for date_s, time_slot, party_size, at_id, at_ids in res_rows:
        if table_id is not None:
            if table_id not in parse_table_ids_csv(at_id, at_ids):
                continue
        events.append((date_s, time_slot, int(party_size or 0)))

    occ_rows = (
        db.query(
            TableOccupancy.business_date,
            TableOccupancy.time_slot,
            TableOccupancy.party_size,
            TableOccupancy.status,
            TableOccupancy.table_id,
        )
        .filter(
            TableOccupancy.business_date >= start,
            TableOccupancy.business_date <= end,
        )
        .all()
    )
    for biz_date, time_slot, party_size, status, tid in occ_rows:
        if table_id is not None and int(tid) != table_id:
            continue
        if not _walkin_count_status_ok(biz_date, status, today):
            continue
        events.append((biz_date, time_slot, int(party_size or 0)))

    return events


def _todo_reasons_and_highlight(r: Reservation) -> tuple[list[str], str]:
    """待办预订：原因列表 + 编辑页高亮锚点（tables / phone / flow）。"""
    reasons: list[str] = [
        "待确认：请将「预订状态」从「待处理」改为「已确认」，或按现场取消/调整。",
    ]
    has_tbl = len(parse_assigned_table_ids(r)) > 0
    phone_ok = bool(_PHONE_OK.match((r.phone or "").strip()))
    if not has_tbl:
        reasons.append("尚未分配桌台，请在「分配桌台」或右侧平面图选择。")
    if not phone_ok:
        reasons.append("未填写有效11位手机号（短信通知依赖手机号）。")
    if not has_tbl:
        highlight = "tables"
    elif not phone_ok:
        highlight = "phone"
    else:
        highlight = "flow"
    return reasons, highlight


def _res_item(r: Reservation) -> ReservationAdminItem:
    return ReservationAdminItem(
        id=r.id,
        customer_name=r.customer_name,
        phone=r.phone,
        reservation_date=r.reservation_date,
        time_slot=r.time_slot,
        party_size=r.party_size,
        note=r.note,
        flow_status=r.flow_status,
        tags=r.tags or "",
        table_code=r.table.code if r.table else None,
        table_label=r.table.label if r.table else None,
        created_at=(
            r.created_at.strftime("%Y-%m-%d %H:%M:%S")
            if r.created_at
            else None
        ),
    )


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    today = datetime.now().strftime("%Y-%m-%d")
    pending_confirm = (
        db.query(Reservation)
        .filter(
            Reservation.flow_status == "waiting",
        )
        .count()
    )
    pending_dep = db.query(Deposit).filter(Deposit.status == "pending").count()
    customers_total = db.query(Customer).count()
    reservations_today = (
        db.query(Reservation)
        .filter(Reservation.reservation_date == today)
        .count()
    )
    return DashboardSummary(
        pending_confirm_reservations=pending_confirm,
        pending_deposits=pending_dep,
        customers_total=customers_total,
        reservations_today=reservations_today,
    )


@router.get("/todos")
def list_todos(
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    """待办：待处理预订 + 待收订金"""
    res_rows = (
        db.query(Reservation)
        .options(joinedload(Reservation.table))
        .filter(
            Reservation.flow_status == "waiting",
        )
        .order_by(Reservation.reservation_date, Reservation.time_slot)
        .limit(200)
        .all()
    )
    dep_rows = (
        db.query(Deposit)
        .filter(Deposit.status == "pending")
        .order_by(Deposit.created_at.desc())
        .limit(100)
        .all()
    )
    res_items: list[ReservationAdminItem] = []
    for r in res_rows:
        base = _res_item(r)
        reasons, highlight = _todo_reasons_and_highlight(r)
        res_items.append(
            base.model_copy(update={"todo_reasons": reasons, "todo_highlight": highlight})
        )
    return {
        "reservations": res_items,
        "deposits": [
            DepositItem(
                id=d.id,
                reservation_id=d.reservation_id,
                customer_phone=d.customer_phone,
                amount_yuan=d.amount_yuan,
                status=d.status,
                note=d.note,
                paid_at=(
                    d.paid_at.strftime("%Y-%m-%d %H:%M:%S")
                    if d.paid_at
                    else None
                ),
                created_at=(
                    d.created_at.strftime("%Y-%m-%d %H:%M:%S")
                    if d.created_at
                    else None
                ),
            )
            for d in dep_rows
        ],
    }


@router.get("/calendar/month", response_model=CalendarMonthResponse)
def calendar_month(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    table_code: str | None = Query(None),
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_assigned_table_ids_column(db)
    last_d = monthrange(year, month)[1]
    start = f"{year}-{month:02d}-01"
    end = f"{year}-{month:02d}-{last_d:02d}"
    today = datetime.now().strftime("%Y-%m-%d")
    periods_rows = [p for p in list_operating_periods(db) if p.enabled]
    periods_rows.sort(key=lambda x: x.sort_order)
    period_label_map = {p.period_key: p.label for p in periods_rows}
    period_keys = [p.period_key for p in periods_rows]
    table_id, table_label = _resolve_table_filter(db, table_code)

    events = _collect_calendar_events(
        db,
        start=start,
        end=end,
        today=today,
        table_id=table_id,
    )

    daily: dict[str, dict] = {}
    month_total_count = 0
    month_total_party = 0
    for date_s, time_slot, party_size in events:
        rec = daily.get(date_s)
        if rec is None:
            rec = {
                "count": 0,
                "party": 0,
                "by_period": {
                    k: {
                        "period_key": k,
                        "label": period_label_map.get(k, k),
                        "count": 0,
                        "party": 0,
                    }
                    for k in period_keys
                },
            }
            daily[date_s] = rec
        rec["count"] += 1
        rec["party"] += int(party_size or 0)
        month_total_count += 1
        month_total_party += int(party_size or 0)
        pk = period_key_for_periods_list(periods_rows, time_slot)
        if pk not in rec["by_period"]:
            rec["by_period"][pk] = {
                "period_key": pk,
                "label": period_label_map.get(pk, pk),
                "count": 0,
                "party": 0,
            }
        rec["by_period"][pk]["count"] += 1
        rec["by_period"][pk]["party"] += int(party_size or 0)

    day_list: list[CalendarDayCount] = []
    for day in range(1, last_d + 1):
        ds = f"{year}-{month:02d}-{day:02d}"
        item = daily.get(ds)
        if not item:
            by_period = [
                CalendarPeriodCount(
                    period_key=k,
                    label=period_label_map.get(k, k),
                    count=0,
                    party=0,
                )
                for k in period_keys
            ]
            day_list.append(
                CalendarDayCount(
                    date=ds, count=0, party=0, by_period=by_period
                )
            )
            continue
        by_period_rows = [
            CalendarPeriodCount(**item["by_period"][k])
            for k in item["by_period"].keys()
        ]
        day_list.append(
            CalendarDayCount(
                date=ds,
                count=int(item["count"]),
                party=int(item["party"]),
                by_period=by_period_rows,
            )
        )
    return CalendarMonthResponse(
        year=year,
        month=month,
        days=day_list,
        month_total_count=month_total_count,
        month_total_party=month_total_party,
        table_code=(table_code or "").strip() or None,
        table_label=table_label,
    )


@router.get(
    "/calendar/monthly-trend",
    response_model=CalendarMonthlyTrendResponse,
)
def calendar_monthly_trend(
    table_code: str | None = Query(None),
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    """
    月度预订趋势（固定）：从系统内最早有数据月份到本地当前月。
    不受当前日历选定月份影响；传 table_code 则只统计该桌台（含散客入席）。
    """
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    current_ym = f"{now.year:04d}-{now.month:02d}"
    table_id, table_label = _resolve_table_filter(db, table_code)

    trend_filters = (
        _calendar_count_status_filter(today),
        Reservation.reservation_date >= "2020-01-01",
        Reservation.reservation_date <= f"{current_ym}-31",
    )

    min_date = (
        db.query(func.min(Reservation.reservation_date))
        .filter(*trend_filters)
        .scalar()
    )
    first_date = (str(min_date).strip() if min_date else "") or ""
    if len(first_date) < 7:
        return CalendarMonthlyTrendResponse(
            items=[],
            table_code=(table_code or "").strip() or None,
            table_label=table_label,
        )

    start_y = int(first_date[:4])
    start_m = int(first_date[5:7])

    # 按桌台统计需读取 assigned_table_ids，改在 Python 侧过滤聚合
    events = _collect_calendar_events(
        db,
        start="2020-01-01",
        end=f"{current_ym}-31",
        today=today,
        table_id=table_id,
    )
    by_month: dict[str, dict[str, int]] = {}
    for date_s, _time_slot, party_size in events:
        ym = date_s[:7]
        if len(ym) < 7:
            continue
        item = by_month.setdefault(ym, {"count": 0, "party": 0})
        item["count"] += 1
        item["party"] += int(party_size or 0)

    items: list[CalendarMonthlyTrendItem] = []
    y = start_y
    m = start_m
    while True:
        ym = f"{y:04d}-{m:02d}"
        data = by_month.get(ym, {"count": 0, "party": 0})
        items.append(
            CalendarMonthlyTrendItem(
                ym=ym,
                label=f"{y}年{m}月",
                count=int(data["count"]),
                party=int(data["party"]),
            )
        )
        if ym >= current_ym:
            break
        if m == 12:
            y += 1
            m = 1
        else:
            m += 1
    return CalendarMonthlyTrendResponse(
        items=items,
        table_code=(table_code or "").strip() or None,
        table_label=table_label,
    )


def _mask_phone(phone: str) -> str:
    p = (phone or "").strip()
    if len(p) < 7:
        return p
    return f"{p[:3]}****{p[-4:]}"


def _kitchen_assignee_label(db: Session, r: Reservation) -> str:
    stored = getattr(r, "assigned_staff_name", None)
    name = (stored or "").strip() or None
    if name:
        return name
    sid = getattr(r, "assigned_staff_id", None)
    if sid:
        u = db.get(User, int(sid))
        if u:
            return (u.full_name or "").strip() or u.username
    return "—"


@router.get("/kitchen/prep")
def kitchen_prep(
    date_from: str,
    date_to: str | None = None,
    mask_phone: bool = True,
    period_keys: list[str] | None = Query(None),
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_assigned_table_ids_column(db)
    ensure_assigned_staff_id_column(db)
    ensure_assigned_staff_name_column(db)
    end = (date_to or "").strip() or date_from
    periods_rows = [p for p in list_operating_periods(db) if p.enabled]
    periods_rows.sort(key=lambda x: x.sort_order)
    period_map = {p.period_key: p for p in periods_rows}
    period_sort_order = {p.period_key: p.sort_order for p in periods_rows}
    periods_out = [
        {
            "period_key": p.period_key,
            "label": p.label,
            "icon": p.icon,
            "color": p.color,
        }
        for p in periods_rows
    ]
    rows = (
        db.query(Reservation)
        .options(joinedload(Reservation.table))
        .filter(
            Reservation.reservation_date >= date_from,
            Reservation.reservation_date <= end,
            Reservation.flow_status.in_(
                ("waiting", "confirmed", "arrived", "left")
            ),
        )
        .order_by(
            Reservation.reservation_date.asc(),
            Reservation.time_slot.asc(),
            Reservation.id.asc(),
        )
        .all()
    )

    pk_filter: set[str] | None = None
    if period_keys:
        pk_filter = {x.strip() for x in period_keys if x and str(x).strip()}
        if not pk_filter:
            pk_filter = None

    summary_by_date: dict[str, dict] = {}
    items: list[dict] = []
    for r in rows:
        pk = period_key_for_periods_list(periods_rows, r.time_slot)
        if pk_filter is not None and pk not in pk_filter:
            continue
        date_key = r.reservation_date
        if date_key not in summary_by_date:
            by_period = {
                pk: {"period_key": pk, "orders": 0, "party": 0}
                for pk in period_map.keys()
            }
            summary_by_date[date_key] = {
                "date": date_key,
                "total_orders": 0,
                "total_party": 0,
                "by_period": by_period,
            }
        s = summary_by_date[date_key]
        s["total_orders"] += 1
        s["total_party"] += int(r.party_size)
        period_label = period_map.get(pk).label if pk in period_map else pk
        if pk not in s["by_period"]:
            s["by_period"][pk] = {"period_key": pk, "orders": 0, "party": 0}
        s["by_period"][pk]["orders"] += 1
        s["by_period"][pk]["party"] += int(r.party_size)

        items.append(
            {
                "id": r.id,
                "reservation_date": r.reservation_date,
                "period_key": pk,
                "period": period_label,
                "time_slot": r.time_slot,
                "customer_name": r.customer_name,
                "phone": _mask_phone(r.phone) if mask_phone else r.phone,
                "party_size": r.party_size,
                "tags": r.tags or "",
                "flow_status": r.flow_status,
                "table_label": r.table.label if r.table else "待定",
                "note": r.note,
                "assigned_staff_name": _kitchen_assignee_label(db, r),
            }
        )

    summary = []
    for k in sorted(summary_by_date.keys()):
        s = summary_by_date[k]
        by_list = list(s["by_period"].values())
        # 按 sort_order 输出，方便前端列对齐
        by_list.sort(key=lambda x: period_sort_order.get(x["period_key"], 999))
        summary.append(
            {
                "date": s["date"],
                "total_orders": s["total_orders"],
                "total_party": s["total_party"],
                "by_period": by_list,
            }
        )
    return {
        "date_from": date_from,
        "date_to": end,
        "mask_phone": mask_phone,
        "periods": periods_out,
        "summary": summary,
        "items": items,
    }
