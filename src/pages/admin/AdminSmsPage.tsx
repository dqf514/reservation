import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { SmsSettingsDTO } from "@/types/sms";

export function AdminSmsPage() {
  const [data, setData] = useState<SmsSettingsDTO | null>(null);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testPhone, setTestPhone] = useState("18602113774");
  const [balanceJson, setBalanceJson] = useState<string | null>(null);
  const [testDebug, setTestDebug] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const r = await apiFetch<SmsSettingsDTO>("/api/admin/sms-settings");
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        enabled: data.enabled,
        sp_id: data.sp_id,
        send_url: data.send_url,
        balance_url: data.balance_url,
        notify_public_submit: data.notify_public_submit,
        notify_admin_create: data.notify_admin_create,
        notify_cancel: data.notify_cancel,
        template_success: data.template_success,
        template_cancel: data.template_cancel,
        promotion_sms_max_recipients: data.promotion_sms_max_recipients,
        promotion_sms_staff_max_recipients: data.promotion_sms_staff_max_recipients,
      };
      if (password.trim()) payload.password = password.trim();
      await apiFetch<SmsSettingsDTO>("/api/admin/sms-settings", {
        method: "PUT",
        json: payload,
      });
      setPassword("");
      setMsg("已保存");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function queryBalance() {
    setErr(null);
    setBalanceJson(null);
    setBusy(true);
    try {
      const r = await apiFetch<{ ok: boolean; provider: unknown }>("/api/admin/sms-settings/balance");
      setBalanceJson(JSON.stringify(r.provider, null, 2));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "查询失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setErr(null);
    setMsg(null);
    setTestDebug(null);
    setBusy(true);
    try {
      const r = await apiFetch<{
        ok: boolean;
        message?: string;
        result?: {
          reason?: string;
          code?: unknown;
          provider?: unknown;
          error?: unknown;
          content?: unknown;
        };
      }>("/api/admin/sms-settings/test", {
        method: "POST",
        json: { phone: testPhone.trim() },
      });
      if (r.ok) {
        const provider = r.result?.provider as { msg_id?: unknown } | undefined;
        const msgId = provider?.msg_id ? String(provider.msg_id) : "";
        setMsg(msgId ? `测试短信已发送（msg_id: ${msgId}）` : r.message || "测试短信已发送");
        const content = r.result?.content != null ? String(r.result.content) : "";
        const providerRaw = r.result?.provider ? JSON.stringify(r.result.provider, null, 2) : "";
        setTestDebug(
          ["实际发送内容：", content, "", "运营商回包：", providerRaw].filter(Boolean).join("\n"),
        );
      } else {
        const reason = r.result?.reason ? `原因：${r.result.reason}` : "";
        const code = r.result?.code != null ? `运营商 code：${String(r.result.code)}` : "";
        const error = r.result?.error != null ? `异常：${String(r.result.error)}` : "";
        const content = r.result?.content != null ? `实际发送内容：${String(r.result.content)}` : "";
        const providerRaw = r.result?.provider ? JSON.stringify(r.result.provider, null, 2) : "";
        setErr(
          [r.message || "测试短信发送失败", reason, code, error, content, providerRaw]
            .filter(Boolean)
            .join("\n"),
        );
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendBasicTest() {
    setErr(null);
    setMsg(null);
    setTestDebug(null);
    setBusy(true);
    try {
      const r = await apiFetch<{
        ok: boolean;
        message?: string;
        result?: {
          reason?: string;
          code?: unknown;
          provider?: unknown;
          error?: unknown;
          content?: unknown;
        };
      }>("/api/admin/sms-settings/test-basic", {
        method: "POST",
        json: { phone: testPhone.trim() },
      });
      if (r.ok) {
        const provider = r.result?.provider as { msg_id?: unknown } | undefined;
        const msgId = provider?.msg_id ? String(provider.msg_id) : "";
        setMsg(
          msgId ? `基础测试短信已发送（msg_id: ${msgId}）` : r.message || "基础测试短信已发送",
        );
        const content = r.result?.content != null ? String(r.result.content) : "";
        const providerRaw = r.result?.provider ? JSON.stringify(r.result.provider, null, 2) : "";
        setTestDebug(
          ["实际发送内容：", content, "", "运营商回包：", providerRaw].filter(Boolean).join("\n"),
        );
      } else {
        const reason = r.result?.reason ? `原因：${r.result.reason}` : "";
        const code = r.result?.code != null ? `运营商 code：${String(r.result.code)}` : "";
        const error = r.result?.error != null ? `异常：${String(r.result.error)}` : "";
        const content = r.result?.content != null ? `实际发送内容：${String(r.result.content)}` : "";
        const providerRaw = r.result?.provider ? JSON.stringify(r.result.provider, null, 2) : "";
        setErr(
          [r.message || "基础测试短信发送失败", reason, code, error, content, providerRaw]
            .filter(Boolean)
            .join("\n"),
        );
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="w-full px-4 py-6 text-sm text-stone-500">
        {err ? <p className="text-red-600">{err}</p> : "加载中…"}
      </div>
    );
  }

  const inputCls = "mt-0.5 h-8 w-full rounded-lg border border-stone-200 px-2.5 text-sm";
  const labelCls = "block text-[11px] font-medium leading-tight text-stone-600";

  return (
    <div className="flex min-h-full flex-col bg-[#f5f3f0] text-ink-900">
      <header className="sticky top-0 z-10 shrink-0 border-b border-stone-200 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-base font-semibold">短信通知（欣欣云）</h1>
            <p className="truncate text-[11px] text-stone-500">
              预订成功 / 新建 / 取消时的短信提醒；须符合运营商模板与签名规范
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="submit"
              form="sms-settings-form"
              disabled={busy}
              className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? "保存中…" : "保存全部"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 disabled:opacity-50"
              onClick={() => void load()}
            >
              重新加载
            </button>
          </div>
        </div>
      </header>

      <form id="sms-settings-form" onSubmit={onSave} className="px-4 py-2">
        {msg && (
          <p className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
            {msg}
          </p>
        )}

        <details className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
          <summary className="cursor-pointer select-none font-medium text-stone-700">
            接入说明（欣欣云 API）
          </summary>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 pl-1">
            <li>POST · UTF-8 · application/x-www-form-urlencoded · JSON 响应</li>
            <li>正文：【企业签名】+ 内容（签名已在控制台报备）</li>
            <li>
              文档{" "}
              <a
                href="https://shxinxinyun.com/api.html"
                target="_blank"
                rel="noreferrer"
                className="text-brand-coral underline-offset-2 hover:underline"
              >
                shxinxinyun.com/api
              </a>
              ；控制台 id.shxinxinyun.com
            </li>
            <li>密码保存为 MD5 小写；可用环境变量 SMS_XINXINYUN_SP_ID / SMS_XINXINYUN_PASSWORD_MD5</li>
          </ul>
        </details>

        <div className="grid gap-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:min-h-[calc(100dvh-9.5rem)]">
          {/* 左侧：大屏在可用高度内均匀分布，内容超出时整页可滚动 */}
          <section className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm xl:min-h-full xl:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">开关与发送场景</h2>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-700 xl:grid-cols-2">
                <label className="col-span-2 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={data.enabled}
                    onChange={(e) => setData({ ...data, enabled: e.target.checked })}
                  />
                  启用短信发送
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={data.notify_public_submit}
                    onChange={(e) => setData({ ...data, notify_public_submit: e.target.checked })}
                  />
                  顾客端提交成功
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={data.notify_admin_create}
                    onChange={(e) => setData({ ...data, notify_admin_create: e.target.checked })}
                  />
                  后台新建预订
                </label>
                <label className="col-span-2 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={data.notify_cancel}
                    onChange={(e) => setData({ ...data, notify_cancel: e.target.checked })}
                  />
                  预订取消或删除
                </label>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-2.5">
              <h2 className="text-sm font-semibold text-ink-900">账号与接口</h2>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <label className={labelCls}>
                  sp_id
                  <input
                    value={data.sp_id}
                    onChange={(e) => setData({ ...data, sp_id: e.target.value })}
                    className={inputCls}
                    placeholder="352107"
                  />
                </label>
                <label className={labelCls}>
                  接口密码（留空不修改）
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className={inputCls}
                    placeholder={data.password_set ? "已保存" : "控制台密码或 MD5"}
                  />
                </label>
                <label className={`${labelCls} col-span-2`}>
                  发送接口 URL
                  <input
                    value={data.send_url}
                    onChange={(e) => setData({ ...data, send_url: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <label className={`${labelCls} col-span-2`}>
                  余额查询 URL
                  <input
                    value={data.balance_url}
                    onChange={(e) => setData({ ...data, balance_url: e.target.value })}
                    className={inputCls}
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-2.5 xl:border-t-0 xl:pt-0">
              <h2 className="text-sm font-semibold text-ink-900">推广短信</h2>
              <p className="mt-0.5 text-[10px] leading-snug text-stone-500">
                「推广」单次收件人上限；普通人员超限需超管发送
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <label className={labelCls}>
                  单次收件人上限
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={data.promotion_sms_max_recipients}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(10000, Number(e.target.value) || 1));
                      setData({
                        ...data,
                        promotion_sms_max_recipients: n,
                        promotion_sms_staff_max_recipients: Math.min(
                          data.promotion_sms_staff_max_recipients,
                          n,
                        ),
                      });
                    }}
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  普通人员上限
                  <input
                    type="number"
                    min={1}
                    max={data.promotion_sms_max_recipients}
                    value={data.promotion_sms_staff_max_recipients}
                    onChange={(e) => {
                      const cap = data.promotion_sms_max_recipients;
                      const n = Math.max(1, Math.min(cap, Number(e.target.value) || 1));
                      setData({ ...data, promotion_sms_staff_max_recipients: n });
                    }}
                    className={inputCls}
                  />
                </label>
              </div>
            </div>
          </section>

          {/* 右侧：模板区自适应增高，连通性贴底 */}
          <div className="flex flex-col gap-2 xl:min-h-full">
            <section className="flex flex-col rounded-xl border border-stone-200 bg-white p-3 shadow-sm xl:min-h-0 xl:flex-1">
              <h2 className="shrink-0 text-sm font-semibold text-ink-900">签名与模板</h2>
              <p className="mt-0.5 shrink-0 text-[10px] leading-snug text-stone-500">
                占位符：{"{name}"} {"{date}"} {"{time}"} {"{party}"} {"{id}"} {"{table}"}；签名固定【音昱上海】，模板勿重复写签名
              </p>
              <div className="mt-1.5 flex flex-col gap-2 xl:min-h-0 xl:flex-1">
                <label className={`${labelCls} shrink-0`}>
                  固定签名
                  <input value={data.signature_prefix} readOnly className={inputCls} />
                </label>
                <label className={`${labelCls} flex flex-col xl:min-h-0 xl:flex-1`}>
                  预订提交成功模板
                  <textarea
                    value={data.template_success}
                    onChange={(e) => setData({ ...data, template_success: e.target.value })}
                    rows={4}
                    className="mt-0.5 min-h-[4.5rem] w-full resize-y rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm xl:min-h-[5rem] xl:flex-1"
                  />
                </label>
                <label className={`${labelCls} flex flex-col xl:min-h-0 xl:flex-1`}>
                  预订取消模板
                  <textarea
                    value={data.template_cancel}
                    onChange={(e) => setData({ ...data, template_cancel: e.target.value })}
                    rows={4}
                    className="mt-0.5 min-h-[4.5rem] w-full resize-y rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm xl:min-h-[5rem] xl:flex-1"
                  />
                </label>
              </div>
            </section>

            <section className="shrink-0 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-ink-900">连通性</h2>
              <div className="mt-1.5 flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void queryBalance()}
                  className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                >
                  查询余额
                </button>
                <label className={labelCls}>
                  测试手机号
                  <input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="mt-0.5 h-8 w-36 rounded-lg border border-stone-200 px-2.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendTest()}
                  className="rounded-lg bg-stone-800 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  模板测试
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendBasicTest()}
                  className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 disabled:opacity-50"
                >
                  基础连通性
                </button>
              </div>
              {balanceJson && (
                <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-stone-50 p-2 text-[10px] text-stone-700">
                  {balanceJson}
                </pre>
              )}
              {testDebug && (
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-2 text-[10px] text-stone-700">
                  {testDebug}
                </pre>
              )}
            </section>
          </div>
        </div>

        {err && (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-800">
            {err}
          </p>
        )}
      </form>
    </div>
  );
}
