import { useCallback, useRef, useState } from "react";
import type { TableNode } from "@/types";
import { clientPointToContainerPercent } from "@/lib/floorCoords";
import { tableStatusClasses } from "@/lib/tableStyles";

const DRAG_THRESHOLD_PX = 6;

interface Props {
  tables: TableNode[];
  selectedId: string | null;
  selectedIds?: string[];
  onSelect: (id: string) => void;
  /** 管理端：拖拽桌台中心点，松手后保存坐标 */
  draggable?: boolean;
  onPositionCommit?: (dbId: number, x: number, y: number) => void | Promise<void>;
  /** 弹窗等场景：较矮画布 */
  compact?: boolean;
}

export function FloorCanvas({
  tables,
  selectedId,
  selectedIds,
  onSelect,
  draggable,
  onPositionCommit,
  compact,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    dbId: number;
    id: string;
    startPx: number;
    startPy: number;
    hasDragIntent: boolean;
  } | null>(null);
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const savingRef = useRef(false);

  const displayXY = useCallback(
    (t: TableNode) => {
      if (preview && preview.id === t.id) return { x: preview.x, y: preview.y };
      return { x: t.x, y: t.y };
    },
    [preview],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setPreview(null);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId || !containerRef.current) return;
      const dist = Math.hypot(e.clientX - d.startPx, e.clientY - d.startPy);
      if (dist > DRAG_THRESHOLD_PX) d.hasDragIntent = true;
      if (!d.hasDragIntent) return;
      const rect = containerRef.current.getBoundingClientRect();
      const { x, y } = clientPointToContainerPercent(rect, e.clientX, e.clientY);
      setPreview({ id: d.id, x, y });
    },
    [],
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent<HTMLButtonElement>, t: TableNode) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const wasDrag = d.hasDragIntent;
      const dbId = d.dbId;
      dragRef.current = null;

      if (wasDrag && draggable && onPositionCommit && containerRef.current && !savingRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const { x, y } = clientPointToContainerPercent(rect, e.clientX, e.clientY);
        savingRef.current = true;
        try {
          await onPositionCommit(dbId, x, y);
        } finally {
          savingRef.current = false;
        }
        setPreview(null);
        return;
      }

      setPreview(null);
      if (!wasDrag) {
        onSelect(t.id);
      }
    },
    [draggable, onPositionCommit, onSelect],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      endDrag();
    },
    [endDrag],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, t: TableNode) => {
      if (!draggable || !onPositionCommit || t.dbId == null || savingRef.current) {
        return;
      }
      e.preventDefault();
      dragRef.current = {
        pointerId: e.pointerId,
        dbId: t.dbId,
        id: t.id,
        startPx: e.clientX,
        startPy: e.clientY,
        hasDragIntent: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [draggable, onPositionCommit],
  );

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-50 to-white shadow-inner ${
        compact ? "min-h-[320px] max-h-[min(62vh,500px)]" : "min-h-[420px]"
      }`}
      role="application"
      aria-label="餐厅平面图"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* 中央过道示意 */}
      <div className="pointer-events-none absolute left-[18%] top-[22%] h-[52%] w-[52%] rounded-[40%] border border-dashed border-stone-200/80 bg-stone-100/30" />

      <div ref={containerRef} className="absolute inset-3">
        {tables.map((t) => {
          const active = selectedId === t.id || Boolean(selectedIds?.includes(t.id));
          const base = tableStatusClasses(t.status);
          const shape =
            t.shape === "circle"
              ? "rounded-full aspect-square"
              : t.shape === "rect_h"
                ? "rounded-2xl aspect-[1.6/1]"
                : t.shape === "rect_v"
                  ? "rounded-2xl aspect-[1/1.6]"
                  : "rounded-2xl aspect-square";
          const { x, y } = displayXY(t);
          const canDrag = Boolean(draggable && onPositionCommit && t.dbId != null);
          const capacityText = t.ratio || (t.capacity ? `0/${t.capacity}` : "");
          const isRoom = t.tableType === "room";
          const usage = t.roomUsage;
          const titleParts: string[] = [];
          if (t.isLocked) titleParts.push(`已锁定（${t.lockedBy || "未知"}）`);
          if (isRoom && usage) {
            titleParts.push(
              `${t.label} 房间：已占用 ${usage.used}/${usage.capacity} 座（预订 ${usage.reserved} · 散客 ${usage.seated}）· ${usage.parties} 组`,
            );
            if (usage.day_used && usage.day_used !== usage.used) {
              titleParts.push(`全天合计 ${usage.day_used} 人`);
            }
            for (const p of usage.by_period ?? []) {
              if (p.used <= 0) continue;
              titleParts.push(`${p.label}：${p.used}/${usage.capacity}（${p.parties} 组）`);
            }
          }
          const titleText = titleParts.length ? titleParts.join("\n") : undefined;
          return (
            <button
              key={t.id}
              type="button"
              aria-grabbed={canDrag && preview?.id === t.id ? true : undefined}
              onClick={canDrag ? undefined : () => onSelect(t.id)}
              onPointerDown={(e) => handlePointerDown(e, t)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => void handlePointerUp(e, t)}
              onPointerCancel={handlePointerCancel}
              className={`absolute flex flex-col items-center justify-center p-1 text-center transition-transform hover:z-20 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral ${shape} ${base} ${
                active ? "ring-2 ring-brand-coral ring-offset-2" : ""
              } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${preview?.id === t.id ? "z-30 scale-105 shadow-lg" : ""}`}
              title={titleText}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${t.size}%`,
                height: "auto",
                transform: "translate(-50%, -50%)",
                touchAction: canDrag ? "none" : undefined,
              }}
            >
              {t.isLocked && (
                <span className="pointer-events-none absolute -right-1 -top-1 rounded-full border border-amber-300 bg-amber-100 px-1 text-[10px] font-semibold leading-4 text-amber-800 shadow-sm">
                  锁
                </span>
              )}
              {isRoom && (
                <span className="pointer-events-none absolute -left-1 -top-1 rounded-full border border-indigo-300 bg-indigo-100 px-1 text-[10px] font-semibold leading-4 text-indigo-700 shadow-sm">
                  房
                </span>
              )}
              <span className="max-w-[90%] whitespace-nowrap overflow-hidden text-ellipsis text-[10px] font-bold leading-tight sm:text-[11px]">
                {t.label}
              </span>
              {t.time && (
                <span className="whitespace-nowrap text-[9px] opacity-90 sm:text-[10px]">{t.time}</span>
              )}
              {t.guestHint && (
                <span className="max-w-full truncate whitespace-nowrap text-[9px] font-medium opacity-90 sm:text-[10px]">
                  {t.guestHint}
                </span>
              )}
              {capacityText && (
                <span className="whitespace-nowrap text-[9px] opacity-80 sm:text-[10px]">
                  {capacityText}
                </span>
              )}
              {active && (
                <span className="mt-0.5 rounded-full bg-brand-coral/15 px-1.5 text-[9px] font-semibold text-brand-coral">
                  已选
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
