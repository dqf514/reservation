export type OperatingPeriodItem = {
  period_key: string;
  label: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  color: string;
  icon: string;
  enabled: boolean;
};

export type OperatingPeriodsDTO = {
  periods: OperatingPeriodItem[];
};

export const DEFAULT_OPERATING_PERIODS: OperatingPeriodsDTO = {
  periods: [
    {
      period_key: "lunch",
      label: "午餐",
      start_time: "11:00",
      end_time: "14:30",
      sort_order: 0,
      color: "#f97316",
      icon: "午",
      enabled: true,
    },
    {
      period_key: "afternoon",
      label: "下午茶",
      start_time: "14:30",
      end_time: "17:00",
      sort_order: 1,
      color: "#f59e0b",
      icon: "茶",
      enabled: true,
    },
    {
      period_key: "dinner",
      label: "晚餐",
      start_time: "17:00",
      end_time: "22:00",
      sort_order: 2,
      color: "#ef4444",
      icon: "晚",
      enabled: true,
    },
  ],
};
