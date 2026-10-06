import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, assetUrl } from "@/lib/api";
import type { BrandingDTO } from "@/types/branding";

const FALLBACK_BRANDING: BrandingDTO = {
  company_name: "TFF 演示门店",
  app_name: "TFF",
  logo_url: null,
  favicon_url: null,
  login_title: "员工登录",
  login_subtitle: "请确认后端服务已启动（默认 http://127.0.0.1:8000）",
  login_bg_url: null,
  login_primary_color: "#1c1917",
  login_accent_color: "#e85d4c",
  login_card_opacity: 0.92,
  login_footer_text: "离线模式：品牌配置使用本地默认值",
  login_show_powered: true,
  splash_enabled: false,
  splash_image_url: null,
  splash_seconds: 2.5,
  splash_for_customer: true,
  splash_for_staff: true,
  customer_hero_title: "今晚，为您留一盏灯",
  customer_hero_subtitle: "主厨推荐 · 本地时令食材",
  customer_primary_color: "#e85d4c",
};

type Ctx = {
  branding: BrandingDTO | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const BrandingContext = createContext<Ctx | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await apiFetch<BrandingDTO>("/api/branding");
      setBranding(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载品牌配置失败");
      setBranding({ ...FALLBACK_BRANDING });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!branding) return;
    document.title = `${branding.app_name} · 餐厅预订`;
    const fav = assetUrl(branding.favicon_url ?? undefined);
    let link = document.querySelector<HTMLLinkElement>("link[data-rr-favicon]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.dataset.rrFavicon = "1";
      document.head.appendChild(link);
    }
    if (fav) link.href = fav;
    const root = document.documentElement;
    root.style.setProperty("--rr-customer-primary", branding.customer_primary_color);
  }, [branding]);

  const value = useMemo(
    () => ({ branding, loading, error, refresh }),
    [branding, loading, error, refresh],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const v = useContext(BrandingContext);
  if (!v) throw new Error("useBranding 必须在 BrandingProvider 内使用");
  return v;
}
