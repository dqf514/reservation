from __future__ import annotations

from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_login_success(client: TestClient) -> None:
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert len(data["access_token"]) > 10


def test_login_fail(client: TestClient) -> None:
    r = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 400


def test_me_requires_auth(client: TestClient) -> None:
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_with_token(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.get("/api/auth/me", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["username"] == "admin"
    assert r.json()["role"] == "admin"
