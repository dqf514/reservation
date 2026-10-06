from __future__ import annotations

from fastapi.testclient import TestClient


def test_home_summary_public(client: TestClient) -> None:
    r = client.get("/api/home/summary")
    assert r.status_code == 200
    j = r.json()
    assert "promotions" in j
    assert len(j["promotions"]) >= 1
    assert "title" in j["promotions"][0]
    assert "reservations_today" in j
    assert "reservations_tomorrow" in j


def test_get_branding_public(client: TestClient) -> None:
    r = client.get("/api/branding")
    assert r.status_code == 200
    j = r.json()
    assert "app_name" in j
    assert "company_name" in j


def test_create_public_reservation(client: TestClient) -> None:
    r = client.post(
        "/api/reservations",
        json={
            "customer_name": "测试用户",
            "phone": "13800138000",
            "reservation_date": "2030-01-15",
            "time_slot": "18:00",
            "party_size": 2,
            "note": "单元测试",
        },
    )
    assert r.status_code == 200
    j = r.json()
    assert "id" in j
    assert "message" in j


def test_reservations_mine_invalid_phone(client: TestClient) -> None:
    r = client.get("/api/reservations/mine", params={"phone": "123"})
    assert r.status_code == 400


def test_reservations_mine_ok(client: TestClient) -> None:
    r = client.get("/api/reservations/mine", params={"phone": "13800138000"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_floor_requires_auth(client: TestClient) -> None:
    r = client.get("/api/admin/floor", params={"date": "2030-01-01", "period": "lunch"})
    assert r.status_code == 401


def test_floor_ok(client: TestClient, admin_headers: dict[str, str]) -> None:
    from datetime import datetime

    today = datetime.now().strftime("%Y-%m-%d")
    r = client.get("/api/admin/floor", params={"date": today, "period": "lunch"}, headers=admin_headers)
    assert r.status_code == 200
    j = r.json()
    assert "tables" in j
    assert len(j["tables"]) >= 1
    t0 = j["tables"][0]
    assert "dbId" in t0
    assert isinstance(t0["dbId"], int)
