import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, assetUrl } from "@/lib/api";
import { useBranding } from "@/context/BrandingContext";

type MineRow = {
  id: number;
  reservation_date: string;
  time_slot: string;
  party_size: number;
  flow_status: string;
  note: string | null;
};

const FLOW_LABEL: Record<string, string> = {
  pending_confirm: "待确认",
  waiting: "待处理",
  confirmed: "已确认",
  arrived: "入座",
  seated: "入座",
  left: "已离店",
  noshow: "爽约",
  cancelled: "已取消",
};

export function MePage() {
  const { branding } = useBranding();
  const [phone, setPhone] = useState(() => localStorage.getItem("rr_last_phone") ?? "");
  const [rows, setRows] = useState<MineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const logo = useMemo(() => assetUrl(branding?.logo_url ?? undefined), [branding?.logo_url]);
  const accent = branding?.customer_primary_color ?? "#e85d4c";

  async function fetchMine(forPhone?: string) {
    const raw = (forPhone ?? phone).replace(/\s/g, "");
    if (!/^1\d{10}$/.test(raw)) {
      setErr("请输入 11 位手机号");
      setRows([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch<MineRow[]>(`/api/reservations/mine?phone=${encodeURIComponent(raw)}`);
      setRows(data);
      setPhone(raw);
      localStorage.setItem("rr_last_phone", raw);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = (localStorage.getItem("rr_last_phone") ?? "").replace(/\s/g, "");
    if (/^1\d{10}$/.test(stored)) {
      void fetchMine(stored);
    }
    // 仅挂载时自动拉取已保存手机号
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-up px-4 pb-8 pt-4">
      <div className="flex items-center gap-4 rounded-3xl border border-stone-200/80 bg-white p-5 shadow-soft">
        {logo ? (
          <img src={logo} alt="" className="h-16 w-16 rounded-full object-contain" />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, #ea580c)` }}
          >
            食
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold text-ink-900">{branding?.app_name ?? "会员"}</p>
          <p className="text-xs text-stone-500">数据来源：门店本地（按手机号查询预订记录）</p>
          <div className="mt-2 flex gap-2">
            <input
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号"
              className="min-w-0 flex-1 rounded-full border border-stone-200 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void fetchMine()}
              className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium text-white"
              style={{ backgroundColor: accent }}
            >
              查询
            </button>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-base font-semibold text-ink-900">我的预订</h2>
        {loading && <p className="text-sm text-stone-500">加载中…</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <ul className="space-y-3">
          {rows.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between rounded-2xl border border-stone-200/80 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-ink-900">
                  {h.reservation_date} · {h.time_slot}
                </p>
                <p className="text-xs text-stone-500">{h.party_size} 位</p>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                {FLOW_LABEL[h.flow_status] ?? h.flow_status}
              </span>
            </li>
          ))}
        </ul>
        {!loading && rows.length === 0 && !err && /^1\d{10}$/.test(phone.replace(/\s/g, "")) && (
          <p className="text-sm text-stone-500">暂无记录</p>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-stone-400">
        <Link to="/login?next=/admin" className="text-stone-500 underline-offset-4 hover:underline">
          员工登录 / 桌台管理
        </Link>
      </p>
    </div>
  );
}
