export interface BrandingDTO {
  company_name: string;
  app_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  login_title: string;
  login_subtitle: string;
  login_bg_url: string | null;
  login_primary_color: string;
  login_accent_color: string;
  login_card_opacity: number;
  login_footer_text: string;
  login_show_powered: boolean;
  splash_enabled: boolean;
  splash_image_url: string | null;
  splash_seconds: number;
  splash_for_customer: boolean;
  splash_for_staff: boolean;
  customer_hero_title: string;
  customer_hero_subtitle: string;
  customer_primary_color: string;
}
