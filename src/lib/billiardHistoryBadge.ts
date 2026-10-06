/** 桌台客人列表 / 记录列表：历史次数小徽标（台球风格，白字；>10 为金色球） */
export function billiardHistoryBadgeClass(count: number): string {
  const base =
    "inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.18)]";
  if (count > 10) {
    return `${base} bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 ring-1 ring-amber-800/50`;
  }
  const byNum: Record<number, string> = {
    1: "bg-yellow-500 ring-1 ring-yellow-700/45",
    2: "bg-blue-600 ring-1 ring-blue-900/40",
    3: "bg-red-600 ring-1 ring-red-900/40",
    4: "bg-violet-600 ring-1 ring-violet-900/40",
    5: "bg-orange-500 ring-1 ring-orange-800/45",
    6: "bg-emerald-600 ring-1 ring-emerald-900/40",
    7: "bg-rose-900 ring-1 ring-rose-950/50",
    8: "bg-zinc-900 ring-1 ring-black/50",
    9: "bg-amber-500 ring-1 ring-amber-800/45",
    10: "bg-sky-700 ring-1 ring-sky-950/45",
  };
  return `${base} ${byNum[count] ?? "bg-stone-600 ring-1 ring-stone-900/40"}`;
}
