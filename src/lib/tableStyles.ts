import type { TableStatus } from "@/types";

export const STATUS_LABEL: Record<TableStatus, string> = {
  empty: "空桌中",
  reserved: "已预订",
  unavailable: "不可用",
  pending_confirm: "待确认",
  final_confirm: "最终确认",
  arrived: "已到店",
};

/** 桌台节点样式：与参考图例一致 */
export function tableStatusClasses(status: TableStatus): string {
  switch (status) {
    case "empty":
      return "bg-white border-2 border-stone-300 text-stone-700 shadow-sm";
    case "reserved":
      return "bg-white border-2 border-blue-500 text-blue-800 shadow-sm";
    case "unavailable":
      return "bg-stone-200 border-2 border-stone-400 text-stone-500 opacity-80 [background-image:repeating-linear-gradient(135deg,transparent,transparent_3px,rgba(0,0,0,.06)_3px,rgba(0,0,0,.06)_6px)]";
    case "pending_confirm":
      return "bg-amber-50 border-2 border-dashed border-red-500 text-red-800 shadow-sm";
    case "final_confirm":
      return "bg-blue-50 border-2 border-blue-600 text-blue-900 shadow-sm ring-1 ring-blue-300/80";
    case "arrived":
      return "bg-brand-coral border-2 border-brand-coral text-white shadow-md";
    default:
      return "bg-white border border-stone-200";
  }
}

export const LEGEND_ITEMS: { status: TableStatus }[] = [
  { status: "empty" },
  { status: "reserved" },
  { status: "unavailable" },
  { status: "arrived" },
];
