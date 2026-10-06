from __future__ import annotations

from fastapi.testclient import TestClient


def test_dashboard_summary(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/dashboard/summary", headers=admin_headers)
    assert r.status_code == 200
    j = r.json()
    for k in ("pending_confirm_reservations", "pending_deposits", "customers_total", "reservations_today"):
        assert k in j
        assert isinstance(j[k], int)


def test_todos(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/todos", headers=admin_headers)
    assert r.status_code == 200
    j = r.json()
    assert "reservations" in j
    assert "deposits" in j


def test_dining_tables(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/dining-tables", headers=admin_headers)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) >= 1
    x = rows[0]
    for k in ("id", "code", "label", "shape", "pos_x", "pos_y", "pos_size", "sort_order", "capacity", "is_active"):
        assert k in x


def test_dining_table_patch_position(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/dining-tables", headers=admin_headers)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 1
    tid = rows[0]["id"]
    patch = client.patch(
        f"/api/admin/dining-tables/{tid}",
        headers=admin_headers,
        json={"pos_x": 42.5, "pos_y": 58.25},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["pos_x"] == 42.5
    assert patch.json()["pos_y"] == 58.25


def test_dining_table_crud(client: TestClient, admin_headers: dict[str, str]) -> None:
    create = client.post(
        "/api/admin/dining-tables",
        headers=admin_headers,
        json={
            "code": "z_autotest_1",
            "label": "自动化测试桌",
            "shape": "square",
            "pos_x": 55,
            "pos_y": 55,
            "pos_size": 9,
            "sort_order": 999,
            "capacity": 2,
            "is_active": True,
        },
    )
    assert create.status_code == 200, create.text
    tid = create.json()["id"]
    patch = client.patch(
        f"/api/admin/dining-tables/{tid}",
        headers=admin_headers,
        json={"label": "自动化测试桌（已改）"},
    )
    assert patch.status_code == 200
    assert patch.json()["label"] == "自动化测试桌（已改）"
    delete = client.delete(f"/api/admin/dining-tables/{tid}", headers=admin_headers)
    assert delete.status_code == 200


def test_calendar_month(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/calendar/month", params={"year": 2030, "month": 6}, headers=admin_headers)
    assert r.status_code == 200
    j = r.json()
    assert j["year"] == 2030
    assert j["month"] == 6
    assert len(j["days"]) >= 28


def test_calendar_month_counts_left_on_past_date(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    """过去日期：离席、散客等实际到店应计入；已取消不计入。"""
    create = client.post(
        "/api/admin/reservations",
        json={
            "customer_name": "Walk-in",
            "phone": "",
            "reservation_date": "2020-06-01",
            "time_slot": "12:00",
            "party_size": 4,
            "note": "pytest-calendar-left",
            "flow_status": "left",
            "tags": "",
            "assigned_table_code": None,
            "assigned_staff_name": "pytest",
        },
        headers=admin_headers,
    )
    assert create.status_code == 200, create.text
    rid = create.json()["id"]

    cal = client.get(
        "/api/admin/calendar/month",
        params={"year": 2020, "month": 6},
        headers=admin_headers,
    )
    assert cal.status_code == 200
    day = next((d for d in cal.json()["days"] if d["date"] == "2020-06-01"), None)
    assert day is not None
    assert day["count"] >= 1
    assert day["party"] >= 4

    client.delete(f"/api/admin/reservations/{rid}", headers=admin_headers)


def test_note_quick_options(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/reservations/note-quick-options", headers=admin_headers)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1

    r2 = client.put(
        "/api/admin/reservations/note-quick-options",
        json={"items": ["靠窗", "VIP", "宝宝椅"]},
        headers=admin_headers,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json() == ["靠窗", "VIP", "宝宝椅"]

    r3 = client.get("/api/admin/reservations/note-quick-options", headers=admin_headers)
    assert r3.json() == ["靠窗", "VIP", "宝宝椅"]


def test_terminal_status_preserves_table_and_frees_floor(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    """离席/取消/爽约后保留历史桌台，但平面图不再占用该桌。"""
    from datetime import datetime

    today = datetime.now().strftime("%Y-%m-%d")
    floor = client.get(
        "/api/admin/floor",
        params={"date": today, "period": "all"},
        headers=admin_headers,
    )
    assert floor.status_code == 200, floor.text
    tables = floor.json()["tables"]
    table_code = next(
        t["id"] for t in tables if t.get("status") != "unavailable"
    )

    create = client.post(
        "/api/admin/reservations",
        json={
            "customer_name": "pytest-table-history",
            "phone": "13900139002",
            "reservation_date": today,
            "time_slot": "18:00",
            "party_size": 2,
            "note": "pytest-terminal-table",
            "flow_status": "arrived",
            "tags": "",
            "assigned_table_codes": [table_code],
            "assigned_staff_name": "pytest",
        },
        headers=admin_headers,
    )
    assert create.status_code == 200, create.text
    rid = create.json()["id"]
    created_codes = create.json().get("table_codes") or []
    if not created_codes and create.json().get("table_code"):
        created_codes = [create.json()["table_code"]]
    assert table_code in created_codes

    patch_left = client.patch(
        f"/api/admin/reservations/{rid}",
        json={"flow_status": "left"},
        headers=admin_headers,
    )
    assert patch_left.status_code == 200, patch_left.text

    after_left = client.get(f"/api/admin/reservations/{rid}", headers=admin_headers)
    assert after_left.status_code == 200
    left_body = after_left.json()
    assert left_body["flow_status"] == "left"
    left_codes = left_body.get("table_codes") or []
    if not left_codes and left_body.get("table_code"):
        left_codes = [left_body["table_code"]]
    assert table_code in left_codes

    floor_left = client.get(
        "/api/admin/floor",
        params={"date": today, "period": "all"},
        headers=admin_headers,
    )
    assert floor_left.status_code == 200
    node_left = next(t for t in floor_left.json()["tables"] if t["id"] == table_code)
    assert node_left["status"] == "empty"

    patch_cancel = client.patch(
        f"/api/admin/reservations/{rid}",
        json={"flow_status": "cancelled"},
        headers=admin_headers,
    )
    assert patch_cancel.status_code == 200, patch_cancel.text

    after_cancel = client.get(f"/api/admin/reservations/{rid}", headers=admin_headers)
    assert after_cancel.status_code == 200
    cancel_body = after_cancel.json()
    assert cancel_body["flow_status"] == "cancelled"
    cancel_codes = cancel_body.get("table_codes") or []
    if not cancel_codes and cancel_body.get("table_code"):
        cancel_codes = [cancel_body["table_code"]]
    assert table_code in cancel_codes

    floor_cancel = client.get(
        "/api/admin/floor",
        params={"date": today, "period": "all"},
        headers=admin_headers,
    )
    assert floor_cancel.status_code == 200
    node_cancel = next(
        t for t in floor_cancel.json()["tables"] if t["id"] == table_code
    )
    assert node_cancel["status"] == "empty"

    client.delete(f"/api/admin/reservations/{rid}", headers=admin_headers)


def test_admin_reservations_list(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/reservations", params={"page": 1, "page_size": 5}, headers=admin_headers)
    assert r.status_code == 200
    j = r.json()
    assert "items" in j
    assert "total" in j
    assert isinstance(j["items"], list)


def test_admin_reservation_crud_flow(client: TestClient, admin_headers: dict[str, str]) -> None:
    create = client.post(
        "/api/admin/reservations",
        json={
            "customer_name": "自动化测试",
            "phone": "13900139000",
            "reservation_date": "2030-02-01",
            "time_slot": "19:00",
            "party_size": 3,
            "note": "pytest",
            "flow_status": "pending_confirm",
            "tags": "测试",
            "assigned_table_code": None,
        },
        headers=admin_headers,
    )
    assert create.status_code == 200, create.text
    rid = create.json()["id"]

    one = client.get(f"/api/admin/reservations/{rid}", headers=admin_headers)
    assert one.status_code == 200
    assert one.json()["customer_name"] == "自动化测试"

    patch = client.patch(
        f"/api/admin/reservations/{rid}",
        json={"flow_status": "waiting", "note": "已确认"},
        headers=admin_headers,
    )
    assert patch.status_code == 200, patch.text

    delete = client.delete(f"/api/admin/reservations/{rid}", headers=admin_headers)
    assert delete.status_code == 200


def test_customers_crud(client: TestClient, admin_headers: dict[str, str]) -> None:
    post = client.post(
        "/api/admin/customers",
        json={
            "phone": "13700137000",
            "display_name": "客户测",
            "email": None,
            "tags": "vip",
            "note": None,
        },
        headers=admin_headers,
    )
    assert post.status_code == 200, post.text
    cid = post.json()["id"]

    r = client.get(f"/api/admin/customers/{cid}", headers=admin_headers)
    assert r.status_code == 200

    patch = client.patch(
        f"/api/admin/customers/{cid}",
        json={"display_name": "客户测改名", "tags": "vip,老客"},
        headers=admin_headers,
    )
    assert patch.status_code == 200

    delete = client.delete(f"/api/admin/customers/{cid}", headers=admin_headers)
    assert delete.status_code == 200


def test_deposits_crud(client: TestClient, admin_headers: dict[str, str]) -> None:
    post = client.post(
        "/api/admin/deposits",
        json={"reservation_id": None, "customer_phone": "13600136000", "amount_yuan": 100.0, "note": "定金"},
        headers=admin_headers,
    )
    assert post.status_code == 200, post.text
    did = post.json()["id"]

    r = client.get("/api/admin/deposits", params={"page": 1, "page_size": 5}, headers=admin_headers)
    assert r.status_code == 200

    patch = client.patch(
        f"/api/admin/deposits/{did}",
        json={"status": "paid", "amount_yuan": 100.0},
        headers=admin_headers,
    )
    assert patch.status_code == 200
    assert patch.json()["status"] == "paid"

    delete = client.delete(f"/api/admin/deposits/{did}", headers=admin_headers)
    assert delete.status_code == 200
