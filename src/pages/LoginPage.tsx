import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, assetUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";
import { CaptchaImage } from "@/components/CaptchaImage";
import { CAPTCHA_LENGTH, randomCaptchaCode } from "@/lib/captcha";

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11);
}

function formatPhoneDisplay(v: string): string {
  const d = onlyDigits(v);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
}

export function LoginPage() {
  const { branding } = useBranding();
  const { login, loginSms } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/admin", [sp]);

  const [mode, setMode] = useState<"password" | "sms">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [captcha, setCaptcha] = useState(() => randomCaptchaCode());
  const [captchaInput, setCaptchaInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (mode === "password" && captchaInput.trim().toUpperCase() !== captcha) {
      setErr("图形验证码不正确");
      setCaptcha(randomCaptchaCode());
      setCaptchaInput("");
      return;
    }
    setBusy(true);
    try {
      if (mode === "password") {
        await login(username.trim(), password);
      } else {
        await loginSms(onlyDigits(phoneDisplay), smsCode.trim());
      }
      nav(next, { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendSmsCode() {
    setErr(null);
    if (!/^1\d{10}$/.test(onlyDigits(phoneDisplay))) {
      setErr("请输入正确手机号");
      return;
    }
    setSendingCode(true);
    try {
      await apiFetch("/api/auth/sms/send-code", {
        method: "POST",
        json: { phone: onlyDigits(phoneDisplay), purpose: "staff_login" },
      });
      setCountdown(60);
      const timer = window.setInterval(() => {
        setCountdown((v) => {
          if (v <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "验证码发送失败");
    } finally {
      setSendingCode(false);
    }
  }

  if (!branding) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-stone-900 text-stone-200">加载中…</div>;
  }

  const bg = assetUrl(branding.login_bg_url ?? undefined);
  const logo = assetUrl(branding.logo_url ?? undefined);
  const cardOpacity = Math.min(Math.max(branding.login_card_opacity, 0.35), 1);
  // 增强卡片可读性：避免背景“占比过大”
  const cardBgAlpha = Math.min(0.24, Math.max(0.12, cardOpacity * 0.18));

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      {bg ? (
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background: `linear-gradient(145deg, ${branding.login_primary_color}, ${branding.login_accent_color})`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-4 py-10">
        <div
          className="rounded-3xl border border-white/25 p-6 shadow-2xl backdrop-blur-md sm:p-8"
          style={{
            backgroundColor: `rgba(255,255,255,${cardBgAlpha})`,
            color: "#fafaf9",
          }}
        >
          <div className="mb-6 flex flex-col items-center text-center">
            {logo ? (
              <img src={logo} alt="" className="mb-4 h-14 w-auto object-contain drop-shadow" />
            ) : (
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg"
                style={{ backgroundColor: branding.login_accent_color }}
              >
                {branding.app_name.slice(0, 1)}
              </div>
            )}
            <h1 className="font-display text-2xl font-semibold tracking-tight">{branding.login_title}</h1>
            {branding.company_name ? (
              <p className="mt-1 text-xs text-white/70">{branding.company_name}</p>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/15 p-1">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={`rounded-lg py-2 text-xs font-semibold ${mode === "password" ? "bg-white/90 text-stone-900" : "text-white/80"}`}
              >
                账号密码
              </button>
              <button
                type="button"
                onClick={() => setMode("sms")}
                className={`rounded-lg py-2 text-xs font-semibold ${mode === "sms" ? "bg-white/90 text-stone-900" : "text-white/80"}`}
              >
                手机验证码
              </button>
            </div>
            {mode === "password" ? (
              <>
                <label className="block text-sm">
                  <span className="text-white/80">用户名</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="mt-1 w-full rounded-xl border border-white/30 bg-black/20 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-white/40 focus:border-white/60"
                    placeholder="admin"
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-white/80">密码</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-xl border border-white/30 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-white/60"
                    required
                  />
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="block text-sm">
                    <span className="text-white/80">图形验证码</span>
                    <input
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value)}
                      maxLength={CAPTCHA_LENGTH}
                      autoComplete="off"
                      className="mt-1 w-full rounded-xl border border-white/30 bg-black/20 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-white/40 focus:border-white/60"
                      placeholder={`输入${CAPTCHA_LENGTH}位`}
                    />
                  </label>
                  <button
                    type="button"
                    title="点击换一张"
                    onClick={() => setCaptcha(randomCaptchaCode())}
                    className="mt-6 flex flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-white/95 p-0.5 shadow-inner"
                  >
                    <CaptchaImage code={captcha} width={136} height={48} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="block text-sm">
                  <span className="text-white/80">手机号</span>
                  <input
                    value={phoneDisplay}
                    onChange={(e) => setPhoneDisplay(formatPhoneDisplay(e.target.value))}
                    inputMode="numeric"
                    maxLength={13}
                    className="mt-1 w-full rounded-xl border border-white/30 bg-black/20 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-white/40 focus:border-white/60"
                    placeholder="11位手机号"
                    required
                  />
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="block text-sm">
                    <span className="text-white/80">短信验证码</span>
                    <input
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const form = e.currentTarget.form;
                          form?.requestSubmit();
                        }
                      }}
                      inputMode="numeric"
                      maxLength={6}
                      className="mt-1 w-full rounded-xl border border-white/30 bg-black/20 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-white/40 focus:border-white/60"
                      placeholder="6位数字"
                      required
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void sendSmsCode()}
                    disabled={sendingCode || countdown > 0}
                    className="mt-6 rounded-xl border border-white/40 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {countdown > 0 ? `${countdown}s后重发` : sendingCode ? "发送中…" : "发送验证码"}
                  </button>
                </div>
              </>
            )}
            {err && <p className="text-sm text-red-200">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl py-3 text-sm font-semibold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60"
              style={{ backgroundColor: branding.login_accent_color }}
            >
              {busy ? "登录中…" : "登录"}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-center text-xs text-white/65">
            <span>{branding.login_footer_text}</span>
            <Link to="/" className="text-white/90 underline-offset-4 hover:underline">
              返回顾客端首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
