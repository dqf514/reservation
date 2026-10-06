from fastapi.testclient import TestClient


def test_manager_can_dashboard(client: TestClient, manager_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/dashboard/summary", headers=manager_headers)
    assert r.status_code == 200


def test_manager_forbidden_branding_put(client: TestClient, manager_headers: dict[str, str]) -> None:
    r = client.put(
        "/api/admin/branding",
        headers=manager_headers,
        json={"company_name": "hack"},
    )
    assert r.status_code == 403


def test_manager_forbidden_users_api(client: TestClient, manager_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/users", headers=manager_headers)
    assert r.status_code == 403


def test_super_admin_users_crud(client: TestClient, admin_headers: dict[str, str]) -> None:
    from uuid import uuid4

    uname = f"staff_{uuid4().hex[:8]}"
    r = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={"username": uname, "password": "secret12"},
    )
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    assert r.json()["role"] == "manager"

    r2 = client.get("/api/admin/users", headers=admin_headers)
    assert r2.status_code == 200
    names = {x["username"] for x in r2.json()}
    assert uname in names

    r3 = client.delete(f"/api/admin/users/{uid}", headers=admin_headers)
    assert r3.status_code == 200
