export type SmsSettingsDTO = {
  enabled: boolean;
  sp_id: string;
  password_set: boolean;
  send_url: string;
  balance_url: string;
  notify_public_submit: boolean;
  notify_admin_create: boolean;
  notify_cancel: boolean;
  signature_prefix: string;
  template_success: string;
  template_cancel: string;
  promotion_sms_max_recipients: number;
  promotion_sms_staff_max_recipients: number;
};
