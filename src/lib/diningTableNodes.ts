import type { DiningTableItem } from "@/types/admin";
import type { TableNode } from "@/types";

/** 将餐位主数据转为平面图节点（布局编辑用，不展示预订态） */
export function diningTableItemsToNodes(items: DiningTableItem[]): TableNode[] {
  function normalizeShape(shape: string): TableNode["shape"] {
    if (shape === "square") return "square";
    if (shape === "rect_h") return "rect_h";
    if (shape === "rect_v") return "rect_v";
    return "circle";
  }

  return items.map((t) => ({
    id: t.code,
    dbId: t.id,
    label: t.label,
    x: t.pos_x,
    y: t.pos_y,
    size: t.pos_size,
    shape: normalizeShape(t.shape),
    capacity: t.capacity,
    ratio: t.is_active ? `0/${t.capacity}` : undefined,
    status: t.is_active ? "empty" : "unavailable",
  }));
}
