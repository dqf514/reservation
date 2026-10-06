import type { ServicePeriod } from "@/types";
import { DEFAULT_OPERATING_PERIODS, type OperatingPeriodsDTO } from "@/types/operatingPeriods";

function timeToMinutes(raw: string): number {
  const p = raw.trim().split(":");
  const h = Number.parseInt(p[0] ?? "12", 10);
  const m = Number.parseInt(p[1] ?? "0", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** 与后端 time_in_period_db 规则一致（从运营时段配置中找匹配 period_key） */
export function timeSlotToPeriod(
  timeSlot: string,
  bounds: OperatingPeriodsDTO = DEFAULT_OPERATING_PERIODS,
): ServicePeriod {
  const raw = timeSlot.trim();
  if (!raw) return "lunch";
  const mins = timeToMinutes(raw);
  const periods = (bounds.periods ?? []).filter((p) => p.enabled).sort((a, z) => a.sort_order - z.sort_order);
  if (!periods.length) return "lunch";

  for (const p of periods) {
    const st = timeToMinutes(p.start_time);
    const ed = timeToMinutes(p.end_time);
    const isLast = p.sort_order === periods[periods.length - 1]!.sort_order;
    if (isLast) {
      if (mins >= st && mins <= ed) return p.period_key as ServicePeriod;
    } else {
      if (mins >= st && mins < ed) return p.period_key as ServicePeriod;
    }
  }
  if (mins < timeToMinutes(periods[0]!.start_time)) return periods[0]!.period_key;
  return periods[periods.length - 1]!.period_key;
}

export function periodLabel(
  p: ServicePeriod,
  bounds: OperatingPeriodsDTO = DEFAULT_OPERATING_PERIODS,
): string {
  const periods = (bounds.periods ?? []).filter((x) => x.enabled).sort((a, z) => a.sort_order - z.sort_order);
  const row = periods.find((x) => x.period_key === p);
  if (!row) return p;
  return `${row.label} ${row.start_time}–${row.end_time}${" "}`;
}
