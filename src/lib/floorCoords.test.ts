import { describe, expect, it } from "vitest";
import { clientPointToContainerPercent } from "./floorCoords";

describe("clientPointToContainerPercent", () => {
  it("容器中心对应约 50% 50%", () => {
    const rect = { left: 100, top: 80, width: 200, height: 160 } as DOMRect;
    expect(clientPointToContainerPercent(rect, 200, 160)).toEqual({ x: 50, y: 50 });
  });

  it("左上角为 0 0", () => {
    const rect = { left: 50, top: 50, width: 100, height: 100 } as DOMRect;
    expect(clientPointToContainerPercent(rect, 50, 50)).toEqual({ x: 0, y: 0 });
  });

  it("超出范围时钳制到 0–100", () => {
    const rect = { left: 0, top: 0, width: 100, height: 100 } as DOMRect;
    expect(clientPointToContainerPercent(rect, -20, 50)).toEqual({ x: 0, y: 50 });
    expect(clientPointToContainerPercent(rect, 150, 200)).toEqual({ x: 100, y: 100 });
  });

  it("保留两位小数", () => {
    const rect = { left: 0, top: 0, width: 3, height: 3 } as DOMRect;
    const p = clientPointToContainerPercent(rect, 1, 1);
    expect(p.x).toBeCloseTo(33.33, 2);
    expect(p.y).toBeCloseTo(33.33, 2);
  });
});
