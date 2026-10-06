"""兼容旧文件：原“预订自动确认”在新版中已替换为“网上预约通道”。"""

from __future__ import annotations

from sqlalchemy.orm import Session

from .online_reservation_settings_util import (
    get_or_create_online_reservation_settings,
)


def get_or_create_auto_confirm_settings(db: Session):
    # 历史代码可能仍在 import 该 util；为避免运行时崩溃，重定向到线上通道配置。
    return get_or_create_online_reservation_settings(db)
