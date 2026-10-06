export type PromotionSmsRecipient = {
  phone: string;
  display_name: string;
  source: string;
};

export type PromotionSmsMessageItem = {
  id: number;
  subject: string;
  content: string;
  status: string;
  recipients: PromotionSmsRecipient[];
  filter_snapshot: Record<string, unknown> | null;
  created_by_username: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type PromotionSmsMessageListResponse = {
  items: PromotionSmsMessageItem[];
  total: number;
  page: number;
  page_size: number;
};

export type PromotionSmsQueueItemOut = {
  id: number;
  phone: string;
  display_name: string;
  status: string;
  reason: string;
  sent_at: string | null;
};

export type PromotionSmsQueueResponse = {
  items: PromotionSmsQueueItemOut[];
  total: number;
};

export type PromotionSmsRecipientCandidate = {
  phone: string;
  display_name: string;
  reservation_count: number;
  last_booking_date: string | null;
};

export type PromotionSmsRecipientSearchResponse = {
  items: PromotionSmsRecipientCandidate[];
  total: number;
  page: number;
  page_size: number;
};

export type PromotionSmsSendLimits = {
  promotion_max_recipients: number;
  staff_max_recipients: number;
};
