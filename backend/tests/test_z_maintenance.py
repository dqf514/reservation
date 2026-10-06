"""清空数据：文件名以 z 开头，确保在默认字母序下最后执行。"""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_clear_reservations_structure(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.post("/api/admin/maintenance/clear-reservations", headers=admin_headers)
    assert r.status_code == 200
    j = r.json()
    assert "deleted_deposits" in j
    assert "deleted_reservations" in j
    assert "deleted_customers" in j
    assert "message" in j
    assert isinstance(j["deleted_reservations"], int)
