/** 排除易混淆的 0/O、1/I/L 等，提升可读性 */
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CAPTCHA_LENGTH = 5;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 生成随机验证码（大写字母与数字，长度见 CAPTCHA_LENGTH） */
export function randomCaptchaCode(): string {
  let out = "";
  for (let i = 0; i < CAPTCHA_LENGTH; i += 1) {
    out += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return out;
}

export type CaptchaRng = () => number;

/** 与某条验证码绑定的确定性随机数，用于画布绘制（避免闪烁、StrictMode 双渲染不一致） */
export function captchaRngForCode(code: string): CaptchaRng {
  return mulberry32(seedFromString(code.toUpperCase()));
}
