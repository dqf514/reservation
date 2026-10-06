import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import type { AppLanguage } from "@/i18n";
import { translateApiError } from "@/lib/translateApiError";
import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";
import type { DashboardSummary } from "@/types/admin";

/** 开发完成前保持 false；完成后改为 true 即可显示账户菜单内的中英文切换 */
const ENABLE_LANGUAGE_SWITCHER = false;

export function AdminLayout({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const { logout, user, reloadMe } = useAuth();
  const { branding } = useBranding();
  const loc = useLocation();
  const [sum, setSum] = useState<DashboardSummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdOld, setPwdOld] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdAgain, setPwdAgain] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName =
    (user?.full_name || "").trim() || user?.username || t("adminLayout.fallbackDisplayName");

  useEffect(() => {
    let c = false;
    async function loadSummary() {
      try {
        const s = await apiFetch<DashboardSummary>("/api/admin/dashboard/summary");
        if (!c) setSum(s);
      } catch {
        if (!c) setSum(null);
      }
    }
    void loadSummary();
    const timer = window.setInterval(() => {
      void loadSummary();
    }, 60_000);
    return () => {
      c = true;
      window.clearInterval(timer);
    };
  }, [loc.pathname]);

  const isSuper = user?.role === "admin";

  const todoCount = useMemo(() => {
    const a = sum?.pending_confirm_reservations ?? 0;
    const b = sum?.pending_deposits ?? 0;
    return a + b;
  }, [sum]);

  const adminLinks = useMemo(() => {
    const base: Array<{ to: string; label: string }> = [
      { to: "/admin/sms", label: t("adminLayout.linkSms") },
      { to: "/admin/kitchen-prep", label: t("adminLayout.linkKitchen") },
      { to: "/admin/tables", label: t("adminLayout.linkTables") },
    ];
    if (isSuper) {
      base.push({ to: "/admin/settings", label: t("adminLayout.linkSettings") });
      base.push({ to: "/admin/users", label: t("adminLayout.linkUsers") });
    }
    return base;
  }, [isSuper, t]);

  useEffect(() => {
    // 切路由就收起设置弹窗，避免卡住
    setSettingsOpen(false);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [loc.pathname]);

  const accessLogBucket = useRef<string>("");
  useEffect(() => {
    if (!user) return;
    const path = `${loc.pathname}${loc.search || ""}`;
    if (!path.startsWith("/admin")) return;
    const bucket = `${path}@${Math.floor(Date.now() / 1000)}`;
    if (bucket === accessLogBucket.current) return;
    accessLogBucket.current = bucket;
    void apiFetch("/api/admin/logs/access", {
      method: "POST",
      json: { path },
    }).catch(() => {});
  }, [user, loc.pathname, loc.search]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const t = e.target as Node | null;
      if (settingsRef.current && t && settingsRef.current.contains(t)) return;
      if (userMenuRef.current && t && userMenuRef.current.contains(t)) return;
      setSettingsOpen(false);
      setUserMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  const mainNav = useMemo(() => {
    const items: Array<{ to: string; label: string }> = [
      { to: "/admin", label: t("adminLayout.navFloor") },
      { to: "/admin/reservations", label: t("adminLayout.navRecords") },
      { to: "/admin/deposits", label: t("adminLayout.navDeposits") },
      { to: "/admin/diners", label: t("adminLayout.navDiners") },
      { to: "/admin/promotion", label: t("adminLayout.navPromotion") },
      { to: "/admin/calendar", label: t("adminLayout.navCalendar") },
    ];
    return items;
  }, [t]);

  const mobileMainNav = useMemo(
    () => [
      { to: "/admin/reservations", label: t("adminLayout.navRecords") },
      { to: "/admin/deposits", label: t("adminLayout.navDeposits") },
      { to: "/admin", label: t("adminLayout.navFloor") },
      { to: "/admin/diners", label: t("adminLayout.navDiners") },
      { to: "/admin/promotion", label: t("adminLayout.navPromotion") },
      { to: "/admin/calendar", label: t("adminLayout.navCalendar") },
    ],
    [t],
  );

  async function submitMyPassword() {
    if (pwdBusy) return;
    if (pwdNew.length < 6) {
      window.alert(t("adminLayout.alertPwdMin"));
      return;
    }
    if (pwdNew !== pwdAgain) {
      window.alert(t("adminLayout.alertPwdMismatch"));
      return;
    }
    setPwdBusy(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        json: { old_password: pwdOld, new_password: pwdNew },
      });
      setPwdOpen(false);
      setPwdOld("");
      setPwdNew("");
      setPwdAgain("");
      window.alert(t("adminLayout.alertPwdOk"));
    } catch (e) {
      window.alert(
        e instanceof Error ? translateApiError(t, e.message) : t("adminLayout.alertPwdFail"),
      );
    } finally {
      setPwdBusy(false);
    }
  }

  function openProfileModal() {
    setProfileName((user?.full_name || "").trim());
    setProfilePhone((user?.phone || "").trim());
    setProfileEmail((user?.email || "").trim());
    setProfileOpen(true);
  }

  async function submitMyProfile() {
    if (profileBusy) return;
    setProfileBusy(true);
    try {
      await apiFetch("/api/auth/me/profile", {
        method: "PATCH",
        json: {
          full_name: profileName.trim() || null,
          phone: profilePhone.trim() || null,
          email: profileEmail.trim() || null,
        },
      });
      await reloadMe();
      setProfileOpen(false);
      window.alert(t("adminLayout.alertProfileOk"));
    } catch (e) {
      window.alert(
        e instanceof Error ? translateApiError(t, e.message) : t("adminLayout.alertProfileFail"),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f5f3f0] text-ink-900">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/admin"
              className="text-lg font-display font-bold tracking-tight text-ink-900 lg:text-xl"
            >
              {branding?.app_name || t("adminLayout.brandFallback")}
            </Link>
          </div>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto whitespace-nowrap px-2 lg:flex">
            {mainNav.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/admin"}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-[14px] sm:px-4 sm:py-2 sm:text-[16px] font-semibold transition ${
                    isActive
                      ? "bg-ink-900 text-white shadow-sm"
                      : "bg-white text-stone-600 hover:bg-stone-50"
                  }`
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <NavLink
              to="/admin/todo"
              className={({ isActive }) =>
                `relative rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50 ${
                  isActive ? "ring-1 ring-brand-coral/30" : ""
                }`
              }
            >
              {t("adminLayout.todo")}
              {todoCount > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {todoCount > 99 ? "99+" : todoCount}
                </span>
              )}
            </NavLink>

            <div ref={settingsRef} className="relative">
              <button
                type="button"
                aria-label={t("adminLayout.ariaSettings")}
                aria-expanded={settingsOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsOpen((v) => !v);
                }}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                {t("adminLayout.settings")}
              </button>
              {settingsOpen && (
                <div className="absolute right-0 mt-2 w-28 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
                  <div className="max-h-[60dvh] overflow-y-auto p-2">
                    {adminLinks.map((l) => (
                      <Link
                        key={l.to}
                        to={l.to}
                        onClick={() => setSettingsOpen(false)}
                        className="block rounded-xl px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <NavLink
              to="/admin/help"
              className={({ isActive }) =>
                `rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 ${
                  isActive ? "ring-1 ring-brand-coral/30" : ""
                }`
              }
            >
              {t("adminLayout.help")}
            </NavLink>

            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                aria-label={t("adminLayout.ariaUserMenu")}
                aria-expanded={userMenuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen((v) => !v);
                }}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                {displayName}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 min-w-[11rem] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      openProfileModal();
                    }}
                    className="block w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {t("adminLayout.profile")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setPwdOpen(true);
                    }}
                    className="block w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {t("adminLayout.changePassword")}
                  </button>
                  {ENABLE_LANGUAGE_SWITCHER ? <AdminLanguageSwitcher variant="desktop" /> : null}
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="block w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {t("adminLayout.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="relative lg:hidden">
            <button
              type="button"
              aria-label={t("adminLayout.ariaMenu")}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
            >
              ☰
            </button>
            {mobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
                <div className="border-b border-stone-100 px-3 py-2 text-xs text-stone-500">
                  {t("adminLayout.currentUserPrefix")}
                  {displayName}
                </div>
                <div className="max-h-[60dvh] overflow-y-auto p-2">
                  <Link
                    to="/admin/todo"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mb-1 block rounded-xl px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {t("adminLayout.pending")}
                    {todoCount > 0 && (
                      <span className="ml-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] text-white">
                        {todoCount > 99 ? "99+" : todoCount}
                      </span>
                    )}
                  </Link>
                  {adminLinks.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <Link
                    to="/admin/help"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-xl px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {t("adminLayout.help")}
                  </Link>
                  {ENABLE_LANGUAGE_SWITCHER ? <AdminLanguageSwitcher variant="mobile" /> : null}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openProfileModal();
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {t("adminLayout.profile")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setPwdOpen(true);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {t("adminLayout.changePassword")}
                  </button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {t("adminLayout.logout")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-14 pb-16 lg:pb-0">{children ?? <Outlet />}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white/95 px-2 py-1 backdrop-blur lg:hidden">
        <div className="grid grid-cols-6 items-end">
          {mobileMainNav.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/admin"}
              className={({ isActive }) => {
                const isCenter = it.to === "/admin";
                if (isCenter) {
                  return `-mt-4 mx-auto flex h-12 w-12 items-center justify-center rounded-full border text-xs font-semibold shadow ${
                    isActive
                      ? "border-brand-coral bg-brand-coral text-white"
                      : "border-stone-200 bg-white text-stone-700"
                  }`;
                }
                return `flex flex-col items-center justify-center px-1 py-1 text-[11px] font-medium ${
                  isActive ? "text-ink-900" : "text-stone-500"
                }`;
              }}
            >
              {it.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {pwdOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg font-semibold">{t("adminLayout.pwdTitle")}</div>
                <div className="mt-1 text-xs text-stone-500">
                  {t("adminLayout.accountLabel")}
                  {user?.username}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPwdOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-stone-600 hover:bg-stone-100"
              >
                {t("adminLayout.close")}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-stone-600">
                {t("adminLayout.pwdOld")}
                <input
                  type="password"
                  value={pwdOld}
                  onChange={(e) => setPwdOld(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  autoComplete="current-password"
                />
              </label>
              <label className="block text-xs text-stone-600">
                {t("adminLayout.pwdNew")}
                <input
                  type="password"
                  minLength={6}
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-xs text-stone-600">
                {t("adminLayout.pwdConfirm")}
                <input
                  type="password"
                  minLength={6}
                  value={pwdAgain}
                  onChange={(e) => setPwdAgain(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPwdOpen(false)}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-700"
              >
                {t("adminLayout.cancel")}
              </button>
              <button
                type="button"
                disabled={pwdBusy}
                onClick={() => void submitMyPassword()}
                className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pwdBusy ? t("adminLayout.saving") : t("adminLayout.save")}
              </button>
            </div>
          </div>
        </div>
      )}
      {profileOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg font-semibold">{t("adminLayout.profileTitle")}</div>
                <div className="mt-1 text-xs text-stone-500">
                  {t("adminLayout.accountLabel")}
                  {user?.username}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-stone-600 hover:bg-stone-100"
              >
                {t("adminLayout.close")}
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-stone-600">
                {t("adminLayout.fullName")}
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-stone-600">
                {t("adminLayout.phone")}
                <input
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
                {profilePhone.trim() === "" && (
                  <p className="mt-1 text-[11px] text-stone-500">{t("adminLayout.phoneHint")}</p>
                )}
              </label>
              <label className="block text-xs text-stone-600">
                {t("adminLayout.email")}
                <input
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-700"
              >
                {t("adminLayout.cancel")}
              </button>
              <button
                type="button"
                disabled={profileBusy}
                onClick={() => void submitMyProfile()}
                className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {profileBusy ? t("adminLayout.saving") : t("adminLayout.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 与「个人信息 / 修改密码」同款样式；当前中文显示 English，当前英文显示「中文」 */
function AdminLanguageSwitcher({ variant }: { variant: "desktop" | "mobile" }) {
  const { i18n, t } = useTranslation();
  const code = i18n.resolvedLanguage ?? i18n.language;
  const isEn = code === "en" || code.startsWith("en");
  const next: AppLanguage = isEn ? "zh-CN" : "en";

  const cls =
    variant === "mobile"
      ? "block w-full rounded-xl border-t border-stone-100 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
      : "block w-full border-t border-stone-100 px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50";

  return (
    <button
      type="button"
      onClick={() => {
        void i18n.changeLanguage(next);
      }}
      className={cls}
      aria-label={isEn ? t("lang.ariaSwitchToZh") : t("lang.ariaSwitchToEn")}
    >
      {isEn ? t("lang.zh") : t("lang.en")}
    </button>
  );
}
