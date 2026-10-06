import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { DepositItem, DepositListResponse } from "@/types/admin";
import { DEPOSIT_STATUS } from "@/types/admin";

export function AdminDepositsPage() {
  const [sp, setSp] = useSearchParams();
  const [list, setList] = useState<DepositItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DepositItem | null>(null);
  const [createForm, setCreateForm] = useState({
    reservation_id: "",
    customer_phone: "",
    amount_yuan: "",
    note: "",
  });
  const [editForm, setEditForm] = useState({ status: "pending", amount_yuan: "", note: "" });
  const [saving, setSaving] = useState(false);

  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<DepositListResponse>(`/api/admin/deposits?${params}`);
      setList(data.items);
      setTotal(data.total);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const focusId = sp.get("focus");
  useEffect(() => {
    if (!focusId || !/^\d+$/.test(focusId)) return;
    const id = Number(focusId);
    const t = window.setTimeout(() => {
      const el = rowRefs.current.get(id);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      const next = new URLSearchParams(sp);
      next.delete("focus");
      setSp(next, { replace: true });
    }, 400);
    return () => window.clearTimeout(t);
  }, [focusId, list, sp, setSp]);

  function depLabel(v: string) {
    return DEPOSIT_STATUS.find((x) => x.v === v)?.l ?? v;
  }

  function openCreate() {
    setEditing(null);
    setCreateForm({ reservation_id: "", customer_phone: "", amount_yuan: "", note: "" });
    setModalOpen(true);
  }

  function openEditRow(d: DepositItem) {
    setEditing(d);
    setEditForm({
      status: d.status,
      amount_yuan: String(d.amount_yuan),
      note: d.note ?? "",
    });
    setModalOpen(true);
  }

  async function onCreate(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      const rid = createForm.reservation_id.trim();
      await apiFetch("/api/admin/deposits", {
        method: "POST",
        json: {
          reservation_id: rid ? Number(rid) : null,
          customer_phone: createForm.customer_phone.trim(),
          amount_yuan: Number(createForm.amount_yuan),
          note: createForm.note.trim() || null,
        },
      });
      setModalOpen(false);
      await loadList();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit(ev: FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/deposits/${editing.id}`, {
        method: "PATCH",
        json: {
          status: editForm.status,
          amount_yuan: Number(editForm.amount_yuan),
          note: editForm.note.trim() || null,
        },
      });
      setModalOpen(false);
      await loadList();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editing) return;
    if (!window.confirm("确定删除该订金记录？")) return;
    try {
      await apiFetch(`/api/admin/deposits/${editing.id}`, { method: "DELETE" });
      setModalOpen(false);
      await loadList();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="w-full px-3 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">订金管理</h1>
          <p className="text-sm text-stone-500">登记、核销与调整订金；可与预订关联。</p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="rounded-xl bg-brand-coral px-4 py-2 text-sm font-medium text-white"
        >
          登记订金
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
        >
          <option value="">全部状态</option>
          {DEPOSIT_STATUS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {loading && <p className="mt-3 text-sm text-stone-500">加载中…</p>}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
            <tr>
              <th className="px-3 py-2">手机</th>
              <th className="px-3 py-2">金额</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">关联预订</th>
              <th className="px-3 py-2">创建时间</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr
                key={d.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(d.id, el);
                  else rowRefs.current.delete(d.id);
                }}
                data-deposit-id={d.id}
                className={`border-b border-stone-100 hover:bg-stone-50 ${
                  focusId === String(d.id) ? "bg-amber-50 ring-1 ring-amber-200" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono">{d.customer_phone}</td>
                <td className="px-3 py-2">¥{d.amount_yuan.toFixed(2)}</td>
                <td className="px-3 py-2">{depLabel(d.status)}</td>
                <td className="px-3 py-2">
                  {d.reservation_id ? (
                    <Link
                      to={`/admin/reservations?edit=${d.reservation_id}`}
                      className="text-brand-coral hover:underline"
                    >
                      #{d.reservation_id}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-stone-500">{d.created_at ?? "—"}</td>
                <td className="px-3 py-2">
                  <button type="button" className="text-brand-coral hover:underline" onClick={() => openEditRow(d)}>
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
        <span>
          共 {total} 条 · 第 {page} 页
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <button
            type="button"
            disabled={page * pageSize >= total}
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </div>

      {modalOpen && !editing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <form onSubmit={onCreate} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="font-display text-lg font-semibold">登记订金</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-stone-500">关联预订 ID（可选）</span>
                <input
                  inputMode="numeric"
                  value={createForm.reservation_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, reservation_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                  placeholder="留空表示不关联"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">客户手机</span>
                <input
                  required
                  pattern="^1\d{10}$"
                  inputMode="numeric"
                  value={createForm.customer_phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, customer_phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">金额（元）</span>
                <input
                  required
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={createForm.amount_yuan}
                  onChange={(e) => setCreateForm((f) => ({ ...f, amount_yuan: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">备注</span>
                <textarea
                  value={createForm.note}
                  onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl px-4 py-2 text-sm text-stone-600">
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "提交中…" : "创建"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalOpen && editing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <form onSubmit={onSaveEdit} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="font-display text-lg font-semibold">编辑订金 #{editing.id}</h2>
            <p className="mt-1 text-xs text-stone-500">手机 {editing.customer_phone}</p>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-stone-500">状态</span>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                >
                  {DEPOSIT_STATUS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">金额（元）</span>
                <input
                  required
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={editForm.amount_yuan}
                  onChange={(e) => setEditForm((f) => ({ ...f, amount_yuan: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">备注</span>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void onDelete()}
                className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700"
              >
                删除
              </button>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl px-4 py-2 text-sm text-stone-600">
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
