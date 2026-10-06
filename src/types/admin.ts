/** 餐位主数据（与 /api/admin/dining-tables 一致） */
export type DiningTableItem = {
  id: number;
  code: string;
  label: string;
  shape: string;
  pos_x: number;
  pos_y: number;
  pos_size: number;
  sort_order: number;
  capacity: number;
  is_active: boolean;
};

export type DashboardSummary = {
  pending_confirm_reservations: number;
  pending_deposits: number;
  customers_total: number;
  reservations_today: number;
};

export type ReservationAdminItem = {
  id: number;
  customer_name: string;
  phone: string;
  reservation_date: string;
  time_slot: string;
  party_size: number;
  note: string | null;
  flow_status: string;
  tags: string;
  table_code: string | null;
  table_label: string | null;
  table_codes?: string[];
  table_labels?: string[];
  reservation_count?: number | null;
  created_at: string | null;
  assigned_staff_id?: number | null;
  assigned_staff_name?: string | null;
  /** 仅待办接口返回：展示原因与高亮锚点 */
  todo_reasons?: string[] | null;
  todo_highlight?: string | null;
};

export type CustomerItem = {
  id: number;
  phone: string;
  display_name: string;
  last_seen_name: string;
  alias_names: string[];
  email: string | null;
  tags: string;
  note: string | null;
  reservation_count: number;
};

export type DepositItem = {
  id: number;
  reservation_id: number | null;
  customer_phone: string;
  amount_yuan: number;
  status: string;
  note: string | null;
  paid_at: string | null;
  created_at: string | null;
};

export const FLOW_OPTIONS = [
  { v: "waiting", l: "待处理" },
  { v: "confirmed", l: "已确认" },
  { v: "arrived", l: "入座" },
  { v: "left", l: "离席" },
  { v: "cancelled", l: "已取消" },
] as const;

export const DEPOSIT_STATUS = [
  { v: "pending", l: "待付" },
  { v: "paid", l: "已付" },
  { v: "refunded", l: "已退" },
  { v: "cancelled", l: "作废" },
] as const;

export type CalendarPeriodCount = {
  period_key: string;
  label: string;
  count: number;
  party: number;
};

export type CalendarDayCount = {
  date: string;
  count: number;
  party: number;
  by_period: CalendarPeriodCount[];
};

export type CalendarMonthResponse = {
  year: number;
  month: number;
  days: CalendarDayCount[];
  month_total_count: number;
  month_total_party: number;
};

export type CalendarMonthlyTrendItem = {
  ym: string;
  label: string;
  count: number;
  party: number;
};

export type CalendarMonthlyTrendResponse = {
  items: CalendarMonthlyTrendItem[];
};

export type CustomerListResponse = {
  items: CustomerItem[];
  total: number;
  page: number;
  page_size: number;
};

export type CustomerProfileResponse = {
  customer: CustomerItem | null;
  phone: string;
  reservation_count: number;
  reservations: ReservationAdminItem[];
};

export type DepositListResponse = {
  items: DepositItem[];
  total: number;
  page: number;
  page_size: number;
};
