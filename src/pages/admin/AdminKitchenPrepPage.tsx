import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { formatYmdToMonthDay, toLocalYmd } from "@/lib/dateLocal";
import { computeNextPrepMeal } from "@/lib/kitchenPeriodClock";
import { useBranding } from "@/context/BrandingContext";
import { useAuth } from "@/context/AuthContext";

type KitchenSummary = {
  date: string;
  total_orders: number;
  total_party: number;
  by_period: { period_key: string; orders: number; party: number }[];
};

type KitchenItem = {
  id: number;
  reservation_date: string;
  period_key: string;
  period: string;
  time_slot: string;
  customer_name: string;
  phone: string;
  party_size: number;
  tags?: string;
  flow_status: string;
  table_label: string;
  note?: string | null;
  assigned_staff_name?: string;
};

type KitchenResp = {
  summary: KitchenSummary[];
  items: KitchenItem[];
  periods: { period_key: string; label: string; icon?: string; color?: string }[];
};

type OperatingPeriodRow = {
  period_key: string;
  label: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  enabled: boolean;
};

const FLOW_LABEL: Record<string, string> = {
  waiting: "待处理",
  confirmed: "已确认",
  arrived: "入座",
  left: "离席",
  cancelled: "已取消",
};

function displayPeriodLabel(label?: string) {
  return (label ?? "").trim();
}

export function AdminKitchenPrepPage() {
  const { branding } = useBranding();
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [periodOptions, setPeriodOptions] = useState<OperatingPeriodRow[]>([]);
  const [selectedPeriodKeys, setSelectedPeriodKeys] = useState<string[]>([]);
  const [prepDefaultsReady, setPrepDefaultsReady] = useState(false);
  const [maskPhone, setMaskPhone] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<KitchenResp | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const op = await apiFetch<{ periods: OperatingPeriodRow[] }>("/api/operating-periods");
        if (cancelled) return;
        const enabled = [...op.periods]
          .filter((p) => p.enabled)
          .sort((a, b) => a.sort_order - b.sort_order);
        setPeriodOptions(enabled);
        if (enabled.length === 0) {
          const y = toLocalYmd(new Date());
          setDateFrom(y);
          setDateTo(y);
          setSelectedPeriodKeys([]);
        } else {
          const rows = enabled.map((p) => ({
            period_key: p.period_key,
            start_time: p.start_time,
            end_time: p.end_time,
            sort_order: p.sort_order,
          }));
          const next = computeNextPrepMeal(rows, new Date());
          setDateFrom(next.ymd);
          setDateTo(next.ymd);
          setSelectedPeriodKeys([next.periodKey]);
        }
      } catch {
        if (!cancelled) {
          const y = toLocalYmd(new Date());
          setDateFrom(y);
          setDateTo(y);
          setSelectedPeriodKeys([]);
        }
      } finally {
        if (!cancelled) setPrepDefaultsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!prepDefaultsReady || !dateFrom || !dateTo) return;
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        mask_phone: maskPhone ? "true" : "false",
      });
      selectedPeriodKeys.forEach((k) => q.append("period_keys", k));
      const r = await apiFetch<KitchenResp>(`/api/admin/kitchen/prep?${q.toString()}`);
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [prepDefaultsReady, dateFrom, dateTo, maskPhone, selectedPeriodKeys]);

  useEffect(() => {
    void load();
  }, [load]);

  function togglePeriod(key: string) {
    setSelectedPeriodKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }

  const printSummary = useMemo(() => {
    const periods = data?.periods ?? [];
    const summary = data?.summary ?? [];
    const periodTotals = periods.map((p) => {
      const acc = summary.reduce(
        (sum, d) => {
          const row = d.by_period.find((x) => x.period_key === p.period_key);
          return {
            orders: sum.orders + (row?.orders ?? 0),
            party: sum.party + (row?.party ?? 0),
          };
        },
        { orders: 0, party: 0 },
      );
      return {
        label: displayPeriodLabel(p.label),
        orders: acc.orders,
        party: acc.party,
      };
    });
    const totalOrders = summary.reduce((s, d) => s + d.total_orders, 0);
    const totalParty = summary.reduce((s, d) => s + d.total_party, 0);
    return { periodTotals, totalOrders, totalParty };
  }, [data]);

  const printTimeText = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 print-page-root">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-list-only { display: none !important; }
          .print-list-only.keep-print { display: block !important; }
          /* 整页白底：避免管理后台外层 #f5f3f0 等被打印成灰底费墨 */
          html {
            -webkit-print-color-adjust: economy;
            print-color-adjust: economy;
          }
          html, body, #root, #root > div, main, .print-page-root {
            background: #fff !important;
            box-shadow: none !important;
          }
          header { display: none !important; }
          footer { display: none !important; }
          nav { display: none !important; }
          [data-mobile-nav] { display: none !important; }
          .mobile-bottom-nav { display: none !important; }
          main { padding-top: 0 !important; overflow: visible !important; }
          .print-page-root > * { display: none !important; }
          .print-page-root > .print-scope { display: block !important; }
          .print-scope { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .print-scope section {
            background: #fff !important;
            box-shadow: none !important;
          }
          .print-scope thead, .print-scope th {
            background: #fff !important;
            background-color: #fff !important;
          }
          .print-scope table { width: 100% !important; border-collapse: collapse !important; }
          .print-scope th, .print-scope td { border-top: 1px solid #ddd !important; }
        }
      `}</style>

      <div className="print-only hidden print-scope">
        <div className="mb-2 flex items-end justify-between">
          <div className="text-3xl font-bold text-stone-900">{branding?.app_name || "餐厅"}</div>
          <div className="text-right text-lg font-bold leading-tight text-stone-900">
            {dateFrom === dateTo ? dateFrom : `${dateFrom} - ${dateTo}`}
          </div>
        </div>
        <section className="rounded-xl border border-stone-300 bg-white p-2.5">
          <div className="grid grid-cols-2 gap-2 border-b border-stone-200 pb-2">
            <div>
              <div className="text-[11px] text-stone-500 leading-tight">累计总预定桌次</div>
              <div className="mt-0.5 text-2xl font-bold text-stone-900 leading-none">{printSummary.totalOrders}</div>
            </div>
            <div>
              <div className="text-[11px] text-stone-500 leading-tight">累计总人数</div>
              <div className="mt-0.5 text-2xl font-bold text-stone-900 leading-none">{printSummary.totalParty}</div>
            </div>
          </div>

          <div className="mt-2 overflow-visible">
            <table className="min-w-full text-sm">
              <thead className="text-stone-700">
                <tr>
                  <th className="px-1.5 py-1 text-left">餐食时段</th>
                  <th className="px-1.5 py-1 text-left">预定量</th>
                  <th className="px-1.5 py-1 text-left">总人数</th>
                </tr>
              </thead>
              <tbody>
                {printSummary.periodTotals
                  .filter((x) => x.orders > 0)
                  .map((x) => (
                    <tr key={x.label} className="border-t border-stone-200">
                      <td className="px-1.5 py-1">{x.label}</td>
                      <td className="px-1.5 py-1">{x.orders}</td>
                      <td className="px-1.5 py-1">{x.party}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-stone-300 bg-white p-2.5">
          <div className="text-lg font-semibold text-stone-900">预定明细</div>
          <div className="mt-2 overflow-visible">
            <table className="min-w-full text-sm">
              <thead className="text-stone-700">
                <tr>
                  <th className="whitespace-nowrap px-1.5 py-1 text-left">预定人</th>
                  <th className="whitespace-nowrap px-1.5 py-1 text-center">预定时段</th>
                  <th className="whitespace-nowrap px-1.5 py-1 text-center">人数</th>
                  <th className="whitespace-nowrap px-1.5 py-1 text-left">桌号</th>
                  <th className="px-1.5 py-1 text-left">备注</th>
                  <th className="whitespace-nowrap px-1.5 py-1 text-left">接单人</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((it) => (
                  <tr key={it.id} className="border-t border-stone-200">
                    <td className="px-1.5 py-1 align-top leading-tight">
                      <div className="whitespace-nowrap text-[12px] font-medium text-stone-900">
                        {it.customer_name}
                      </div>
                      <div className="whitespace-nowrap text-[11px] text-stone-600">{it.phone}</div>
                    </td>
                    <td className="px-1.5 py-1 text-center align-top leading-tight">
                      <div className="whitespace-nowrap">{it.period}</div>
                      <div className="whitespace-nowrap text-[11px] text-stone-700">
                        {formatYmdToMonthDay(it.reservation_date)} {it.time_slot}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-center align-top">
                      {it.party_size}
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1 align-top">
                      {it.table_label || "—"}
                    </td>
                    <td className="px-1.5 py-1 align-top">{it.note || "—"}</td>
                    <td className="whitespace-nowrap px-1.5 py-1 align-top">
                      {(it.assigned_staff_name || "").trim() || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-6 flex items-center justify-between border-t border-stone-300 pt-2 text-sm text-stone-600">
          <div>打印时间：{printTimeText}</div>
          <div>打印账号：{user?.username || "未知账号"}</div>
        </div>
      </div>

      <div className="no-print flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">预定打印</h1>
          <p className="mt-1 text-sm text-stone-500">
            支持按日期区间与餐段筛选、汇总与明细打印，手机号默认脱敏。
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-brand-coral px-3 py-2 text-sm font-medium text-white"
        >
          打印
        </button>
      </div>

      <div className="no-print mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3">
        <label className="text-sm">
          开始日期
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            disabled={!prepDefaultsReady}
            className="ml-2 rounded-lg border border-stone-200 px-2 py-1.5 disabled:opacity-60"
          />
        </label>
        <label className="text-sm">
          结束日期
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            disabled={!prepDefaultsReady}
            className="ml-2 rounded-lg border border-stone-200 px-2 py-1.5 disabled:opacity-60"
          />
        </label>
        {periodOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-l border-stone-200 pl-3 text-sm">
            <span className="text-stone-500">餐段</span>
            {periodOptions.map((p) => (
              <label
                key={p.period_key}
                className="inline-flex cursor-pointer items-center gap-1.5 text-stone-800"
              >
                <input
                  type="checkbox"
                  checked={selectedPeriodKeys.includes(p.period_key)}
                  onChange={() => togglePeriod(p.period_key)}
                  className="rounded border-stone-300"
                />
                {displayPeriodLabel(p.label)}
              </label>
            ))}
          </div>
        )}
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={maskPhone}
            onChange={(e) => setMaskPhone(e.target.checked)}
          />
          手机号脱敏
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
        >
          刷新
        </button>
      </div>

      {err && <p className="no-print mt-3 text-sm text-red-600">{err}</p>}
      {loading && <p className="no-print mt-3 text-sm text-stone-500">加载中…</p>}

      <section className="no-print mt-4 rounded-2xl border border-stone-200 bg-white p-3">
        <h2 className="text-base font-semibold">汇总</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-2 py-2 text-left">日期</th>
                <th className="px-2 py-2 text-left">总单量</th>
                <th className="px-2 py-2 text-left">总人数</th>
                {(data?.periods ?? []).map((p) => (
                  <th key={p.period_key} className="px-2 py-2 text-left">
                    {displayPeriodLabel(p.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.summary ?? []).map((s) => (
                <tr key={s.date} className="border-t border-stone-100">
                  <td className="px-2 py-2">{s.date}</td>
                  <td className="px-2 py-2">{s.total_orders}</td>
                  <td className="px-2 py-2">{s.total_party}</td>
                  {(data?.periods ?? []).map((p) => {
                    const bp = s.by_period.find((x) => x.period_key === p.period_key);
                    return (
                      <td key={p.period_key} className="px-2 py-2">
                        {bp ? `${bp.orders} / ${bp.party}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="no-print mt-4 rounded-2xl border border-stone-200 bg-white p-3">
        <h2 className="text-base font-semibold">明细</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-2 py-2 text-left">日期</th>
                <th className="px-2 py-2 text-left">时段</th>
                <th className="px-2 py-2 text-left">时间</th>
                <th className="px-2 py-2 text-left">姓名</th>
                <th className="px-2 py-2 text-left">手机</th>
                <th className="px-2 py-2 text-left">人数</th>
                <th className="px-2 py-2 text-left">桌台</th>
                <th className="px-2 py-2 text-left">状态</th>
                <th className="px-2 py-2 text-left">备注</th>
                <th className="px-2 py-2 text-left">接单人</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((it) => (
                <tr key={it.id} className="border-t border-stone-100">
                  <td className="px-2 py-2">{it.reservation_date}</td>
                  <td className="px-2 py-2">{it.period}</td>
                  <td className="px-2 py-2">{it.time_slot}</td>
                  <td className="px-2 py-2">{it.customer_name}</td>
                  <td className="px-2 py-2">{it.phone}</td>
                  <td className="px-2 py-2">{it.party_size}</td>
                  <td className="px-2 py-2">{it.table_label}</td>
                  <td className="px-2 py-2">{FLOW_LABEL[it.flow_status] ?? it.flow_status}</td>
                  <td className="px-2 py-2">{it.note || "—"}</td>
                  <td className="px-2 py-2">{(it.assigned_staff_name || "").trim() || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="no-print mt-4 text-center text-xs text-stone-400">
        <Link to="/admin/calendar" className="text-stone-600 underline-offset-2 hover:underline">
          返回预订日历
        </Link>
      </p>
    </div>
  );
}
