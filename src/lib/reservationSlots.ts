import type { OperatingPeriodsDTO } from "@/types/operatingPeriods";

function parseHM(s: string): number {
  const p = s.trim().split(":");
  const h = Number.parseInt(p[0] ?? "0", 10);
  const m = Number.parseInt(p[1] ?? "0", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function fmt(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 按 30 分钟步长生成顾客端可选时刻（午餐/下午茶左闭右开，晚餐含结束时刻） */
export function buildReservationSlots(b: OperatingPeriodsDTO): string[] {
  const arr = [...(b.periods ?? [])]
    .filter((x) => x.enabled)
    .sort((a, z) => a.sort_order - z.sort_order);
  const out: string[] = [];
  if (!arr.length) return out;

  arr.forEach((p, idx) => {
    const st = parseHM(p.start_time);
    const ed = parseHM(p.end_time);
    for (let m = st; idx === arr.length - 1 ? m <= ed : m < ed; m += 30) {
      out.push(fmt(m));
    }
  });

  return out;
}
