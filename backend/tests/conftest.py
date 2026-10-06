"""测试前设置独立数据库，避免污染本地 app.db。"""

from __future__ import annotations

import os

# 必须在首次 import app 之前执行
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_token(client: TestClient) -> str:
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def manager_headers(client: TestClient, admin_headers: dict[str, str]) -> dict[str, str]:
    """创建临时预订管理员，用毕删除。"""
    from uuid import uuid4

    uname = f"mgr_{uuid4().hex[:10]}"
    r = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={"username": uname, "password": "mypass12345"},
    )
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    lr = client.post("/api/auth/login", json={"username": uname, "password": "mypass12345"})
    assert lr.status_code == 200, lr.text
    token = lr.json()["access_token"]
    yield {"Authorization": f"Bearer {token}"}
    client.delete(f"/api/admin/users/{uid}", headers=admin_headers)
