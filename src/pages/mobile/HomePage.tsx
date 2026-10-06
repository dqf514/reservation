import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, assetUrl } from "@/lib/api";
import { useBranding } from "@/context/BrandingContext";

type HomePromotion = { title: string; sub: string; tone: string; image_url?: string | null };

type HomeSummary = {
  promotions: HomePromotion[];
  reservations_today: number;
  reservations_tomorrow: number;
};

export function HomePage() {
  const { branding } = useBranding();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<HomeSummary>("/api/home/summary");
        if (!c) {
          setSummary(data);
          setSummaryErr(null);
        }
      } catch (e) {
        if (!c) {
          setSummary(null);
          setSummaryErr(e instanceof Error ? e.message : "加载失败");
        }
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  if (!branding) return null;

  const logo = assetUrl(branding.logo_url ?? undefined);
  const accent = branding.customer_primary_color;
  const promotions = summary?.promotions ?? [];

  return (
    <div className="animate-fade-up pb-2">
      <div className="mx-auto w-full max-w-[1400px] px-4">
        <header className="safe-pt flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="" className="h-10 w-10 rounded-2xl object-contain shadow-soft" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-display font-semibold text-white shadow-soft"
                style={{ background: `linear-gradient(135deg, ${accent}, #ea580c)` }}
                aria-hidden
              >
                {branding.app_name.slice(0, 1)}
              </div>
            )}
            <div>
              <p className="font-display text-lg font-semibold tracking-wide text-ink-900">{branding.app_name}</p>
              <p className="text-[11px] text-stone-500">{branding.company_name || "餐厅预订"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login?next=/admin"
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm active:bg-stone-50"
            >
              员工入口
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="relative overflow-hidden rounded-3xl shadow-card">
            <div
              className="aspect-[16/10] md:aspect-[16/8] lg:aspect-[16/7] bg-gradient-to-br from-stone-800 via-stone-700 to-amber-900/90"
              role="img"
              aria-label="餐厅氛围图"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,220,180,0.35),transparent_55%),radial-gradient(ellipse_at_70%_80%,rgba(255,160,120,0.2),transparent_50%)]" />
              <div
                className="absolute inset-0 opacity-25 mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.12%22/%3E%3C/svg%3E')]"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent p-5 pt-16">
                <p className="font-display text-xl text-white drop-shadow">{branding.customer_hero_title}</p>
                <p className="mt-1 text-sm text-white/85">{branding.customer_hero_subtitle}</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-semibold text-ink-900">快速预订</h2>
            <Link
              to="/reserve"
              className="mt-3 flex w-full items-center justify-center rounded-2xl py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/20 active:scale-[0.99]"
              style={{ background: `linear-gradient(90deg, ${accent}, #ea580c)` }}
            >
              立即预订
            </Link>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-lg font-semibold text-ink-900">门店活动</h2>
            <span className="text-xs text-stone-500">精选活动</span>
          </div>
          {!summary && !summaryErr && <p className="text-sm text-stone-500">加载活动…</p>}
          {promotions.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {promotions.map((a) => (
                <article
                  key={a.title}
                  className={`overflow-hidden rounded-2xl bg-gradient-to-br shadow-soft ${a.tone}`}
                >
                  <div className="relative aspect-[5/3]">
                    {a.image_url ? (
                      <img
                        src={assetUrl(a.image_url) ?? a.image_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
                    <div className="relative flex h-full flex-col justify-end p-4 text-white">
                      <h3 className="text-base font-semibold drop-shadow">{a.title}</h3>
                      <p className="mt-1 text-xs text-white/90">{a.sub}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {summaryErr && promotions.length === 0 && (
            <p className="text-sm text-stone-500">活动卡片需连接后端 /api/home/summary 后显示。</p>
          )}
        </section>
      </div>
    </div>
  );
}
