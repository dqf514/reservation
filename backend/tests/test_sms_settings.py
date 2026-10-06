from __future__ import annotations

from fastapi.testclient import TestClient

from app.sms_settings_util import normalize_sms_text, sanitize_sms_gateway_words


def test_normalize_sms_text_preserves_newlines() -> None:
    assert normalize_sms_text("a\nb") == "a\nb"
    assert normalize_sms_text("a  \n  b") == "a\nb"
    assert normalize_sms_text("a\r\nb") == "a\nb"


def test_sanitize_xiaojie_to_nvshi() -> None:
    assert sanitize_sms_gateway_words("张小姐您好") == "张女士您好"
    assert normalize_sms_text("尊敬的{name}".replace("{name}", "张小姐")) == "尊敬的张女士"


def test_sms_settings_get_super_admin(client: TestClient, admin_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/sms-settings", headers=admin_headers)
    assert r.status_code == 200
    j = r.json()
    assert "enabled" in j
    assert "sp_id" in j
    assert "template_success" in j


def test_sms_settings_forbidden_manager(client: TestClient, manager_headers: dict[str, str]) -> None:
    r = client.get("/api/admin/sms-settings", headers=manager_headers)
    assert r.status_code == 403
