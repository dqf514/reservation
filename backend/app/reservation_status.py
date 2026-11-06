"""预订状态常量。

集中定义，避免 ``floor_logic`` 与 ``table_capacity_util`` 之间产生循环依赖
（两者都需要「终态」这一概念）。
"""

# 终态：不再占用桌台，也不计入房间容量
TERMINAL = frozenset({"left", "noshow", "cancelled"})
