"""欣欣云短信 HTTP 调用（返回 JSON；响应正文可能不是 UTF-8）。"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .sms_settings_util import sanitize_sms_gateway_words

logger = logging.getLogger(__name__)

DEFAULT_SEND_URL = "https://sms.shxinxinyun.com/api/send-sms-batch"
DEFAULT_BALANCE_URL = "https://sms.shxinxinyun.com/api/balance"

# 文档：403/404 时需带此 User-Agent
UA = "application/x-www-form-urlencoded"


def _decode_json_bytes(raw: bytes, *, charset: str | None = None) -> str:
    """
    欣欣云短信接口响应有时会用 GBK/GB18030 编码返回 JSON，
    若错误按 UTF-8 解码会导致 msg 字段出现乱码。
    """
    candidates: list[str] = []
    if charset:
        candidates.append(charset)
    # 常见中文编码回退：先严格 UTF-8，不行再兼容解码
    candidates.extend(["utf-8", "gb18030", "gbk"])

    last_err: Exception | None = None
    for enc in candidates:
        try:
            return raw.decode(enc)
        except UnicodeDecodeError as e:
            last_err = e
            continue

    # 最后兜底：不希望直接抛错导致短信失败
    if last_err is not None:
        logger.warning("短信接口返回解码失败，已回退替换字符: %s", last_err)
    return raw.decode("utf-8", errors="replace")


def _post_form(url: str, data: dict[str, str], timeout: float = 15.0) -> dict[str, Any]:
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": UA,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw_bytes = resp.read()
            try:
                resp_charset = resp.headers.get_content_charset()
            except Exception:
                resp_charset = None
            raw = _decode_json_bytes(raw_bytes, charset=resp_charset)
    except urllib.error.HTTPError as e:
        raw_bytes = e.read()
        try:
            resp_charset = e.headers.get_content_charset()
        except Exception:
            resp_charset = None
        raw = _decode_json_bytes(raw_bytes, charset=resp_charset)
        logger.warning("短信接口 HTTP 错误: %s %s", e.code, raw[:500])
        raise
    except OSError as e:
        logger.warning("短信接口网络错误: %s", e)
        raise
    try:
        out = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("短信接口非 JSON: %s", raw[:500])
        raise ValueError("短信接口返回非 JSON") from None
    return out


def _get_json(url: str, params: dict[str, str], timeout: float = 15.0) -> dict[str, Any]:
    q = urllib.parse.urlencode(params)
    full = f"{url}?{q}"
    req = urllib.request.Request(
        full,
        method="GET",
        headers={
            "User-Agent": UA,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw_bytes = resp.read()
            try:
                resp_charset = resp.headers.get_content_charset()
            except Exception:
                resp_charset = None
            raw = _decode_json_bytes(raw_bytes, charset=resp_charset)
    except OSError as e:
        logger.warning("短信接口网络错误: %s", e)
        raise
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("短信接口非 JSON: %s", raw[:500])
        raise ValueError("短信接口返回非 JSON") from None


def send_sms_batch(
    *,
    sp_id: str,
    password_md5: str,
    mobiles: str,
    content: str,
    send_url: str | None = None,
    ext: str | None = None,
) -> dict[str, Any]:
    """批量发送（单条也可），content 须含【企业签名】+正文。"""
    url = send_url or DEFAULT_SEND_URL
    content = sanitize_sms_gateway_words(content)
    data: dict[str, str] = {
        "sp_id": sp_id,
        "mobiles": mobiles,
        "content": content,
        "password": password_md5,
    }
    if ext:
        data["ext"] = ext
    return _post_form(url, data)


def query_balance(
    *,
    sp_id: str,
    password_md5: str,
    balance_url: str | None = None,
) -> dict[str, Any]:
    url = balance_url or DEFAULT_BALANCE_URL
    return _get_json(
        url,
        {"sp_id": sp_id, "password": password_md5},
    )
