import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { DepositItem, ReservationAdminItem } from "@/types/admin";
import { DEPOSIT_STATUS } from "@/types/admin";

function depLabel(v: string) {
  return DEPOSIT_STATUS.find((x) => x.v === v)?.l ?? v;
}

export function AdminTodoPage() {
  const [res, setRes] = useState<ReservationAdminItem[]>([]);
  const [dep, setDep] = useState<DepositItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ reservations: ReservationAdminItem[]; deposits: DepositItem[] }>(
          "/api/admin/todos",
        );
        if (!c) {
          setRes(data.reservations);
          setDep(data.deposits);
          setErr(null);
        }
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="w-full px-3 py-4">
      <h1 className="font-display text-xl font-semibold">待办</h1>
      <p className="mt-1 text-sm text-stone-500">预定确认预订与待收订金，处理后可到对应模块查看全部记录。</p>
      {loading && <p className="mt-4 text-sm text-stone-500">加载中…</p>}
      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-stone-800">预定确认预订</h2>
        <ul className="mt-2 space-y-2">
          {res.map((r) => {
            const hl = (r.todo_highlight || "flow").trim();
            const safeHl = ["flow", "tables", "phone"].includes(hl) ? hl : "flow";
            const q = new URLSearchParams();
            q.set("date_from", r.reservation_date);
            q.set("date_to", r.reservation_date);
            q.set("edit", String(r.id));
            q.set("highlight", safeHl);
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{r.customer_name}</span>
                  <span className="text-stone-500"> · {r.phone}</span>
                  <div className="text-xs text-stone-500">
                    {r.reservation_date} {r.time_slot} · {r.party_size} 人
                    {r.table_label ? ` · ${r.table_label}` : " · 未分桌"}
                  </div>
                  {(r.todo_reasons && r.todo_reasons.length > 0 ? r.todo_reasons : ["待确认：当前为「待处理」状态，请在记录页确认或调整。"]).map(
                    (line, i) => (
                      <p key={i} className="mt-1.5 text-xs leading-snug text-amber-900/90">
                        · {line}
                      </p>
                    ),
                  )}
                </div>
                <Link
                  to={`/admin/reservations?${q.toString()}`}
                  className="shrink-0 rounded-lg bg-ink-900 px-3 py-1.5 text-xs text-white"
                >
                  去处理
                </Link>
              </li>
            );
          })}
        </ul>
        {!loading && res.length === 0 && <p className="mt-2 text-sm text-stone-400">暂无预定确认预订</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-stone-800">待收订金</h2>
        <ul className="mt-2 space-y-2">
          {dep.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <span className="font-medium">{d.customer_phone}</span>
                <span className="text-stone-600"> · ¥{d.amount_yuan.toFixed(2)}</span>
                <div className="text-xs text-stone-500">
                  {depLabel(d.status)}
                  {d.reservation_id ? ` · 关联预订 #${d.reservation_id}` : ""}
                </div>
                <p className="mt-1.5 text-xs leading-snug text-amber-900/90">· 待收取订金：请到订金页确认到账或作废。</p>
              </div>
              <Link to={`/admin/deposits?focus=${d.id}`} className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-xs">
                去处理
              </Link>
            </li>
          ))}
        </ul>
        {!loading && dep.length === 0 && <p className="mt-2 text-sm text-stone-400">暂无待收订金</p>}
      </section>
    </div>
  );
}
