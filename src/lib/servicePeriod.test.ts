import { describe, expect, it } from "vitest";
import { timeSlotToPeriod } from "./servicePeriod";

describe("timeSlotToPeriod", () => {
  it("午餐时段", () => {
    expect(timeSlotToPeriod("12:00")).toBe("lunch");
    expect(timeSlotToPeriod("11:00")).toBe("lunch");
    expect(timeSlotToPeriod("14:00")).toBe("lunch");
  });

  it("下午茶", () => {
    expect(timeSlotToPeriod("14:30")).toBe("afternoon");
    expect(timeSlotToPeriod("15:00")).toBe("afternoon");
    expect(timeSlotToPeriod("16:30")).toBe("afternoon");
  });

  it("14:29 仍属午餐时段", () => {
    expect(timeSlotToPeriod("14:29")).toBe("lunch");
  });

  it("晚餐", () => {
    expect(timeSlotToPeriod("18:30")).toBe("dinner");
    expect(timeSlotToPeriod("22:00")).toBe("dinner");
  });

  it("早于 11:00 归入午餐视图", () => {
    expect(timeSlotToPeriod("10:30")).toBe("lunch");
  });

  it("晚于 22:00 归入晚餐视图", () => {
    expect(timeSlotToPeriod("22:30")).toBe("dinner");
  });
});
