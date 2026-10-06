import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdminSettingsCopy } from "@/i18n/adminSettingsLocales";
import { apiUrl, assetUrl, apiFetch, uploadAdminFile } from "@/lib/api";
import { translateApiError } from "@/lib/translateApiError";
import { useAuth } from "@/context/AuthContext";
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

/** 生产环境：禁用「数据管理」内清空业务数据相关按钮，防止误操作 */
const DISABLE_DATA_MANAGEMENT_CLEAR = true;

/** 生产环境：禁用从备份恢复数据库 */
const DISABLE_DATA_MANAGEMENT_RESTORE = true;

export function AdminSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const s = useAdminSettingsCopy();
  const canAccessDataManagement = (user?.username ?? "").toLowerCase() === "admin";
  const promotionTones = useMemo(
    () =>
      [
        { value: "from-amber-700/90 to-orange-600/85", label: s.toneAmber },
        { value: "from-rose-800/90 to-red-700/85", label: s.toneRose },
        { value: "from-emerald-800/88 to-teal-700/85", label: s.toneEmerald },
        { value: "from-violet-800/88 to-fuchsia-700/85", label: s.toneViolet },
      ] as const,
    [s],
  );
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
  const [clearReservationsBusy, setClearReservationsBusy] = useState(false);
  const [clearReservationsFrom, setClearReservationsFrom] = useState("");
  const [clearReservationsTo, setClearReservationsTo] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStage, setImportStage] = useState<"idle" | "uploading" | "processing">("idle");
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

  const [logsTab, setLogsTab] = useState<"ops" | "sms" | "access">("ops");
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

  const [accessRows, setAccessRows] = useState<
    {
      id: number;
      created_at: string | null;
      username: string;
      role: string;
      path: string;
      ip: string;
    }[]
  >([]);
  const [accessTotal, setAccessTotal] = useState(0);
  const [accessPage, setAccessPage] = useState(1);
  const [accessUser, setAccessUser] = useState("");
  const [accessDateFrom, setAccessDateFrom] = useState("");
  const [accessDateTo, setAccessDateTo] = useState("");

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
  const [promoTone, setPromoTone] = useState<string>(promotionTones[0].value);
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
      setMsg(s.msgOperatingSaved);
      await refreshOp();
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.saveFailed);
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
      setMsg(s.msgOnlineSaved);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.saveFailed);
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
        label: s.periodLabel(prev.length + 1),
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
      setMsg(s.msgSaved);
      await refresh();
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function clearTestReservations() {
    if (DISABLE_DATA_MANAGEMENT_CLEAR) return;
    const ok = window.confirm(s.confirmClearTest);
    if (!ok) return;
    setErr(null);
    setMsg(null);
    setClearBusy(true);
    try {
      const result = await apiFetch<{ backup_file?: string }>("/api/admin/maintenance/clear-reservations", {
        method: "POST",
      });
      setMsg(`${s.msgCleared}${result.backup_file ?? s.unknownFile}`);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.clearFailed);
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
      setMsg(`${s.msgBackupDone}${r.backup_file}`);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.backupFailed);
    } finally {
      setBackupBusy(false);
    }
  }

  async function clearReservationsForImport() {
    if (DISABLE_DATA_MANAGEMENT_CLEAR) return;
    const from = clearReservationsFrom.trim();
    const to = clearReservationsTo.trim();
    const rangeText =
      from || to ? `${from || s.rangeEarliest} ~ ${to || s.rangeLatest}` : s.rangeAllTime;
    const ok = window.confirm(s.confirmClearReservations(rangeText));
    if (!ok) return;
    setErr(null);
    setMsg(null);
    setClearReservationsBusy(true);
    try {
      const q = new URLSearchParams();
      if (from) q.set("date_from", from);
      if (to) q.set("date_to", to);
      const path = `/api/admin/maintenance/clear-reservations-for-import${
        q.toString() ? `?${q.toString()}` : ""
      }`;
      const result = await apiFetch<{
        message?: string;
        backup_file?: string;
        deleted_reservations?: number;
        deleted_deposits?: number;
      }>(path, {
        method: "POST",
      });
      setMsg(
        result.message ||
          s.msgClearedReservations(
            result.deleted_reservations ?? 0,
            result.deleted_deposits ?? 0,
            result.backup_file ?? s.unknownFile,
          ),
      );
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.clearFailed);
    } finally {
      setClearReservationsBusy(false);
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
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.loadFailed);
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
      setMsg(r.message || s.msgBackupPlanSaved);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.saveFailed);
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
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.loadFailed);
    } finally {
      setBackupListBusy(false);
    }
  }

  async function downloadBackupFile(filename: string) {
    setErr(null);
    try {
      const token = localStorage.getItem("rr_token");
      if (!token) throw new Error(t("apiErrors.notLoggedIn"));
      const res = await fetch(
        apiUrl(`/api/admin/maintenance/backups/download?filename=${encodeURIComponent(filename)}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || s.downloadFailed);
      }
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(u);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.downloadFailed);
    }
  }

  async function restoreFromSelectedBackup() {
    if (DISABLE_DATA_MANAGEMENT_RESTORE) return;
    const name = selectedBackupFilename.trim();
    if (!name) return;
    const ok = window.confirm(s.confirmRestoreSelected(name));
    if (!ok) return;
    setRestoreBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ ok: boolean; message?: string; before_backup?: string }>(
        `/api/admin/maintenance/restore-db/from-backup?filename=${encodeURIComponent(name)}`,
        { method: "POST" },
      );
      setMsg(r.message || `${s.msgRestored}${r.before_backup ?? s.unknownFile}）`);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.restoreFailed);
    } finally {
      setRestoreBusy(false);
    }
  }

  async function restoreFromBackupName(filename: string) {
    if (DISABLE_DATA_MANAGEMENT_RESTORE) return;
    setSelectedBackupFilename(filename);
    const ok = window.confirm(s.confirmRestoreSelected(filename));
    if (!ok) return;
    setRestoreBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ ok: boolean; message?: string; before_backup?: string }>(
        `/api/admin/maintenance/restore-db/from-backup?filename=${encodeURIComponent(filename)}`,
        { method: "POST" },
      );
      setMsg(r.message || `${s.msgRestored}${r.before_backup ?? s.unknownFile}）`);
      await loadBackupFiles();
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.restoreFailed);
    } finally {
      setRestoreBusy(false);
    }
  }

  async function restoreFromUpload(file: File) {
    if (DISABLE_DATA_MANAGEMENT_RESTORE) return;
    const ok = window.confirm(s.confirmRestoreUpload);
    if (!ok) return;
    setRestoreBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const token = localStorage.getItem("rr_token");
      if (!token) throw new Error(t("apiErrors.notLoggedIn"));
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(apiUrl("/api/admin/maintenance/restore-db/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || s.restoreFailed);
      }
      const data = (await res.json()) as { message?: string; before_backup?: string; uploaded_as?: string };
      setMsg(data.message || `${s.msgRestoredUpload}${data.before_backup ?? s.unknownFile}）`);
      await loadBackupFiles();
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.restoreFailed);
    } finally {
      setRestoreBusy(false);
    }
  }

  useEffect(() => {
    if (!canAccessDataManagement && tab === "data") {
      setTab("brand");
    }
  }, [canAccessDataManagement, tab]);

  useEffect(() => {
    if (tab === "logs" && logsTab === "access" && !canAccessDataManagement) {
      setLogsTab("ops");
    }
  }, [tab, logsTab, canAccessDataManagement]);

  useEffect(() => {
    if (!canAccessDataManagement || tab !== "data") return;
    void loadBackupPlan();
    void loadBackupFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canAccessDataManagement]);

  async function downloadCsv(path: string, filename: string) {
    setErr(null);
    try {
      const token = localStorage.getItem("rr_token");
      if (!token) throw new Error(t("apiErrors.notLoggedIn"));
      const res = await fetch(apiUrl(path), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || s.downloadFailed);
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.downloadFailed);
    }
  }

  async function importCsv(path: string, file: File, duplicateStrategy: "skip" | "update") {
    setErr(null);
    setMsg(null);
    setImportBusy(true);
    setImportProgress(0);
    setImportStage("uploading");
    try {
      const token = localStorage.getItem("rr_token");
      if (!token) throw new Error(t("apiErrors.notLoggedIn"));
      const fd = new FormData();
      fd.append("file", file);
      const data = await new Promise<{
        created: number;
        updated: number;
        skipped: number;
        error_count: number;
        errors?: string[];
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiUrl(`${path}?duplicate_strategy=${duplicateStrategy}`), true);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          const p = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
          setImportProgress(p);
          setImportStage("uploading");
        };

        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(xhr.responseText ? translateApiError(t, xhr.responseText) : s.importFailed));
            return;
          }
          try {
            const parsed = JSON.parse(xhr.responseText) as {
              created: number;
              updated: number;
              skipped: number;
              error_count: number;
              errors?: string[];
            };
            resolve(parsed);
          } catch {
            reject(new Error(s.importParseFailed));
          }
        };
        xhr.onerror = () => reject(new Error(s.importFailed));
        xhr.onloadstart = () => {
          setImportProgress(1);
          setImportStage("uploading");
        };
        xhr.onloadend = () => {
          setImportProgress(100);
          setImportStage("processing");
        };
        xhr.send(fd);
      });
      const errorPreview = (data.errors || []).slice(0, 3).join("；");
      setMsg(
        s.importResult(data.created, data.updated, data.skipped, data.error_count, errorPreview),
      );
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.importFailed);
    } finally {
      setImportStage("idle");
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
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.loadFailed);
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
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.loadFailed);
    } finally {
      setLogsBusy(false);
    }
  }

  async function loadAccessLogs(pageOverride?: number) {
    if (!canAccessDataManagement) return;
    setErr(null);
    setLogsBusy(true);
    try {
      const p = pageOverride ?? accessPage;
      const q = new URLSearchParams({
        page: String(p),
        page_size: "50",
      });
      if (accessUser.trim()) q.set("username", accessUser.trim());
      if (accessDateFrom.trim()) q.set("date_from", accessDateFrom.trim());
      if (accessDateTo.trim()) q.set("date_to", accessDateTo.trim());
      const r = await apiFetch<{ items: typeof accessRows; total: number }>(`/api/admin/logs/access?${q}`);
      setAccessRows(r.items);
      setAccessTotal(r.total);
      setAccessPage(p);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.loadFailed);
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
      setMsg(s.msgImageUploaded);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.uploadFailed);
    }
  }

  async function refreshPromotions() {
    setPromoBusy(true);
    setErr(null);
    try {
      const rows = await apiFetch<PromotionRow[]>("/api/admin/promotions");
      setPromotions(rows);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.loadFailed);
    } finally {
      setPromoBusy(false);
    }
  }

  function resetPromotionForm() {
    setPromoEditId(null);
    setPromoTitle("");
    setPromoSub("");
    setPromoTone(promotionTones[0].value);
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
      setMsg(s.msgPromoImageUploaded);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.uploadFailed);
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
        setMsg(s.msgPromoCreated);
      } else {
        await apiFetch(`/api/admin/promotions/${promoEditId}`, { method: "PATCH", json: payload });
        setMsg(s.msgPromoSaved);
      }

      await refreshPromotions();
      resetPromotionForm();
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.savePromoFailed);
    } finally {
      setPromoBusy(false);
    }
  }

  async function deletePromotion(id: number) {
    const ok = window.confirm(s.confirmDeletePromo);
    if (!ok) return;
    setErr(null);
    setPromoBusy(true);
    try {
      await apiFetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
      setMsg(s.msgPromoDeleted);
      await refreshPromotions();
      if (promoEditId === id) resetPromotionForm();
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : s.deleteFailed);
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
            <h1 className="font-display text-lg font-semibold">{s.headerTitle}</h1>
            <p className="text-xs text-stone-500">{s.headerSubtitle}</p>
          </div>
          {tab === "brand" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSave()}
                className="rounded-xl bg-ink-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? s.saving : s.saveAll}
              </button>
              <button
                type="button"
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
                onClick={() => void refresh()}
              >
                {s.reload}
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
            {s.tabBrand}
          </button>
          <button
            type="button"
            onClick={() => setTab("operating")}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              tab === "operating" ? "border-brand-coral bg-brand-coral/10 text-brand-coral" : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            {s.tabOperating}
          </button>
          <button
            type="button"
            onClick={() => setTab("activities")}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              tab === "activities" ? "border-brand-coral bg-brand-coral/10 text-brand-coral" : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            {s.tabActivities}
          </button>
          {canAccessDataManagement && (
            <button
              type="button"
              onClick={() => setTab("data")}
              className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                tab === "data" ? "border-brand-coral bg-brand-coral/10 text-brand-coral" : "border-stone-200 bg-white text-stone-600"
              }`}
            >
              {s.tabData}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setTab("logs");
              window.setTimeout(() => {
                if (logsTab === "ops") void loadOperationLogs(1);
                else if (logsTab === "sms") void loadSmsLogs(1);
                else if (logsTab === "access" && canAccessDataManagement) void loadAccessLogs(1);
              }, 0);
            }}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              tab === "logs" ? "border-brand-coral bg-brand-coral/10 text-brand-coral" : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            {s.tabLogs}
          </button>
        </div>
      </div>

      <div className="w-full space-y-4 px-4 py-4">
        {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}
        {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
        {importBusy && (
          <div className="rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="flex items-center justify-between text-xs text-stone-600">
              <span>{importStage === "uploading" ? s.importStageUpload : s.importStageProcess}</span>
              <span>{importProgress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-brand-coral transition-all duration-200"
                style={{ width: `${Math.max(2, Math.min(100, importProgress))}%` }}
              />
            </div>
          </div>
        )}

        {tab === "operating" && (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold">{s.operatingTitle}</h2>
            <p className="mt-1 text-xs text-stone-500">{s.operatingDesc}</p>

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
                        {s.periodEnabled}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 disabled:opacity-40"
                          disabled={idx === 0}
                          onClick={() => movePeriod(idx, -1)}
                        >
                          {s.moveUp}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 disabled:opacity-40"
                          disabled={idx === periodsDraft.length - 1}
                          onClick={() => movePeriod(idx, 1)}
                        >
                          {s.moveDown}
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
                          {s.delete}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="block text-xs font-medium text-stone-600">
                        {s.labelDisplayName}
                        <input
                          value={p.label}
                          onChange={(e) => updatePeriodAt(idx, { label: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                          required
                        />
                      </label>
                      <label className="block text-xs font-medium text-stone-600">
                        {s.labelIcon}
                        <input
                          value={p.icon}
                          onChange={(e) => updatePeriodAt(idx, { icon: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                          maxLength={8}
                        />
                      </label>
                      <label className="block text-xs font-medium text-stone-600">
                        {s.labelColor}
                        <input
                          type="color"
                          value={p.color}
                          onChange={(e) => updatePeriodAt(idx, { color: e.target.value })}
                          className="mt-1 h-10 w-full p-0"
                        />
                      </label>
                      <label className="block text-xs font-medium text-stone-600">
                        {s.labelStartTime}
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
                        {s.labelEndTime}
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
                  {s.addPeriod}
                </button>
                <button
                  type="submit"
                  disabled={opBusy}
                  className="rounded-xl bg-stone-800 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {opBusy ? s.saving : s.saveOperating}
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <h3 className="font-display text-base font-semibold">{s.onlineReservationTitle}</h3>
              <p className="mt-1 text-xs text-stone-500">{s.onlineReservationDesc}</p>
              <form onSubmit={(e) => void saveOnlineReservation(e)} className="mt-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={onlineReservationEnabled}
                    onChange={(e) => setOnlineReservationEnabled(e.target.checked)}
                  />
                  {s.enableOnlineBooking}
                </label>
                <button
                  type="submit"
                  disabled={onlineReservationBusy}
                  className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {onlineReservationBusy ? s.saving : s.save}
                </button>
              </form>
            </div>
          </section>
        )}

        {tab === "brand" && (
          <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">{s.brandCompanyTitle}</h2>
            <p className="mt-1 text-xs text-stone-500">{s.brandCompanyDesc}</p>
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-stone-600">
                {s.labelCompanyName}
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-stone-600">
                {s.labelAppName}
                <input
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">{s.logoSectionTitle}</h2>
            <p className="mt-1 text-xs text-stone-500">{s.logoSectionDesc}</p>
            <div className="mt-3 flex flex-wrap gap-4">
              <div>
                <p className="text-xs text-stone-600">{s.logoLabel}</p>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block text-xs"
                  onChange={(e) => void pickAndUpload("logo", e.target.files?.[0] ?? null)}
                />
                {logoPath && (
                  <p className="mt-1 text-[11px] text-stone-400">
                    {s.currentFile}
                    {logoPath}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-stone-600">{s.faviconLabel}</p>
                <input
                  type="file"
                  accept=".ico,.png,.svg,.webp"
                  className="mt-1 block text-xs"
                  onChange={(e) => void pickAndUpload("favicon", e.target.files?.[0] ?? null)}
                />
                {faviconPath && (
                  <p className="mt-1 text-[11px] text-stone-400">
                    {s.currentFile}
                    {faviconPath}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">{s.loginSectionTitle}</h2>
            <p className="mt-1 text-xs text-stone-500">{s.loginSectionDesc}</p>
            <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-stone-600">
              {s.loginBg}
              <input type="file" accept="image/*" className="mt-1 block text-xs" onChange={(e) => void pickAndUpload("login_bg", e.target.files?.[0] ?? null)} />
              {loginBgPath && (
                <p className="mt-1 text-[11px] text-stone-400">
                  {s.currentFile}
                  {loginBgPath}
                </p>
              )}
            </label>
            <label className="block text-xs font-medium text-stone-600">
              {s.loginMainTitle}
              <input value={loginTitle} onChange={(e) => setLoginTitle(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm" />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              {s.loginSubTitle}
              <textarea value={loginSubtitle} onChange={(e) => setLoginSubtitle(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-stone-600">
                {s.loginPrimaryColor}
                <input type="color" value={loginPrimary} onChange={(e) => setLoginPrimary(e.target.value)} className="mt-1 h-10 w-full" />
              </label>
              <label className="block text-xs font-medium text-stone-600">
                {s.loginAccentColor}
                <input type="color" value={loginAccent} onChange={(e) => setLoginAccent(e.target.value)} className="mt-1 h-10 w-full" />
              </label>
            </div>
            <label className="block text-xs font-medium text-stone-600">
              {s.loginCardOpacity}（{loginCardOpacity.toFixed(2)}）
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
              {s.loginFooter}
              <input value={loginFooter} onChange={(e) => setLoginFooter(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input type="checkbox" checked={loginShowPowered} onChange={(e) => setLoginShowPowered(e.target.checked)} />
              {s.loginShowPowered}
            </label>
            </div>
          </section>
        

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">{s.splashTitle}</h2>
            <p className="mt-1 text-xs text-stone-500">{s.splashDesc}</p>
            <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input type="checkbox" checked={splashEnabled} onChange={(e) => setSplashEnabled(e.target.checked)} />
              {s.splashEnable}
            </label>
            <label className="block text-xs font-medium text-stone-600">
              {s.splashImage}
              <input type="file" accept="image/*" className="mt-1 block text-xs" onChange={(e) => void pickAndUpload("splash", e.target.files?.[0] ?? null)} />
              {splashPath && (
                <p className="mt-1 text-[11px] text-stone-400">
                  {s.currentFile}
                  {splashPath}
                </p>
              )}
            </label>
            <label className="block text-xs font-medium text-stone-600">
              {s.splashDuration}
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
              {s.splashCustomer}
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input type="checkbox" checked={splashStaff} onChange={(e) => setSplashStaff(e.target.checked)} />
              {s.splashStaff}
            </label>
            <p className="text-[11px] text-amber-800">
              {s.splashHint.split("rr_splash_*").map((part, i, arr) => (
                <Fragment key={i}>
                  {part}
                  {i < arr.length - 1 ? (
                    <code className="rounded bg-amber-100 px-1">rr_splash_*</code>
                  ) : null}
                </Fragment>
              ))}
            </p>
          </div>
          </section>
        

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">{s.customerHeroTitle}</h2>
            <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-stone-600">
              {s.heroMain}
              <input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm" />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              {s.heroSub}
              <input value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stone-200 px-3 text-sm" />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              {s.customerPrimary}
              <input type="color" value={customerPrimary} onChange={(e) => setCustomerPrimary(e.target.value)} className="mt-1 h-10 w-full max-w-xs" />
            </label>
            </div>
          </section>
          </div>
        )}

        {tab === "activities" && (
          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold">{s.activitiesTitle}</h2>
            <p className="mt-1 text-xs text-stone-500">{s.activitiesDesc}</p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                onClick={() => resetPromotionForm()}
                disabled={promoBusy}
              >
                {s.newActivity}
              </button>
              <button
                type="button"
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                onClick={() => void refreshPromotions()}
                disabled={promoBusy}
              >
                {promoBusy ? s.refreshing : s.refreshList}
              </button>
            </div>

            {promotions.length === 0 && promoBusy ? <p className="mt-4 text-sm text-stone-500">{s.loadingActivities}</p> : null}
            {promotions.length === 0 && !promoBusy ? <p className="mt-4 text-sm text-stone-500">{s.noActivities}</p> : null}

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
                        <p className="mt-1 text-[11px] text-stone-500">
                          {s.sortEnabled}
                          {p.sort_order} · {p.enabled ? s.enabled : s.disabled}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditPromotion(p)}
                        disabled={promoBusy}
                        className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50"
                      >
                        {s.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePromotion(p.id)}
                        disabled={promoBusy}
                        className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
                      >
                        {s.delete}
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
                  {s.promoName}
                  <input value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" required />
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  {s.promoSort}
                  <input
                    type="number"
                    value={promoSortOrder}
                    onChange={(e) => setPromoSortOrder(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs font-medium text-stone-600">
                {s.promoIntro}
                <textarea value={promoSub} onChange={(e) => setPromoSub(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" required />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  {s.promoGradient}
                  <select
                    value={promoTone}
                    onChange={(e) => setPromoTone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  >
                    {promotionTones.map((tone) => (
                      <option key={tone.value} value={tone.value}>
                        {tone.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-medium text-stone-600">
                  {s.promoImage}
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-1 block text-xs"
                    onChange={(e) => void pickAndUploadPromotion(e.target.files?.[0] ?? null)}
                    disabled={promoImageBusy}
                  />
                  {promoImagePreview ? (
                    <p className="mt-1 text-[11px] text-stone-500">
                      {s.currentFile}
                      {urlToFilename(promoImagePreview)}
                    </p>
                  ) : null}
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
                      {s.removeImage}
                    </button>
                  ) : null}
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-700">
                <input type="checkbox" checked={promoEnabled} onChange={(e) => setPromoEnabled(e.target.checked)} />
                {s.promoEnableVisible}
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={promoBusy}
                  className="rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {promoBusy ? s.saving : promoEditId === null ? s.saveActivity : s.saveChanges}
                </button>
                <button
                  type="button"
                  disabled={promoBusy}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700"
                  onClick={() => resetPromotionForm()}
                >
                  {s.clearForm}
                </button>
              </div>
            </form>
          </section>
        )}

        {tab === "data" && canAccessDataManagement && (
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="order-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-base font-semibold">{s.backupTitle}</h2>
              <p className="mt-1 text-xs text-stone-500">{s.backupDesc}</p>
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => void backupDatabaseNow()}
                className="mt-4 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
              >
                {backupBusy ? s.backingUp : s.backupNow}
              </button>
            </article>

            <article className="order-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">{s.restoreTitle}</h2>
                  <p className="mt-1 text-xs text-stone-500">{s.restoreDesc}</p>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                  disabled={backupListBusy}
                  onClick={() => void loadBackupFiles()}
                >
                  {backupListBusy ? s.refreshing : s.refreshBackupList}
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label className="block text-xs font-medium text-stone-600">
                  {s.selectBackup}
                  <select
                    value={selectedBackupFilename}
                    onChange={(e) => setSelectedBackupFilename(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    {backupFiles.length === 0 ? <option value="">{s.noBackupsOption}</option> : null}
                    {backupFiles.map((b) => (
                      <option key={b.filename} value={b.filename}>
                        {s.backupFileOptionLine(b.filename, b.modified_at)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={
                    DISABLE_DATA_MANAGEMENT_RESTORE || restoreBusy || !selectedBackupFilename
                  }
                  title={DISABLE_DATA_MANAGEMENT_RESTORE ? "生产环境已禁用此操作" : undefined}
                  onClick={() => void restoreFromSelectedBackup()}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 disabled:opacity-50"
                >
                  {restoreBusy ? s.restoring : s.restoreFromBackup}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label
                  title={DISABLE_DATA_MANAGEMENT_RESTORE ? "生产环境已禁用此操作" : undefined}
                  className={`rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 ${
                    DISABLE_DATA_MANAGEMENT_RESTORE ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  {restoreBusy ? s.restoring : s.uploadDbRestore}
                  <input
                    type="file"
                    accept=".db"
                    className="hidden"
                    disabled={DISABLE_DATA_MANAGEMENT_RESTORE || restoreBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) return;
                      void restoreFromUpload(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <p className="text-xs text-stone-500">{s.restoreHint}</p>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
                    <tr>
                      <th className="px-3 py-2">{s.thBackupFile}</th>
                      <th className="px-3 py-2">{s.thModified}</th>
                      <th className="px-3 py-2">{s.thSize}</th>
                      <th className="px-3 py-2">{s.thActions}</th>
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
                              {s.download}
                            </button>
                            <button
                              type="button"
                              disabled={DISABLE_DATA_MANAGEMENT_RESTORE || restoreBusy}
                              title={DISABLE_DATA_MANAGEMENT_RESTORE ? "生产环境已禁用此操作" : undefined}
                              className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 disabled:opacity-50"
                              onClick={() => void restoreFromBackupName(b.filename)}
                            >
                              {s.restoreFromThis}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {backupFiles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-sm text-stone-500">
                          {s.noBackupFiles}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="order-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">{s.backupPlanTitle}</h2>
                  <p className="mt-1 text-xs text-stone-500">{s.backupPlanDesc}</p>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                  disabled={backupPlanBusy}
                  onClick={() => void loadBackupPlan()}
                >
                  {backupPlanBusy ? s.loading : s.loadCurrentPlan}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={backupPlanEnabled}
                    onChange={(e) => setBackupPlanEnabled(e.target.checked)}
                  />
                  {s.enableAutoBackup}
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  {s.dailyBackupTime}
                  <input
                    type="time"
                    value={backupPlanTime}
                    onChange={(e) => setBackupPlanTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  {s.keepLastN}
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
                  <p className="text-xs font-medium text-stone-600">{s.lastAutoBackup}</p>
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
                  {backupPlanBusy ? s.saving : s.savePlan}
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
                  {s.refreshState}
                </button>
              </div>
            </article>

            <article className="order-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-base font-semibold">{s.customersImportTitle}</h2>
              <p className="mt-1 text-xs text-stone-500">{s.customersImportDesc}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void downloadCsv("/api/admin/maintenance/customers/template.csv", "customers-template.csv")}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                >
                  {s.downloadTemplate}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadCsv("/api/admin/maintenance/customers/export.csv", "customers-export.csv")}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                >
                  {s.exportData}
                </button>
                <select
                  value={customerDuplicateStrategy}
                  onChange={(e) => setCustomerDuplicateStrategy(e.target.value as "skip" | "update")}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700"
                >
                  <option value="skip">{s.dupPhoneSkip}</option>
                  <option value="update">{s.dupPhoneUpdate}</option>
                </select>
                <label className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700">
                  {importBusy ? s.importing : s.importCsv}
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

            <article className="order-2 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-base font-semibold">{s.reservationsImportTitle}</h2>
              <p className="mt-1 text-xs text-stone-500">{s.reservationsImportDesc}</p>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-900">{s.clearBeforeImportTitle}</p>
                <p className="mt-1 text-xs text-amber-800/90">{s.clearBeforeImportDesc}</p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="text-xs text-stone-600">
                    {s.labelDateFrom}
                    <input
                      type="date"
                      value={clearReservationsFrom}
                      onChange={(e) => setClearReservationsFrom(e.target.value)}
                      className="ml-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="text-xs text-stone-600">
                    {s.labelDateTo}
                    <input
                      type="date"
                      value={clearReservationsTo}
                      onChange={(e) => setClearReservationsTo(e.target.value)}
                      className="ml-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={DISABLE_DATA_MANAGEMENT_CLEAR || clearReservationsBusy}
                    title={DISABLE_DATA_MANAGEMENT_CLEAR ? "生产环境已禁用此操作" : undefined}
                    onClick={() => void clearReservationsForImport()}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 disabled:opacity-50"
                  >
                    {clearReservationsBusy ? s.clearing : s.clearReservationsBtn}
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void downloadCsv("/api/admin/maintenance/reservations/template.csv", "reservations-template.csv")}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                >
                  {s.downloadTemplate}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadCsv("/api/admin/maintenance/reservations/export.csv", "reservations-export.csv")}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                >
                  {s.exportData}
                </button>
                <select
                  value={reservationDuplicateStrategy}
                  onChange={(e) => setReservationDuplicateStrategy(e.target.value as "skip" | "update")}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700"
                >
                  <option value="skip">{s.dupResSkip}</option>
                  <option value="update">{s.dupResUpdate}</option>
                </select>
                <label className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700">
                  {importBusy ? s.importing : s.importCsv}
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

            <article className="order-6 rounded-2xl border border-red-200 bg-red-50/60 p-5 shadow-sm">
              <h2 className="font-display text-base font-semibold text-red-900">{s.dangerClearTitle}</h2>
              <p className="mt-1 text-xs text-red-800/90">{s.dangerClearDesc}</p>
              <button
                type="button"
                disabled={DISABLE_DATA_MANAGEMENT_CLEAR || clearBusy}
                title={DISABLE_DATA_MANAGEMENT_CLEAR ? "生产环境已禁用此操作" : undefined}
                onClick={() => void clearTestReservations()}
                className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-800 shadow-sm hover:bg-red-50 disabled:opacity-50"
              >
                {clearBusy ? s.processing : s.clearBusinessData}
              </button>
            </article>
          </section>
        )}

        {tab === "logs" && (
          <section className="space-y-4">
            <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">{s.logsTitle}</h2>
                  <p className="mt-1 text-xs text-stone-500">{s.logsDesc}</p>
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
                    {s.logTabOps}
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
                    {s.logTabSms}
                  </button>
                  {canAccessDataManagement && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogsTab("access");
                        void loadAccessLogs(1);
                      }}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                        logsTab === "access" ? "border-ink-900 bg-ink-900 text-white" : "border-stone-200 bg-white text-stone-700"
                      }`}
                    >
                      {s.logTabAccess}
                    </button>
                  )}
                </div>
              </div>

              {logsTab === "ops" && (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <label className="block text-xs font-medium text-stone-600 lg:col-span-2">
                      {s.labelAccount}
                      <input value={opsUser} onChange={(e) => setOpsUser(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder={s.placeholderAdmin} />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.labelCategory}
                      <input value={opsCategory} onChange={(e) => setOpsCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder={s.placeholderReservation} />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.labelAction}
                      <input value={opsAction} onChange={(e) => setOpsAction(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder={s.placeholderCreate} />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.labelTimeFrom}
                      <input value={opsDateFrom} onChange={(e) => setOpsDateFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder={s.placeholderDateTime} />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.labelTimeTo}
                      <input value={opsDateTo} onChange={(e) => setOpsDateTo(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder={s.placeholderDateTime} />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => void loadOperationLogs(1)} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700">
                      {logsBusy ? s.loading : s.query}
                    </button>
                    <p className="text-xs text-stone-500">{s.totalCount(opsTotal)}</p>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
                        <tr>
                          <th className="px-3 py-2">{s.thTime}</th>
                          <th className="px-3 py-2">{s.thAccount}</th>
                          <th className="px-3 py-2">{s.thCatAction}</th>
                          <th className="px-3 py-2">{s.thObject}</th>
                          <th className="px-3 py-2">{s.thDetail}</th>
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
                              {s.noData}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                    <span>{s.pageOf(opsPage)}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={opsPage <= 1 || logsBusy} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => void loadOperationLogs(Math.max(1, opsPage - 1))}>
                        {s.prevPage}
                      </button>
                      <button type="button" disabled={opsPage * 50 >= opsTotal || logsBusy} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => void loadOperationLogs(opsPage + 1)}>
                        {s.nextPage}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {logsTab === "sms" && (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <label className="block text-xs font-medium text-stone-600 lg:col-span-2">
                      {s.smsPhone}
                      <input value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder={s.smsPlaceholderFuzzy} />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.smsKind}
                      <select value={smsKind} onChange={(e) => setSmsKind(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                        <option value="">{s.optAll}</option>
                        <option value="reservation">{s.optKindReservation}</option>
                        <option value="login">{s.optKindLogin}</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.smsPurpose}
                      <select value={smsPurpose} onChange={(e) => setSmsPurpose(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                        <option value="">{s.optAll}</option>
                        <option value="reservation_success">{s.optPurposeSuccess}</option>
                        <option value="reservation_cancel">{s.optPurposeCancel}</option>
                        <option value="staff_login">{s.optPurposeStaffLogin}</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.smsStatus}
                      <select value={smsStatus} onChange={(e) => setSmsStatus(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                        <option value="">{s.optAll}</option>
                        <option value="sent">{s.optStatusSent}</option>
                        <option value="failed">{s.optStatusFailed}</option>
                        <option value="blocked">{s.optStatusBlocked}</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.labelTimeFrom}
                      <input value={smsDateFrom} onChange={(e) => setSmsDateFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder={s.placeholderDateTime} />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.labelTimeTo}
                      <input value={smsDateTo} onChange={(e) => setSmsDateTo(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder={s.placeholderDateTime} />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => void loadSmsLogs(1)} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700">
                      {logsBusy ? s.loading : s.query}
                    </button>
                    <p className="text-xs text-stone-500">{s.totalCount(smsTotal)}</p>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="w-full min-w-[1120px] text-left text-sm">
                      <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
                        <tr>
                          <th className="px-3 py-2">{s.thTime}</th>
                          <th className="px-3 py-2">{s.thKindPurpose}</th>
                          <th className="px-3 py-2">{s.thPhone}</th>
                          <th className="px-3 py-2">{s.thStatus}</th>
                          <th className="px-3 py-2">{s.thContent}</th>
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
                              {s.noData}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                    <span>{s.pageOf(smsPage)}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={smsPage <= 1 || logsBusy} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => void loadSmsLogs(Math.max(1, smsPage - 1))}>
                        {s.prevPage}
                      </button>
                      <button type="button" disabled={smsPage * 50 >= smsTotal || logsBusy} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => void loadSmsLogs(smsPage + 1)}>
                        {s.nextPage}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {logsTab === "access" && canAccessDataManagement && (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-xs font-medium text-stone-600 lg:col-span-2">
                      {s.labelAccount}
                      <input
                        value={accessUser}
                        onChange={(e) => setAccessUser(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                        placeholder={s.placeholderAdmin}
                      />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.labelTimeFrom}
                      <input
                        value={accessDateFrom}
                        onChange={(e) => setAccessDateFrom(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                        placeholder={s.placeholderDateTime}
                      />
                    </label>
                    <label className="block text-xs font-medium text-stone-600">
                      {s.labelTimeTo}
                      <input
                        value={accessDateTo}
                        onChange={(e) => setAccessDateTo(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                        placeholder={s.placeholderDateTime}
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void loadAccessLogs(1)}
                      className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700"
                    >
                      {logsBusy ? s.loading : s.query}
                    </button>
                    <p className="text-xs text-stone-500">{s.totalCount(accessTotal)}</p>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
                        <tr>
                          <th className="px-3 py-2">{s.thTime}</th>
                          <th className="px-3 py-2">{s.thAccount}</th>
                          <th className="px-3 py-2">{s.thRole}</th>
                          <th className="px-3 py-2">{s.thPath}</th>
                          <th className="px-3 py-2">{s.thIp}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accessRows.map((r) => (
                          <tr key={r.id} className="border-b border-stone-100">
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-stone-600">{r.created_at ?? "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.username || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs">{r.role || "—"}</td>
                            <td className="px-3 py-2 font-mono text-xs text-stone-700">{r.path || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-stone-600">{r.ip || "—"}</td>
                          </tr>
                        ))}
                        {accessRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-sm text-stone-500">
                              {s.noData}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                    <span>{s.pageOf(accessPage)}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={accessPage <= 1 || logsBusy}
                        className="rounded-lg border px-3 py-1 disabled:opacity-40"
                        onClick={() => void loadAccessLogs(Math.max(1, accessPage - 1))}
                      >
                        {s.prevPage}
                      </button>
                      <button
                        type="button"
                        disabled={accessPage * 50 >= accessTotal || logsBusy}
                        className="rounded-lg border px-3 py-1 disabled:opacity-40"
                        onClick={() => void loadAccessLogs(accessPage + 1)}
                      >
                        {s.nextPage}
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
