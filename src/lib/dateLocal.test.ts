import { describe, expect, it } from "vitest";
import { isSameLocalDay, startOfLocalDay, toLocalYmd } from "./dateLocal";

describe("dateLocal", () => {
  it("toLocalYmd 输出 YYYY-MM-DD", () => {
    const d = new Date(2026, 2, 15, 14, 30, 0);
    expect(toLocalYmd(d)).toBe("2026-03-15");
  });

  it("startOfLocalDay 将时间归零", () => {
    const d = new Date(2026, 0, 10, 23, 59, 59, 999);
    const s = startOfLocalDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
  });

  it("isSameLocalDay 同日为 true", () => {
    const a = new Date(2026, 5, 1, 8, 0);
    const b = new Date(2026, 5, 1, 22, 0);
    expect(isSameLocalDay(a, b)).toBe(true);
  });

  it("isSameLocalDay 跨日为 false", () => {
    const a = new Date(2026, 5, 1, 23, 0);
    const b = new Date(2026, 5, 2, 1, 0);
    expect(isSameLocalDay(a, b)).toBe(false);
  });
});
