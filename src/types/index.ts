export type TableStatus =
  | "empty"
  | "reserved"
  | "unavailable"
  | "pending_confirm"
  | "final_confirm"
  | "arrived";

export interface TableNode {
  id: string;
  /** 数据库餐位主键，管理端拖拽保存坐标用 */
  dbId?: number;
  label: string;
  /** 0–100 相对平面图容器 */
  x: number;
  y: number;
  size: number;
  shape: "circle" | "square" | "rect_h" | "rect_v";
  status: TableStatus;
  time?: string;
  ratio?: string;
  capacity?: number;
  guestHint?: string;
  isLocked?: boolean;
  lockedBy?: string | null;
}

export type GuestFlowStatus =
  | "pending_confirm"
  | "waiting"
  | "confirmed"
  | "arrived"
  | "seated"
  | "left"
  | "noshow"
  | "cancelled";

export interface GuestCard {
  id: string;
  name: string;
  reservation_date?: string;
  time: string;
  tags: string[];
  party: string;
  table?: string;
  flow: GuestFlowStatus;
  phone?: string;
  note?: string | null;
  sms_confirm_sent?: boolean;
  reservation_count?: number;
}

// 运营时段的标识（可增删改，因此用 string 表示 period_key）
export type ServicePeriod = string;
