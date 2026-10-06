import { NavLink, Outlet, useLocation } from "react-router-dom";

const tabs = [
  { to: "/", label: "首页", end: true },
  { to: "/reserve", label: "预订" },
  { to: "/me", label: "我的" },
];

export function MobileShell() {
  const loc = useLocation();
  const hideNav = loc.pathname.startsWith("/admin") || loc.pathname === "/login";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#faf7f2]">
      <main className={`flex-1 ${hideNav ? "" : "pb-[calc(4.25rem+env(safe-area-inset-bottom))]"}`}>
        <Outlet />
      </main>
      {!hideNav && (
        <nav
          className="fixed bottom-0 inset-x-0 z-40 border-t border-stone-200/80 bg-white/95 backdrop-blur-md safe-pb"
          aria-label="主导航"
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-xs font-medium transition-colors ${
                    isActive
                      ? "text-brand-coral"
                      : "text-stone-500 hover:text-stone-800"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`h-1 w-8 rounded-full ${isActive ? "bg-brand-coral" : "bg-transparent"}`}
                      aria-hidden
                    />
                    <span>{t.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
