import { useEffect, useRef, useState } from "react";

export type TableScopeOption = {
  value: string;
  label: string;
  /** 类型角标，如「房间」 */
  badge?: string;
  /** 总人数 */
  total?: number;
};

interface Props {
  value: string;
  options: TableScopeOption[];
  onChange: (value: string) => void;
  allLabel?: string;
  allTotal?: number;
  title?: string;
  className?: string;
}

function formatTotal(total: number | undefined): string {
  const n = Number(total ?? 0);
  return `${n} 人`;
}

/**
 * 「统计范围」下拉框。
 *
 * 原生 <select> 的 <option> 无法对局部文字单独设置颜色，
 * 因此这里用按钮 + 浮层自绘，让「总人数」可以用更淡的字体颜色展示。
 */
export function TableScopeSelect({
  value,
  options,
  onChange,
  allLabel = "全店",
  allTotal,
  title,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node | null;
      if (ref.current && t && ref.current.contains(t)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = value ? options.find((o) => o.value === value) : null;

  const rowCls = (active: boolean) =>
    `flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
      active ? "bg-brand-coral/10 text-stone-900" : "text-stone-700 hover:bg-stone-50"
    }`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={title}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white py-1.5 pl-3 pr-2 text-sm font-medium text-stone-800 hover:border-stone-300 focus:border-brand-coral focus:outline-none focus:ring-2 focus:ring-brand-coral/25"
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate">{current ? current.label : allLabel}</span>
          {current?.badge && (
            <span className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-1.5 text-[10px] font-medium leading-4 text-indigo-700">
              {current.badge}
            </span>
          )}
          <span className="shrink-0 text-xs font-normal tabular-nums text-stone-400">
            {formatTotal(current ? current.total : allTotal)}
          </span>
        </span>
        <span className="shrink-0 text-[10px] text-stone-400" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="统计范围"
          className="absolute right-0 z-50 mt-1 max-h-72 w-[min(22rem,78vw)] overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-xl"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === ""}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={rowCls(value === "")}
          >
            <span className="truncate">{allLabel}</span>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-stone-400">
              {formatTotal(allTotal)}
            </span>
          </button>
          <div className="my-1 h-px bg-stone-100" />
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={rowCls(o.value === value)}
            >
              <span className="truncate">{o.label}</span>
              {o.badge && (
                <span className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-1.5 text-[10px] font-medium leading-4 text-indigo-700">
                  {o.badge}
                </span>
              )}
              <span className="ml-auto shrink-0 text-xs tabular-nums text-stone-400">
                {formatTotal(o.total)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
