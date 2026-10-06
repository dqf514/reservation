from __future__ import annotations

from .models import BrandingSettings
from .schemas import BrandingPublic


def public_url(filename: str | None) -> str | None:
    if not filename:
        return None
    fn = filename.strip()
    if not fn:
        return None
    if fn.startswith("/uploads/"):
        return fn
    return f"/uploads/{fn}"


def to_public(b: BrandingSettings) -> BrandingPublic:
    return BrandingPublic(
        company_name=b.company_name,
        app_name=b.app_name,
        logo_url=public_url(b.logo_path),
        favicon_url=public_url(b.favicon_path),
        login_title=b.login_title,
        login_subtitle=b.login_subtitle,
        login_bg_url=public_url(b.login_bg_path),
        login_primary_color=b.login_primary_color,
        login_accent_color=b.login_accent_color,
        login_card_opacity=float(b.login_card_opacity),
        login_footer_text=b.login_footer_text,
        login_show_powered=bool(b.login_show_powered),
        splash_enabled=bool(b.splash_enabled),
        splash_image_url=public_url(b.splash_image_path),
        splash_seconds=float(b.splash_seconds),
        splash_for_customer=bool(b.splash_for_customer),
        splash_for_staff=bool(b.splash_for_staff),
        customer_hero_title=b.customer_hero_title,
        customer_hero_subtitle=b.customer_hero_subtitle,
        customer_primary_color=b.customer_primary_color,
    )


def get_or_create_branding(db) -> BrandingSettings:
    b = db.query(BrandingSettings).filter(BrandingSettings.id == 1).first()
    if b:
        return b
    b = BrandingSettings(id=1)
    db.add(b)
    db.commit()
    db.refresh(b)
    return b
