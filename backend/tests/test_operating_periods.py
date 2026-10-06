from fastapi.testclient import TestClient


def test_operating_periods_public_get(client: TestClient) -> None:
    r = client.get("/api/operating-periods")
    assert r.status_code == 200
    j = r.json()
    assert "periods" in j
    assert isinstance(j["periods"], list)
    assert j["periods"][0]["period_key"] == "lunch"
    assert j["periods"][0]["start_time"] == "11:00"


def test_operating_periods_admin_put(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.put(
        "/api/admin/operating-periods",
        headers=admin_headers,
        json={
            "periods": [
                {
                    "period_key": "lunch",
                    "label": "午市",
                    "start_time": "10:30",
                    "end_time": "14:00",
                    "sort_order": 0,
                    "enabled": True,
                    "color": "#f97316",
                    "icon": "午",
                },
                {
                    "period_key": "afternoon",
                    "label": "茶歇",
                    "start_time": "14:00",
                    "end_time": "16:30",
                    "sort_order": 1,
                    "enabled": True,
                    "color": "#f59e0b",
                    "icon": "茶",
                },
                {
                    "period_key": "dinner",
                    "label": "晚市",
                    "start_time": "16:30",
                    "end_time": "21:30",
                    "sort_order": 2,
                    "enabled": True,
                    "color": "#ef4444",
                    "icon": "晚",
                },
            ]
        },
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["periods"][0]["period_key"] == "lunch"
    assert j["periods"][0]["label"] == "午市"
    assert j["periods"][0]["start_time"] == "10:30"

    r2 = client.get("/api/operating-periods")
    assert r2.json()["periods"][0]["start_time"] == "10:30"

    # restore defaults for other tests
    client.put(
        "/api/admin/operating-periods",
        headers=admin_headers,
        json={
            "periods": [
                {
                    "period_key": "lunch",
                    "label": "午餐",
                    "start_time": "11:00",
                    "end_time": "14:30",
                    "sort_order": 0,
                    "enabled": True,
                    "color": "#f97316",
                    "icon": "午",
                },
                {
                    "period_key": "afternoon",
                    "label": "下午茶",
                    "start_time": "14:30",
                    "end_time": "17:00",
                    "sort_order": 1,
                    "enabled": True,
                    "color": "#f59e0b",
                    "icon": "茶",
                },
                {
                    "period_key": "dinner",
                    "label": "晚餐",
                    "start_time": "17:00",
                    "end_time": "22:00",
                    "sort_order": 2,
                    "enabled": True,
                    "color": "#ef4444",
                    "icon": "晚",
                },
            ]
        },
    )


def test_operating_periods_invalid_chain(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.put(
        "/api/admin/operating-periods",
        headers=admin_headers,
        json={
            "periods": [
                {
                    "period_key": "p1",
                    "label": "时段1",
                    "start_time": "12:00",
                    "end_time": "13:00",
                    "sort_order": 0,
                    "enabled": True,
                    "color": "#f97316",
                    "icon": "A",
                },
                {
                    "period_key": "p2",
                    "label": "时段2",
                    "start_time": "12:30",
                    "end_time": "14:00",
                    "sort_order": 1,
                    "enabled": True,
                    "color": "#f59e0b",
                    "icon": "B",
                },
            ]
        },
    )
    assert r.status_code == 400
