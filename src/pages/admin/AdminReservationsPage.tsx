import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FloorCanvas } from "@/components/admin/FloorCanvas";
import { NoteQuickOptionsBar } from "@/components/admin/NoteQuickOptionsBar";
import { apiFetch } from "@/lib/api";
import { billiardHistoryBadgeClass } from "@/lib/billiardHistoryBadge";
import { formatApiDateTimeToMinute, toLocalYmd } from "@/lib/dateLocal";
import { maskPhoneForDisplay } from "@/lib/phoneMask";
import { useOperatingPeriods } from "@/context/OperatingPeriodsContext";
import { timeSlotToPeriod } from "@/lib/servicePeriod";
import { useAuth } from "@/context/AuthContext";
import type { TableNode } from "@/types";
import type { CustomerProfileResponse, DiningTableItem, ReservationAdminItem } from "@/types/admin";
import { FLOW_OPTIONS } from "@/types/admin";

type ListResp = { items: ReservationAdminItem[]; total: number; page: number; page_size: number };

const emptyForm = {
  customer_name: "",
  phone: "",
  reservation_date: "",
  time_slot: "12:00",
  party_size: 2,
  note: "",
  flow_status: "confirmed",
  tags: "",
  assigned_table_codes: [] as string[],
  walkin_quick: false,
};

const CREATE_FLOW_OPTIONS: { value: string; label: string }[] = [
  { value: "waiting", label: "待处理" },
  { value: "confirmed", label: "已确认" },
  { value: "arrived", label: "已入座" },
  { value: "left", label: "已离席" },
  { value: "cancelled", label: "已取消" },
];
const FLOW_FILTER_OPTIONS = [
  { key: "waiting", label: "待处理" },
  { key: "confirmed", label: "已确认" },
  { key: "arrived", label: "已入座" },
  { key: "left", label: "已离席" },
  { key: "cancelled", label: "已取消" },
] as const;

const HIGHLIGHT_ANCHORS = new Set(["flow", "tables", "phone"]);

function guessReservationHighlight(r: ReservationAdminItem): "flow" | "tables" | "phone" {
  const codes = r.table_codes?.length ? r.table_codes : r.table_code ? [r.table_code] : [];
  const hasTbl = codes.length > 0;
  const phoneOk = /^1\d{10}$/.test((r.phone || "").trim());
  if (!hasTbl) return "tables";
  if (!phoneOk) return "phone";
  return "flow";
}

export function AdminReservationsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: op } = useOperatingPeriods();
  const canDeleteReservation = user?.role === "admin";
  const todayYmd = useMemo(() => toLocalYmd(new Date()), []);
  const defaultDateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toLocalYmd(d);
  }, []);
  const [sp, setSp] = useSearchParams();
  const getSp = useCallback(
    (key: string, fallbackKey?: string) =>
      (sp.get(key) ?? (fallbackKey ? sp.get(fallbackKey) : null) ?? "").trim(),
    [sp],
  );
  const [list, setList] = useState<ReservationAdminItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [dateFrom, setDateFrom] = useState(() => getSp("date_from", "date_from-") || defaultDateFrom);
  const [dateTo, setDateTo] = useState(() => getSp("date_to", "date_to-") || todayYmd);
  const [search, setSearch] = useState(() => getSp("q"));
  const [selectedFlowSet, setSelectedFlowSet] = useState<Set<string>>(
    () => new Set(FLOW_FILTER_OPTIONS.map((x) => x.key)),
  );
  const [selectedPeriodSet, setSelectedPeriodSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tables, setTables] = useState<DiningTableItem[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [floorTables, setFloorTables] = useState<TableNode[]>([]);
  const [floorLoading, setFloorLoading] = useState(false);
  const [floorErr, setFloorErr] = useState<string | null>(null);
  const [smsBusyId, setSmsBusyId] = useState<number | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [phoneProfile, setPhoneProfile] = useState<CustomerProfileResponse | null>(null);
  const [profileModal, setProfileModal] = useState<CustomerProfileResponse | null>(null);
  const [pulseHighlight, setPulseHighlight] = useState<string | null>(null);
  const highlightAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value);
    if (dateTo && value && value > dateTo) {
      setDateTo(value);
    }
    setPage(1);
  }, [dateTo]);

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value);
    if (dateFrom && value && value < dateFrom) {
      setDateFrom(value);
    }
    setPage(1);
  }, [dateFrom]);

  const nowHm = useCallback(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }, []);

  const floorPeriod = useMemo(() => timeSlotToPeriod(form.time_slot, op), [form.time_slot, op]);
  const enabledPeriods = useMemo(
    () => (op.periods ?? []).filter((x) => x.enabled),
    [op],
  );
  const floorPeriodRow = useMemo(
    () => enabledPeriods.find((x) => x.period_key === floorPeriod) ?? null,
    [enabledPeriods, floorPeriod],
  );
  const selectedAssignedTables = useMemo(
    () =>
      tables.filter((x) => form.assigned_table_codes.includes(x.code)),
    [tables, form.assigned_table_codes],
  );
  const tableCapacitySummary = useMemo(() => {
    const selectedCount = selectedAssignedTables.length;
    const totalCapacity = selectedAssignedTables.reduce((sum, t) => sum + t.capacity, 0);
    const party = form.party_size;
    const gap = totalCapacity - party;
    return { selectedCount, totalCapacity, party, gap };
  }, [selectedAssignedTables, form.party_size]);
  const periodName = useCallback(
    (periodKey: string) => {
      const row = enabledPeriods.find((x) => x.period_key === periodKey);
      return row?.label || periodKey;
    },
    [enabledPeriods],
  );

  const backAdminUrl = useMemo(() => {
    const backDate = sp.get("back_date") ?? "";
    const backPeriod = sp.get("back_period") ?? "";
    const backSearch = sp.get("back_search") ?? "";
    if (!backDate || !backPeriod) return "/admin";
    const q = new URLSearchParams();
    q.set("date", backDate);
    q.set("period", backPeriod);
    if (backSearch.trim()) q.set("search", backSearch.trim());
    return `/admin?${q.toString()}`;
  }, [sp]);
  const hasBackContext = useMemo(() => {
    const backDate = (sp.get("back_date") ?? "").trim();
    const backPeriod = (sp.get("back_period") ?? "").trim();
    return Boolean(backDate && backPeriod);
  }, [sp]);

  const closeModal = useCallback(() => {
    setPulseHighlight(null);
    if (highlightAnimTimerRef.current) {
      clearTimeout(highlightAnimTimerRef.current);
      highlightAnimTimerRef.current = null;
    }
    if (hasBackContext) {
      nav(backAdminUrl);
      return;
    }
    setModalOpen(false);
  }, [hasBackContext, nav, backAdminUrl]);

  const toMins = useCallback((hhmm: string): number => {
    const [h, m] = (hhmm || "").split(":");
    const hh = Number.parseInt(h ?? "", 10);
    const mm = Number.parseInt(m ?? "", 10);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return -1;
    return hh * 60 + mm;
  }, []);

  const toggleAssignedTable = useCallback(
    (tableCode: string) => {
      const code = tableCode.trim();
      if (!code) {
        setForm((f) => ({ ...f, assigned_table_codes: [] }));
        return;
      }
      const t = tables.find((x) => x.code === code);
      if (!t) return;
      setForm((f) => {
        const exists = f.assigned_table_codes.includes(code);
        const next = exists
          ? f.assigned_table_codes.filter((x) => x !== code)
          : [...f.assigned_table_codes, code];
        return { ...f, assigned_table_codes: next };
      });
    },
    [tables],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (search.trim()) params.set("q", search.trim());
      const data = await apiFetch<ListResp>(`/api/admin/reservations?${params}`);
      setList(data.items);
      setTotal(data.total);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo, search]);

  useEffect(() => {
    if (!enabledPeriods.length) {
      setSelectedPeriodSet(new Set());
      return;
    }
    setSelectedPeriodSet((prev) => {
      if (prev.size > 0) return prev;
      return new Set(enabledPeriods.map((p) => p.period_key));
    });
  }, [enabledPeriods]);

  const filteredList = useMemo(() => {
    return list.filter((r) => {
      const mappedFlow = (FLOW_OPTIONS.find((x) => x.v === r.flow_status)?.v ?? r.flow_status).toString();
      if (!selectedFlowSet.has(mappedFlow)) return false;
      const pKey = timeSlotToPeriod(r.time_slot, op);
      if (selectedPeriodSet.size > 0 && !selectedPeriodSet.has(pKey)) return false;
      return true;
    });
  }, [list, selectedFlowSet, selectedPeriodSet, op]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    (async () => {
      try {
        const t = await apiFetch<DiningTableItem[]>("/api/admin/dining-tables");
        setTables(t);
      } catch {
        setTables([]);
      }
    })();
  }, []);

  const qsDateFrom = getSp("date_from", "date_from-");
  const qsDateTo = getSp("date_to", "date_to-");
  useEffect(() => {
    if (qsDateFrom) setDateFrom(qsDateFrom);
    if (qsDateTo) setDateTo(qsDateTo);
  }, [qsDateFrom, qsDateTo]);

  const openCreate = useCallback(
    (prefill?: { reservation_date?: string; time_slot?: string; assigned_table_code?: string; walkin?: boolean }) => {
      setPulseHighlight(null);
      setEditingId(null);
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const walkin = Boolean(prefill?.walkin);
      const today = `${y}-${m}-${day}`;
      setForm({
        ...emptyForm,
        reservation_date: walkin ? today : (prefill?.reservation_date?.trim() || today),
        time_slot: prefill?.time_slot?.trim() || (walkin ? nowHm() : emptyForm.time_slot),
        customer_name: walkin ? "Walk-in" : emptyForm.customer_name,
        flow_status: walkin ? "arrived" : emptyForm.flow_status,
        walkin_quick: walkin,
        assigned_table_codes: prefill?.assigned_table_code?.trim() ? [prefill.assigned_table_code.trim()] : [],
      });
      setModalOpen(true);
    },
    [nowHm],
  );

  const openEdit = useCallback(
    (
      id: number,
      reservationDate?: string,
      _timeSlot?: string,
      highlight: "flow" | "tables" | "phone" = "flow",
    ) => {
      const d = (reservationDate || "").trim() || dateTo || todayYmd;
      const next = new URLSearchParams(sp);
      next.set("date_from", d);
      next.set("date_to", d);
      next.set("edit", String(id));
      next.set("highlight", HIGHLIGHT_ANCHORS.has(highlight) ? highlight : "flow");
      nav(`/admin/reservations?${next.toString()}`);
    },
    [nav, dateTo, todayYmd, sp],
  );

  useEffect(() => {
    const e = sp.get("edit");
    if (!e || !/^\d+$/.test(e)) return;

    const rawHl = (sp.get("highlight") || "flow").trim();
    const highlight = HIGHLIGHT_ANCHORS.has(rawHl) ? rawHl : "flow";
    let cancelled = false;

    (async () => {
      try {
        const r = await apiFetch<ReservationAdminItem>(`/api/admin/reservations/${e}`);
        if (cancelled) return;
        const nm = (r.customer_name || "").trim().toLowerCase();
        const walk = nm === "walk-in" || nm === "walkin";
        setEditingId(Number(e));
        setForm({
          customer_name: r.customer_name || "",
          phone: r.phone || "",
          reservation_date: r.reservation_date || "",
          time_slot: r.time_slot || "12:00",
          party_size: r.party_size ?? 2,
          note: r.note || "",
          flow_status: r.flow_status || "confirmed",
          tags: r.tags || "",
          assigned_table_codes:
            r.table_codes && r.table_codes.length > 0
              ? [...r.table_codes]
              : r.table_code
                ? [r.table_code]
                : [],
          walkin_quick: walk,
        });
        setModalOpen(true);
        setPulseHighlight(highlight);
        const next = new URLSearchParams(sp);
        next.delete("edit");
        next.delete("highlight");
        setSp(next, { replace: true });
      } catch (ex) {
        window.alert(ex instanceof Error ? ex.message : "加载预订失败");
        const next = new URLSearchParams(sp);
        next.delete("edit");
        next.delete("highlight");
        setSp(next, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sp, setSp]);

  useEffect(() => {
    if (!modalOpen || !pulseHighlight) return;
    const idMap: Record<string, string> = {
      flow: "reservation-highlight-flow",
      tables: "reservation-highlight-tables",
      phone: "reservation-highlight-phone",
    };
    const domId = idMap[pulseHighlight] ?? idMap.flow;
    if (highlightAnimTimerRef.current) {
      clearTimeout(highlightAnimTimerRef.current);
      highlightAnimTimerRef.current = null;
    }
    const run = () => {
      const el = document.getElementById(domId);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("ring-4", "ring-amber-400", "ring-offset-2", "rounded-xl");
      highlightAnimTimerRef.current = setTimeout(() => {
        el.classList.remove("ring-4", "ring-amber-400", "ring-offset-2", "rounded-xl");
        setPulseHighlight(null);
        highlightAnimTimerRef.current = null;
      }, 3200);
    };
    const t0 = window.setTimeout(run, 120);
    return () => {
      window.clearTimeout(t0);
      if (highlightAnimTimerRef.current) {
        clearTimeout(highlightAnimTimerRef.current);
        highlightAnimTimerRef.current = null;
      }
    };
  }, [modalOpen, pulseHighlight]);

  useEffect(() => {
    const c = sp.get("create");
    if (c !== "1") return;

    const tableCode = sp.get("table_code") ?? "";
    const reservationDate = sp.get("create_date") ?? sp.get("back_date") ?? "";
    const timeSlot = sp.get("time_slot") ?? "";
    const walkin = sp.get("walkin") === "1";

    openCreate({
      reservation_date: reservationDate || undefined,
      time_slot: timeSlot || undefined,
      assigned_table_code: tableCode || undefined,
      walkin,
    });

    const next = new URLSearchParams(sp);
    next.delete("create");
    next.delete("table_code");
    next.delete("time_slot");
    next.delete("create_date");
    next.delete("walkin");
    setSp(next, { replace: true });
  }, [sp, setSp, openCreate]);

  useEffect(() => {
    if (!modalOpen || !form.reservation_date.trim()) {
      setFloorTables([]);
      setFloorErr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setFloorLoading(true);
      setFloorErr(null);
      try {
        const q = new URLSearchParams({ date: form.reservation_date, period: floorPeriod });
        const data = await apiFetch<{ tables: TableNode[] }>(`/api/admin/floor?${q.toString()}`);
        if (cancelled) return;
        setFloorTables(
          data.tables.map((row) => {
            const r = row as TableNode & { dbId?: unknown };
            return { ...row, dbId: typeof r.dbId === "number" ? r.dbId : undefined };
          }),
        );
      } catch (e) {
        if (!cancelled) {
          setFloorErr(e instanceof Error ? e.message : "加载桌台状态图失败");
          setFloorTables([]);
        }
      } finally {
        if (!cancelled) setFloorLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, form.reservation_date, floorPeriod]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const phone = form.phone.trim();
    if (phone && !/^1\d{10}$/.test(phone)) {
      window.alert("手机号格式不正确（11位，以1开头）");
      return;
    }
    setSaving(true);
    try {
      if (
        tableCapacitySummary.selectedCount > 0
        && tableCapacitySummary.totalCapacity < form.party_size
      ) {
        window.alert(
          `已选桌台总容量 ${tableCapacitySummary.totalCapacity} 小于预订人数 ${form.party_size}，请继续增加桌台后再保存。`,
        );
        setSaving(false);
        return;
      }
      if (
        tableCapacitySummary.selectedCount > 0
        && tableCapacitySummary.totalCapacity >= form.party_size * 2
      ) {
        const ok = window.confirm(
          `已选桌台总容量 ${tableCapacitySummary.totalCapacity} 明显高于预订人数 ${form.party_size}（>= 2 倍）。\n确定按当前分配保存吗？`,
        );
        if (!ok) {
          setSaving(false);
          return;
        }
      }
      const payload = {
        customer_name: (form.customer_name.trim() || (form.walkin_quick ? "Walk-in" : "")),
        phone,
        reservation_date: form.reservation_date,
        time_slot: form.time_slot.trim(),
        party_size: form.party_size,
        note: form.note.trim() || null,
        flow_status: form.walkin_quick ? "arrived" : form.flow_status,
        tags: form.tags.trim(),
        assigned_table_codes: form.assigned_table_codes,
      };
      if (!payload.customer_name) {
        window.alert("请填写联系人");
        setSaving(false);
        return;
      }
      if (!form.walkin_quick) {
        const dt = parseLocalReservationDateTime(
          form.reservation_date,
          form.time_slot.trim(),
        );
        if (dt) {
          const now = new Date();
          const staffPastMs = 24 * 60 * 60 * 1000;
          if (
            dt.getTime() < now.getTime() - staffPastMs
            && form.flow_status !== "left"
          ) {
            window.alert(
              "不可保存为早于当前超过一天的预订时间。如需补录更早记录，请将状态选为「离席」。",
            );
            setSaving(false);
            return;
          }
        }
      }
      if (editingId) {
        await apiFetch(`/api/admin/reservations/${editingId}`, {
          method: "PATCH",
          json: {
            ...payload,
            note: payload.note,
          },
        });
      } else {
        await apiFetch("/api/admin/reservations", {
          method: "POST",
          json: {
            customer_name: payload.customer_name,
            phone: payload.phone,
            reservation_date: payload.reservation_date,
            time_slot: payload.time_slot,
            party_size: payload.party_size,
            note: payload.note,
            flow_status: payload.flow_status,
            tags: payload.tags,
            assigned_table_codes: payload.assigned_table_codes,
          },
        });
      }
      if (hasBackContext) {
        nav(backAdminUrl);
      } else {
        setModalOpen(false);
        await loadList();
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReservation(id: number) {
    if (!window.confirm("确定删除该预订？关联订金将一并按规则处理（若存在订金请先处理）。")) return;
    setDeleteBusyId(id);
    try {
      await apiFetch(`/api/admin/reservations/${id}`, { method: "DELETE" });
      if (editingId === id) {
        if (hasBackContext) {
          nav(backAdminUrl);
        } else {
          setModalOpen(false);
        }
      }
      await loadList();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function onDelete() {
    if (!editingId) return;
    await deleteReservation(editingId);
  }

  function isWalkinReservation(r: ReservationAdminItem): boolean {
    return (r.customer_name || "").trim().toLowerCase() === "walk-in";
  }

  function parseLocalReservationDateTime(dateStr: string, timeStr: string): Date | null {
    const d = (dateStr || "").trim();
    const t = (timeStr || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    if (!/^\d{2}:\d{2}$/.test(t)) return null;
    const dt = new Date(`${d}T${t}:00`);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function canResendSuccessSms(r: ReservationAdminItem): { ok: boolean; reason?: string } {
    if (smsBusyId === r.id) return { ok: false, reason: "正在补发中" };
    if (isWalkinReservation(r)) return { ok: false, reason: "Walk-in 无需发送短信" };
    const phone = (r.phone || "").trim();
    if (!/^1\d{10}$/.test(phone)) return { ok: false, reason: "未填写有效手机号" };
    if (["cancelled", "left"].includes((r.flow_status || "").trim())) {
      return { ok: false, reason: "当前状态无需补发" };
    }
    const dt = parseLocalReservationDateTime(r.reservation_date, r.time_slot);
    if (!dt) return { ok: false, reason: "预订日期/时间无效" };
    const now = new Date();
    if (dt.getTime() < now.getTime()) return { ok: false, reason: "预订时间已过，避免误发" };
    return { ok: true };
  }

  async function resendSuccessSms(r: ReservationAdminItem) {
    if (smsBusyId != null) return;
    const gate = canResendSuccessSms(r);
    if (!gate.ok) {
      window.alert(gate.reason || "当前不可补发短信");
      return;
    }
    setSmsBusyId(r.id);
    try {
      const ret = await apiFetch<{
        ok: boolean;
        message?: string;
        result?: { reason?: string; code?: unknown; provider?: unknown };
      }>(
        `/api/admin/reservations/${r.id}/resend-success-sms`,
        {
          method: "POST",
        },
      );
      if (ret.ok) {
        window.alert(ret.message || "补发成功短信已提交");
      } else {
        const reason = ret.result?.reason ? `原因：${ret.result.reason}` : "";
        const code = ret.result?.code != null ? ` code：${String(ret.result.code)}` : "";
        const providerRaw = ret.result?.provider ? JSON.stringify(ret.result.provider, null, 2) : "";
        window.alert(
          [ret.message, reason, code, providerRaw].filter(Boolean).join("\n"),
        );
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "补发失败");
    } finally {
      setSmsBusyId(null);
    }
  }

  function appendCreateNoteQuick(text: string) {
    setForm((prev) => {
      const cur = (prev.note || "").trim();
      const add = text.trim();
      if (!add) return prev;
      if (!cur) return { ...prev, note: add };
      if (cur.includes(add)) return prev;
      return { ...prev, note: `${cur} ${add}` };
    });
  }

  async function openCustomerProfileByPhone(phone: string) {
    const p = (phone || "").trim();
    if (!/^1\d{10}$/.test(p)) return;
    try {
      const data = await apiFetch<CustomerProfileResponse>(`/api/admin/customers/by-phone/${p}`);
      setProfileModal(data);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "加载客户详情失败");
    }
  }

  useEffect(() => {
    if (!modalOpen) {
      setPhoneProfile(null);
      setProfileBusy(false);
      return;
    }
    const phone = form.phone.trim();
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
  }, [modalOpen, form.phone]);

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-0 w-full flex-col overflow-hidden px-3 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">记录</h1>
          <p className="text-sm text-stone-500">查询、新建、修改与删除预订；可分配桌台与流转状态。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/kitchen-prep"
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            订单打印
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-3">
        <input
          type="search"
          placeholder="搜索姓名/手机"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="min-w-[220px] rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => handleDateFromChange(e.target.value)}
          className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
        />
        <span className="self-center text-stone-400">至</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => handleDateToChange(e.target.value)}
          className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setDateFrom(todayYmd);
            setDateTo(todayYmd);
            setPage(1);
          }}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
        >
          今日
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {loading && <p className="mt-3 text-sm text-stone-500">加载中…</p>}

      <div className="mt-4 min-h-0 flex flex-1 gap-3 overflow-hidden">
        <aside className="w-[220px] shrink-0 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3">
          <div>
            <p className="text-xs font-semibold text-stone-600">状态</p>
            <div className="mt-2 space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={selectedFlowSet.size === FLOW_FILTER_OPTIONS.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedFlowSet(new Set(FLOW_FILTER_OPTIONS.map((x) => x.key)));
                    else setSelectedFlowSet(new Set());
                  }}
                />
                全部状态
              </label>
              {FLOW_FILTER_OPTIONS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={selectedFlowSet.has(f.key)}
                    onChange={(e) => {
                      setSelectedFlowSet((prev) => {
                        const n = new Set(prev);
                        if (e.target.checked) n.add(f.key);
                        else n.delete(f.key);
                        return n;
                      });
                    }}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-stone-100 pt-3">
            <p className="text-xs font-semibold text-stone-600">时段</p>
            <div className="mt-2 space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={selectedPeriodSet.size === enabledPeriods.length && enabledPeriods.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedPeriodSet(new Set(enabledPeriods.map((p) => p.period_key)));
                    else setSelectedPeriodSet(new Set());
                  }}
                />
                全部时段
              </label>
              {enabledPeriods.map((p) => (
                <label key={p.period_key} className="flex items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={selectedPeriodSet.has(p.period_key)}
                    onChange={(e) => {
                      setSelectedPeriodSet((prev) => {
                        const n = new Set(prev);
                        if (e.target.checked) n.add(p.period_key);
                        else n.delete(p.period_key);
                        return n;
                      });
                    }}
                  />
                  {periodName(p.period_key)}
                </label>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
              <tr>
                <th className="px-3 py-2">日期/时间</th>
                <th className="px-3 py-2">时段</th>
                <th className="px-3 py-2">客人</th>
                <th className="px-3 py-2">手机</th>
                <th className="px-3 py-2">人数</th>
                <th className="px-3 py-2">桌台</th>
                <th className="px-3 py-2">接单人</th>
                <th className="px-3 py-2">创建时间</th>
                <th className="px-3 py-2">备注</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((r) => {
                const pKey = timeSlotToPeriod(r.time_slot, op);
                const resendGate = canResendSuccessSms(r);
                return (
                  <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.reservation_date} {r.time_slot}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{periodName(pKey)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className="text-left text-stone-800 hover:underline"
                          onClick={() => void openCustomerProfileByPhone(r.phone)}
                        >
                          {r.customer_name}
                        </button>
                        {typeof r.reservation_count === "number" && r.reservation_count > 0 ? (
                          <span
                            title={`历史预订 ${r.reservation_count} 次（不含本条）`}
                            className={`align-middle ${billiardHistoryBadgeClass(r.reservation_count)}`}
                          >
                            {r.reservation_count > 99 ? "99+" : r.reservation_count}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-600">
                      {maskPhoneForDisplay(r.phone)}
                    </td>
                    <td className="px-3 py-2">{r.party_size}</td>
                    <td className="px-3 py-2">
                      {r.table_labels && r.table_labels.length > 0 ? r.table_labels.join("、") : (r.table_label ?? "—")}
                    </td>
                    <td className="px-3 py-2 text-stone-700">
                      {(r.assigned_staff_name || "").trim() || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-stone-600">
                      {formatApiDateTimeToMinute(r.created_at)}
                    </td>
                    <td className="px-3 py-2 text-stone-600">{r.note || "—"}</td>
                    <td className="px-3 py-2">{FLOW_OPTIONS.find((x) => x.v === r.flow_status)?.l ?? r.flow_status}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="rounded p-1 text-stone-500 hover:text-brand-coral"
                          title="编辑"
                          onClick={() => openEdit(r.id, r.reservation_date, r.time_slot, guessReservationHighlight(r))}
                          aria-label="编辑"
                        >
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title={resendGate.ok ? "补发成功短信" : (resendGate.reason || "不可补发")}
                          className="rounded p-1 text-stone-500 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => void resendSuccessSms(r)}
                          disabled={!resendGate.ok}
                          aria-label="补发短信"
                        >
                          {smsBusyId === r.id ? (
                            <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin text-stone-500" fill="none" aria-hidden="true">
                              <circle className="opacity-25" cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
                              <path className="opacity-75" fill="currentColor" d="M18 10a8 8 0 00-8-8v4a4 4 0 014 4h4z" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                              <path
                                fillRule="evenodd"
                                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                        {canDeleteReservation ? (
                          <button
                            type="button"
                            title="删除该条预订（仅超级管理员；可用于清理测试数据）"
                            className="rounded p-1 text-stone-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={deleteBusyId === r.id}
                            onClick={() => void deleteReservation(r.id)}
                            aria-label="删除"
                          >
                            {deleteBusyId === r.id ? (
                              <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin text-stone-500" fill="none" aria-hidden="true">
                                <circle className="opacity-25" cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
                                <path className="opacity-75" fill="currentColor" d="M18 10a8 8 0 00-8-8v4a4 4 0 014 4h4z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                <path
                                  fillRule="evenodd"
                                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 shrink-0 flex items-center justify-between text-sm text-stone-600">
        <span>
          共 {total} 条 · 第 {page} 页
          {list.length > 0 && filteredList.length !== list.length ? (
            <span className="text-stone-400"> · 本页经状态/时段筛选显示 {filteredList.length} 条</span>
          ) : null}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <button
            type="button"
            disabled={page * pageSize >= total}
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <form
            onSubmit={onSubmit}
            className="flex max-h-[98vh] min-h-[min(90vh,1000px)] w-full max-w-8xl flex-col overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-3">
              <h2 className="font-display text-lg font-semibold">{editingId ? "编辑预订" : "新建预订"}</h2>
              <div className="flex flex-wrap justify-end gap-2">
                {!editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const tm = nowHm();
                      setForm((f) => ({
                        ...f,
                        reservation_date: toLocalYmd(new Date()),
                        customer_name: "Walk-in",
                        phone: "",
                        time_slot: tm,
                        flow_status: "arrived",
                        walkin_quick: true,
                      }));
                    }}
                    className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-700"
                  >
                    散客入席快捷建单
                  </button>
                )}
                {!editingId && form.walkin_quick && (
                  <span className="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    Walk-in 模式：仅需填写人数与桌台，提交后状态为「入座」
                  </span>
                )}
                {editingId && canDeleteReservation ? (
                  <button
                    type="button"
                    onClick={() => void onDelete()}
                    className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700"
                  >
                    删除
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-600"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "保存中…" : "保存"}
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
                      value={form.customer_name}
                      onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                    />
                  </label>
                  <div id="reservation-highlight-phone" className="block rounded-xl">
                    <label className="block">
                      <span className="text-xs text-stone-500">手机（可留空）</span>
                      <input
                        inputMode="numeric"
                        maxLength={11}
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-stone-500">标签（逗号分隔）</span>
                    <input
                      value={form.tags}
                      onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="text-xs text-stone-500">日期</span>
                    <input
                      required
                      type="date"
                      value={form.reservation_date}
                      onChange={(e) => setForm((f) => ({ ...f, reservation_date: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-stone-500">时间点</span>
                    <input
                      required
                      type="time"
                      step={300}
                      min={floorPeriodRow?.start_time}
                      max={floorPeriodRow?.end_time}
                      value={form.time_slot}
                      onChange={(e) => setForm((f) => ({ ...f, time_slot: e.target.value }))}
                      onBlur={(e) => {
                        if (!floorPeriodRow) return;
                        const v = e.target.value;
                        const mins = toMins(v);
                        const st = toMins(floorPeriodRow.start_time);
                        const ed = toMins(floorPeriodRow.end_time);
                        if (mins < 0 || st < 0 || ed < 0) return;
                        if (mins < st || mins > ed) {
                          setForm((f) => ({ ...f, time_slot: floorPeriodRow.start_time }));
                        }
                      }}
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
                      value={form.party_size}
                      onChange={(e) => setForm((f) => ({ ...f, party_size: Number(e.target.value) }))}
                      className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="flex items-start gap-2 text-xs text-stone-500">
                    <span className="mt-1 shrink-0">备注</span>
                    <div className="min-w-0 flex-1">
                      <NoteQuickOptionsBar active={modalOpen} onPick={appendCreateNoteQuick} />
                    </div>
                  </span>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm"
                    placeholder="可填写忌口、座位偏好、庆生等信息"
                  />
                </label>
                <div id="reservation-highlight-flow" className="rounded-xl">
                  <span className="text-xs text-stone-500">预订状态</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {CREATE_FLOW_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                          form.flow_status === opt.value
                            ? "border-brand-coral bg-brand-coral/10 text-brand-coral"
                            : "border-stone-200 bg-white text-stone-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="reservation-flow-status"
                          value={opt.value}
                          checked={form.flow_status === opt.value}
                          onChange={() => setForm((f) => ({ ...f, flow_status: opt.value }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">
                    过去时段建议仅用于补录，状态可按现场实际调整。
                  </p>
                </div>
                <div id="reservation-highlight-tables" className="rounded-xl">
                  <span className="text-xs text-stone-500">分配桌台</span>
                  <div className="mt-1 rounded-xl border border-stone-200 p-2">
                    <div className="flex flex-wrap">
                      {tables.filter((t) => t.is_active).map((t) => (
                        <label key={t.code} className="mb-1 mr-2 inline-flex items-center text-xs text-stone-700">
                          <input
                            type="checkbox"
                            checked={form.assigned_table_codes.includes(t.code)}
                            onChange={() => toggleAssignedTable(t.code)}
                          />
                          <span>{t.label}</span>
                        </label>
                      ))}
                    </div>
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
                        <p>手机：<span className="font-mono">{phoneProfile.phone}</span></p>
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
                <p className="text-xs font-medium text-stone-600">桌台状态图</p>
                <p className="text-[11px] leading-snug text-stone-500">
                  根据上方日期与时刻对应时段「{periodName(floorPeriod)}」；与桌台管理页同一数据源。点击桌台可选中分配；也可使用左侧下拉。
                </p>
                <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[11px] text-stone-600">
                  <div>已选桌台：{tableCapacitySummary.selectedCount} 张</div>
                  <div>总容量：{tableCapacitySummary.totalCapacity} 位 · 预订人数：{tableCapacitySummary.party} 位</div>
                  {tableCapacitySummary.selectedCount > 0 && tableCapacitySummary.gap < 0 && (
                    <div className="mt-1 font-medium text-red-600">
                      容量不足：还差 {Math.abs(tableCapacitySummary.gap)} 位（不可保存）
                    </div>
                  )}
                  {tableCapacitySummary.selectedCount > 0 && tableCapacitySummary.gap >= 0 && tableCapacitySummary.gap <= 2 && (
                    <div className="mt-1 font-medium text-emerald-600">容量匹配较好</div>
                  )}
                  {tableCapacitySummary.selectedCount > 0 && tableCapacitySummary.totalCapacity >= tableCapacitySummary.party * 2 && (
                    <div className="mt-1 font-medium text-amber-600">容量明显偏多，保存时会二次确认</div>
                  )}
                </div>
                {floorLoading && <p className="text-xs text-stone-500">加载平面图…</p>}
                {floorErr && <p className="text-xs text-red-600">{floorErr}</p>}
                {!floorLoading && !floorErr && floorTables.length > 0 && (
                  <FloorCanvas
                    tables={floorTables}
                    selectedId={form.assigned_table_codes[0] || null}
                    selectedIds={form.assigned_table_codes}
                    onSelect={toggleAssignedTable}
                    draggable={false}
                  />
                )}
                {!floorLoading && !floorErr && floorTables.length === 0 && (
                  <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-3 py-6 text-center text-xs text-stone-500">
                    暂无桌台数据，请先在「桌台管理」中维护桌台。
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
      {profileModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">客户详情</h3>
              <button
                type="button"
                onClick={() => setProfileModal(null)}
                className="rounded-lg px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
              >
                关闭
              </button>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-stone-700">
              <p>
                手机：<span className="font-mono">{profileModal.phone}</span>
              </p>
              <p>称呼：{profileModal.customer?.display_name || "—"}</p>
              <p>邮箱：{profileModal.customer?.email || "—"}</p>
              <p>标签：{profileModal.customer?.tags || "—"}</p>
              <p>备注：{profileModal.customer?.note || "—"}</p>
              <p>历史预订总数：{profileModal.reservation_count}</p>
            </div>
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-sm font-medium text-stone-700">历史预订清单</p>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white">
                {profileModal.reservations.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-stone-500">暂无历史预订</p>
                ) : (
                  profileModal.reservations.map((x) => (
                    <div key={x.id} className="border-b border-stone-100 px-3 py-2 text-xs text-stone-700">
                      <p className="whitespace-normal break-words leading-snug">
                        {x.reservation_date} {x.time_slot} · {x.customer_name} ·{" "}
                        {x.party_size}位 · {x.flow_status}
                      </p>
                      <p className="mt-0.5 whitespace-normal break-words text-stone-500 leading-snug">
                        历史备注：{x.note?.trim() ? x.note : "—"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
