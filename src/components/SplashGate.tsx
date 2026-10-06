import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { assetUrl } from "@/lib/api";
import { useBranding } from "@/context/BrandingContext";

export function SplashGate({ children }: { children: ReactNode }) {
  const { branding, loading } = useBranding();
  const loc = useLocation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!branding) {
      setVisible(false);
      return;
    }

    const staff = loc.pathname.startsWith("/admin") || loc.pathname === "/login";
    const key = staff ? "rr_splash_staff_v1" : "rr_splash_customer_v1";
    const enabled =
      branding.splash_enabled && (staff ? branding.splash_for_staff : branding.splash_for_customer);

    if (!enabled || sessionStorage.getItem(key)) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const ms = Math.min(Math.max(branding.splash_seconds * 1000, 500), 12000);
    const t = window.setTimeout(() => {
      sessionStorage.setItem(key, "1");
      setVisible(false);
    }, ms);
    return () => window.clearTimeout(t);
  }, [loading, branding, loc.pathname]);

  if (loading || !branding) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-stone-900 text-sm text-stone-300">
        加载中…
      </div>
    );
  }

  if (visible) {
    const img = assetUrl(branding.splash_image_url ?? undefined);
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-stone-950 text-white">
        {img ? (
          <img src={img} alt="启动页" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background: `linear-gradient(135deg, ${branding.login_primary_color}, ${branding.login_accent_color})`,
            }}
          />
        )}
        <div className="relative z-10 flex flex-col items-center px-8 text-center">
          {branding.logo_url && (
            <img src={assetUrl(branding.logo_url) ?? ""} alt="" className="mb-4 h-16 w-auto object-contain drop-shadow-lg" />
          )}
          <p className="font-display text-2xl font-semibold drop-shadow-md">{branding.company_name || branding.app_name}</p>
          <p className="mt-2 text-sm text-white/85 drop-shadow">{branding.app_name}</p>
        </div>
      </div>
    );
  }

  return children;
}
