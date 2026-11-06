import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type {
  CalendarMonthResponse,
  CalendarMonthlyTrendResponse,
  DiningTableItem,
} from "@/types/admin";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const SOLAR_TERMS = [
  "小寒",
  "大寒",
  "立春",
  "雨水",
  "惊蛰",
  "春分",
  "清明",
  "谷雨",
  "立夏",
  "小满",
  "芒种",
  "夏至",
  "小暑",
  "大暑",
  "立秋",
  "处暑",
  "白露",
  "秋分",
  "寒露",
  "霜降",
  "立冬",
  "小雪",
  "大雪",
  "冬至",
] as const;
const TERM_STYLE: Record<
  string,
  { icon: "spring" | "summer" | "autumn" | "winter"; cls: string }
> = {
  立春: { icon: "spring", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  雨水: { icon: "spring", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  惊蛰: { icon: "spring", cls: "bg-lime-50 text-lime-700 ring-lime-200" },
  春分: { icon: "spring", cls: "bg-green-50 text-green-700 ring-green-200" },
  清明: { icon: "spring", cls: "bg-teal-50 text-teal-700 ring-teal-200" },
  谷雨: { icon: "spring", cls: "bg-cyan-50 text-cyan-700 ring-cyan-200" },

  立夏: { icon: "summer", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  小满: { icon: "summer", cls: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  芒种: { icon: "summer", cls: "bg-orange-50 text-orange-700 ring-orange-200" },
  夏至: { icon: "summer", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  小暑: { icon: "summer", cls: "bg-red-50 text-red-700 ring-red-200" },
  大暑: { icon: "summer", cls: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" },

  立秋: { icon: "autumn", cls: "bg-orange-50 text-orange-700 ring-orange-200" },
  处暑: { icon: "autumn", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  白露: { icon: "autumn", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  秋分: { icon: "autumn", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  寒露: { icon: "autumn", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
  霜降: { icon: "autumn", cls: "bg-purple-50 text-purple-700 ring-purple-200" },

  立冬: { icon: "winter", cls: "bg-slate-50 text-slate-700 ring-slate-200" },
  小雪: { icon: "winter", cls: "bg-zinc-50 text-zinc-700 ring-zinc-200" },
  大雪: { icon: "winter", cls: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
  冬至: { icon: "winter", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  小寒: { icon: "winter", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  大寒: { icon: "winter", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
};
// 1901-2000 / 2001-2100 常用节气系数
const TERM_C20 = [
  6.11, 20.84, 4.6295, 19.4599, 6.3826, 21.4155, 4.81, 20.1, 5.52, 21.04,
  5.678, 21.37, 7.108, 22.83, 7.5, 23.13, 7.646, 23.042, 8.318, 23.438,
  7.438, 22.36, 7.18, 21.94,
];
const TERM_C21 = [
  5.4055, 20.12, 3.87, 18.73, 5.63, 20.646, 4.81, 20.1, 5.52, 21.04, 5.678,
  21.37, 7.108, 22.83, 7.5, 23.13, 7.646, 23.042, 8.318, 23.438, 7.438, 22.36,
  7.18, 21.94,
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number,
): number {
  const first = new Date(year, month - 1, 1).getDay();
  const offset = (weekday - first + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function getEasterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function getLunarLabel(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      month: "long",
      day: "numeric",
    }).formatToParts(date);
    const month = parts.find((x) => x.type === "month")?.value ?? "";
    const day = parts.find((x) => x.type === "day")?.value ?? "";
    if (!month || !day) return "";
    return `${month}${day}`;
  } catch {
    return "";
  }
}

function getSolarTermLabel(date: Date): string {
  const y = date.getFullYear();
  if (y < 1901 || y > 2100) return "";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const yy = y % 100;
  const cArr = y <= 2000 ? TERM_C20 : TERM_C21;

  // 每月两个节气：奇数月索引从 (month-1)*2 开始
  const idxA = (month - 1) * 2;
  const idxB = idxA + 1;
  const dayA = Math.floor(yy * 0.2422 + cArr[idxA]) - Math.floor((yy - 1) / 4);
  const dayB = Math.floor(yy * 0.2422 + cArr[idxB]) - Math.floor((yy - 1) / 4);

  // 已知常见修正（覆盖近年常见偏差）
  const fixes: Record<string, number> = {
    "2026-02-0": 1, // 雨水
    "2026-11-0": 1, // 立冬
  };
  const fixA = fixes[`${y}-${pad2(month)}-0`] ?? 0;
  const fixB = fixes[`${y}-${pad2(month)}-1`] ?? 0;

  if (day === dayA + fixA) return SOLAR_TERMS[idxA];
  if (day === dayB + fixB) return SOLAR_TERMS[idxB];
  return "";
}

function SolarTermBadge({ term }: { term: string }) {
  const style = TERM_STYLE[term] ?? {
    icon: "spring" as const,
    cls: "bg-stone-50 text-stone-700 ring-stone-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1 py-[1px] text-[10px] font-semibold ring-1 ${style.cls}`}
      title={`节气：${term}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          style.icon === "spring"
            ? "bg-emerald-500"
            : style.icon === "summer"
            ? "bg-orange-500"
            : style.icon === "autumn"
            ? "bg-amber-500"
            : "bg-sky-500"
        }`}
      />
      {term}
    </span>
  );
}

function getHolidayLabel(date: Date, lunarLabel: string): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const md = `${pad2(m)}-${pad2(d)}`;

  const solar: Record<string, string> = {
    "01-01": "元旦",
    "02-14": "情人节",
    "03-08": "妇女节",
    "05-01": "劳动节",
    "06-01": "儿童节",
    "10-01": "国庆节",
    "12-24": "平安夜",
    "12-25": "圣诞节",
  };
  if (solar[md]) return solar[md];

  const motherDay = getNthWeekdayOfMonth(y, 5, 0, 2);
  if (m === 5 && d === motherDay) return "母亲节";
  const fatherDay = getNthWeekdayOfMonth(y, 6, 0, 3);
  if (m === 6 && d === fatherDay) return "父亲节";
  const thanksDay = getNthWeekdayOfMonth(y, 11, 4, 4);
  if (m === 11 && d === thanksDay) return "感恩节";
  if (m === 11 && d === thanksDay + 1) return "黑五";
  const easter = getEasterDate(y);
  if (m === easter.month && d === easter.day) return "复活节";

  const lunarFestivals: Record<string, string> = {
    "正月1": "春节",
    "正月15": "元宵",
    "五月5": "端午",
    "八月15": "中秋",
    "腊月30": "除夕",
    "腊月29": "除夕",
  };
  return lunarFestivals[lunarLabel] ?? "";
}

export function AdminCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarMonthResponse | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<
    CalendarMonthlyTrendResponse["items"]
  >([]);
  /** 统计口径：空字符串 = 全店；否则只统计该桌台（房间等） */
  const [tableCode, setTableCode] = useState<string>("");
  const [tableOptions, setTableOptions] = useState<DiningTableItem[]>([]);
  /** 当前月份网格优先：首屏为 true，避免与趋势请求争抢 */
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** 月度趋势是否已拉取结束（成功或失败）；未完成前可因切换月份重试 */
  const trendDoneRef = useRef(false);

  /** 桌台列表：用于「按桌台统计」下拉 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await apiFetch<DiningTableItem[]>("/api/admin/dining-tables");
        if (!cancelled) setTableOptions(Array.isArray(raw) ? raw : []);
      } catch {
        if (!cancelled) setTableOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 统计口径变化时，趋势需重新拉取 */
  useEffect(() => {
    trendDoneRef.current = false;
    setMonthlyTrend([]);
  }, [tableCode]);

  const tableScopeLabel = useMemo(() => {
    if (!tableCode) return "全店";
    const t = tableOptions.find((x) => x.code === tableCode);
    return t ? t.label : tableCode;
  }, [tableCode, tableOptions]);

  /** 以当前查看月为基准，前后各 6 个月（共 13 个）供下拉跳转 */
  const monthSelectOptions = useMemo(() => {
    const out: { y: number; m: number; value: string; label: string }[] = [];
    for (let delta = -6; delta <= 6; delta++) {
      const t = new Date(year, month - 1 + delta, 1);
      const y = t.getFullYear();
      const m = t.getMonth() + 1;
      const value = `${y}-${String(m).padStart(2, "0")}`;
      out.push({ y, m, value, label: `${y} 年 ${m} 月` });
    }
    return out;
  }, [year, month]);

  const monthSelectValue = `${year}-${String(month).padStart(2, "0")}`;

  /** 切换月份时取消上一次请求的结果，避免较慢的旧请求覆盖当前月数据（竞态）。 */
  useEffect(() => {
    let cancelled = false;
    const y = year;
    const m = month;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const q = new URLSearchParams({ year: String(y), month: String(m) });
        if (tableCode) q.set("table_code", tableCode);
        const r = await apiFetch<CalendarMonthResponse>(`/api/admin/calendar/month?${q}`);
        if (cancelled) return;
        setData(r);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "加载失败");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, month, tableCode]);

  /** 当前月数据返回后再延后加载月度趋势（idle 或超时），避免首屏被重查询阻塞 */
  useEffect(() => {
    if (loading || trendDoneRef.current) return;

    let cancelled = false;
    let idleId: number | undefined;
    let fallbackId: ReturnType<typeof setTimeout> | undefined;

    const runTrend = () => {
      if (cancelled) return;
      setTrendLoading(true);
      (async () => {
        try {
          const tq = new URLSearchParams();
          if (tableCode) tq.set("table_code", tableCode);
          const qs = tq.toString();
          const r = await apiFetch<CalendarMonthlyTrendResponse>(
            `/api/admin/calendar/monthly-trend${qs ? `?${qs}` : ""}`,
          );
          if (!cancelled) setMonthlyTrend(r.items || []);
        } catch {
          if (!cancelled) setMonthlyTrend([]);
        } finally {
          if (!cancelled) {
            setTrendLoading(false);
            trendDoneRef.current = true;
          }
        }
      })();
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(
        () => {
          if (!cancelled) runTrend();
        },
        { timeout: 3000 },
      );
    } else {
      fallbackId = window.setTimeout(() => {
        if (!cancelled) runTrend();
      }, 16);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (fallbackId !== undefined) window.clearTimeout(fallbackId);
    };
  }, [loading, tableCode]);

  const monthLen = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const firstWeekday = useMemo(() => new Date(year, month - 1, 1).getDay(), [year, month]);

  const countByDate = useMemo(() => {
    const m = new Map<string, CalendarMonthResponse["days"][number]>();
    data?.days.forEach((d) => m.set(d.date, d));
    return m;
  }, [data]);

  function shiftMonth(delta: number) {
    const cur = new Date(year, month - 1, 1);
    cur.setMonth(cur.getMonth() + delta);
    setYear(cur.getFullYear());
    setMonth(cur.getMonth() + 1);
  }

  const monthSummary = useMemo(() => {
    const totalCount = data?.month_total_count ?? 0;
    const totalParty = data?.month_total_party ?? 0;
    const byPeriod = new Map<string, { label: string; count: number; party: number }>();
    for (const d of data?.days ?? []) {
      for (const p of d.by_period ?? []) {
        const prev = byPeriod.get(p.period_key) ?? { label: p.label, count: 0, party: 0 };
        prev.count += p.count;
        prev.party += p.party;
        byPeriod.set(p.period_key, prev);
      }
    }
    return { totalCount, totalParty, byPeriod: Array.from(byPeriod.values()) };
  }, [data]);

  const maxParty = useMemo(() => {
    return Math.max(0, ...((data?.days ?? []).map((d) => d.party || 0)));
  }, [data]);

  function dayCardTone(party: number): string {
    if (party <= 0 || maxParty <= 0) return "bg-white";
    const ratio = party / maxParty;
    if (ratio >= 0.75) return "bg-orange-200/80";
    if (ratio >= 0.5) return "bg-orange-100/90";
    if (ratio >= 0.25) return "bg-amber-50/90";
    return "bg-orange-50/70";
  }

  const cells = useMemo(() => {
    const out: { day: number | null; dateStr: string | null; info: CalendarMonthResponse["days"][number] | null }[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push({ day: null, dateStr: null, info: null });
    for (let d = 1; d <= monthLen; d++) {
      const ds = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({ day: d, dateStr: ds, info: countByDate.get(ds) ?? null });
    }
    while (out.length % 7 !== 0) out.push({ day: null, dateStr: null, info: null });
    return out;
  }, [year, month, monthLen, firstWeekday, countByDate]);

  const maxPartyChart = useMemo(() => {
    return Math.max(1, ...((data?.days ?? []).map((d) => d.party || 0)));
  }, [data]);
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-0 w-full flex-col overflow-hidden px-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">预订日历</h1>
          <p className="mt-1 text-sm text-stone-500">
            按日显示单量/人数（琥珀色为单量，蓝色为人数）。今日及过去含离席、散客等实际到店（不含取消、爽约）；未来仅计有效预订。点击某日进入预订列表。
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {loading ? (
            <span
              className="shrink-0 text-sm font-medium text-brand-coral animate-pulse"
              aria-live="polite"
            >
              加载中…
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            aria-label="查看上月"
            title="上月"
          >
            ←
          </button>
          <div className="relative min-w-[10rem]">
            <label htmlFor="calendar-month-select" className="sr-only">
              选择月份（当前查看月前后各 6 个月）
            </label>
            <select
              id="calendar-month-select"
              value={monthSelectValue}
              title="选择月份（当前查看月前后各 6 个月）"
              aria-label="选择月份"
              onChange={(e) => {
                const v = e.target.value;
                const [ys, ms] = v.split("-");
                const ny = Number(ys);
                const nm = Number(ms);
                if (!Number.isFinite(ny) || !Number.isFinite(nm)) return;
                setYear(ny);
                setMonth(nm);
              }}
              className="w-full cursor-pointer appearance-none rounded-lg border border-stone-200 bg-white py-1.5 pl-3 pr-9 text-center text-sm font-medium text-stone-800 hover:border-stone-300 focus:border-brand-coral focus:outline-none focus:ring-2 focus:ring-brand-coral/25"
            >
              {monthSelectOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400"
              aria-hidden
            >
              ▾
            </span>
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            aria-label="查看下月"
            title="下月"
          >
            →
          </button>
          <div className="relative min-w-[9rem]">
            <label htmlFor="calendar-table-select" className="sr-only">
              统计范围（按桌台）
            </label>
            <select
              id="calendar-table-select"
              value={tableCode}
              title="统计范围：选择桌台后只统计该桌台（含房间型桌台的散客入席）"
              aria-label="统计范围"
              onChange={(e) => setTableCode(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-lg border border-stone-200 bg-white py-1.5 pl-3 pr-9 text-sm font-medium text-stone-800 hover:border-stone-300 focus:border-brand-coral focus:outline-none focus:ring-2 focus:ring-brand-coral/25"
            >
              <option value="">全店</option>
              {tableOptions.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                  {t.table_type === "room" ? "（房间）" : ""}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400"
              aria-hidden
            >
              ▾
            </span>
          </div>
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-4 grid min-h-0 flex-1 items-stretch gap-4 xl:grid-cols-[1.05fr_1.45fr]">
        <section className="flex min-h-0 h-full flex-col gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-stone-500">本月累计</p>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                统计范围：{tableScopeLabel}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-stone-100 p-3">
                <p className="text-xs text-stone-500">预订单量</p>
                <p className="mt-1 text-lg font-semibold text-stone-800">{monthSummary.totalCount} 单</p>
              </div>
              <div className="rounded-xl bg-stone-100 p-3">
                <p className="text-xs text-stone-500">总人数</p>
                <p className="mt-1 text-lg font-semibold text-stone-800">{monthSummary.totalParty} 位</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {monthSummary.byPeriod.slice(0, 3).map((p) => (
                <div key={p.label} className="rounded-xl bg-orange-50 p-3">
                  <p className="text-xs text-orange-600">{p.label}</p>
                  <p className="mt-1 text-right text-sm font-semibold tabular-nums text-orange-700">
                    {p.count}/{p.party}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 rounded-2xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-800">
                每日预订趋势
              </p>
            </div>
            <div className="mt-3 h-[300px] min-h-[240px] max-h-[340px] overflow-hidden rounded-xl border border-stone-100 bg-stone-50 p-2">
              <svg viewBox="0 0 1000 280" className="h-full w-full overflow-hidden">
                <line x1="20" y1="250" x2="980" y2="250" stroke="#d6d3d1" strokeWidth="1" />
                {(data?.days ?? []).map((d, idx, arr) => {
                  const n = arr.length || 1;
                  const partyNum = Number(d.party) || 0;
                  const slot = 960 / n;
                  const barW = Math.max(3, slot * 0.7);
                  const x = 20 + idx * slot + (slot - barW) / 2;
                  const h = partyNum > 0 ? Math.max(4, (partyNum / maxPartyChart) * 220) : 0;
                  const y = 250 - h;
                  return (
                    <g key={d.date}>
                      <title>{`${d.date}：${partyNum}位`}</title>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        rx="1.5"
                        fill="#e85d4c"
                        opacity={partyNum > 0 ? 0.92 : 0.25}
                      />
                      {Number(d.date.slice(-2)) % 5 === 0 ? (
                        <text
                          x={x + barW / 2}
                          y="272"
                          fontSize="10"
                          fill="#a8a29e"
                          textAnchor="middle"
                        >
                          {Number(d.date.slice(-2))}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-stone-800">
                  月度预订趋势
                </p>
              </div>
              <div className="mt-2 h-[170px] overflow-hidden rounded-xl border border-stone-100 bg-stone-50 p-2">
                {trendLoading && monthlyTrend.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-stone-500">
                    趋势加载中…
                  </div>
                ) : monthlyTrend.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-stone-500">
                    暂无历史月度数据
                  </div>
                ) : (
                  <svg viewBox="0 0 1000 150" className="h-full w-full overflow-hidden">
                    <line
                      x1="20"
                      y1="130"
                      x2="980"
                      y2="130"
                      stroke="#d6d3d1"
                      strokeWidth="1"
                    />
                    {(() => {
                      const max = Math.max(
                        1,
                        ...monthlyTrend.map((x) => Number(x.party || 0)),
                      );
                      const n = monthlyTrend.length || 1;
                      const slot = 960 / n;
                      return monthlyTrend.map((x, idx) => {
                        const partyNum = Number(x.party) || 0;
                        const barW = Math.max(3, slot * 0.65);
                        const xx = 20 + idx * slot + (slot - barW) / 2;
                        const hh =
                          partyNum > 0
                            ? Math.max(3, (partyNum / max) * 108)
                            : 0;
                        const yy = 130 - hh;
                        return (
                          <g key={x.ym}>
                            <title>{`${x.label}：${x.count}单 / ${x.party}位`}</title>
                            <rect
                              x={xx}
                              y={yy}
                              width={barW}
                              height={hh}
                              rx="1.2"
                              fill="#a78bfa"
                              opacity={partyNum > 0 ? 0.9 : 0.2}
                            />
                            {idx % Math.max(1, Math.floor(n / 8)) === 0 ? (
                              <text
                                x={xx + barW / 2}
                                y="145"
                                fontSize="9"
                                fill="#a8a29e"
                                textAnchor="middle"
                              >
                                {x.ym.slice(2)}
                              </text>
                            ) : null}
                          </g>
                        );
                      });
                    })()}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="min-h-0 overflow-auto rounded-2xl border border-stone-200 bg-white">
          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs font-medium text-stone-600">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-stone-200 p-px">
            {cells.map((c, i) => (
              <div key={i} className="min-h-[6.5rem] bg-white p-1 text-sm">
                {c.day != null && c.dateStr ? (
                  (() => {
                    const dayDate = new Date(`${c.dateStr}T00:00:00`);
                    const lunarLabel = getLunarLabel(dayDate);
                    const solarTerm = getSolarTermLabel(dayDate);
                    const holiday = getHolidayLabel(dayDate, lunarLabel);
                    const isToday = c.dateStr === todayStr;
                    const resParams = new URLSearchParams({
                      date_from: c.dateStr,
                      date_to: c.dateStr,
                    });
                    if (tableCode) resParams.set("table_code", tableCode);
                    const toReservations = `/admin/reservations?${resParams.toString()}`;
                    return (
                  <Link
                    to={toReservations}
                    className={`flex h-full flex-col rounded-lg p-1 hover:bg-stone-50 ${
                      isToday
                        ? "ring-2 ring-brand-coral bg-orange-50/80 shadow-sm"
                        : dayCardTone(c.info?.party ?? 0)
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="min-w-0">
                        <span className={`text-lg font-bold leading-none ${isToday ? "text-brand-coral" : "text-stone-900"}`}>
                          {c.day}
                        </span>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-500">
                          {isToday ? (
                            <span className="rounded bg-brand-coral px-1 py-0.5 text-white">
                              今日
                            </span>
                          ) : null}
                          {solarTerm ? (
                            <SolarTermBadge term={solarTerm} />
                          ) : (
                            <span className="truncate">{lunarLabel || "农历"}</span>
                          )}
                          {holiday ? (
                            <span className="rounded bg-red-50 px-1 py-0.5 text-red-600">
                              {holiday}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {(c.info?.count ?? 0) === 0 && (c.info?.party ?? 0) === 0 ? null : (
                        <span className="text-right text-xs font-medium tabular-nums">
                          <span
                            className={(c.info?.count ?? 0) > 0 ? "text-amber-700" : "text-stone-500"}
                          >
                            {c.info?.count ?? 0}
                          </span>
                          <span className="text-stone-400">/</span>
                          <span
                            className={(c.info?.party ?? 0) > 0 ? "text-sky-700" : "text-stone-500"}
                          >
                            {c.info?.party ?? 0}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {(c.info?.by_period ?? []).map((p) => {
                        // 期内总预订=0且总人数=0时，整行都不显示（包含餐段文字）
                        if ((p.count ?? 0) === 0 && (p.party ?? 0) === 0) return null;
                        return (
                          <div
                            key={p.period_key}
                            className="flex items-center justify-between gap-2 border-b border-stone-100 px-0.5 py-[1px] text-[11px] text-stone-700 last:border-b-0"
                          >
                            <span className="min-w-0 flex-1 truncate">{p.label}</span>
                            <span className="shrink-0 text-right tabular-nums">
                              <span
                                className={
                                  p.count > 0 ? "text-amber-700" : "text-stone-500"
                                }
                              >
                                {p.count}
                              </span>
                              <span className="text-stone-400">/</span>
                              <span
                                className={
                                  p.party > 0 ? "text-sky-700" : "text-stone-500"
                                }
                              >
                                {p.party}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </Link>
                    );
                  })()
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

    </div>
  );
}
