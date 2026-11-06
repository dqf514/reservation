import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FloorCanvas } from "@/components/admin/FloorCanvas";
import { GuestPanel } from "@/components/admin/GuestPanel";
import { NoteQuickOptionsBar } from "@/components/admin/NoteQuickOptionsBar";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useOperatingPeriods } from "@/context/OperatingPeriodsContext";
import { formatZhDate, isSameLocalDay, startOfLocalDay, toLocalYmd } from "@/lib/dateLocal";
import { timeSlotToPeriod } from "@/lib/servicePeriod";
import { LEGEND_ITEMS, STATUS_LABEL, tableStatusClasses } from "@/lib/tableStyles";
import type { GuestCard, GuestFlowStatus, ServicePeriod, TableNode } from "@/types";
import type { CustomerProfileResponse } from "@/types/admin";

type CreateReservationForm = {
  customer_name: string;
  phone: string;
  reservation_date: string;
  time_slot: string;
  party_size: number;
  note: string;
  flow_status: string;
  tags: string;
  assigned_table_codes: string[];
  walkin_quick: boolean;
  send_sms: boolean;
  /** 接单人（自由文本，可与员工账号无关） */
  assigned_staff_name: string;
};

const CREATE_FLOW_OPTIONS: { value: string; label: string }[] = [
  { value: "waiting", label: "待处理" },
  { value: "confirmed", label: "已确认" },
  { value: "arrived", label: "已入座" },
  { value: "left", label: "已离席" },
  { value: "cancelled", label: "已取消" },
];

/** 与后端 floor_logic.TERMINAL 一致：终态预订不再占用桌台，弹窗应走散客/新建流程 */
const TERMINAL_FLOWS = new Set<GuestFlowStatus>(["left", "cancelled", "noshow"]);

// 与日历页一致：节气/节日徽标（本地时间）
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

const TERM_STYLE: Record<string, { icon: "spring" | "summer" | "autumn" | "winter"; cls: string }> = {
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

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): number {
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
  const idxA = (month - 1) * 2;
  const idxB = idxA + 1;
  const dayA = Math.floor(yy * 0.2422 + cArr[idxA]) - Math.floor((yy - 1) / 4);
  const dayB = Math.floor(yy * 0.2422 + cArr[idxB]) - Math.floor((yy - 1) / 4);
  const fixes: Record<string, number> = {
    "2026-02-0": 1,
    "2026-11-0": 1,
  };
  const fixA = fixes[`${y}-${pad2(month)}-0`] ?? 0;
  const fixB = fixes[`${y}-${pad2(month)}-1`] ?? 0;
  if (day === dayA + fixA) return SOLAR_TERMS[idxA];
  if (day === dayB + fixB) return SOLAR_TERMS[idxB];
  return "";
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

function SolarTermBadgeLg({ term }: { term: string }) {
  const style = TERM_STYLE[term] ?? { icon: "spring" as const, cls: "bg-stone-50 text-stone-700 ring-stone-200" };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium ring-1 ${style.cls}`}
      title={`节气：${term}`}
    >
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
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

function HolidayBadgeLg({ label }: { label: string }) {
  const tone: Record<string, string> = {
    元旦: "bg-red-50 text-red-700 ring-red-200",
    情人节: "bg-rose-50 text-rose-700 ring-rose-200",
    妇女节: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
    劳动节: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    儿童节: "bg-sky-50 text-sky-700 ring-sky-200",
    国庆节: "bg-red-50 text-red-700 ring-red-200",
    平安夜: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    圣诞节: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    母亲节: "bg-rose-50 text-rose-700 ring-rose-200",
    父亲节: "bg-sky-50 text-sky-700 ring-sky-200",
    感恩节: "bg-amber-50 text-amber-700 ring-amber-200",
    黑五: "bg-zinc-50 text-zinc-700 ring-zinc-200",
    复活节: "bg-violet-50 text-violet-700 ring-violet-200",
    春节: "bg-red-50 text-red-700 ring-red-200",
    元宵: "bg-amber-50 text-amber-700 ring-amber-200",
    端午: "bg-teal-50 text-teal-700 ring-teal-200",
    中秋: "bg-amber-50 text-amber-700 ring-amber-200",
    除夕: "bg-red-50 text-red-700 ring-red-200",
  };
  const cls = tone[label] ?? "bg-stone-50 text-stone-700 ring-stone-200";
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-1 text-sm font-medium ring-1 ${cls}`} title={`节日：${label}`}>
      {label}
    </span>
  );
}

const emptyCreateForm: CreateReservationForm = {
  customer_name: "",
  phone: "",
  reservation_date: "",
  time_slot: "12:00",
  party_size: 2,
  note: "",
  flow_status: "confirmed",
  tags: "",
  assigned_table_codes: [],
  walkin_quick: false,
  send_sms: false,
  assigned_staff_name: "",
};

export function AdminFloorPage() {
  const { user } = useAuth();
  const { data: op } = useOperatingPeriods();
  const canDragLayout = user?.role === "admin";
  const canDeleteReservation = user?.role === "admin";
  const periodOptions = useMemo(() => {
    function displayPeriodLabel(label?: string) {
      return (label ?? "").trim();
    }
    const ps = (op.periods ?? []).filter((p) => p.enabled);
    const opts = ps.map((p) => ({
      id: p.period_key,
      label: `${displayPeriodLabel(p.label)} ${p.start_time}–${p.end_time}`,
      color: p.color,
    }));
    return [{ id: "all", label: "全部时段", color: "#64748b" }, ...opts];
  }, [op]);
  const [sp, setSp] = useSearchParams();

  function ymdToLocalDate(ymd: string | null): Date | null {
    if (!ymd) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mon = Number(m[2]);
    const d = Number(m[3]);
    if (Number.isNaN(y) || Number.isNaN(mon) || Number.isNaN(d)) return null;
    const dt = new Date(y, mon - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    return startOfLocalDay(dt);
  }

  function parsePeriod(p: string | null): ServicePeriod | null {
    if (!p) return null;
    const v = p.trim();
    if (!v) return null;
    if (v === "all") return v;
    // URL period 必须在配置里存在，否则忽略
    if ((op.periods ?? []).some((x) => x.period_key === v && x.enabled)) return v;
    return null;
  }

  const defaultPeriod = useMemo(() => {
    return (op.periods ?? []).find((x) => x.enabled)?.period_key ?? "lunch";
  }, [op]);

  const [day, setDay] = useState(() => ymdToLocalDate(sp.get("date")) ?? startOfLocalDay(new Date()));
  const [period, setPeriod] = useState<ServicePeriod>(() => parsePeriod(sp.get("period")) ?? defaultPeriod);
  const [panelQuery, setPanelQuery] = useState("");
  const [tables, setTables] = useState<TableNode[]>([]);
  const [guests, setGuests] = useState<GuestCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapA, setSwapA] = useState<string | null>(null);
  const [swapB, setSwapB] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState<CreateReservationForm>(emptyCreateForm);
  const [editingReservationId, setEditingReservationId] = useState<number | null>(null);
  /** 编辑前的原始分配（用于房间座位提示：把本单已占的座位扣回） */
  const [editingReservationMeta, setEditingReservationMeta] = useState<{
    tableCodes: string[];
    partySize: number;
  } | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [phoneProfile, setPhoneProfile] = useState<CustomerProfileResponse | null>(null);
  const [smsBusyGuestId, setSmsBusyGuestId] = useState<string | null>(null);
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<string[]>([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const dayPickerRef = useRef<HTMLInputElement | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);

  // 顶部“营业时段”自动选中：仅在 URL 未显式提供 period 时启用（避免从预订编辑返回后又被自动覆盖）
  const urlPeriodPresentRef = useRef(sp.get("period") != null);
  const autoPeriodAppliedRef = useRef(false);

  const dateLabel = useMemo(() => formatZhDate(day), [day]);
  const dateStr = useMemo(() => toLocalYmd(day), [day]);
  const isToday = isSameLocalDay(day, new Date());
  const currentPeriodLabel = periodOptions.find((p) => p.id === period)?.label ?? period;
  const dayBadges = useMemo(() => {
    if (!dateStr) return { solarTerm: "", holiday: "" };
    const dayDate = new Date(`${dateStr}T00:00:00`);
    const lunarLabel = getLunarLabel(dayDate);
    const solarTerm = getSolarTermLabel(dayDate);
    const holiday = getHolidayLabel(dayDate, lunarLabel);
    return { solarTerm, holiday };
  }, [dateStr]);

  const shiftDay = useCallback((delta: number) => {
    setDay((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + delta);
      return startOfLocalDay(n);
    });
  }, []);

  const openDayPicker = useCallback(() => {
    const input = dayPickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  }, []);

  const nowHm = useCallback(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }, []);

  const shouldDefaultWalkinToLeft = useCallback((reservationDate: string, timeSlot: string) => {
    const d = (reservationDate || "").trim();
    const t = (timeSlot || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) return false;
    const dt = new Date(`${d}T${t}:00`);
    if (Number.isNaN(dt.getTime())) return false;
    return Date.now() - dt.getTime() > 24 * 60 * 60 * 1000;
  }, []);

  const filteredAssignees = useMemo(() => {
    const q = createForm.assigned_staff_name.trim().toLowerCase();
    const base = assigneeSuggestions;
    if (!q) return base.slice(0, 40);
    return base.filter((s) => s.toLowerCase().includes(q)).slice(0, 40);
  }, [assigneeSuggestions, createForm.assigned_staff_name]);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ date: dateStr, period });
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ tables: TableNode[]; guests: Record<string, unknown>[] }>(
          `/api/admin/floor?${q.toString()}`,
        );
        if (cancelled) return;
        setTables(
          data.tables.map((row) => {
            const r = row as TableNode & {
              dbId?: unknown;
              isLocked?: unknown;
              lockedBy?: unknown;
            };
            return {
              ...row,
              dbId: typeof r.dbId === "number" ? r.dbId : undefined,
              isLocked: Boolean(r.isLocked),
              lockedBy: typeof r.lockedBy === "string" ? r.lockedBy : null,
            };
          }),
        );
        setGuests(
          data.guests.map((g) => ({
            id: String(g.id),
            name: String(g.name),
            reservation_date: g.reservation_date ? String(g.reservation_date) : undefined,
            time: String(g.time),
            tags: Array.isArray(g.tags) ? (g.tags as string[]) : [],
            party: String(g.party),
            table: g.table ? String(g.table) : undefined,
            flow: g.flow as GuestFlowStatus,
            phone: g.phone ? String(g.phone) : undefined,
            reservation_count:
              typeof g.reservation_count === "number" ? g.reservation_count : undefined,
            note: g.note ? String(g.note) : null,
            sms_confirm_sent: Boolean(g.sms_confirm_sent),
          })),
        );
        setLoadErr(null);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateStr, period, rev]);

  // 每 1 分钟局部刷新一次（仅拉取桌台/预订状态，不整页刷新）
  useEffect(() => {
    const id = window.setInterval(() => {
      // 避免在上一次请求还未结束时叠加刷新
      setRev((v) => (loading ? v : v + 1));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (autoPeriodAppliedRef.current) return;
    if (urlPeriodPresentRef.current) return;
    if (!op) return;
    if (!isToday) return;

    const now = new Date();
    const timeSlot = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const computed = timeSlotToPeriod(timeSlot, op);
    if (computed !== period) {
      setPeriod(computed);
    }
    autoPeriodAppliedRef.current = true;
  }, [op, isToday, period]);

  // 将当前筛选条件写入 URL，避免用户刷新后回到默认时段导致“看不到最新状态”
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("date", dateStr);
    p.set("period", period);
    const editId = sp.get("edit");
    if (editId && /^\d+$/.test(editId)) p.set("edit", editId);
    setSp(p, { replace: true });
  }, [dateStr, period, setSp, sp]);

  const selectedTable = tables.find((t) => t.id === selectedId);

  const selectedReservationId = useMemo(() => {
    if (!selectedTable) return null;
    const g = guests.find(
      (x) => x.table === selectedTable.id && !TERMINAL_FLOWS.has(x.flow),
    );
    if (!g?.id) return null;
    return /^\d+$/.test(g.id) ? g.id : null;
  }, [selectedTable, guests]);

  const selectedGuest = useMemo(() => {
    if (!selectedReservationId) return null;
    return guests.find((g) => g.id === selectedReservationId) ?? null;
  }, [selectedReservationId, guests]);

  /** 房间型桌台同时段可能有多组客人，需列出全部以便逐组操作 */
  const selectedParties = useMemo(() => {
    if (!selectedTable) return [] as GuestCard[];
    return guests.filter(
      (x) => x.table === selectedTable.id && !TERMINAL_FLOWS.has(x.flow),
    );
  }, [selectedTable, guests]);

  const selectedRoomUsage = selectedTable?.tableType === "room" ? selectedTable.roomUsage : undefined;

  /** 新建/编辑预订时，房间剩余座位提示 */
  const roomSeatHint = useMemo(() => {
    const codes = createForm.assigned_table_codes;
    if (!codes.length) return null;
    const room = tables.find(
      (t) => t.tableType === "room" && codes.includes(t.id),
    );
    if (!room?.roomUsage) return null;
    // 「全部时段」视图下 roomUsage 取的是峰值时段，需按本单时间换算准确口径
    const scoped =
      period === "all"
        ? (room.roomUsage.by_period ?? []).find(
            (p) => p.period_key === timeSlotToPeriod(createForm.time_slot, op),
          )
        : undefined;
    const usedScoped = scoped ? scoped.used : room.roomUsage.used;
    // 编辑时：房间已用座位里包含本单，需要先扣回再比较
    const selfOnRoom =
      editingReservationMeta &&
      editingReservationMeta.tableCodes.includes(room.id)
        ? editingReservationMeta.partySize
        : 0;
    const usedByOthers = Math.max(0, usedScoped - selfOnRoom);
    const free = Math.max(0, room.roomUsage.capacity - usedByOthers);
    return {
      label: room.label,
      capacity: room.roomUsage.capacity,
      used: usedScoped,
      free,
      party: createForm.party_size,
      over: createForm.party_size > free,
    };
  }, [
    createForm.assigned_table_codes,
    createForm.party_size,
    createForm.time_slot,
    tables,
    editingReservationMeta,
    period,
    op,
  ]);

  const selectedFlow = selectedGuest?.flow ?? null;

  const openEditReservationModal = useCallback(
    async (
      reservationId: string,
      prefill?: {
        forceArrived?: boolean;
        forceTimeSlot?: string;
        appendNote?: string;
      },
    ) => {
      if (!/^\d+$/.test(reservationId)) return;
      try {
        const r = await apiFetch<{
          customer_name: string;
          phone?: string | null;
          reservation_date: string;
          time_slot: string;
          party_size: number;
          note?: string | null;
          flow_status?: string;
          tags?: string | null;
          table_codes?: string[] | null;
          table_code?: string | null;
          assigned_staff_name?: string | null;
        }>(`/api/admin/reservations/${reservationId}`);

        const extra = (prefill?.appendNote || "").trim();
        const baseNote = (r.note || "").trim();
        const mergedNote = extra
          ? (baseNote ? (baseNote.includes(extra) ? baseNote : `${baseNote} ${extra}`) : extra)
          : (r.note ?? "");

        const staffLabel =
          (r.assigned_staff_name || "").trim() ||
          (user?.full_name || user?.username || "").trim();
        const loadedTableCodes =
          (r.table_codes && r.table_codes.length > 0)
            ? r.table_codes
            : (r.table_code ? [r.table_code] : []);
        setCreateForm({
          ...emptyCreateForm,
          customer_name: r.customer_name || "",
          phone: r.phone || "",
          reservation_date: r.reservation_date || dateStr,
          time_slot: prefill?.forceTimeSlot?.trim() || r.time_slot || nowHm(),
          party_size: Number(r.party_size) || 2,
          note: mergedNote,
          flow_status: prefill?.forceArrived ? "arrived" : (r.flow_status || "confirmed"),
          tags: r.tags || "",
          walkin_quick: (r.customer_name || "").trim().toLowerCase() === "walk-in" || (r.customer_name || "").trim().toLowerCase() === "walkin",
          assigned_table_codes: loadedTableCodes,
          send_sms: false,
          assigned_staff_name: staffLabel,
        });
        setEditingReservationMeta({
          tableCodes: loadedTableCodes,
          partySize: Number(r.party_size) || 0,
        });
        setEditingReservationId(Number(reservationId));
        setCreateOpen(true);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "加载预订详情失败");
      }
    },
    [dateStr, nowHm, user?.full_name, user?.username],
  );

  const goEditReservation = useCallback(
    async (reservationId: string) => {
      await openEditReservationModal(reservationId);
    },
    [openEditReservationModal],
  );

  useEffect(() => {
    const e = sp.get("edit");
    if (!e || !/^\d+$/.test(e)) return;
    const id = Number(e);
    if (createOpen && editingReservationId === id) return;
    void openEditReservationModal(e);
    const next = new URLSearchParams(sp);
    next.delete("edit");
    setSp(next, { replace: true });
  }, [sp, setSp, openEditReservationModal, createOpen, editingReservationId]);

  const openCreateReservation = useCallback(
    (tableCode?: string, walkin = false) => {
      const periodKey = period === "all" ? defaultPeriod : period;
      const slot = walkin
        ? nowHm()
        : (op?.periods?.find((x) => x.period_key === periodKey)?.start_time || "12:00");
      setCreateForm({
        ...emptyCreateForm,
        reservation_date: dateStr,
        time_slot: slot,
        customer_name: walkin ? "Walk-in" : "",
        flow_status: walkin && shouldDefaultWalkinToLeft(dateStr, slot) ? "left" : (walkin ? "arrived" : "confirmed"),
        walkin_quick: walkin,
        assigned_table_codes: tableCode ? [tableCode] : [],
        assigned_staff_name: (user?.full_name || user?.username || "").trim(),
      });
      setEditingReservationId(null);
      setEditingReservationMeta(null);
      setCreateOpen(true);
    },
    [dateStr, period, defaultPeriod, op, nowHm, shouldDefaultWalkinToLeft, user?.full_name, user?.username],
  );

  const quickBusyRef = useRef(false);
  const quickSetFlow = useCallback(
    async (flow: GuestFlowStatus, reservationId?: string | null) => {
      const targetId = reservationId ?? selectedReservationId;
      if (!targetId) return;
      if (quickBusyRef.current) return;
      quickBusyRef.current = true;
      try {
        const ret = await apiFetch<{
          ok?: boolean;
          cancel_sms?: { sent?: boolean; reason?: string; error?: string; wait_seconds?: number };
        }>(`/api/admin/reservations/${targetId}`, {
          method: "PATCH",
          json: { flow_status: flow },
        });
        setRev((v) => v + 1); // 触发重新拉取桌台状态与客人列表
        if (flow === "cancelled" && ret.cancel_sms && ret.cancel_sms.sent !== true) {
          const r = ret.cancel_sms.reason || "";
          const hint: Record<string, string> = {
            sms_disabled: "短信总开关已关闭。",
            notify_cancel_disabled: "短信设置里未开启「预订取消」通知，或需在后台勾选。",
            sms_not_configured: "未配置短信 sp_id / 接口密码。",
            phone_empty: "该预订无手机号，无法发送取消短信。",
            rate_limited: `发送过于频繁，请约 ${String(ret.cancel_sms.wait_seconds ?? 60)} 秒后再试。`,
            failed_data: "运营商未受理（failed_data）：取消短信模板可能未报备或与正文不一致。",
            code_not_zero: "运营商返回失败（code 非 0）。",
            missing_code: "运营商响应异常（缺少 code）。",
            exception: ret.cancel_sms.error ? `调用异常：${ret.cancel_sms.error}` : "网关调用异常。",
          };
          window.alert(
            `预订已取消，但取消通知短信未成功发送。\n原因：${hint[r] ?? (r || "未知")}`,
          );
        }
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "状态更新失败");
      } finally {
        quickBusyRef.current = false;
      }
    },
    [selectedReservationId],
  );

  // 快捷键：Alt+E 编辑；Alt+C 待处理；Alt+A 入座；Alt+L 离席；Alt+X 取消
  useEffect(() => {
    function isTypingTarget(el: Element | null): boolean {
      if (!el) return false;
      const tag = (el as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el instanceof HTMLElement && el.isContentEditable) return true;
      return false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!selectedReservationId) return;
      if (swapOpen) return;
      if (e.repeat) return;
      if (isTypingTarget(document.activeElement)) return;

      // 避免拦截 Ctrl/Cmd 快捷键
      if (e.ctrlKey || e.metaKey) return;

      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (!["e", "c", "a", "s", "l", "x"].includes(k)) return;

      e.preventDefault();
      if (k === "e") {
        void goEditReservation(selectedReservationId);
        return;
      }
      if (k === "c") void quickSetFlow("waiting");
      else if (k === "a") void quickSetFlow("arrived");
      else if (k === "s") void quickSetFlow("arrived");
      else if (k === "l") void quickSetFlow("left");
      else if (k === "x") void quickSetFlow("cancelled");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedReservationId, swapOpen, goEditReservation, quickSetFlow]);

  const commitTablePosition = useCallback(async (dbId: number, x: number, y: number) => {
    try {
      await apiFetch(`/api/admin/dining-tables/${dbId}`, {
        method: "PATCH",
        json: { pos_x: x, pos_y: y },
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存位置失败");
    } finally {
      setRev((v) => v + 1);
    }
  }, []);

  async function applySwap() {
    if (!swapA || !swapB || swapA === swapB) {
      setSwapOpen(false);
      return;
    }
    try {
      await apiFetch("/api/admin/floor/swap", {
        method: "POST",
        json: {
          reservation_date: dateStr,
          period,
          table_code_a: swapA,
          table_code_b: swapB,
        },
      });
      setSwapOpen(false);
      setSwapA(null);
      setSwapB(null);
      setRev((x) => x + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "交换失败");
    }
  }

  async function lockTable(tableCode: string) {
    await apiFetch("/api/admin/floor/lock", {
      method: "POST",
      json: { table_code: tableCode },
    });
    setRev((x) => x + 1);
  }

  async function unlockTable(tableCode: string) {
    await apiFetch("/api/admin/floor/unlock", {
      method: "POST",
      json: { table_code: tableCode },
    });
    setRev((x) => x + 1);
  }

  async function leaveWalkin(tableCode: string, reservationId?: string | null) {
    await apiFetch("/api/admin/floor/walkin/leave", {
      method: "POST",
      json: {
        table_code: tableCode,
        ...(reservationId && /^\d+$/.test(reservationId)
          ? { reservation_id: Number(reservationId) }
          : {}),
      },
    });
    setRev((x) => x + 1);
  }

  async function sendGuestConfirmSms(guest: GuestCard) {
    if (!/^\d+$/.test(guest.id)) return;
    if (smsBusyGuestId) return;
    if (!window.confirm("是否发送确认短信？")) return;
    setSmsBusyGuestId(guest.id);
    try {
      const ret = await apiFetch<{ ok: boolean; message?: string; result?: { reason?: string } }>(
        `/api/admin/reservations/${guest.id}/resend-success-sms`,
        { method: "POST" },
      );
      if (!ret.ok) {
        window.alert(ret.message || ret.result?.reason || "发送失败");
      }
      setRev((x) => x + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSmsBusyGuestId(null);
    }
  }

  async function quickCancelFromList(guest: GuestCard) {
    if (!/^\d+$/.test(guest.id)) return;
    if (!window.confirm("确认取消该预订？")) return;
    try {
      await apiFetch(`/api/admin/reservations/${guest.id}`, {
        method: "PATCH",
        json: { flow_status: "cancelled" },
      });
      setRev((x) => x + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "取消失败");
    }
  }

  async function quickArriveFromList(guest: GuestCard) {
    if (!/^\d+$/.test(guest.id)) return;
    const currentHm = nowHm();
    // 未分配桌台：在当前页打开编辑弹窗，预带入席状态与入席时间，便于选桌和补备注。
    if (!guest.table) {
      await openEditReservationModal(guest.id, {
        forceArrived: true,
        forceTimeSlot: currentHm,
        appendNote: `入席时间 ${currentHm}`,
      });
      return;
    }
    try {
      await apiFetch(`/api/admin/reservations/${guest.id}`, {
        method: "PATCH",
        json: { flow_status: "arrived" },
      });
      setRev((x) => x + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "入席失败");
    }
  }

  async function quickEditFromList(guest: GuestCard) {
    if (!/^\d+$/.test(guest.id)) return;
    await openEditReservationModal(guest.id);
  }

  async function deleteReservationFromFloorModal() {
    if (!editingReservationId) return;
    if (!window.confirm("确定删除该预订？关联订金将一并按规则处理（若存在订金请先处理）。")) return;
    setDeleteBusyId(editingReservationId);
    try {
      await apiFetch(`/api/admin/reservations/${editingReservationId}`, { method: "DELETE" });
      setEditingReservationId(null);
      setCreateOpen(false);
      setRev((x) => x + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function submitCreateReservation(ev: FormEvent) {
    ev.preventDefault();
    const phone = createForm.phone.trim();
    if (phone && !/^1\d{10}$/.test(phone)) {
      window.alert("手机号格式不正确（11位，以1开头）");
      return;
    }
    if (!createForm.assigned_staff_name.trim()) {
      window.alert("请填写接单人");
      return;
    }
    setCreateSaving(true);
    try {
      const payload = {
        customer_name: (createForm.customer_name.trim() || (createForm.walkin_quick ? "Walk-in" : "")),
        phone,
        reservation_date: createForm.reservation_date,
        time_slot: createForm.time_slot.trim(),
        party_size: createForm.party_size,
        note: createForm.note.trim() || null,
        flow_status: createForm.flow_status,
        tags: createForm.tags.trim(),
        assigned_table_codes: createForm.assigned_table_codes,
        assigned_staff_name: createForm.assigned_staff_name.trim(),
      };
      if (editingReservationId) {
        await apiFetch(`/api/admin/reservations/${editingReservationId}`, {
          method: "PATCH",
          json: payload,
        });
      } else {
        await apiFetch("/api/admin/reservations", {
          method: "POST",
          json: {
            ...payload,
            // 兜底：当手机号无效（checkbox 被禁用）时，即使内部状态仍为 true 也不应触发短信发送。
            send_sms: createForm.send_sms && !smsSwitchDisabled,
          },
        });
      }
      setEditingReservationId(null);
      setEditingReservationMeta(null);
      setCreateOpen(false);
      setRev((x) => x + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : (editingReservationId ? "编辑预订失败" : "新建预订失败"));
    } finally {
      setCreateSaving(false);
    }
  }

  function toggleCreateTable(code: string) {
    setCreateForm((prev) => {
      const has = prev.assigned_table_codes.includes(code);
      return {
        ...prev,
        assigned_table_codes: has
          ? prev.assigned_table_codes.filter((x) => x !== code)
          : [...prev.assigned_table_codes, code],
      };
    });
  }

  function appendCreateNoteQuick(text: string) {
    setCreateForm((prev) => {
      const cur = (prev.note || "").trim();
      const add = text.trim();
      if (!add) return prev;
      if (!cur) return { ...prev, note: add };
      if (cur.includes(add)) return prev;
      return { ...prev, note: `${cur} ${add}` };
    });
  }

  const smsSwitchDisabled = !/^1\d{10}$/.test(createForm.phone.trim());

  // 兜底：手机号无效时，把内部 send_sms 状态强制关闭，避免出现“页面未选但提交仍发短信”的错配。
  useEffect(() => {
    if (!createOpen) return;
    if (smsSwitchDisabled && createForm.send_sms) {
      setCreateForm((f) => ({ ...f, send_sms: false }));
    }
  }, [createOpen, smsSwitchDisabled, createForm.send_sms]);

  useEffect(() => {
    if (!createOpen) {
      setPhoneProfile(null);
      setProfileBusy(false);
      return;
    }
    const phone = createForm.phone.trim();
    if (!/^1\d{10}$/.test(phone)) {
      setPhoneProfile(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setProfileBusy(true);
      try {
        const data = await apiFetch<CustomerProfileResponse>(`/api/admin/customers/by-phone/${phone}`);
        if (!cancelled) setPhoneProfile(data);
      } catch {
        if (!cancelled) setPhoneProfile(null);
      } finally {
        if (!cancelled) setProfileBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [createOpen, createForm.phone]);

  // 散客入席模式：仅做“默认建议”，超过 1 天的补录默认离席；用户仍可手工改。
  useEffect(() => {
    if (!createOpen || !createForm.walkin_quick) return;
    const next = shouldDefaultWalkinToLeft(createForm.reservation_date, createForm.time_slot) ? "left" : "arrived";
    if (createForm.flow_status !== next) {
      setCreateForm((f) => ({ ...f, flow_status: next }));
    }
  }, [createOpen, createForm.walkin_quick, createForm.reservation_date, createForm.time_slot, createForm.flow_status, shouldDefaultWalkinToLeft]);

  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetch<string[]>("/api/admin/reservations/assignee-suggestions");
        if (!cancelled) setAssigneeSuggestions(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setAssigneeSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen]);

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-0 flex-1 flex-col overflow-hidden text-ink-900">
      <header className="sticky top-0 z-30 border-b border-stone-200">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 bg-white/95 px-3 pb-2 pt-2.5 backdrop-blur lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-stone-200 bg-white px-1 shadow-sm">
              <button
                type="button"
                className="rounded-lg px-2 py-1.5 text-stone-600 hover:bg-stone-50"
                aria-label="上一天"
                onClick={() => shiftDay(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={openDayPicker}
                className="min-w-[10rem] px-2 text-center text-sm font-medium hover:text-brand-coral"
                title="点击选择日期"
              >
                {dateLabel}
              </button>
              <input
                ref={dayPickerRef}
                type="date"
                value={dateStr}
                onChange={(e) => {
                  const next = ymdToLocalDate(e.target.value);
                  if (next) setDay(next);
                }}
                className="sr-only"
                aria-label="选择日期"
              />
              <button
                type="button"
                className="rounded-lg px-2 py-1.5 text-stone-600 hover:bg-stone-50"
                aria-label="下一天"
                onClick={() => shiftDay(1)}
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setDay(startOfLocalDay(new Date()))}
                className={`ml-1 rounded-lg px-2 py-1 text-xs font-medium ${
                  isToday ? "bg-ink-900 text-white" : "text-brand-coral hover:bg-orange-50"
                }`}
              >
                今天
              </button>
            </div>

            <label className="flex items-center gap-2">
              <span className="sr-only">营业时段</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as ServicePeriod)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand-coral/30"
              >
                {periodOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {/* 顶部不提供搜索功能（按 Tablera 对齐需求） */}

          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {dayBadges.solarTerm ? <SolarTermBadgeLg term={dayBadges.solarTerm} /> : null}
              {dayBadges.holiday ? <HolidayBadgeLg label={dayBadges.holiday} /> : null}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => openCreateReservation()}
              className="mr-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-600 shadow-sm hover:bg-blue-50"
            >
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
                </svg>
                新建预订
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRev((v) => v + 1)}
              disabled={loading}
              className="mr-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="重新拉取桌台与预订状态"
            >
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M10 3a7 7 0 1 1-6.32 4H2.5a.75.75 0 0 1 0-1.5h2.75c.3 0 .58.18.7.45l.9 2.1a.75.75 0 0 1-1.38.6l-.24-.56A5.5 5.5 0 1 0 10 4.5a.75.75 0 0 1 0-1.5Z" />
                </svg>
                {loading ? "刷新中…" : "刷新数据"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openCreateReservation(undefined, true)}
              className="mr-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm hover:bg-emerald-50"
            >
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M10 2a3.2 3.2 0 1 1 0 6.4A3.2 3.2 0 0 1 10 2Zm-5 14a5 5 0 1 1 10 0v1H5v-1Z" />
                </svg>
                散客入席
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSwapOpen(true)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-50"
            >
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M3 6a1 1 0 0 1 1-1h8.59L10.3 2.7a1 1 0 0 1 1.4-1.4l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4L12.59 7H4a1 1 0 0 1-1-1Zm14 8a1 1 0 0 1-1 1H7.41l2.3 2.3a1 1 0 1 1-1.42 1.4l-4-4a1 1 0 0 1 0-1.4l4-4a1 1 0 0 1 1.42 1.4L7.4 13H16a1 1 0 0 1 1 1Z" />
                </svg>
                交换桌台
              </span>
            </button>
          </div>
        </div>

      </header>

      {loadErr && (
        <div className="w-full px-4 py-2 text-sm text-red-700">
          数据加载失败：{loadErr}
        </div>
      )}

      <div className="flex w-full flex-1 min-h-0 flex-col gap-3 px-2 py-3 lg:flex-row lg:px-4">
        <div className="order-2 flex min-h-0 min-w-0 flex-1 flex-col lg:order-2">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
            {loading && (
              <span className="shrink-0 text-xs text-stone-500" aria-live="polite">
                同步服务器数据…
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {LEGEND_ITEMS.map(({ status }) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${tableStatusClasses(status)}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {STATUS_LABEL[status]}
                </span>
              ))}
            </div>
          </div>
          <div className="relative flex-1 min-h-0">
            <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-xl bg-brand-coral/10 px-3 py-2 text-[11px] font-semibold text-brand-coral shadow-sm">
              {currentPeriodLabel}
            </div>
            <FloorCanvas
              tables={tables}
              selectedId={selectedId}
              onSelect={setSelectedId}
              draggable={canDragLayout}
              onPositionCommit={commitTablePosition}
            />
          </div>
        </div>

        <div className="order-1 min-h-[280px] lg:order-1 lg:min-h-0 lg:w-[420px] lg:shrink-0">
          <GuestPanel
            guests={guests}
            query={panelQuery}
            onQueryChange={setPanelQuery}
            onSendSms={sendGuestConfirmSms}
            onQuickCancel={quickCancelFromList}
            onQuickArrive={quickArriveFromList}
            onQuickEdit={quickEditFromList}
            smsBusyGuestId={smsBusyGuestId}
          />
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <form
            onSubmit={submitCreateReservation}
            className="flex max-h-[98vh] min-h-[min(90vh,1000px)] w-full flex-col max-w-8xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-3">
              <h2 className="font-display text-lg font-semibold">{editingReservationId ? "编辑预订" : "新建预订"}</h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {editingReservationId && canDeleteReservation ? (
                  <button
                    type="button"
                    title="仅超级管理员可删除"
                    disabled={deleteBusyId === editingReservationId || createSaving}
                    onClick={() => void deleteReservationFromFloorModal()}
                    className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
                  >
                    {deleteBusyId === editingReservationId ? "删除中…" : "删除"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    setEditingReservationId(null);
                  }}
                  className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-600"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {createSaving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 grid items-start gap-5 md:grid-cols-[460px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)]">
              <div className="self-start grid gap-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                  <span className="text-xs text-stone-500">联系人</span>
                  <input
                    required
                    value={createForm.customer_name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, customer_name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                  />
                  </label>
                  <label className="block">
                  <span className="text-xs text-stone-500">手机（可留空）</span>
                  <input
                    inputMode="numeric"
                    maxLength={11}
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                  />
                  </label>
                  <label className="flex min-h-[68px] items-center gap-2 rounded-xl px-1 py-2">
                  <input
                    type="checkbox"
                    checked={createForm.send_sms && !smsSwitchDisabled}
                    disabled={smsSwitchDisabled}
                    onChange={(e) => setCreateForm((f) => ({ ...f, send_sms: e.target.checked }))}
                  />
                  <span className="text-xs">发送短信</span>
                  </label>
                </div>
                <label className="relative block">
                  <span className="text-xs text-stone-500">接单人</span>
                  <input
                    type="text"
                    autoComplete="off"
                    value={createForm.assigned_staff_name}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        assigned_staff_name: e.target.value,
                      }))
                    }
                    onFocus={() => setAssigneeOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setAssigneeOpen(false), 180);
                    }}
                    placeholder="点击后可选历史姓名，或直接输入"
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                  {assigneeOpen && filteredAssignees.length > 0 ? (
                    <ul
                      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
                      role="listbox"
                    >
                      {filteredAssignees.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-50"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setCreateForm((f) => ({ ...f, assigned_staff_name: name }));
                              setAssigneeOpen(false);
                            }}
                          >
                            {name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                  <span className="text-xs text-stone-500">日期</span>
                  <input
                    required
                    type="date"
                    value={createForm.reservation_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, reservation_date: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                  />
                  </label>
                  <label className="block">
                    <span className="text-xs text-stone-500">时间点</span>
                    <input
                      required
                      type="time"
                      step={300}
                      value={createForm.time_slot}
                      onChange={(e) => setCreateForm((f) => ({ ...f, time_slot: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-stone-500">人数</span>
                    <input
                      required
                      type="number"
                      min={1}
                      max={99}
                      value={createForm.party_size}
                      onChange={(e) => setCreateForm((f) => ({ ...f, party_size: Number(e.target.value) }))}
                      className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="flex items-start gap-2 text-xs text-stone-500">
                    <span className="mt-1 shrink-0">备注</span>
                    <div className="min-w-0 flex-1">
                      <NoteQuickOptionsBar active={createOpen} onPick={appendCreateNoteQuick} />
                    </div>
                  </span>
                  <textarea
                    value={createForm.note}
                    onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm"
                    placeholder="可填写忌口、座位偏好、庆生等信息"
                  />
                </label>
                <div>
                  <span className="text-xs text-stone-500">预订状态</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {CREATE_FLOW_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                          createForm.flow_status === opt.value
                            ? "border-brand-coral bg-brand-coral/10 text-brand-coral"
                            : "border-stone-200 bg-white text-stone-700"
                        } ${createForm.walkin_quick ? "opacity-80" : ""}`}
                      >
                        <input
                          type="radio"
                          name="create-flow-status"
                          value={opt.value}
                          checked={createForm.flow_status === opt.value}
                          onChange={() => setCreateForm((f) => ({ ...f, flow_status: opt.value }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {createForm.walkin_quick
                      ? "散客入席：默认「已入座」；仅当所选时间早于当前超过一天时，默认「已离席」（可手动改）。"
                      : "普通新建预订默认「已确认」，可按需切换。"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-stone-500">分配桌台</span>
                  <div className="mt-1 rounded-xl border border-stone-200 p-2">
                    <div className="flex flex-wrap">
                      {tables.map((t) => (
                        <label
                          key={t.id}
                          className="mb-1 mr-2 inline-flex items-center text-xs text-stone-700"
                          title={
                            t.tableType === "room" && t.roomUsage
                              ? `房间：已占用 ${t.roomUsage.used}/${t.roomUsage.capacity} 座（预订 ${t.roomUsage.reserved} · 散客 ${t.roomUsage.seated}）· ${t.roomUsage.parties} 组`
                              : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            checked={createForm.assigned_table_codes.includes(t.id)}
                            onChange={() => toggleCreateTable(t.id)}
                          />
                          <span>{t.label}</span>
                          {t.tableType === "room" && t.roomUsage && (
                            <span className="ml-1 rounded-full bg-indigo-50 px-1 text-[10px] font-medium text-indigo-700">
                              房 {t.roomUsage.used}/{t.roomUsage.capacity}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    {roomSeatHint && (
                      <p
                        className={`mt-2 rounded-lg px-2 py-1 text-[11px] leading-4 ${
                          roomSeatHint.over
                            ? "bg-red-50 text-red-700"
                            : "bg-indigo-50 text-indigo-700"
                        }`}
                      >
                        {roomSeatHint.label}（房间）：该时段已占用 {roomSeatHint.used}/
                        {roomSeatHint.capacity} 座，本单 {roomSeatHint.party} 人，
                        {roomSeatHint.over
                          ? `超出剩余 ${roomSeatHint.free} 座，保存时会被拒绝。`
                          : `剩余可安排 ${roomSeatHint.free} 座。`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-medium text-stone-700">客户画像与历史预订</p>
                  {profileBusy && <p className="mt-2 text-xs text-stone-500">识别手机号中…</p>}
                  {!profileBusy && !phoneProfile && (
                    <p className="mt-2 text-xs text-stone-500">输入已存在手机号后，将自动显示客户画像与历史预订。</p>
                  )}
                  {!profileBusy && phoneProfile && (
                    <div className="mt-2 grid gap-3 text-xs text-stone-700 md:grid-cols-2">
                      <div className="space-y-1">
                        <p>
                          手机：<span className="font-mono">{phoneProfile.phone}</span>
                        </p>
                        <p>称呼：{phoneProfile.customer?.display_name || "—"}</p>
                        <p>标签：{phoneProfile.customer?.tags || "—"}</p>
                        <p>总预订：{phoneProfile.reservation_count}</p>
                      </div>
                      <div className="max-h-32 overflow-y-auto rounded-lg border border-stone-200 bg-white p-2">
                        {phoneProfile.reservations.length === 0 ? (
                          <p className="text-xs text-stone-500">暂无历史预订</p>
                        ) : (
                          phoneProfile.reservations.slice(0, 3).map((x) => (
                            <div key={x.id} className="border-b border-stone-100 py-1 text-xs text-stone-700 last:border-b-0">
                              <p className="whitespace-normal break-words leading-snug">
                                {x.reservation_date} {x.time_slot} · {x.party_size}位 · {x.flow_status}
                              </p>
                              <p className="whitespace-normal break-words text-stone-500 leading-snug">历史备注：{x.note?.trim() ? x.note : "—"}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0 h-full">
                <FloorCanvas
                  tables={tables}
                  selectedId={createForm.assigned_table_codes[0] || null}
                  selectedIds={createForm.assigned_table_codes}
                  onSelect={toggleCreateTable}
                  draggable={false}
                />
              </div>
            </div>
          </form>
        </div>
      )}
      {swapOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="swap-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 id="swap-title" className="font-display text-lg font-semibold">
              交换桌台
            </h2>
            <p className="mt-1 text-sm text-stone-500">在当前日期与所选时段内，互换两桌的预订分配（若仅一侧有预订，将移动到空桌）。</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-stone-500">
                桌台 A
                <select
                  value={swapA ?? ""}
                  onChange={(e) => setSwapA(e.target.value || null)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                >
                  <option value="">请选择</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-stone-500">
                桌台 B
                <select
                  value={swapB ?? ""}
                  onChange={(e) => setSwapB(e.target.value || null)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                >
                  <option value="">请选择</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
                onClick={() => setSwapOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
                onClick={() => void applySwap()}
              >
                确认交换
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {selectedTable.label}
                  <span className="ml-2 font-normal text-stone-500">{STATUS_LABEL[selectedTable.status]}</span>
                  {selectedTable.tableType === "room" && (
                    <span className="ml-2 rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                      房间
                    </span>
                  )}
                </p>
                {selectedTable.guestHint && <p className="mt-1 text-sm text-stone-600">客人：{selectedTable.guestHint}</p>}
                {selectedRoomUsage && (
                  <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
                    <p>
                      座位占用 <span className="font-semibold">{selectedRoomUsage.used}/{selectedRoomUsage.capacity}</span>
                      <span className="ml-2 text-indigo-700">
                        预订 {selectedRoomUsage.reserved} · 散客 {selectedRoomUsage.seated} · 共 {selectedRoomUsage.parties} 组
                      </span>
                    </p>
                    <p className="mt-1 text-indigo-700">
                      剩余 {selectedRoomUsage.free} 座
                      {selectedRoomUsage.day_used &&
                      selectedRoomUsage.day_used !== selectedRoomUsage.used && (
                        <span className="ml-2">· 全天合计 {selectedRoomUsage.day_used} 人</span>
                      )}
                    </p>
                    {(selectedRoomUsage.by_period ?? []).some((p) => p.used > 0) && (
                      <ul className="mt-1 space-y-0.5 text-indigo-700">
                        {(selectedRoomUsage.by_period ?? [])
                          .filter((p) => p.used > 0)
                          .map((p) => (
                            <li key={p.period_key}>
                              {p.label}：{p.used}/{selectedRoomUsage.capacity} 座（{p.parties} 组）
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}
                {selectedGuest?.note && <p className="mt-1 text-xs text-stone-600">备注：{selectedGuest.note}</p>}
                {selectedTable.isLocked && (
                  <p className="mt-1 text-xs text-amber-700">已锁定（{selectedTable.lockedBy || "未知"}）</p>
                )}
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100">
                关闭
              </button>
            </div>
            {selectedTable.tableType === "room" && selectedParties.length > 0 && (
              <div className="mt-3 rounded-xl border border-stone-200">
                <p className="border-b border-stone-200 px-3 py-2 text-xs font-medium text-stone-700">
                  本桌客人（{selectedParties.length} 组）
                </p>
                <ul className="max-h-56 divide-y divide-stone-100 overflow-y-auto">
                  {selectedParties.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-stone-800">
                          {g.name}
                          <span className="ml-2 text-xs text-stone-500">
                            {g.time} · {g.party} 位
                          </span>
                        </p>
                        {g.note && <p className="truncate text-[11px] text-stone-500">备注：{g.note}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {g.flow === "arrived" && (
                          <button
                            type="button"
                            onClick={() => void leaveWalkin(selectedTable.id, g.id)}
                            className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                          >
                            离席
                          </button>
                        )}
                        {g.flow === "waiting" && (
                          <button
                            type="button"
                            onClick={() => void quickSetFlow("confirmed", g.id)}
                            className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                          >
                            确认
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void goEditReservation(g.id)}
                          className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                        >
                          编辑
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedReservationId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => goEditReservation(selectedReservationId)} className="rounded-xl bg-brand-coral px-4 py-2 text-sm font-medium text-white">编辑预订</button>
                <button type="button" onClick={() => void quickSetFlow("waiting")} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">待处理</button>
                <button type="button" onClick={() => void quickSetFlow("arrived")} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">入座</button>
                <button type="button" onClick={() => void quickSetFlow("left")} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">离席</button>
                <button type="button" onClick={() => void quickSetFlow("cancelled")} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-red-700">取消</button>
                {selectedTable.isLocked ? (
                  <button type="button" onClick={() => void unlockTable(selectedTable.id)} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">解除锁定</button>
                ) : (
                  <button type="button" onClick={() => void lockTable(selectedTable.id)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700">锁定桌台</button>
                )}
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedTable.tableType === "room" ? (
                  <button type="button" onClick={() => openCreateReservation(selectedTable.id, true)} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700">
                    散客入席（房间）
                  </button>
                ) : selectedTable.status === "arrived" ? (
                  <button type="button" onClick={() => void leaveWalkin(selectedTable.id)} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700">散客离席</button>
                ) : (
                  <button type="button" onClick={() => openCreateReservation(selectedTable.id, true)} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700">散客入席</button>
                )}
                <button type="button" onClick={() => openCreateReservation(selectedTable.id)} className="rounded-xl bg-brand-coral px-4 py-2 text-sm font-medium text-white">新建预订</button>
                {selectedTable.isLocked ? (
                  <button type="button" onClick={() => void unlockTable(selectedTable.id)} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">解除锁定</button>
                ) : (
                  <button type="button" onClick={() => void lockTable(selectedTable.id)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700">锁定桌台</button>
                )}
              </div>
            )}
            {selectedFlow && <p className="mt-2 text-xs text-stone-500">当前预订状态：{selectedFlow}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
