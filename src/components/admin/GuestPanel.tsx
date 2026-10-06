import { useMemo, useState } from "react";
import { billiardHistoryBadgeClass } from "@/lib/billiardHistoryBadge";
import type { GuestCard, GuestFlowStatus } from "@/types";

const FLOW_LABEL: Partial<Record<GuestFlowStatus, string>> = {
  waiting: "待处理",
  confirmed: "已确认",
  arrived: "入座",
  left: "离席",
  cancelled: "已取消",
};

const FLOW_ORDER: GuestFlowStatus[] = [
  "waiting",
  "confirmed",
  "arrived",
  "left",
  "cancelled",
];

interface Props {
  guests: GuestCard[];
  query: string;
  onQueryChange?: (value: string) => void;
  onSendSms?: (guest: GuestCard) => void;
  onQuickCancel?: (guest: GuestCard) => void;
  onQuickArrive?: (guest: GuestCard) => void;
  onQuickEdit?: (guest: GuestCard) => void;
  smsBusyGuestId?: string | null;
}

export function GuestPanel({
  guests,
  query,
  onQueryChange,
  onSendSms,
  onQuickCancel,
  onQuickArrive,
  onQuickEdit,
  smsBusyGuestId,
}: Props) {
  const [open, setOpen] = useState<GuestFlowStatus | "all">("all");
  const q = query.trim().toLowerCase();

  function isPastReservation(g: GuestCard): boolean {
    const d = (g.reservation_date || "").trim();
    const t = (g.time || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) return false;
    const dt = new Date(`${d}T${t}:00`);
    if (Number.isNaN(dt.getTime())) return false;
    return dt.getTime() < Date.now();
  }

  const filtered = useMemo(() => {
    return guests.filter((g) => {
      const hit =
        !q ||
        g.name.toLowerCase().includes(q) ||
        (g.phone && g.phone.toLowerCase().includes(q)) ||
        (g.table && g.table.toLowerCase().includes(q));
      return hit;
    });
  }, [guests, q]);

  const counts = useMemo(() => {
    const c: Record<GuestFlowStatus, number> = {
      pending_confirm: 0,
      waiting: 0,
      confirmed: 0,
      arrived: 0,
      seated: 0,
      left: 0,
      noshow: 0,
      cancelled: 0,
    };
    for (const g of filtered) c[g.flow] += 1;
    return c;
  }, [filtered]);

  const allCount = filtered.length;

  const list =
    open === "all"
      ? filtered
      : filtered.filter((g) => g.flow === open);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-stone-200 bg-white lg:max-w-[420px]">
      <div className="border-b border-stone-100 p-3">
        <p className="text-xs font-medium text-stone-500">客人列表</p>
        <div className="mt-2">
          <label className="relative block">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400">⌕</span>
            <input
              value={query}
              onChange={(e) => onQueryChange?.(e.target.value)}
              placeholder="搜索姓名、电话"
              className="w-full rounded-lg border border-stone-200 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-brand-coral/30"
            />
          </label>
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap gap-1.5 border-b border-stone-100 p-2">
          <button
            type="button"
            onClick={() => setOpen("all")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              open === "all" ? "bg-ink-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            全部
            <span className="ml-1 tabular-nums opacity-80">{allCount}</span>
          </button>
          {FLOW_ORDER.map((flow) => {
            const n = counts[flow];
            const active = open === flow;
            return (
              <button
                key={flow}
                type="button"
                onClick={() => setOpen(flow)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? flow === "pending_confirm"
                      ? "bg-red-600 text-white"
                      : "bg-ink-900 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {FLOW_LABEL[flow] ?? flow}
                <span className="ml-1 tabular-nums opacity-80">{n}</span>
              </button>
            );
          })}
        </div>
        <ul className="flex-1 space-y-2 overflow-y-scroll p-2">
          {list.map((g) => (
            <li key={g.id}>
              <div
                className="w-full rounded-xl border border-stone-200 bg-cream-50/80 p-3 text-left text-sm shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">
                      <span className="inline-block max-w-full align-bottom">{g.name}</span>
                      {g.phone && (
                        <span className="ml-1 text-xs font-normal text-stone-500">
                          {typeof g.reservation_count === "number" && g.reservation_count > 0 ? (
                            <span
                              title={`历史预订 ${g.reservation_count} 次（不含本条）`}
                              className={`mr-1 align-middle ${billiardHistoryBadgeClass(g.reservation_count)}`}
                            >
                              {g.reservation_count > 99 ? "99+" : g.reservation_count}
                            </span>
                          ) : null}
                          ({g.phone.slice(-4)})
                        </span>
                      )}
                      <span className="ml-1 shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] text-stone-600 ring-1 ring-stone-200">
                        {FLOW_LABEL[g.flow] ?? g.flow}
                      </span>
                    </p>
                    <p className="text-xs text-stone-500">
                      {g.time} · {g.party} 人
                      {g.table ? ` · ${g.table}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {/^\d+$/.test(g.id) && (
                      <>
                        <button
                          type="button"
                          disabled={["arrived", "seated", "left", "cancelled"].includes(g.flow)}
                          onClick={() => onQuickArrive?.(g)}
                          className="whitespace-nowrap rounded-lg border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-[11px] text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          入席
                        </button>
                        <button
                          type="button"
                          disabled={["arrived", "seated", "left", "cancelled"].includes(g.flow)}
                          onClick={() => onQuickCancel?.(g)}
                          className="whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-1.5 py-1 text-[11px] text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickEdit?.(g)}
                          className="whitespace-nowrap rounded-lg border border-stone-200 bg-white px-1.5 py-1 text-[11px] text-stone-700"
                        >
                          编辑
                        </button>
                      </>
                    )}
                    {g.sms_confirm_sent ? (
                      <span
                        title="已发送确认短信"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200"
                      >
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                          <path d="M2.94 5.5A2.5 2.5 0 0 1 5.44 3h9.12a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H5.44a2.5 2.5 0 0 1-2.5-2.5v-9Zm2.5-.5a.5.5 0 0 0-.32.89l4.56 3.8a.5.5 0 0 0 .64 0l4.56-3.8a.5.5 0 0 0-.32-.89H5.44Z" />
                        </svg>
                      </span>
                    ) : (
                      (() => {
                        const isPast = isPastReservation(g);
                        const canSend =
                          /^\d+$/.test(g.id) &&
                          /^1\d{10}$/.test((g.phone || "").trim()) &&
                          !["left", "cancelled"].includes(g.flow) &&
                          !isPast;
                        if (!canSend) return null;
                        return (
                          <button
                            type="button"
                            disabled={smsBusyGuestId === g.id}
                            onClick={() => onSendSms?.(g)}
                            className="whitespace-nowrap rounded-lg border border-stone-200 bg-white px-1.5 py-1 text-[11px] text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {smsBusyGuestId === g.id ? "发送中…" : "短信"}
                          </button>
                        );
                      })()
                    )}
                  </div>
                </div>
                {g.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-medium text-stone-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {g.note && <p className="mt-2 text-xs text-stone-600">备注：{g.note}</p>}
              </div>
            </li>
          ))}
          {list.length === 0 && (
            <li className="py-8 text-center text-xs text-stone-400">暂无匹配的客人</li>
          )}
        </ul>
      </div>
    </aside>
  );
}
