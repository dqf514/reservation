import { describe, expect, it } from "vitest";
import type { DiningTableItem } from "@/types/admin";
import { diningTableItemsToNodes } from "./diningTableNodes";

describe("diningTableItemsToNodes", () => {
  it("映射为 TableNode 且启用为空桌样式", () => {
    const items: DiningTableItem[] = [
      {
        id: 3,
        code: "t1",
        label: "临窗①",
        shape: "circle",
        pos_x: 12,
        pos_y: 14,
        pos_size: 11,
        sort_order: 0,
        capacity: 4,
        is_active: true,
      },
    ];
    const nodes = diningTableItemsToNodes(items);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: "t1",
      dbId: 3,
      label: "临窗①",
      x: 12,
      y: 14,
      size: 11,
      shape: "circle",
      status: "empty",
    });
  });

  it("停用为不可用样式", () => {
    const items: DiningTableItem[] = [
      {
        id: 1,
        code: "v5",
        label: "维护",
        shape: "square",
        pos_x: 8,
        pos_y: 88,
        pos_size: 12,
        sort_order: 0,
        capacity: 4,
        is_active: false,
      },
    ];
    expect(diningTableItemsToNodes(items)[0].status).toBe("unavailable");
  });
});
