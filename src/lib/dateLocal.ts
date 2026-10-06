/** 使用本地时区展示日期时间 */
export function formatZhDate(d: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(d);
}

export function formatZhDateShort(d: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(d);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → "MM-DD"（无年份，用于打印等） */
export function formatYmdToMonthDay(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const t = ymd.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[2]}-${m[3]}`;
  return t;
}

/** API 返回的 "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DD HH:mm"（精确到分钟） */
export function formatApiDateTimeToMinute(s: string | null | undefined): string {
  if (!s) return "—";
  const t = s.trim();
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/.exec(t);
  if (m) return `${m[1]} ${m[2]}`;
  return t;
}
