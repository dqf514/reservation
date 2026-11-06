export type TableStatus =
  | "empty"
  | "reserved"
  | "unavailable"
  | "pending_confirm"
  | "final_confirm"
  | "arrived";

/** 房间型桌台在同一时段的座位占用（预订 + 散客合并） */
export interface RoomUsage {
  capacity: number;
  reserved: number;
  seated: number;
  used: number;
  free: number;
  reservations: number;
  occupancies: number;
  parties: number;
  /** 全天合计（各时段相加） */
  day_used: number;
  day_parties: number;
  /** 时段峰值 */
  peak_used: number;
  peak_period: string;
  /** 当前统计口径对应的时段（"all" 时取峰值时段） */
  scope_period: string;
  by_period: Array<{
    period_key: string;
    label: string;
    reserved: number;
    seated: number;
    used: number;
    parties: number;
    reservations: number;
    occupancies: number;
  }>;
}

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
  /** standard=普通桌（一桌一单）；room=房间/包厢（同时段共享座位池） */
  tableType?: "standard" | "room";
  /** 房间型桌台的聚合占用情况 */
  roomUsage?: RoomUsage;
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
