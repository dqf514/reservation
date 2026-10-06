/** 与订单打印等一致：手机号脱敏（与后端 _mask_phone 口径一致） */
export function maskPhoneForDisplay(phone: string | null | undefined): string {
  const p = (phone ?? "").trim();
  if (p.length < 7) return p || "—";
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}
