import { useEffect, useRef } from "react";
import { captchaRngForCode } from "@/lib/captcha";

type Props = {
  code: string;
  width?: number;
  height?: number;
  className?: string;
};

function hsla(rnd: () => number, a: number): string {
  const h = Math.floor(rnd() * 360);
  const s = 55 + Math.floor(rnd() * 35);
  const l = 28 + Math.floor(rnd() * 22);
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/**
 * Canvas 图形验证码：彩色字符、随机旋转与位移、干扰线与噪点。
 * 外观由 code 经种子随机确定，同一 code 重绘结果一致。
 */
export function CaptchaImage({ code, width = 132, height = 44, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !code) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = width;
    const h = height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const rnd = captchaRngForCode(code);
    const upper = code.toUpperCase();
    const chars = upper.split("");

    // 背景渐变 + 轻微纹理感
    const g0 = rnd() * 80 + 180;
    const g1 = rnd() * 80 + 200;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, `hsl(${g0}, 18%, ${88 + rnd() * 8}%)`);
    grad.addColorStop(0.45, `hsl(${g1}, 22%, ${90 + rnd() * 6}%)`);
    grad.addColorStop(1, `hsl(${g0 + 40}, 15%, ${86 + rnd() * 10}%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 干扰曲线
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeStyle = hsla(rnd, 0.35 + rnd() * 0.25);
      ctx.beginPath();
      const sx = rnd() * w;
      const sy = rnd() * h;
      ctx.moveTo(sx, sy);
      for (let j = 0; j < 4; j += 1) {
        ctx.quadraticCurveTo(rnd() * w, rnd() * h, rnd() * w, rnd() * h);
      }
      ctx.stroke();
    }

    // 直线干扰
    for (let i = 0; i < 10; i += 1) {
      ctx.strokeStyle = hsla(rnd, 0.22 + rnd() * 0.2);
      ctx.beginPath();
      ctx.moveTo(rnd() * w, rnd() * h);
      ctx.lineTo(rnd() * w, rnd() * h);
      ctx.stroke();
    }

    // 噪点
    for (let i = 0; i < 55; i += 1) {
      ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.22})`;
      const px = rnd() * w;
      const py = rnd() * h;
      ctx.fillRect(px, py, rnd() * 2 + 0.5, rnd() * 2 + 0.5);
    }
    for (let i = 0; i < 25; i += 1) {
      ctx.fillStyle = hsla(rnd, 0.15 + rnd() * 0.15);
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, rnd() * 1.8 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    const slot = w / (chars.length + 0.6);
    const baseFont = 17 + Math.floor(rnd() * 5);

    chars.forEach((ch, i) => {
      const cx = slot * (i + 0.35) + (rnd() - 0.5) * 6;
      const cy = h / 2 + (rnd() - 0.5) * 9;
      const rot = (rnd() - 0.5) * 0.95;
      const fontSize = baseFont + Math.floor((rnd() - 0.5) * 4);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.font = `800 ${fontSize}px ui-monospace, "Cascadia Code", Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hsla(rnd, 0.88 + rnd() * 0.1);
      ctx.shadowColor = "rgba(0,0,0,0.12)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = rnd() * 1.2 - 0.6;
      ctx.shadowOffsetY = rnd() * 1.2 - 0.6;
      ctx.fillText(ch, 0, 0);
      // 细描边增强对比
      ctx.lineWidth = 0.35;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.strokeText(ch, 0, 0);
      ctx.restore();
    });
  }, [code, width, height]);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
      role="presentation"
    />
  );
}
