"""顾客端首页等活动文案（非真实订单，由 /api/home/summary 下发；与 SQLite 业务数据分离）。"""

from __future__ import annotations

# tone 与顾客端 Tailwind 渐变类名一致，修改时请保留 `from-…/… to-…/…` 格式以免样式断裂
HOME_PROMOTIONS: list[dict[str, str]] = [
    {
        "title": "春鲜赏味季",
        "sub": "时令菜单上新 · 预订优先安排窗边位",
        "tone": "from-amber-700/90 to-orange-600/85",
    },
    {
        "title": "小酒馆之夜",
        "sub": "精选杯卖葡萄酒 · 周四限定加购",
        "tone": "from-rose-800/90 to-red-700/85",
    },
    {
        "title": "周末早午餐",
        "sub": "周六日 10:30 起 · 家庭与好友聚餐推荐",
        "tone": "from-emerald-800/88 to-teal-700/85",
    },
    {
        "title": "生日与纪念日",
        "sub": "提前备注可享桌面布置 · 赠甜品一份（详询门店）",
        "tone": "from-violet-800/88 to-fuchsia-700/85",
    },
]
