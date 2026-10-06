import { FormEvent, useEffect, useState } from "react";
import { apiUrl, assetUrl, apiFetch, uploadAdminFile } from "@/lib/api";
import { useBranding } from "@/context/BrandingContext";
import { useOperatingPeriods } from "@/context/OperatingPeriodsContext";
import type { BrandingDTO } from "@/types/branding";
import { DEFAULT_OPERATING_PERIODS, type OperatingPeriodsDTO } from "@/types/operatingPeriods";

function urlToFilename(u: string | null): string | null {
  if (!u) return null;
  const clean = u.split("?")[0];
  const seg = clean.split("/").filter(Boolean).pop();
  return seg || null;
}

const PROMOTION_TONES = [
  { value: "from-amber-700/90 to-orange-600/85", label: "琥珀暖橘" },
  { value: "from-rose-800/90 to-red-700/85", label: "玫瑰红" },
  { value: "from-emerald-800/88 to-teal-700/85", label: "翡翠青绿" },
  { value: "from-violet-800/88 to-fuchsia-700/85", label: "紫韵绛紫" },
] as const;

export function AdminSettingsPage() {
  const { branding, refresh } = useBranding();
  const { data: op, refresh: refreshOp } = useOperatingPeriods();
  const [tab, setTab] = useState<"brand" | "operating" | "activities" | "data" | "logs">("brand");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opBusy, setOpBusy] = useState(false);

  const [periodsDraft, setPeriodsDraft] = useState<OperatingPeriodsDTO["periods"]>(
    DEFAULT_OPERATING_PERIODS.periods,
  );

  const [companyName, setCompanyName] = useState("");
  const [appName, setAppName] = useState("");
  const [loginTitle, setLoginTitle] = useState("");
  const [loginSubtitle, setLoginSubtitle] = useState("");
  const [loginPrimary, setLoginPrimary] = useState("#1c1917");
  const [loginAccent, setLoginAccent] = useState("#e85d4c");
  const [loginCardOpacity, setLoginCardOpacity] = useState(0.92);
  const [loginFooter, setLoginFooter] = useState("");
  const [loginShowPowered, setLoginShowPowered] = useState(true);

  const [splashEnabled, setSplashEnabled] = useState(true);
  const [splashSeconds, setSplashSeconds] = useState(2.5);
  const [splashCustomer, setSplashCustomer] = useState(true);
  const [splashStaff, setSplashStaff] = useState(true);

  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [customerPrimary, setCustomerPrimary] = useState("#e85d4c");

  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [faviconPath, setFaviconPath] = useState<string | null>(null);
  const [loginBgPath, setLoginBgPath] = useState<string | null>(null);
  const [splashPath, setSplashPath] = useState<string | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [customerDuplicateStrategy, setCustomerDuplicateStrategy] = useState<"skip" | "update">("skip");
  const [reservationDuplicateStrategy, setReservationDuplicateStrategy] = useState<"skip" | "update">("skip");

  const [backupPlanBusy, setBackupPlanBusy] = useState(false);
  const [backupPlanEnabled, setBackupPlanEnabled] = useState(false);
  const [backupPlanTime, setBackupPlanTime] = useState("03:00");
  const [backupPlanKeepLast, setBackupPlanKeepLast] = useState(30);
  const [backupPlanLastRunDate, setBackupPlanLastRunDate] = useState("");

  const [backupListBusy, setBackupListBusy] = useState(false);
  const [backupFiles, setBackupFiles] = useState<
    { filename: string; size_bytes: number; modified_at: string }[]
  >([]);
  const [selectedBackupFilename, setSelectedBackupFilename] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);

  const [logsTab, setLogsTab] = useState<"ops" | "sms">("ops");
  const [logsBusy, setLogsBusy] = useState(false);
  const [opsRows, setOpsRows] = useState<
    {
      id: number;
      created_at: string | null;
      actor_username: string;
      actor_role: string;
      category: string;
      action: string;
      entity: string;
      entity_id: string;
      ip: string;
      detail_json: string;
    }[]
  >([]);
  const [opsTotal, setOpsTotal] = useState(0);
  const [opsPage, setOpsPage] = useState(1);
  const [opsUser, setOpsUser] = useState("");
  const [opsCategory, setOpsCategory] = useState("");
  const [opsAction, setOpsAction] = useState("");
  const [opsDateFrom, setOpsDateFrom] = useState("");
  const [opsDateTo, setOpsDateTo] = useState("");

  const [smsRows, setSmsRows] = useState<
    {
      id: number;
      created_at: string | null;
      kind: string;
      purpose: string;
      reservation_id: number | null;
      phone: string;
      status: string;
      reason: string;
      content: string;
      provider_json: string;
    }[]
  >([]);
  const [smsTotal, setSmsTotal] = useState(0);
  const [smsPage, setSmsPage] = useState(1);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsKind, setSmsKind] = useState("");
  const [smsPurpose, setSmsPurpose] = useState("");
  const [smsStatus, setSmsStatus] = useState("");
  const [smsDateFrom, setSmsDateFrom] = useState("");
  const [smsDateTo, setSmsDateTo] = useState("");

  const [onlineReservationEnabled, setOnlineReservationEnabled] = useState(true);
  const [onlineReservationBusy, setOnlineReservationBusy] = useState(false);

  // 门店活动（首页“门店活动”卡片）
  type PromotionRow = {
    id: number;
    title: string;
    sub: string;
    tone: string;
    image_url: string | null;
    enabled: boolean;
    sort_order: number;
  };

  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoImageBusy, setPromoImageBusy] = useState(false);
  const [promoEditId, setPromoEditId] = useState<number | null>(null);
  const [promoTitle, setPromoTitle] = useState("");
  const [promoSub, setPromoSub] = useState("");
  const [promoTone, setPromoTone] = useState<string>(PROMOTION_TONES[0].value);
  const [promoSortOrder, setPromoSortOrder] = useState(0);
  const [promoEnabled, setPromoEnabled] = useState(true);
  const [promoImageFilename, setPromoImageFilename] = useState<string | null>(null);
  const [promoImagePreview, setPromoImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!branding) return;
    setCompanyName(branding.company_name);
    setAppName(branding.app_name);
    setLoginTitle(branding.login_title);
    setLoginSubtitle(branding.login_subtitle);
    setLoginPrimary(branding.login_primary_color);
    setLoginAccent(branding.login_accent_color);
    setLoginCardOpacity(branding.login_card_opacity);
    setLoginFooter(branding.login_footer_text);
    setLoginShowPowered(branding.login_show_powered);
    setSplashEnabled(branding.splash_enabled);
    setSplashSeconds(branding.splash_seconds);
    setSplashCustomer(branding.splash_for_customer);
    setSplashStaff(branding.splash_for_staff);
    setHeroTitle(branding.customer_hero_title);
    setHeroSubtitle(branding.customer_hero_subtitle);
    setCustomerPrimary(branding.customer_primary_color);
    setLogoPath(urlToFilename(branding.logo_url));
    setFaviconPath(urlToFilename(branding.favicon_url));
    setLoginBgPath(urlToFilename(branding.login_bg_url));
    setSplashPath(urlToFilename(branding.splash_image_url));
  }, [branding]);

  useEffect(() => {
    if (!op?.periods) return;
    setPeriodsDraft(op.periods);
  }, [op]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch<{ enabled: boolean }>("/api/admin/online-reservation");
        if (cancelled) return;
        setOnlineReservationEnabled(r.enabled);
      } catch {
        // 静默：不影响其它设置页功能
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveOperatingPeriods(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setOpBusy(true);
    try {
      const payload = {
        periods: periodsDraft
          .map((p, idx) => ({
            ...p,
            period_key: String(p.period_key ?? "").trim(),
            label: String(p.label ?? "").trim() || String(p.period_key ?? "").trim(),
            start_time: p.start_time,
            end_time: p.end_time,
            sort_order: idx,
            color: p.color,
            icon: p.icon,
            enabled: p.enabled,
          }))
          .filter((p) => p.period_key),
      };

      await apiFetch<OperatingPeriodsDTO>("/api/admin/operating-periods", {
        method: "PUT",
        json: payload,
      });
      setMsg("运营时段已保存");
      await refreshOp();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "保存失败");
    } finally {
      setOpBusy(false);
    }
  }

  async function saveOnlineReservation(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setOnlineReservationBusy(true);
    try {
      await apiFetch("/api/admin/online-reservation", {
        method: "PUT",
        json: { enabled: onlineReservationEnabled },
      });
      setMsg("网上预约通道已保存");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "保存失败");
    } finally {
      setOnlineReservationBusy(false);
    }
  }

  function hmToMinutes(hm: string): number {
    const p = (hm || "").trim().split(":");
    const h = Number.parseInt(p[0] ?? "0", 10);
    const m = Number.parseInt(p[1] ?? "0", 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return h * 60 + m;
  }

  function minutesToHM(mins: number): string {
    const v = Math.max(0, Math.min(23 * 60 + 59, Math.floor(mins)));
    const h = Math.floor(v / 60);
    const m = v % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function updatePeriodAt(idx: number, patch: Partial<OperatingPeriodsDTO["periods"][number]>) {
    setPeriodsDraft((prev) => {
      const next = prev.map((p, i) => (i === idx ? { ...p, ...patch } : p));
      return next.map((p, i) => ({ ...p, sort_order: i }));
    });
  }

  function movePeriod(idx: number, dir: -1 | 1) {
    setPeriodsDraft((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next.map((p, i) => ({ ...p, sort_order: i }));
    });
  }

  function addPeriod() {
    setPeriodsDraft((prev) => {
      const last = prev[prev.length - 1];
      const startMins = hmToMinutes(last?.end_time || "11:00");
      const step = 30; // 分钟
      const desiredEnd = startMins + 120; // 默认 +2 小时
      const endRounded = Math.ceil(desiredEnd / step) * step;
      const endMins = Math.min(endRounded, 23 * 60 + 59);
      const nextKey = `p_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
      const newItem: OperatingPeriodsDTO["periods"][number] = {
        period_key: nextKey,
        label: `时段${prev.length + 1}`,
        start_time: minutesToHM(startMins),
        end_time: minutesToHM(Math.max(endMins, startMins + step)),
        sort_order: prev.length,
        color: "#e85d4c",
        icon: "餐",
        enabled: true,
      };
      return [...prev, newItem];
    });
  }

  async function onSave() {
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      await apiFetch<BrandingDTO>("/api/admin/branding", {
        method: "PUT",
        json: {
          company_name: companyName,
          app_name: appName,
          login_title: loginTitle,
          login_subtitle: loginSubtitle,
          login_primary_color: loginPrimary,
          login_accent_color: loginAccent,
          login_card_opacity: loginCardOpacity,
          login_footer_text: loginFooter,
          login_show_powered: loginShowPowered,
          splash_enabled: splashEnabled,
          splash_seconds: splashSeconds,
          splash_for_customer: splashCustomer,
          splash_for_staff: splashStaff,
          customer_hero_title: heroTitle,
          customer_hero_subtitle: heroSubtitle,
          customer_primary_color: customerPrimary,
          logo_path: logoPath,
          favicon_path: faviconPath,
          login_bg_path: loginBgPath,
          splash_image_path: splashPath,
        },
      });
      setMsg("已保存");
      await refresh();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function clearTestReservations() {
    const ok = window.confirm(
      "确定清空业务测试数据吗？\n\n将删除：订金记录、预订记录、客户档案。\n将保留：管理员账号、品牌与登录设置、桌台布局、已上传图片文件。",
    );
    if (!ok) return;
    setErr(null);
    setMsg(null);
    setClearBusy(true);
    try {
      const result = await apiFetch<{ backup_file?: string }>("/api/admin/maintenance/clear-reservations", {
        method: "POST",
      });
      setMsg(`已清空业务数据，自动备份文件：${result.backup_file ?? "未知"}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "清空失败");
    } finally {
      setClearBusy(false);
    }
  }

  async function backupDatabaseNow() {
    setErr(null);
    setMsg(null);
    setBackupBusy(true);
    try {
      const r = await apiFetch<{ backup_file: string }>("/api/admin/maintenance/backup-db", {
        method: "POST",
      });
      setMsg(`数据库已备份：${r.backup_file}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "备份失败");
    } finally {
      setBackupBusy(false);
    }
  }

  async function loadBackupPlan() {
    setBackupPlanBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{
        enabled: boolean;
        daily_time_hm: string;
        keep_last: number;
        last_run_date: string;
      }>("/api/admin/maintenance/backup-plan");
      setBackupPlanEnabled(Boolean(r.enabled));
      setBackupPlanTime(r.daily_time_hm || "03:00");
      setBackupPlanKeepLast(Number(r.keep_last || 30));
      setBackupPlanLastRunDate(r.last_run_date || "");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "加载失败");
    } finally {
      setBackupPlanBusy(false);
    }
  }

  async function saveBackupPlan() {
    setBackupPlanBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{
        ok: boolean;
        enabled: boolean;
        daily_time_hm: string;
        keep_last: number;
        last_run_date: string;
        message?: string;
      }>("/api/admin/maintenance/backup-plan", {
        method: "PUT",
        json: {
          enabled: backupPlanEnabled,
          daily_time_hm: backupPlanTime,
          keep_last: backupPlanKeepLast,
        },
      });
      setBackupPlanEnabled(Boolean(r.enabled));
      setBackupPlanTime(r.daily_time_hm || "03:00");
      setBackupPlanKeepLast(Number(r.keep_last || 30));
      setBackupPlanLastRunDate(r.last_run_date || "");
      setMsg(r.message || "自动备份计划已保存");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "保存失败");
    } finally {
      setBackupPlanBusy(false);
    }
  }

  async function loadBackupFiles() {
    setBackupListBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ items: { filename: string; size_bytes: number; modified_at: string }[] }>(
        "/api/admin/maintenance/backups",
      );
      const items = r.items || [];
      setBackupFiles(items);
      if (!selectedBackupFilename && items.length > 0) {
        setSelectedBackupFilename(items[0].filename);
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "加载失败");
    } finally {
      setBackupListBusy(false);
    }
  }

  async function downloadBackupFile(filename: string) {
    setErr(null);
    try {
      const token = localStorage.getItem("rr_token");
      if (!token) throw new Error("未登录");
      const res = await fetch(
        apiUrl(`/api/admin/maintenance/backups/download?filename=${encodeURIComponent(filename)}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "下载失败");
      }
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(u);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "下载失败");
    }
  }

  async function restoreFromSelectedBackup() {
    const name = selectedBackupFilename.trim();
    if (!name) return;
    const ok = window.confirm(
      `确定从备份恢复数据库吗？\n\n将使用备份文件：${name}\n系统会先自动再备份一份当前数据库。\n恢复完成后建议重启后端服务以确保生效。`,
    );
    if (!ok) return;
    setRestoreBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ ok: boolean; message?: string; before_backup?: string }>(
        `/api/admin/maintenance/restore-db/from-backup?filename=${encodeURIComponent(name)}`,
        { method: "POST" },
      );
      setMsg(r.message || `已恢复数据库（恢复前备份：${r.before_backup ?? "未知"}）`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "恢复失败");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function restoreFromBackupName(filename: string) {
    setSelectedBackupFilename(filename);
    const ok = window.confirm(
      `确定从备份恢复数据库吗？\n\n将使用备份文件：${filename}\n系统会先自动再备份一份当前数据库。\n恢复完成后建议重启后端服务以确保生效。`,
    );
    if (!ok) return;
    setRestoreBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ ok: boolean; message?: string; before_backup?: string }>(
        `/api/admin/maintenance/restore-db/from-backup?filename=${encodeURIComponent(filename)}`,
        { method: "POST" },
      );
      setMsg(r.message || `已恢复数据库（恢复前备份：${r.before_backup ?? "未知"}）`);
      await loadBackupFiles();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "恢复失败");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function restoreFromUpload(file: File) {
    const ok = window.confirm(
      "确定从上传文件恢复数据库吗？\n\n系统会先自动备份当前数据库。\n恢复完成后建议重启后端服务以确保生效。",
    );
    if (!ok) return;
    setRestoreBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const token = localStorage.getItem("rr_token");
      if (!token) throw new Error("未登录");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(apiUrl("/api/admin/maintenance/restore-db/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "恢复失败");
      }
      const data = (await res.json()) as { message?: string; before_backup?: string; uploaded_as?: string };
      setMsg(data.message || `已从上传文件恢复（恢复前备份：${data.before_backup ?? "未知"}）`);
      await loadBackupFiles();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "恢复失败");
    } finally {
      setRestoreBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== "data") return;
    void loadBackupPlan();
    void loadBackupFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function downloadCsv(path: string, filename: string) {
    setErr(null);
    try {
      const token = localStorage.getItem("rr_token");
      if (!token) throw new Error("未登录");
      const res = await fetch(apiUrl(path), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "下载失败");
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "下载失败");
    }
  }

  async function importCsv(path: string, file: File, duplicateStrategy: "skip" | "update") {
    setErr(null);
    setMsg(null);
    setImportBusy(true);
    try {
      const token = localStorage.getItem("rr_token");
      if (!token) throw new Error("未登录");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(apiUrl(`${path}?duplicate_strategy=${duplicateStrategy}`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "导入失败");
      }
      const data = (await res.json()) as {
        created: number;
        updated: number;
        skipped: number;
        error_count: number;
        errors?: string[];
      };
      const errorPreview = (data.errors || []).slice(0, 3).join("；");
      setMsg(
        `导入完成：新增 ${data.created}，更新 ${data.updated}，跳过 ${data.skipped}，错误 ${data.error_count}${
          errorPreview ? `。示例错误：${errorPreview}` : ""
        }`,
      );
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "导入失败");
    } finally {
      setImportBusy(false);
    }
  }

  async function loadOperationLogs(pageOverride?: number) {
    setErr(null);
    setLogsBusy(true);
    try {
      const p = pageOverride ?? opsPage;
      const q = new URLSearchParams({
        page: String(p),
        page_size: "50",
      });
      if (opsUser.trim()) q.set("username", opsUser.trim());
      if (opsCategory.trim()) q.set("category", opsCategory.trim());
      if (opsAction.trim()) q.set("action", opsAction.trim());
      if (opsDateFrom.trim()) q.set("date_from", opsDateFrom.trim());
      if (opsDateTo.trim()) q.set("date_to", opsDateTo.trim());
      const r = await apiFetch<{ items: typeof opsRows; total: number }>(`/api/admin/logs/operations?${q}`);
      setOpsRows(r.items);
      setOpsTotal(r.total);
      setOpsPage(p);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "加载失败");
    } finally {
      setLogsBusy(false);
    }
  }

  async function loadSmsLogs(pageOverride?: number) {
    setErr(null);
    setLogsBusy(true);
    try {
      const p = pageOverride ?? smsPage;
      const q = new URLSearchParams({
        page: String(p),
        page_size: "50",
      });
      if (smsPhone.trim()) q.set("phone", smsPhone.trim());
      if (smsKind.trim()) q.set("kind", smsKind.trim());
      if (smsPurpose.trim()) q.set("purpose", smsPurpose.trim());
      if (smsStatus.trim()) q.set("status", smsStatus.trim());
      if (smsDateFrom.trim()) q.set("date_from", smsDateFrom.trim());
      if (smsDateTo.trim()) q.set("date_to", smsDateTo.trim());
      const r = await apiFetch<{ items: typeof smsRows; total: number }>(`/api/admin/logs/sms?${q}`);
      setSmsRows(r.items);
      setSmsTotal(r.total);
      setSmsPage(p);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "加载失败");
    } finally {
      setLogsBusy(false);
    }
  }

  async function pickAndUpload(kind: "logo" | "login_bg" | "splash" | "favicon", file: File | null) {
    if (!file) return;
    setErr(null);
    try {
      const r = await uploadAdminFile(kind, file);
      if (kind === "logo") setLogoPath(r.filename);
      if (kind === "favicon") setFaviconPath(r.filename);
      if (kind === "login_bg") setLoginBgPath(r.filename);
      if (kind === "splash") setSplashPath(r.filename);
      setMsg("图片已上传，请点击底部「保存全部设置」写入数据库");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "上传失败");
    }
  }

  async function refreshPromotions() {
    setPromoBusy(true);
    setErr(null);
    try {
      const rows = await apiFetch<PromotionRow[]>("/api/admin/promotions");
      setPromotions(rows);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "加载活动失败");
    } finally {
      setPromoBusy(false);
    }
  }

  function resetPromotionForm() {
    setPromoEditId(null);
    setPromoTitle("");
    setPromoSub("");
    setPromoTone(PROMOTION_TONES[0].value);
    setPromoSortOrder(0);
    setPromoEnabled(true);
    setPromoImageFilename(null);
    setPromoImagePreview(null);
  }

  async function pickAndUploadPromotion(file: File | null) {
    if (!file) return;
    setPromoImageBusy(true);
    setErr(null);
    try {
      const r = await uploadAdminFile("promotion", file);
      setPromoImageFilename(r.filename);
      setPromoImagePreview(r.url);
      setMsg("配图已上传，请点击“保存活动”写入数据库");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "上传失败");
    } finally {
      setPromoImageBusy(false);
    }
  }

  function startEditPromotion(p: PromotionRow) {
    setPromoEditId(p.id);
    setPromoTitle(p.title);
    setPromoSub(p.sub);
    setPromoTone(p.tone as PromotionRow["tone"]);
    setPromoSortOrder(p.sort_order);
    setPromoEnabled(p.enabled);
    setPromoImageFilename(urlToFilename(p.image_url));
    setPromoImagePreview(p.image_url);
    setErr(null);
  }

  async function savePromotion() {
    setErr(null);
    setMsg(null);
    setPromoBusy(true);
    try {
      const payload = {
        title: promoTitle.trim(),
        sub: promoSub.trim(),
        tone: promoTone,
        image_filename: promoImageFilename,
        sort_order: promoSortOrder,
        enabled: promoEnabled,
      };

      if (promoEditId === null) {
        await apiFetch("/api/admin/promotions", { method: "POST", json: payload });
        setMsg("活动已创建");
      } else {
        await apiFetch(`/api/admin/promotions/${promoEditId}`, { method: "PATCH", json: payload });
        setMsg("活动已保存");
      }

      await refreshPromotions();
      resetPromotionForm();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "保存活动失败");
    } finally {
      setPromoBusy(false);
    }
  }

  async function deletePromotion(id: number) {
    const ok = window.confirm("确定删除该门店活动吗？删除后无法恢复。");
    if (!ok) return;
    setErr(null);
    setPromoBusy(true);
    try {
      await apiFetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
      setMsg("活动已删除");
      await refreshPromotions();
      if (promoEditId === id) resetPromotionForm();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "删除失败");
    } finally {
      setPromoBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== "activities") return;
    void refreshPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="min-h-0 bg-[#f5f3f0] text-ink-900">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-semibold">系统与品牌设置</h1>
            <p className="text-xs text-stone-500">Logo、登录页、运营时段、启动页与顾客端展示文案</p>
          </div>
          {tab === "brand" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSave()}
                className="rounded-xl bg-ink-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? "保存中…" : "保存全部设置"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
                onClick={() => void refresh()}
              >
                重新加载
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="w-full px-4 pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("brand")}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              tab === "brand" ? "border-brand-coral bg-brand-coral/10 text-brand-coral" : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            品牌与登录页
          </button>
          <button
            type="button"
            onClick={() => setTab("operating")}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              tab === "operating" ? "border-brand-coral bg-brand-coral/10 text-brand-coral" : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            运营时段
          </button>
          <button
            type="button"
            onClick={() => setTab("activities")}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              tab === "activities" ? "border-brand-coral bg-brand-coral/10 text-brand-coral" : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            门店活动
          </button>
          <button
            type="button"
            onClick={() => setTab("data")}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              tab === "data" ? "border-brand-coral bg-brand-coral/10 text-brand-coral" : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            数据管理
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("logs");
              window.setTimeout(() => {
                if (logsTab === "ops") void loadOperationLogs(1);
                else void loadSmsLogs(1);
              }, 0);
            }}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              tab === "logs" ? "border-brand-coral bg-brand-coral/10 text-brand-coral" : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            日志
          </button>
        </div>
      </div>

      <div className="w-full space-y-4 px-4 py-4">
        {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}
        {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}

        {tab === "operating" && (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold">运营时段</h2>
            <p className="mt-1 text-xs text-stone-500">
              支持配置 2–8 段时段，且时段不交叉（后台会校验）；用于影响桌台管理页与顾客端可选时刻。
            </p>

            <form onSubmit={(e) => void saveOperatingPeriods(e)} className="mt-4 space-y-4">
              <div className="space-y-3">
                {periodsDraft.map((p, idx) => (
                  <div key={p.period_key} className="rounded-2xl border border-stone-200 bg-stone-50 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm text-stone-700">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) => updatePeriodAt(idx, { enabled: e.target.checked })}
                        />
                        启用
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 disabled:opacity-40"
                          disabled={idx === 0}
                          onClick={() => movePeriod(idx, -1)}
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 disabled:opacity-40"
                          disabled={idx === periodsDraft.length - 1}
                          onClick={() => movePeriod(idx, 1)}
                        >
                          下移
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-700 disabled:opacity-40"
                          disabled={periodsDraft.length <= 2}
                          onClick={() => {
                            if (periodsDraft.length <= 2) return;
                            setPeriodsDraft((prev) => prev.filter((_, i) => i !== idx).map((x, i2) => ({ ...x, sort_order: i2 })));
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="block text-xs font-medium text-stone-600">
                        显示名
                        <input
                          value={p.label}
                          onChange={(e) => updatePeriodAt(idx, { label: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                          required
                        />
                      </label>
                      <label className="block text-xs font-medium text-stone-600">
                        图标（短字）
                        <input
                          value={p.icon}
                          onChange={(e) => updatePeriodAt(idx, { icon: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                          maxLength={8}
                        />
                      </label>
                      <label className="block text-xs font-medium text-stone-600">
                        颜色
                        <input
                          type="color"
                          value={p.color}
                          onChange={(e) => updatePeriodAt(idx, { color: e.target.value })}
                          className="mt-1 h-10 w-full p-0"
                        />
                      </label>
                      <label className="block text-xs font-medium text-stone-600">
                        开始时间
                        <input
                          type="time"
                          step={1800}
                          value={p.start_time}
                          onChange={(e) => updatePeriodAt(idx, { start_time: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                          required
                        />
                      </label>
                      <label className="block text-xs font-medium text-stone-600 sm:col-span-2 lg:col-span-4">
                        结束时间
                        <input
                          type="time"
                          step={1800}
                          value={p.end_time}
                          onChange={(e) => updatePeriodAt(idx, { end_time: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                          required
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => addPeriod()}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700"
                >
                  新增时段
                </button>
                <button
                  type="submit"
                  disabled={opBusy}
                  className="rounded-xl bg-stone-800 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {opBusy ? "保存中…" : "保存运营时段"}
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <h3 className="font-display text-base font-semibold">网上预约通道</h3>
              <p className="mt-1 text-xs text-stone-500">
                开启后：顾客端提交预订后，系统自动分配桌台并确认，随后发送成功预定短信（短信包含桌台信息）。
                关闭后：拒绝网上预订。
              </p>
              <form onSubmit={(e) => void saveOnlineReservation(e)} className="mt-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={onlineReservationEnabled}
                    onChange={(e) => setOnlineReservationEnabled(e.target.checked)}
                  />
                  启用网上预约
                </label>
                <button
                  type="submit"
                  disabled={onlineReservationBusy}
                  className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {onlineReservationBusy ? "保存中…" : "保存"}
                </button>
              </form>
            </div>
          </section>
        )}

        {tab === "brand" && (
          <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">企业与产品</h2>
            <p className="mt-1 text-xs text-stone-500">用于浏览器标题、启动页与页脚展示</p>
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-stone-600">
                企业全称
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-stone-600">
                产品 / 应用名称
                <input
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">Logo 与站点图标</h2>
            <p className="mt-1 text-xs text-stone-500">建议 Logo 透明 PNG；Favicon 可用 .ico / .png</p>
            <div className="mt-3 flex flex-wrap gap-4">
              <div>
                <p className="text-xs text-stone-600">Logo</p>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block text-xs"
                  onChange={(e) => void pickAndUpload("logo", e.target.files?.[0] ?? null)}
                />
                {logoPath && <p className="mt-1 text-[11px] text-stone-400">当前：{logoPath}</p>}
              </div>
              <div>
                <p className="text-xs text-stone-600">Favicon</p>
                <input
                  type="file"
                  accept=".ico,.png,.svg,.webp"
                  className="mt-1 block text-xs"
                  onChange={(e) => void pickAndUpload("favicon", e.target.files?.[0] ?? null)}
                />
                {faviconPath && <p className="mt-1 text-[11px] text-stone-400">当前：{faviconPath}</p>}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">登录页个性化</h2>
            <p className="mt-1 text-xs text-stone-500">背景图、主色与欢迎文案</p>
            <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-stone-600">
              登录页背景图
              <input type="file" accept="image/*" className="mt-1 block text-xs" onChange={(e) => void pickAndUpload("login_bg", e.target.files?.[0] ?? null)} />
              {loginBgPath && <p className="mt-1 text-[11px] text-stone-400">当前：{loginBgPath}</p>}
            </label>
            <label className="block text-xs font-medium text-stone-600">
              主标题
              <input value={loginTitle} onChange={(e) => setLoginTitle(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm" />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              副标题
              <textarea value={loginSubtitle} onChange={(e) => setLoginSubtitle(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-stone-600">
                主色（背景渐变）
                <input type="color" value={loginPrimary} onChange={(e) => setLoginPrimary(e.target.value)} className="mt-1 h-10 w-full" />
              </label>
              <label className="block text-xs font-medium text-stone-600">
                强调色（按钮）
                <input type="color" value={loginAccent} onChange={(e) => setLoginAccent(e.target.value)} className="mt-1 h-10 w-full" />
              </label>
            </div>
            <label className="block text-xs font-medium text-stone-600">
              登录卡片玻璃层不透明度（{loginCardOpacity.toFixed(2)}）
              <input
                type="range"
                min={0.35}
                max={1}
                step={0.01}
                value={loginCardOpacity}
                onChange={(e) => setLoginCardOpacity(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              页脚文案
              <input value={loginFooter} onChange={(e) => setLoginFooter(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input type="checkbox" checked={loginShowPowered} onChange={(e) => setLoginShowPowered(e.target.checked)} />
              在登录页展示页脚说明（可与上方文案合并使用）
            </label>
            </div>
          </section>
        

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">启动页（Splash）</h2>
            <p className="mt-1 text-xs text-stone-500">首次进入会话时全屏展示，可分别控制顾客端与员工入口</p>
            <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input type="checkbox" checked={splashEnabled} onChange={(e) => setSplashEnabled(e.target.checked)} />
              启用启动页
            </label>
            <label className="block text-xs font-medium text-stone-600">
              启动页全屏图（留空则使用品牌渐变）
              <input type="file" accept="image/*" className="mt-1 block text-xs" onChange={(e) => void pickAndUpload("splash", e.target.files?.[0] ?? null)} />
              {splashPath && <p className="mt-1 text-[11px] text-stone-400">当前：{splashPath}</p>}
            </label>
            <label className="block text-xs font-medium text-stone-600">
              展示时长（秒）
              <input
                type="number"
                min={0.5}
                max={12}
                step={0.1}
                value={splashSeconds}
                onChange={(e) => setSplashSeconds(Number(e.target.value))}
                className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input type="checkbox" checked={splashCustomer} onChange={(e) => setSplashCustomer(e.target.checked)} />
              顾客端首页等入口显示启动页
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input type="checkbox" checked={splashStaff} onChange={(e) => setSplashStaff(e.target.checked)} />
              员工登录页入口显示启动页
            </label>
            <p className="text-[11px] text-amber-800">
              提示：修改启动页开关后，可清除浏览器会话存储键 <code className="rounded bg-amber-100 px-1">rr_splash_*</code>{" "}
              或新开隐私窗口以立即预览效果。
            </p>
          </div>
          </section>
        

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">顾客端首屏文案</h2>
            <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-stone-600">
              主标语
              <input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm" />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              副标语
              <input value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm" />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              顾客端主按钮/高亮色
              <input type="color" value={customerPrimary} onChange={(e) => setCustomerPrimary(e.target.value)} className="mt-1 h-10 w-full max-w-xs" />
            </label>
            </div>
          </section>
          </div>
        )}

        {tab === "activities" && (
          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">门店活动</h2>
            <p className="mt-1 text-xs text-stone-500">维护首页“门店活动”卡片：活动名称、简介与配图。</p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                onClick={() => resetPromotionForm()}
                disabled={promoBusy}
              >
                新建活动
              </button>
              <button
                type="button"
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                onClick={() => void refreshPromotions()}
                disabled={promoBusy}
              >
                {promoBusy ? "刷新中…" : "刷新列表"}
              </button>
            </div>

            {promotions.length === 0 && promoBusy ? <p className="mt-4 text-sm text-stone-500">加载活动中…</p> : null}
            {promotions.length === 0 && !promoBusy ? <p className="mt-4 text-sm text-stone-500">暂无活动，先从下方创建。</p> : null}

            {promotions.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {promotions.map((p) => (
                  <article key={p.id} className="rounded-2xl border border-stone-200 bg-stone-50/40 p-3">
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-16 overflow-hidden rounded-xl border border-stone-200 bg-white">
                        {p.image_url ? (
                          <img
                            src={assetUrl(p.image_url) ?? p.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-stone-100" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900">{p.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-stone-600">{p.sub}</p>
                        <p className="mt-1 text-[11px] text-stone-500">排序：{p.sort_order} · {p.enabled ? "启用" : "停用"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditPromotion(p)}
                        disabled={promoBusy}
                        className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePromotion(p.id)}
                        disabled={promoBusy}
                        className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void savePromotion();
              }}
              className="mt-5 space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  活动名称
                  <input value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" required />
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  排序（数字越小越靠前）
                  <input
                    type="number"
                    value={promoSortOrder}
                    onChange={(e) => setPromoSortOrder(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs font-medium text-stone-600">
                简介
                <textarea value={promoSub} onChange={(e) => setPromoSub(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" required />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  渐变风格（用于卡片背景）
                  <select
                    value={promoTone}
                    onChange={(e) => setPromoTone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  >
                    {PROMOTION_TONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-medium text-stone-600">
                  配图
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-1 block text-xs"
                    onChange={(e) => void pickAndUploadPromotion(e.target.files?.[0] ?? null)}
                    disabled={promoImageBusy}
                  />
                  {promoImagePreview ? <p className="mt-1 text-[11px] text-stone-500">当前：{urlToFilename(promoImagePreview)}</p> : null}
                  {promoImagePreview ? (
                    <div className="mt-2 h-20 w-full overflow-hidden rounded-xl border border-stone-200 bg-white">
                      <img src={assetUrl(promoImagePreview) ?? promoImagePreview} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  {promoImagePreview ? (
                    <button
                      type="button"
                      className="mt-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                      onClick={() => {
                        setPromoImageFilename(null);
                        setPromoImagePreview(null);
                      }}
                      disabled={promoImageBusy}
                    >
                      移除配图
                    </button>
                  ) : null}
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-700">
                <input type="checkbox" checked={promoEnabled} onChange={(e) => setPromoEnabled(e.target.checked)} />
                启用该活动（前台可见）
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={promoBusy}
                  className="rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {promoBusy ? "保存中…" : promoEditId === null ? "保存活动" : "保存更改"}
                </button>
                <button
                  type="button"
                  disabled={promoBusy}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700"
                  onClick={() => resetPromotionForm()}
                >
                  清空表单
                </button>
              </div>
            </form>
          </section>
        )}

        {tab === "data" && (
          <section className="space-y-4">
            <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-base font-semibold">数据库备份</h2>
              <p className="mt-1 text-xs text-stone-500">
                支持一键备份；执行“清空业务数据”前，系统也会自动创建时间戳备份，避免误删无法恢复。
              </p>
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => void backupDatabaseNow()}
                className="mt-4 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
              >
                {backupBusy ? "备份中…" : "一键备份数据库"}
              </button>
            </article>

            <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">从备份恢复</h2>
                  <p className="mt-1 text-xs text-stone-500">
                    可从系统已有备份文件恢复，也可上传 .db 文件恢复。恢复前系统会自动再备份一份当前数据库。
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                  disabled={backupListBusy}
                  onClick={() => void loadBackupFiles()}
                >
                  {backupListBusy ? "刷新中…" : "刷新备份列表"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label className="block text-xs font-medium text-stone-600">
                  选择备份文件
                  <select
                    value={selectedBackupFilename}
                    onChange={(e) => setSelectedBackupFilename(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    {backupFiles.length === 0 ? <option value="">暂无备份</option> : null}
                    {backupFiles.map((b) => (
                      <option key={b.filename} value={b.filename}>
                        {b.filename}（{b.modified_at}）
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={restoreBusy || !selectedBackupFilename}
                  onClick={() => void restoreFromSelectedBackup()}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 disabled:opacity-50"
                >
                  {restoreBusy ? "恢复中…" : "从备份恢复"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700">
                  {restoreBusy ? "恢复中…" : "上传 .db 文件恢复"}
                  <input
                    type="file"
                    accept=".db"
                    className="hidden"
                    disabled={restoreBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) return;
                      void restoreFromUpload(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <p className="text-xs text-stone-500">
                  恢复后建议重启后端服务，确保数据库连接刷新生效。
                </p>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
                    <tr>
                      <th className="px-3 py-2">备份文件</th>
                      <th className="px-3 py-2">修改时间</th>
                      <th className="px-3 py-2">大小</th>
                      <th className="px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupFiles.map((b) => (
                      <tr key={b.filename} className="border-b border-stone-100">
                        <td className="px-3 py-2 font-mono text-xs text-stone-700">{b.filename}</td>
                        <td className="px-3 py-2 text-xs text-stone-600">{b.modified_at}</td>
                        <td className="px-3 py-2 text-xs text-stone-600">
                          {(b.size_bytes / 1024 / 1024).toFixed(2)} MB
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700"
                              onClick={() => void downloadBackupFile(b.filename)}
                            >
                              下载
                            </button>
                            <button
                              type="button"
                              disabled={restoreBusy}
                              className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 disabled:opacity-50"
                              onClick={() => void restoreFromBackupName(b.filename)}
                            >
                              从该备份恢复
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {backupFiles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-sm text-stone-500">
                          暂无备份文件
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">自动备份计划</h2>
                  <p className="mt-1 text-xs text-stone-500">
                    每天在指定时间自动备份数据库，并自动清理旧备份，仅保留最近 N 份。
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                  disabled={backupPlanBusy}
                  onClick={() => void loadBackupPlan()}
                >
                  {backupPlanBusy ? "加载中…" : "加载当前计划"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={backupPlanEnabled}
                    onChange={(e) => setBackupPlanEnabled(e.target.checked)}
                  />
                  启用自动备份
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  每日备份时间
                  <input
                    type="time"
                    value={backupPlanTime}
                    onChange={(e) => setBackupPlanTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  保留最近（份）
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={backupPlanKeepLast}
                    onChange={(e) => setBackupPlanKeepLast(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2">
                  <p className="text-xs font-medium text-stone-600">最近一次自动备份</p>
                  <p className="mt-1 text-sm text-stone-800">{backupPlanLastRunDate || "—"}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={backupPlanBusy}
                  onClick={() => void saveBackupPlan()}
                  className="rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {backupPlanBusy ? "保存中…" : "保存计划"}
                </button>
                <button
                  type="button"
                  disabled={backupPlanBusy}
                  onClick={() => {
                    void loadBackupPlan();
                    void loadBackupFiles();
                  }}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 disabled:opacity-50"
                >
                  刷新状态
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-base font-semibold">食客信息导入 / 导出</h2>
              <p className="mt-1 text-xs text-stone-500">
                支持下载 CSV 模板、导出现有数据、批量导入（带基础校验与重复数据策略）。
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void downloadCsv("/api/admin/maintenance/customers/template.csv", "customers-template.csv")}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                >
                  下载模板
                </button>
                <button
                  type="button"
                  onClick={() => void downloadCsv("/api/admin/maintenance/customers/export.csv", "customers-export.csv")}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                >
                  导出数据
                </button>
                <select
                  value={customerDuplicateStrategy}
                  onChange={(e) => setCustomerDuplicateStrategy(e.target.value as "skip" | "update")}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700"
                >
                  <option value="skip">重复手机号：跳过</option>
                  <option value="update">重复手机号：覆盖更新</option>
                </select>
                <label className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700">
                  {importBusy ? "导入中…" : "导入 CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={importBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) return;
                      void importCsv(
                        "/api/admin/maintenance/customers/import.csv",
                        f,
                        customerDuplicateStrategy,
                      );
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </article>

            <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-base font-semibold">预订记录导入 / 导出</h2>
              <p className="mt-1 text-xs text-stone-500">
                支持 CSV 模板、全量导出与批量导入。导入时会校验日期、时间、人数、手机号与桌台编号有效性。
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void downloadCsv("/api/admin/maintenance/reservations/template.csv", "reservations-template.csv")}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                >
                  下载模板
                </button>
                <button
                  type="button"
                  onClick={() => void downloadCsv("/api/admin/maintenance/reservations/export.csv", "reservations-export.csv")}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                >
                  导出数据
                </button>
                <select
                  value={reservationDuplicateStrategy}
                  onChange={(e) => setReservationDuplicateStrategy(e.target.value as "skip" | "update")}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700"
                >
                  <option value="skip">重复预订：跳过</option>
                  <option value="update">重复预订：覆盖更新</option>
                </select>
                <label className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700">
                  {importBusy ? "导入中…" : "导入 CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={importBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) return;
                      void importCsv(
                        "/api/admin/maintenance/reservations/import.csv",
                        f,
                        reservationDuplicateStrategy,
                      );
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </article>

            <article className="rounded-2xl border border-red-200 bg-red-50/60 p-5 shadow-sm">
              <h2 className="font-display text-base font-semibold text-red-900">清空业务数据</h2>
              <p className="mt-1 text-xs text-red-800/90">
                一键删除订金、预订、客户档案。系统会在删除前自动备份数据库，管理员账号、品牌配置、桌台布局与上传资源均保留。
              </p>
              <button
                type="button"
                disabled={clearBusy}
                onClick={() => void clearTestReservations()}
                className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-800 shadow-sm hover:bg-red-50 disabled:opacity-50"
              >
                {clearBusy ? "处理中…" : "清空业务数据（自动备份）"}
              </button>
            </article>
          </section>
        )}

        {tab === "logs" && (
          <section className="space-y-4">
            <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">系统日志</h2>
                  <p className="mt-1 text-xs text-stone-500">操作日志支持按账号/时间/种类筛选；短信日志可按预订/登录验证筛选。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLogsTab("ops");
                      void loadOperationLogs(1);
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                      logsTab === "ops" ? "border-ink-900 bg-ink-900 text-white" : "border-stone-200 bg-white text-stone-700"
                    }`}
                  >
                    操作日志
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLogsTab("sms");
                      void loadSmsLogs(1);
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                      logsTab === "sms" ? "border-ink-900 bg-ink-900 text-white" : "border-stone-200 bg-white text-stone-700"
                    }`}
                  >
                    短信发送日志
                  </button>
                </div>
              </div>

              {logsTab === "ops" && (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <label className="block text-xs font-medium text-stone-600 lg:col-span-2">
                      账号
                      <input value={opsUser} onChange={(e) => setOpsUser(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder="如：admin" />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      种类
                      <input value={opsCategory} onChange={(e) => setOpsCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder="如：reservation" />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      操作
                      <input value={opsAction} onChange={(e) => setOpsAction(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder="如：create" />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      起始时间
                      <input value={opsDateFrom} onChange={(e) => setOpsDateFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder="YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS" />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      结束时间
                      <input value={opsDateTo} onChange={(e) => setOpsDateTo(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder="YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS" />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => void loadOperationLogs(1)} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700">
                      {logsBusy ? "加载中…" : "查询"}
                    </button>
                    <p className="text-xs text-stone-500">共 {opsTotal} 条</p>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
                        <tr>
                          <th className="px-3 py-2">时间</th>
                          <th className="px-3 py-2">账号</th>
                          <th className="px-3 py-2">种类/操作</th>
                          <th className="px-3 py-2">对象</th>
                          <th className="px-3 py-2">详情</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opsRows.map((r) => (
                          <tr key={r.id} className="border-b border-stone-100">
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-stone-600">{r.created_at ?? "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.actor_username || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="text-stone-800">{r.category || "—"}</span>
                              <span className="mx-2 text-stone-300">/</span>
                              <span className="text-stone-700">{r.action || "—"}</span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {r.entity || "—"} {r.entity_id ? `#${r.entity_id}` : ""}
                            </td>
                            <td className="px-3 py-2 text-xs text-stone-600">
                              <span title={r.detail_json || ""} className="block max-w-[520px] truncate">
                                {r.detail_json || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {opsRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-sm text-stone-500">
                              暂无数据
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                    <span>
                      第 {opsPage} 页
                    </span>
                    <div className="flex gap-2">
                      <button type="button" disabled={opsPage <= 1 || logsBusy} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => void loadOperationLogs(Math.max(1, opsPage - 1))}>
                        上一页
                      </button>
                      <button type="button" disabled={opsPage * 50 >= opsTotal || logsBusy} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => void loadOperationLogs(opsPage + 1)}>
                        下一页
                      </button>
                    </div>
                  </div>
                </>
              )}

              {logsTab === "sms" && (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <label className="block text-xs font-medium text-stone-600 lg:col-span-2">
                      收件号码
                      <input value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder="支持模糊搜索" />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      类型
                      <select value={smsKind} onChange={(e) => setSmsKind(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                        <option value="">全部</option>
                        <option value="reservation">预订</option>
                        <option value="login">登录验证</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      用途
                      <select value={smsPurpose} onChange={(e) => setSmsPurpose(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                        <option value="">全部</option>
                        <option value="reservation_success">预订成功</option>
                        <option value="reservation_cancel">预订取消</option>
                        <option value="staff_login">员工登录</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      状态
                      <select value={smsStatus} onChange={(e) => setSmsStatus(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                        <option value="">全部</option>
                        <option value="sent">已发送</option>
                        <option value="failed">失败</option>
                        <option value="blocked">被拦截</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      起始时间
                      <input value={smsDateFrom} onChange={(e) => setSmsDateFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder="YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS" />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      结束时间
                      <input value={smsDateTo} onChange={(e) => setSmsDateTo(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder="YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS" />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => void loadSmsLogs(1)} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700">
                      {logsBusy ? "加载中…" : "查询"}
                    </button>
                    <p className="text-xs text-stone-500">共 {smsTotal} 条</p>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="w-full min-w-[1120px] text-left text-sm">
                      <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
                        <tr>
                          <th className="px-3 py-2">时间</th>
                          <th className="px-3 py-2">类型/用途</th>
                          <th className="px-3 py-2">号码</th>
                          <th className="px-3 py-2">状态</th>
                          <th className="px-3 py-2">内容</th>
                        </tr>
                      </thead>
                      <tbody>
                        {smsRows.map((r) => (
                          <tr key={r.id} className="border-b border-stone-100">
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-stone-600">{r.created_at ?? "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="text-stone-800">{r.kind || "—"}</span>
                              <span className="mx-2 text-stone-300">/</span>
                              <span className="text-stone-700">{r.purpose || "—"}</span>
                              {r.reservation_id ? <span className="ml-2 text-xs text-stone-500">#{r.reservation_id}</span> : null}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{r.phone || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="text-xs text-stone-700">
                                {r.status || "—"}{r.reason ? `（${r.reason}）` : ""}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-stone-600">
                              <span title={`${r.content || ""}\n\n${r.provider_json || ""}`} className="block max-w-[620px] truncate">
                                {r.content || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {smsRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-sm text-stone-500">
                              暂无数据
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                    <span>
                      第 {smsPage} 页
                    </span>
                    <div className="flex gap-2">
                      <button type="button" disabled={smsPage <= 1 || logsBusy} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => void loadSmsLogs(Math.max(1, smsPage - 1))}>
                        上一页
                      </button>
                      <button type="button" disabled={smsPage * 50 >= smsTotal || logsBusy} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => void loadSmsLogs(smsPage + 1)}>
                        下一页
                      </button>
                    </div>
                  </div>
                </>
              )}
            </article>
          </section>
        )}

      </div>
    </div>
  );
}
