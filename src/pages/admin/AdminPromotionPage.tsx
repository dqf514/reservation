import type {
  PromotionSmsMessageItem,
  PromotionSmsMessageListResponse,
  PromotionSmsQueueResponse,
  PromotionSmsRecipient,
  PromotionSmsRecipientCandidate,
  PromotionSmsRecipientSearchResponse,
  PromotionSmsSendLimits,
} from "@/types/promotionSms";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

type Folder = "compose" | "draft" | "outbox" | "sent";

type SendPrompt = {
  recipientCount: number;
  recipientPhones: string[];
  content: string;
};

function fmtRecipientPhones(phones: string[]) {
  if (phones.length <= 5) return phones.join("、");
  return `${phones.slice(0, 5).join("、")} 等共 ${phones.length} 位`;
}

const DEFAULT_SEND_LIMITS: PromotionSmsSendLimits = {
  promotion_max_recipients: 300,
  staff_max_recipients: 1,
};
const SIGNATURE = "【音昱上海】";
const SMS_MAX_LEN = 180;

const emptyCompose = {
  subject: "",
  content: "",
  recipients: [] as PromotionSmsRecipient[],
};

function fmtTime(s: string | null | undefined) {
  if (!s) return "";
  return s.replace("T", " ").slice(0, 16);
}

function localDateStr(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthsAgoLocal(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return localDateStr(d);
}

/** 与后端 normalize_sms_text 一致（截断前） */
function normalizeSmsText(content: string): string {
  const c = (content || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines: string[] = [];
  for (const line of c.split("\n")) {
    const lineTrim = line.replace(/[ \t]+/g, " ").trim();
    if (lineTrim) lines.push(lineTrim);
  }
  return lines.join("\n").replace(/小姐/g, "女士");
}

function buildPreviewContent(body: string): string {
  const t = (body || "").trim().replace(/^【[^】]*】\s*/, "");
  if (!t) return SIGNATURE;
  return normalizeSmsText(`${SIGNATURE}${t}`);
}

function clampSmsBody(raw: string): string {
  if (buildPreviewContent(raw).length <= SMS_MAX_LEN) return raw;
  let s = raw;
  while (s.length > 0 && buildPreviewContent(s).length > SMS_MAX_LEN) {
    s = s.slice(0, -1);
  }
  return s;
}

function statusLabel(status: string) {
  if (status === "draft") return "草稿";
  if (status === "queued") return "排队中";
  if (status === "sending") return "发送中";
  if (status === "completed") return "已完成";
  return status;
}

export function AdminPromotionPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "admin";
  const [folder, setFolder] = useState<Folder>("compose");
  const [listQ, setListQ] = useState("");
  const [messages, setMessages] = useState<PromotionSmsMessageItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compose, setCompose] = useState(emptyCompose);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sendPrompt, setSendPrompt] = useState<SendPrompt | null>(null);
  const [sendLimits, setSendLimits] = useState<PromotionSmsSendLimits>(DEFAULT_SEND_LIMITS);

  // 收件人选取
  const [recipientTab, setRecipientTab] = useState<"manual" | "filter">("manual");
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [filterMinCount, setFilterMinCount] = useState("3");
  const [filterAfter, setFilterAfter] = useState(() => monthsAgoLocal(3));
  const [filterQ, setFilterQ] = useState("");
  const [filterPage, setFilterPage] = useState(1);
  const [filterCandidates, setFilterCandidates] = useState<PromotionSmsRecipientCandidate[]>([]);
  const [filterTotal, setFilterTotal] = useState(0);
  const [filterLoading, setFilterLoading] = useState(false);
  const [selectedFilterPhones, setSelectedFilterPhones] = useState<Set<string>>(new Set());

  // 队列详情
  const [queueItems, setQueueItems] = useState<PromotionSmsQueueResponse | null>(null);

  const previewContent = useMemo(() => buildPreviewContent(compose.content), [compose.content]);
  const smsCharCount = previewContent.length;
  const smsOverLimit = smsCharCount > SMS_MAX_LEN;

  const promoMax = sendLimits.promotion_max_recipients;
  const staffMax = sendLimits.staff_max_recipients;

  const recipientCount = compose.recipients.length;
  const canSendPromotion = useMemo(() => {
    if (recipientCount <= 0 || recipientCount > promoMax) return false;
    if (isSuperAdmin) return true;
    return recipientCount <= staffMax;
  }, [recipientCount, promoMax, staffMax, isSuperAdmin]);

  const sendDisabledHint = useMemo(() => {
    if (recipientCount === 0) return "请至少添加一位收件人";
    if (smsOverLimit) return `短信内容不能超过 ${SMS_MAX_LEN} 字（含签名）`;
    if (recipientCount > promoMax) {
      return `单次最多 ${promoMax} 位收件人，请减少收件人数量`;
    }
    if (!isSuperAdmin && recipientCount > staffMax) {
      return `超过 ${staffMax} 位收件人仅超级管理员可发送；请先将收件人控制在 ${staffMax} 位以内做测试`;
    }
    if (recipientCount <= staffMax) {
      return recipientCount === 1
        ? "单收件人测试发送"
        : `发送给 ${recipientCount} 位收件人（不超过普通人员上限 ${staffMax}）`;
    }
    return `群发给 ${recipientCount} 位收件人（超级管理员）`;
  }, [recipientCount, isSuperAdmin, smsOverLimit, promoMax, staffMax]);

  useEffect(() => {
    void (async () => {
      try {
        const limits = await apiFetch<PromotionSmsSendLimits>(
          "/api/admin/promotion-sms/send-limits",
        );
        setSendLimits(limits);
      } catch {
        /* 使用默认值 */
      }
    })();
  }, []);

  const loadList = useCallback(async (silent = false) => {
    if (folder === "compose") return;
    if (!silent) {
      setListLoading(true);
      setErr(null);
    }
    try {
      const params = new URLSearchParams({
        folder,
        page: "1",
        page_size: "50",
      });
      if (listQ.trim()) params.set("q", listQ.trim());
      const data = await apiFetch<PromotionSmsMessageListResponse>(
        `/api/admin/promotion-sms/messages?${params}`,
      );
      setMessages(data.items);
      setListTotal(data.total);
    } catch (e) {
      if (!silent) setErr(e instanceof Error ? e.message : "加载列表失败");
    } finally {
      if (!silent) setListLoading(false);
    }
  }, [folder, listQ]);

  useEffect(() => {
    void loadList(false);
  }, [loadList]);

  // 仅发件箱静默刷新（发送中状态会变；已发送为已完成，无需轮询）
  useEffect(() => {
    if (folder !== "outbox") return;
    const t = window.setInterval(() => void loadList(true), 5000);
    return () => window.clearInterval(t);
  }, [folder, loadList]);

  const loadQueue = useCallback(async (mid: number) => {
    try {
      const q = await apiFetch<PromotionSmsQueueResponse>(
        `/api/admin/promotion-sms/messages/${mid}/queue`,
      );
      setQueueItems(q);
    } catch {
      setQueueItems(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedId || folder === "compose" || folder === "draft") {
      setQueueItems(null);
      return;
    }
    void loadQueue(selectedId);
    if (folder === "outbox") {
      const t = window.setInterval(() => void loadQueue(selectedId), 3000);
      return () => window.clearInterval(t);
    }
  }, [selectedId, folder, loadQueue]);

  function resetCompose() {
    setCompose(emptyCompose);
    setEditingId(null);
    setSelectedId(null);
    setManualPhone("");
    setManualName("");
    setSelectedFilterPhones(new Set());
    setQueueItems(null);
    setMsg(null);
    setErr(null);
    setSendPrompt(null);
  }

  function startNew() {
    resetCompose();
    setFolder("compose");
  }

  function openMessage(item: PromotionSmsMessageItem, fromFolder: Folder) {
    setSelectedId(item.id);
    setEditingId(fromFolder === "draft" ? item.id : null);
    setSendPrompt(null);
    setCompose({
      subject: item.subject,
      content: item.content,
      recipients: [...item.recipients],
    });
    setMsg(null);
    setErr(null);
  }

  async function searchFilterRecipients(page = 1) {
    setFilterLoading(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = { page, page_size: 20 };
      if (filterMinCount.trim()) payload.min_reservation_count = Number(filterMinCount);
      if (filterAfter.trim()) payload.last_booking_after = filterAfter.trim();
      payload.last_booking_before = localDateStr();
      if (filterQ.trim()) payload.q = filterQ.trim();
      const data = await apiFetch<PromotionSmsRecipientSearchResponse>(
        "/api/admin/promotion-sms/recipients/search",
        { method: "POST", json: payload },
      );
      setFilterCandidates(data.items);
      setFilterTotal(data.total);
      setFilterPage(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "筛选失败");
    } finally {
      setFilterLoading(false);
    }
  }

  function addManualRecipient() {
    const phone = manualPhone.replace(/\D/g, "");
    if (!/^1\d{10}$/.test(phone)) {
      window.alert("请输入有效的 11 位手机号");
      return;
    }
    if (compose.recipients.some((r) => r.phone === phone)) {
      window.alert("该手机号已在收件人列表中");
      return;
    }
    if (compose.recipients.length >= promoMax) {
      window.alert(`最多添加 ${promoMax} 位收件人`);
      return;
    }
    setCompose((c) => ({
      ...c,
      recipients: [
        ...c.recipients,
        { phone, display_name: manualName.trim(), source: "manual" },
      ],
    }));
    setManualPhone("");
    setManualName("");
  }

  function removeRecipient(phone: string) {
    setCompose((c) => ({
      ...c,
      recipients: c.recipients.filter((r) => r.phone !== phone),
    }));
  }

  function toggleFilterPhone(phone: string) {
    setSelectedFilterPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  const allFilterPageSelected = useMemo(
    () =>
      filterCandidates.length > 0 &&
      filterCandidates.every((c) => selectedFilterPhones.has(c.phone)),
    [filterCandidates, selectedFilterPhones],
  );

  function toggleSelectAllFilterCandidates() {
    if (allFilterPageSelected) {
      setSelectedFilterPhones(new Set());
      return;
    }
    setSelectedFilterPhones(new Set(filterCandidates.map((c) => c.phone)));
  }

  function clearAllRecipients() {
    if (!compose.recipients.length) return;
    if (!window.confirm(`确定清空全部 ${compose.recipients.length} 位收件人？`)) return;
    setCompose((c) => ({ ...c, recipients: [] }));
  }

  function addSelectedFilterRecipients() {
    const toAdd: PromotionSmsRecipient[] = [];
    for (const c of filterCandidates) {
      if (!selectedFilterPhones.has(c.phone)) continue;
      if (compose.recipients.some((r) => r.phone === c.phone)) continue;
      toAdd.push({
        phone: c.phone,
        display_name: c.display_name,
        source: "customer",
      });
    }
    if (!toAdd.length) {
      window.alert("请先勾选要添加的食客");
      return;
    }
    const combined = [...compose.recipients, ...toAdd];
    if (combined.length > promoMax) {
      window.alert(`收件人总数不能超过 ${promoMax} 位`);
      return;
    }
    setCompose((c) => ({ ...c, recipients: combined }));
    setSelectedFilterPhones(new Set());
    setMsg(`已添加 ${toAdd.length} 位收件人`);
  }

  function onContentChange(raw: string) {
    setCompose((c) => ({ ...c, content: clampSmsBody(raw) }));
  }

  function assertSmsLengthOk(): boolean {
    if (smsOverLimit) {
      window.alert(`短信内容不能超过 ${SMS_MAX_LEN} 字（含签名），当前 ${smsCharCount} 字`);
      return false;
    }
    return true;
  }

  async function saveDraft(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if ((compose.content || "").trim() && !assertSmsLengthOk()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const payload = {
        subject: compose.subject.trim(),
        content: compose.content.trim(),
        recipients: compose.recipients,
      };
      let saved: PromotionSmsMessageItem;
      if (editingId) {
        saved = await apiFetch<PromotionSmsMessageItem>(
          `/api/admin/promotion-sms/messages/${editingId}`,
          { method: "PUT", json: payload },
        );
      } else {
        saved = await apiFetch<PromotionSmsMessageItem>("/api/admin/promotion-sms/messages", {
          method: "POST",
          json: payload,
        });
        setEditingId(saved.id);
      }
      setSelectedId(saved.id);
      setMsg("草稿已保存");
      if (folder === "draft") void loadList();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  function requestSend() {
    if (busy) return;
    if (!compose.recipients.length) {
      window.alert("请至少添加一位收件人");
      return;
    }
    if (!compose.content.trim()) {
      window.alert("请填写短信内容");
      return;
    }
    if (!assertSmsLengthOk()) return;
    if (!isSuperAdmin && compose.recipients.length > staffMax) {
      window.alert(
        `超过 ${staffMax} 位收件人仅超级管理员可操作。请先将收件人控制在 ${staffMax} 位以内（如自己的手机号）做测试发送。`,
      );
      return;
    }
    if (compose.recipients.length > promoMax) {
      window.alert(`单次最多发送 ${promoMax} 位收件人`);
      return;
    }
    setErr(null);
    setMsg(null);
    setSendPrompt({
      recipientCount: compose.recipients.length,
      recipientPhones: compose.recipients.map((r) => r.phone),
      content: previewContent,
    });
  }

  async function confirmSend() {
    if (busy || !sendPrompt) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const sentPreview = sendPrompt.content;
    const sentCount = sendPrompt.recipientCount;
    setSendPrompt(null);
    try {
      let mid = editingId;
      if (!mid) {
        const saved = await apiFetch<PromotionSmsMessageItem>("/api/admin/promotion-sms/messages", {
          method: "POST",
          json: {
            subject: compose.subject.trim(),
            content: compose.content.trim(),
            recipients: compose.recipients,
          },
        });
        mid = saved.id;
        setEditingId(mid);
      } else {
        await apiFetch<PromotionSmsMessageItem>(`/api/admin/promotion-sms/messages/${mid}`, {
          method: "PUT",
          json: {
            subject: compose.subject.trim(),
            content: compose.content.trim(),
            recipients: compose.recipients,
          },
        });
      }
      const sent = await apiFetch<PromotionSmsMessageItem>(
        `/api/admin/promotion-sms/messages/${mid}/send`,
        { method: "POST" },
      );
      setSelectedId(sent.id);
      setEditingId(null);
      setFolder("outbox");
      setCompose(emptyCompose);
      setMsg(
        `已加入发送队列（${sentCount} 位收件人，约每 2 秒一条）\n\n发送内容：\n${sentPreview}`,
      );
      void loadList();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateAndEdit(mid: number) {
    setBusy(true);
    setErr(null);
    try {
      const copy = await apiFetch<PromotionSmsMessageItem>(
        `/api/admin/promotion-sms/messages/${mid}/duplicate`,
        { method: "POST" },
      );
      setFolder("compose");
      setEditingId(copy.id);
      setSelectedId(copy.id);
      setCompose({
        subject: copy.subject,
        content: copy.content,
        recipients: [...copy.recipients],
      });
      setMsg("已复制为草稿，可编辑后重新发送");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "复制失败");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft(mid: number) {
    if (!window.confirm("确定删除此草稿？")) return;
    setBusy(true);
    setSendPrompt(null);
    try {
      await apiFetch(`/api/admin/promotion-sms/messages/${mid}`, { method: "DELETE" });
      if (selectedId === mid || editingId === mid) resetCompose();
      setMsg("草稿已删除");
      void loadList();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  const showEditor =
    folder === "compose" ||
    (folder === "draft" && (editingId !== null || selectedId !== null));
  const showReadonly = folder === "sent" || folder === "outbox";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f3f0] text-ink-900">
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        {/* 左侧文件夹 */}
        <aside className="flex h-full min-h-0 w-44 shrink-0 flex-col overflow-hidden border-r border-stone-200 bg-white lg:w-52">
          <div className="border-b border-stone-100 p-3">
            <button
              type="button"
              onClick={startNew}
              className="w-full rounded-xl bg-ink-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
            >
              新建短信
            </button>
          </div>
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {(
              [
                { key: "draft" as Folder, label: "草稿箱" },
                { key: "outbox" as Folder, label: "发件箱" },
                { key: "sent" as Folder, label: "已发送" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFolder(f.key);
                  resetCompose();
                }}
                className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  folder === f.key
                    ? "bg-stone-100 text-ink-900"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </nav>
          <div className="shrink-0 border-t border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">重要提示</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">
              请先发送短信内容给自己做测试（普通人员最多 {staffMax} 位收件人），内容无误并能顺利发送后再做群发（单次上限{" "}
              {promoMax} 位）。
            </p>
          </div>
        </aside>

        {/* 中间列表 */}
        {folder !== "compose" && (
          <section className="flex h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-stone-200 bg-white lg:w-72">
            <div className="border-b border-stone-100 p-2">
              <input
                type="search"
                placeholder="按主题搜索…"
                value={listQ}
                onChange={(e) => setListQ(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {listLoading && <p className="p-3 text-sm text-stone-500">加载中…</p>}
              {!listLoading && messages.length === 0 && (
                <p className="p-3 text-sm text-stone-500">暂无短信</p>
              )}
              {messages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openMessage(m, folder)}
                  className={`block w-full border-b border-stone-50 px-3 py-3 text-left transition hover:bg-stone-50 ${
                    selectedId === m.id ? "bg-stone-100" : ""
                  }`}
                >
                  <div className="truncate text-sm font-semibold text-ink-900">
                    {m.subject || "（无主题）"}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-stone-500">
                    {m.total_recipients} 位收件人 · {statusLabel(m.status)}
                    {m.status === "completed" && (
                      <span>
                        {" "}
                        · 成功 {m.sent_count} / 失败 {m.failed_count}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-400">{fmtTime(m.updated_at)}</div>
                </button>
              ))}
            </div>
            {listTotal > messages.length && (
              <div className="border-t border-stone-100 p-2 text-center text-xs text-stone-500">
                共 {listTotal} 条
              </div>
            )}
          </section>
        )}

        {/* 编辑区：中（主题/内容/预览）+ 右（收件人） */}
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {showEditor && (
            <form onSubmit={saveDraft} className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-3 lg:px-6">
                <h1 className="text-lg font-display font-bold">编辑推广短信</h1>
                <div className="flex-1" />
                {editingId !== null && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteDraft(editingId)}
                    className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    删除草稿
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveDraft()}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50"
                >
                  保存草稿
                </button>
                <button
                  type="button"
                  disabled={busy || !canSendPromotion || smsOverLimit || sendPrompt !== null}
                  title={sendDisabledHint}
                  onClick={() => requestSend()}
                  className="rounded-xl bg-brand-coral px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  发送
                </button>
              </div>

              {sendPrompt && (
                <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 lg:px-6">
                  <p className="text-sm font-semibold text-amber-900">请确认发送内容</p>
                  <p className="mt-1 text-xs text-amber-800">
                    收件人 {sendPrompt.recipientCount} 位：
                    {fmtRecipientPhones(sendPrompt.recipientPhones)}
                  </p>
                  <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-stone-800">
                    {sendPrompt.content}
                  </div>
                  <p className="mt-2 text-xs text-amber-700">
                    确认无误后点击发送；加入队列后约每 2 秒一条。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void confirmSend()}
                      className="rounded-lg bg-brand-coral px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      确认发送
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setSendPrompt(null)}
                      className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {(msg || err) && !sendPrompt && (
                <div className="shrink-0 border-b border-stone-100 bg-white px-4 py-2 lg:px-6">
                  {msg && (
                    <p className="whitespace-pre-wrap text-sm text-green-700">{msg}</p>
                  )}
                  {err && <p className="whitespace-pre-wrap text-sm text-red-600">{err}</p>}
                </div>
              )}

              <div className="flex h-full min-h-0 flex-1 overflow-hidden">
                {/* 中间：主题 / 内容 / 预览（高度固定，不撑开页面） */}
                <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 lg:p-6">
                  <label className="mb-3 block shrink-0">
                    <span className="mb-1 block text-sm font-semibold text-stone-700">主题</span>
                    <input
                      type="text"
                      maxLength={120}
                      value={compose.subject}
                      onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                      placeholder="便于快速查找，不会出现在短信正文中"
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="mb-3 shrink-0 rounded-xl border border-stone-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-stone-700">
                        已选收件人（{compose.recipients.length}/{promoMax}）
                      </span>
                      {compose.recipients.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAllRecipients}
                          className="shrink-0 text-xs text-stone-500 hover:text-red-600"
                        >
                          清空
                        </button>
                      )}
                    </div>
                    {compose.recipients.length === 0 ? (
                      <p className="text-xs text-stone-400">暂无，请从右侧手动添加或筛选食客</p>
                    ) : (
                      <div className="max-h-28 overflow-y-auto overscroll-contain rounded-lg bg-stone-50/80 p-2">
                        <div className="flex flex-wrap gap-1">
                          {compose.recipients.map((r) => (
                            <span
                              key={r.phone}
                              className="inline-flex items-center gap-0.5 rounded border border-stone-200/80 bg-white px-1 py-0.5 font-mono text-[11px] leading-tight text-stone-700"
                            >
                              {r.phone}
                              <button
                                type="button"
                                onClick={() => removeRecipient(r.phone)}
                                className="px-0.5 text-[10px] text-stone-400 hover:text-red-600"
                                aria-label={`移除 ${r.phone}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="mb-3 flex min-h-0 flex-1 flex-col">
                    <span className="mb-1 block shrink-0 text-sm font-semibold text-stone-700">短信内容</span>
                    <textarea
                      value={compose.content}
                      onChange={(e) => onContentChange(e.target.value)}
                      placeholder="正文请勿包含签名，系统将自动添加"
                      className={`min-h-[7rem] w-full flex-1 resize-none rounded-xl border bg-white px-3 py-2 text-sm leading-relaxed ${
                        smsOverLimit ? "border-red-400 ring-1 ring-red-200" : "border-stone-200"
                      }`}
                    />
                    <p className={`mt-1 shrink-0 text-xs ${smsOverLimit ? "text-red-600" : "text-stone-500"}`}>
                      签名固定为 {SIGNATURE}，含签名共 {smsCharCount}/{SMS_MAX_LEN} 字
                      {smsOverLimit ? "（已超出限制）" : ""}
                    </p>
                  </label>

                  <div className="shrink-0 rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="mb-2 text-sm font-semibold text-stone-700">发送预览</div>
                    <div className="max-h-48 overflow-y-auto rounded-xl bg-stone-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-stone-800">
                      {previewContent || SIGNATURE}
                    </div>
                    <p className={`mt-2 text-xs ${smsOverLimit ? "text-red-600" : "text-stone-400"}`}>
                      共 {smsCharCount} 字（含签名，上限 {SMS_MAX_LEN} 字）
                    </p>
                  </div>
                </section>

                {/* 右侧：收件人（筛选区固定，仅列表滚动） */}
                <aside className="relative flex h-full min-h-0 w-[32rem] min-w-[32rem] shrink-0 flex-col overflow-hidden border-l border-stone-200 bg-white lg:w-[36rem] lg:min-w-[36rem]">
                  <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
                    <span className="text-sm font-semibold text-stone-700">添加收件人</span>
                  </div>

                  <div className="flex shrink-0 gap-2 border-b border-stone-100 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setRecipientTab("manual")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        recipientTab === "manual" ? "bg-ink-900 text-white" : "text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      手动输入
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientTab("filter")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        recipientTab === "filter" ? "bg-ink-900 text-white" : "text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      从食客筛选
                    </button>
                  </div>

                  {recipientTab === "manual" && (
                    <div className="shrink-0 space-y-2 border-b border-stone-100 px-4 py-3">
                      <div className="flex flex-nowrap items-end gap-2">
                        <label className="min-w-0 flex-1 text-xs">
                          <span className="mb-1 block text-stone-600">手机号</span>
                          <input
                            type="tel"
                            value={manualPhone}
                            onChange={(e) => setManualPhone(e.target.value)}
                            placeholder="11 位手机号"
                            className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="w-24 shrink-0 text-xs">
                          <span className="mb-1 block text-stone-600">称呼</span>
                          <input
                            type="text"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={addManualRecipient}
                          className="shrink-0 rounded-lg bg-stone-800 px-3 py-2 text-xs font-semibold text-white"
                        >
                          添加
                        </button>
                      </div>
                    </div>
                  )}

                  {recipientTab === "filter" && (
                    <>
                      <div className="shrink-0 border-b border-stone-100 px-3 py-2">
                        <div className="flex flex-nowrap items-end gap-1.5">
                          <label className="shrink-0 text-xs">
                            <span className="mb-0.5 block whitespace-nowrap text-[10px] text-stone-500">
                              最少次数
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={filterMinCount}
                              onChange={(e) => setFilterMinCount(e.target.value)}
                              className="w-14 rounded-lg border border-stone-200 px-1.5 py-1.5 text-sm"
                            />
                          </label>
                          <label className="min-w-0 flex-1 text-xs">
                            <span className="mb-0.5 block whitespace-nowrap text-[10px] text-stone-500">
                              关键词
                            </span>
                            <input
                              type="search"
                              value={filterQ}
                              onChange={(e) => setFilterQ(e.target.value)}
                              placeholder="手机/姓名"
                              className="w-full min-w-[5rem] rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="shrink-0 text-xs">
                            <span className="mb-0.5 block whitespace-nowrap text-[10px] text-stone-500">
                              预订起
                            </span>
                            <input
                              type="date"
                              value={filterAfter}
                              onChange={(e) => setFilterAfter(e.target.value)}
                              className="w-[7.25rem] rounded-lg border border-stone-200 px-1 py-1.5 text-sm"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={filterLoading}
                            onClick={() => void searchFilterRecipients(1)}
                            className="shrink-0 rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {filterLoading ? "…" : "搜索"}
                          </button>
                        </div>
                      </div>
                      {(filterCandidates.length > 0 || filterTotal > 0) && (
                        <div className="flex shrink-0 flex-nowrap items-center gap-2 border-b border-stone-100 px-3 py-2">
                          {filterCandidates.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={toggleSelectAllFilterCandidates}
                                className="shrink-0 rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold hover:bg-stone-50"
                              >
                                {allFilterPageSelected ? "取消全选" : "全选本页"}
                              </button>
                              <button
                                type="button"
                                onClick={addSelectedFilterRecipients}
                                className="shrink-0 rounded-lg border border-brand-coral/40 bg-brand-coral/10 px-2 py-1 text-xs font-semibold text-brand-coral hover:bg-brand-coral/20"
                              >
                                添加已选（{selectedFilterPhones.size}）
                              </button>
                            </>
                          )}
                          {filterTotal > 0 && (
                            <span className="min-w-0 flex-1 truncate text-[11px] text-stone-500">
                              共 {filterTotal} 位 · 第 {filterPage} 页
                            </span>
                          )}
                          {filterTotal > filterCandidates.length && (
                            <>
                              <button
                                type="button"
                                disabled={filterPage <= 1 || filterLoading}
                                onClick={() => void searchFilterRecipients(filterPage - 1)}
                                className="shrink-0 rounded border px-2 py-0.5 text-xs disabled:opacity-40"
                              >
                                上一页
                              </button>
                              <button
                                type="button"
                                disabled={filterPage * 20 >= filterTotal || filterLoading}
                                onClick={() => void searchFilterRecipients(filterPage + 1)}
                                className="shrink-0 rounded border px-2 py-0.5 text-xs disabled:opacity-40"
                              >
                                下一页
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* 仅此区域滚动：食客筛选结果 */}
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
                      {recipientTab === "filter" ? (
                        filterCandidates.length > 0 ? (
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 z-10 bg-stone-50 text-stone-600 shadow-sm">
                              <tr>
                                <th className="w-8 px-2 py-2 text-left">
                                  <input
                                    type="checkbox"
                                    checked={allFilterPageSelected}
                                    onChange={toggleSelectAllFilterCandidates}
                                    aria-label="全选本页"
                                  />
                                </th>
                                <th className="px-2 py-2 text-left">姓名</th>
                                <th className="px-2 py-2 text-left">手机</th>
                                <th className="px-2 py-2 text-right">预订</th>
                                <th className="px-2 py-2 text-right">最近预订</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filterCandidates.map((c) => (
                                <tr
                                  key={c.phone}
                                  className={`border-t border-stone-50 hover:bg-stone-50 ${
                                    selectedFilterPhones.has(c.phone) ? "bg-brand-coral/5" : ""
                                  }`}
                                >
                                  <td className="px-2 py-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedFilterPhones.has(c.phone)}
                                      onChange={() => toggleFilterPhone(c.phone)}
                                    />
                                  </td>
                                  <td
                                    className="max-w-[5rem] truncate px-2 py-2"
                                    title={c.display_name}
                                  >
                                    {c.display_name || "—"}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2 font-mono">{c.phone}</td>
                                  <td className="px-2 py-2 text-right">{c.reservation_count}</td>
                                  <td className="whitespace-nowrap px-2 py-2 text-right text-stone-500">
                                    {c.last_booking_date || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-stone-400">
                            {filterLoading ? "搜索中…" : "设置条件后点击搜索"}
                          </div>
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-xs text-stone-400">
                          手动输入手机号添加，或切换到「从食客筛选」
                        </div>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </form>
          )}

          {showReadonly && selectedId && !showEditor && (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              {(() => {
                const m = messages.find((x) => x.id === selectedId);
                if (!m) {
                  return (
                    <div className="flex flex-1 items-center justify-center text-sm text-stone-500">
                      请选择一条短信
                    </div>
                  );
                }
                const bodyPreview = `${SIGNATURE}${m.content.replace(/^【[^】]*】\s*/, "")}`;
                return (
                  <>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-3 lg:px-6">
                      <h1 className="text-lg font-display font-bold">{m.subject || "（无主题）"}</h1>
                      <div className="flex-1" />
                      {folder === "sent" && (
                        <button
                          type="button"
                          onClick={() => void duplicateAndEdit(m.id)}
                          className="rounded-xl bg-brand-coral px-4 py-2 text-sm font-semibold text-white"
                        >
                          复制并重新发送
                        </button>
                      )}
                    </div>

                    <div className="flex min-h-0 flex-1 overflow-hidden">
                      <section className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6">
                        <div className="mb-4 text-sm text-stone-500">
                          {statusLabel(m.status)} · {m.total_recipients} 位收件人 · {fmtTime(m.updated_at)}
                          {m.status === "completed" && (
                            <span>
                              {" "}
                              · 成功 {m.sent_count} / 失败 {m.failed_count}
                            </span>
                          )}
                          {m.status === "sending" && m.pending_count > 0 && (
                            <span> · 待发 {m.pending_count}</span>
                          )}
                        </div>

                        <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4">
                          <div className="mb-2 text-sm font-semibold text-stone-700">短信预览</div>
                          <div className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                            {bodyPreview}
                          </div>
                        </div>

                        {queueItems && queueItems.items.length > 0 && (
                          <div className="rounded-2xl border border-stone-200 bg-white p-4">
                            <div className="mb-2 text-sm font-semibold">发送明细</div>
                            <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-100">
                              <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-stone-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left">手机</th>
                                    <th className="px-3 py-2 text-left">状态</th>
                                    <th className="px-3 py-2 text-left">时间</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {queueItems.items.map((q) => (
                                    <tr key={q.id} className="border-t border-stone-50">
                                      <td className="px-3 py-2 font-mono">{q.phone}</td>
                                      <td className="px-3 py-2">
                                        {q.status === "sent" && (
                                          <span className="text-green-700">已发送</span>
                                        )}
                                        {q.status === "pending" && (
                                          <span className="text-amber-600">排队中</span>
                                        )}
                                        {q.status === "failed" && (
                                          <span className="text-red-600" title={q.reason}>
                                            失败
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-stone-500">{fmtTime(q.sent_at)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </section>

                      <aside className="flex w-[32rem] min-w-[32rem] shrink-0 flex-col overflow-hidden border-l border-stone-200 bg-white lg:w-[36rem] lg:min-w-[36rem]">
                        <div className="shrink-0 border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-700">
                          收件人（{m.recipients.length}）
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
                          <ul className="space-y-1">
                            {m.recipients.map((r) => (
                              <li
                                key={r.phone}
                                className="rounded-lg px-2 py-2 hover:bg-stone-50"
                              >
                                <div className="truncate text-sm font-medium text-ink-900">
                                  {r.display_name || "未命名"}
                                </div>
                                <div className="font-mono text-xs text-stone-500">{r.phone}</div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </aside>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {folder !== "compose" && !selectedId && (
            <div className="flex flex-1 items-center justify-center text-sm text-stone-500">
              请从左侧列表选择一条短信
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
