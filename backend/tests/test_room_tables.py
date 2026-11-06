"""房间型桌台（room）容量池行为测试。

覆盖：
- 房间可同时容纳多组客人（普通桌仍是「一桌一单」独占）
- 容量按时段计算，预订与散客合并累加
- 自动分配时普通桌优先，房间作为兜底
- 平面图节点按聚合口径展示
- 日历可按桌台统计（含散客入席）
"""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

TODAY = datetime.now().strftime("%Y-%m-%d")
TOMORROW = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")


def _unique_code(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:8]}"


@pytest.fixture
def room(client: TestClient, admin_headers: dict[str, str]) -> dict:
    """创建一个容量 30 的房间型桌台与一张普通桌（编号随机，避免用例间冲突）。"""
    room_code = _unique_code("5D")
    std_code = _unique_code("T")
    r = client.post(
        "/api/admin/dining-tables",
        headers=admin_headers,
        json={
            "code": room_code,
            "label": "5D Room",
            "shape": "rect_v",
            "pos_x": 84.0,
            "pos_y": 27.0,
            "pos_size": 10.0,
            "capacity": 30,
            "table_type": "room",
        },
    )
    assert r.status_code == 200, r.text
    room_row = r.json()
    assert room_row["table_type"] == "room"

    r2 = client.post(
        "/api/admin/dining-tables",
        headers=admin_headers,
        json={
            "code": std_code,
            "label": "普通桌",
            "shape": "circle",
            "pos_x": 10.0,
            "pos_y": 10.0,
            "pos_size": 5.0,
            "capacity": 4,
        },
    )
    assert r2.status_code == 200, r2.text
    std_row = r2.json()
    assert std_row["table_type"] == "standard"
    return {
        "room": room_row,
        "room_code": room_code,
        "std": std_row,
        "std_code": std_code,
    }


def _mk_reservation(
    client: TestClient,
    headers: dict[str, str],
    *,
    code: str,
    party: int,
    date: str = TOMORROW,
    slot: str = "19:00",
    flow: str = "confirmed",
    name: str = "客人",
):
    return client.post(
        "/api/admin/reservations",
        headers=headers,
        json={
            "customer_name": name,
            "phone": "13900139000",
            "reservation_date": date,
            "time_slot": slot,
            "party_size": party,
            "flow_status": flow,
            "assigned_table_codes": [code],
            "assigned_staff_name": "测试员",
        },
    )


def test_room_accepts_multiple_reservations(client, admin_headers, room):
    """房间可同时安排多组客人（合计不超过座位数）。"""
    r1 = _mk_reservation(client, admin_headers, code=room["room_code"], party=10, name="A")
    assert r1.status_code == 200, r1.text
    r2 = _mk_reservation(client, admin_headers, code=room["room_code"], party=12, name="B")
    assert r2.status_code == 200, r2.text
    r3 = _mk_reservation(client, admin_headers, code=room["room_code"], party=8, name="C")
    assert r3.status_code == 200, r3.text


def test_room_rejects_over_capacity(client, admin_headers, room):
    """超过座位数直接拒绝。"""
    r1 = _mk_reservation(client, admin_headers, code=room["room_code"], party=20, name="A")
    assert r1.status_code == 200, r1.text
    r2 = _mk_reservation(client, admin_headers, code=room["room_code"], party=11, name="B")
    assert r2.status_code == 400, r2.text
    assert "座位不足" in r2.json()["detail"]


def test_room_capacity_is_per_period(client, admin_headers, room):
    """容量按时段计算：午餐坐满不影响晚餐。"""
    # 运营时段：lunch 11:00-14:00 / afternoon 14:00-17:00 / dinner 17:30-21:00
    r1 = _mk_reservation(
        client, admin_headers, code=room["room_code"], party=30, slot="12:00", name="午"
    )
    assert r1.status_code == 200, r1.text
    r2 = _mk_reservation(
        client, admin_headers, code=room["room_code"], party=30, slot="19:00", name="晚"
    )
    assert r2.status_code == 200, r2.text


def test_room_reservation_patch_rechecks_capacity(client, admin_headers, room):
    """改人数后仍需满足容量。"""
    r1 = _mk_reservation(client, admin_headers, code=room["room_code"], party=10, name="A")
    assert r1.status_code == 200, r1.text
    rid = r1.json()["id"]

    r2 = _mk_reservation(client, admin_headers, code=room["room_code"], party=15, name="B")
    assert r2.status_code == 200, r2.text

    # 把 A 改成 20 人 → 10 + 15 + 20 = 45 > 30，应被拒绝
    patch = client.patch(
        f"/api/admin/reservations/{rid}",
        headers=admin_headers,
        json={"party_size": 20},
    )
    assert patch.status_code == 400, patch.text
    assert "座位不足" in patch.json()["detail"]


def test_auto_assign_prefers_standard_and_falls_back_to_room(client, admin_headers, room):
    """自动分配：普通桌优先；普通桌都坐不下时才用房间。"""
    from app.database import SessionLocal
    from app.floor_logic import pick_random_idle_table

    db = SessionLocal()
    try:
        # 小团 → 落到普通桌
        picked = pick_random_idle_table(
            db, reservation_date=TOMORROW, time_slot="19:00", party_size=2
        )
        assert picked is not None
        assert picked.code != room["room_code"]

        # 把所有普通桌停用 → 大团只能落到房间
        from app.models import DiningTable

        for t in db.query(DiningTable).filter(
            DiningTable.code != room["room_code"]
        ):
            t.is_active = False
        db.commit()

        picked = pick_random_idle_table(
            db, reservation_date=TOMORROW, time_slot="19:00", party_size=20
        )
        assert picked is not None
        assert picked.code == room["room_code"]
    finally:
        db.close()


def test_floor_room_node_aggregates(client, admin_headers, room):
    """平面图房间节点展示聚合占用。"""
    _mk_reservation(client, admin_headers, code=room["room_code"], party=10, name="A")
    _mk_reservation(client, admin_headers, code=room["room_code"], party=5, name="B")
    fl = client.get(
        f"/api/admin/floor?date={TOMORROW}&period=dinner",
        headers=admin_headers,
    )
    assert fl.status_code == 200, fl.text
    nodes = {n["id"]: n for n in fl.json()["tables"]}
    node = nodes[room["room_code"]]
    assert node["tableType"] == "room"
    assert node["status"] == "reserved"
    assert node["ratio"] == "15/30"
    assert node["roomUsage"]["used"] == 15
    assert node["roomUsage"]["reserved"] == 15
    assert node["roomUsage"]["parties"] == 2


def test_walkin_occupancy_counts_into_room(client, admin_headers, room):
    """散客入席计入房间座位池（与预订合并计算）。"""
    now_hm = datetime.now().strftime("%H:%M")
    # 与散客入席同一时刻（当前时段），先占 25 座
    r0 = _mk_reservation(
        client,
        admin_headers,
        code=room["room_code"],
        party=25,
        date=TODAY,
        slot=now_hm,
        name="午",
    )
    assert r0.status_code == 200, r0.text
    # 再加 10 人散客 → 25 + 10 > 30，应超容量
    r = client.post(
        "/api/admin/floor/walkin/seat",
        headers=admin_headers,
        json={
            "table_code": room["room_code"],
            "reservation_date": TODAY,
            "party_size": 10,
        },
    )
    assert r.status_code == 400, r.text
    assert "座位不足" in r.json()["detail"]


def test_room_walkin_allowed_when_seats_available(client, admin_headers, room):
    """房间有空位时允许散客直接入席。"""
    r = client.post(
        "/api/admin/floor/walkin/seat",
        headers=admin_headers,
        json={
            "table_code": room["room_code"],
            "reservation_date": TODAY,
            "party_size": 6,
        },
    )
    assert r.status_code == 200, r.text

    fl = client.get(
        f"/api/admin/floor?date={TODAY}&period=dinner", headers=admin_headers
    )
    assert fl.status_code == 200, fl.text
    nodes = {n["id"]: n for n in fl.json()["tables"]}
    node = nodes[room["room_code"]]
    assert node["roomUsage"]["seated"] == 6
    assert node["roomUsage"]["used"] == 6
    assert node["status"] == "arrived"


def test_room_all_period_uses_peak_not_day_sum(client, admin_headers, room):
    """全部时段视图取「时段峰值」，不会因各时段相加而看起来超过座位数。"""
    _mk_reservation(client, admin_headers, code=room["room_code"], party=30, slot="12:00", name="午")
    _mk_reservation(client, admin_headers, code=room["room_code"], party=27, slot="19:00", name="晚")
    fl = client.get(
        f"/api/admin/floor?date={TOMORROW}&period=all", headers=admin_headers
    )
    assert fl.status_code == 200, fl.text
    node = {n["id"]: n for n in fl.json()["tables"]}[room["room_code"]]
    usage = node["roomUsage"]
    assert node["ratio"] == "30/30"
    assert usage["used"] == 30
    assert usage["peak_used"] == 30
    assert usage["day_used"] == 57
    assert usage["day_parties"] == 2
    assert node["guestHint"] == "2 桌"


def test_calendar_by_table_filter(client, admin_headers, room):
    """日历按桌台统计：只含该桌台的预订与散客。"""
    _mk_reservation(client, admin_headers, code=room["room_code"], party=10, name="A")
    _mk_reservation(client, admin_headers, code=room["std_code"], party=2, name="B")

    y = datetime.now().year
    m = datetime.now().month
    all_res = client.get(
        f"/api/admin/calendar/month?year={y}&month={m}", headers=admin_headers
    )
    assert all_res.status_code == 200, all_res.text
    assert all_res.json()["table_code"] is None

    room_res = client.get(
        f"/api/admin/calendar/month?year={y}&month={m}&table_code={room['room_code']}",
        headers=admin_headers,
    )
    assert room_res.status_code == 200, room_res.text
    body = room_res.json()
    assert body["table_code"] == room["room_code"]
    assert body["table_label"] == "5D Room"
    assert body["month_total_party"] == 10
    assert body["month_total_count"] == 1


def test_calendar_unknown_table_returns_400(client, admin_headers):
    r = client.get(
        "/api/admin/calendar/month?year=2026&month=11&table_code=NOPE",
        headers=admin_headers,
    )
    assert r.status_code == 400, r.text


def test_reservation_list_filters_by_table(client, admin_headers, room):
    """预订列表可按桌台过滤（多桌台 CSV 精确匹配）。"""
    _mk_reservation(client, admin_headers, code=room["room_code"], party=10, name="A")
    _mk_reservation(client, admin_headers, code=room["std_code"], party=2, name="B")

    r = client.get(
        f"/api/admin/reservations?table_code={room['room_code']}", headers=admin_headers
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["customer_name"] == "A"


def test_reservation_list_table_filter_no_false_positive(client, admin_headers, room):
    """桌台 id 存在前缀关系时不应互相误命中（如 65 与 165）。"""
    other_code = f"{room['room_code']}x"
    r = client.post(
        "/api/admin/dining-tables",
        headers=admin_headers,
        json={
            "code": other_code,
            "label": "干扰桌",
            "shape": "circle",
            "pos_x": 20.0,
            "pos_y": 20.0,
            "pos_size": 5.0,
            "capacity": 4,
        },
    )
    assert r.status_code == 200, r.text
    _mk_reservation(client, admin_headers, code=other_code, party=2, name="X")

    r2 = client.get(
        f"/api/admin/reservations?table_code={room['room_code']}", headers=admin_headers
    )
    assert r2.status_code == 200, r2.text
    assert all(x["customer_name"] != "X" for x in r2.json()["items"])


def test_table_type_can_be_switched(client, admin_headers, room):
    """桌台管理页可切换普通桌 / 房间。"""
    tid = room["room"]["id"]
    r = client.patch(
        f"/api/admin/dining-tables/{tid}",
        headers=admin_headers,
        json={"table_type": "standard"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["table_type"] == "standard"
