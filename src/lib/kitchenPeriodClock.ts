import { toLocalYmd } from "@/lib/dateLocal";

/** 与后端 `period_key_for_time_slot` 一致的营业餐段（须已按 sort_order 排序） */
export type KitchenPeriodRow = {
  period_key: string;
  start_time: string;
  end_time: string;
  sort_order: number;
};

function toMinutes(hm: string): number {
  const [h, m] = hm.trim().split(":").map(Number);
  return h * 60 + m;
}

/** 与 backend `periods.period_key_for_time_slot` 对齐 */
export function periodKeyForTimeSlot(periods: KitchenPeriodRow[], timeSlot: string): string {
  if (!periods.length) return "default";
  const t = toMinutes(timeSlot);
  const lastSort = Math.max(...periods.map((p) => p.sort_order));
  for (const p of periods) {
    const isLast = p.sort_order === lastSort;
    const start = toMinutes(p.start_time);
    const end = toMinutes(p.end_time);
    if (start <= t && t <= end) {
      if (isLast) return p.period_key;
      if (t < end) return p.period_key;
    }
  }
  if (t < toMinutes(periods[0].start_time)) return periods[0].period_key;
  return periods[periods.length - 1].period_key;
}

/**
 * 厨房「下一顿」准备：本地当前时间下一餐段 + 该餐所在日期（本地日历日）。
 * periods 须为已启用、按 sort_order 排好序。
 */
export function computeNextPrepMeal(
  periods: KitchenPeriodRow[],
  now: Date,
): { ymd: string; periodKey: string } {
  if (!periods.length) {
    return { ymd: toLocalYmd(now), periodKey: "default" };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const t = toMinutes(hm);
  const p0start = toMinutes(periods[0].start_time);
  const last = periods[periods.length - 1];
  const lastEnd = toMinutes(last.end_time);

  if (t < p0start) {
    return { ymd: toLocalYmd(now), periodKey: periods[0].period_key };
  }
  if (t > lastEnd) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { ymd: toLocalYmd(tomorrow), periodKey: periods[0].period_key };
  }

  const pk = periodKeyForTimeSlot(periods, hm);
  const idx = periods.findIndex((p) => p.period_key === pk);
  if (idx < 0) {
    return { ymd: toLocalYmd(now), periodKey: periods[0].period_key };
  }
  if (idx < periods.length - 1) {
    return { ymd: toLocalYmd(now), periodKey: periods[idx + 1].period_key };
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { ymd: toLocalYmd(tomorrow), periodKey: periods[0].period_key };
}
