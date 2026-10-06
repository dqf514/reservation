import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { CustomerItem, CustomerListResponse, CustomerProfileResponse, ReservationAdminItem } from "@/types/admin";

const emptyForm = {
  phone: "",
  display_name: "",
  email: "",
  tags: "",
  note: "",
};

export function AdminCustomersPage() {
  const [list, setList] = useState<CustomerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 选中客户与右侧详情
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [phoneProfile, setPhoneProfile] = useState<CustomerProfileResponse | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (search.trim()) params.set("q", search.trim());
      const data = await apiFetch<CustomerListResponse>(`/api/admin/customers?${params}`);
      setList(data.items);
      setTotal(data.total);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // 列表变更时，保证选中客户始终存在
  useEffect(() => {
    if (!list.length) {
      setSelectedPhone(null);
      setPhoneProfile(null);
      return;
    }
    if (selectedPhone && list.some((x) => x.phone === selectedPhone)) return;
    setSelectedPhone(list[0].phone);
  }, [list, selectedPhone]);

  useEffect(() => {
    if (!selectedPhone) return;
    let cancelled = false;
    setProfileBusy(true);
    setProfileErr(null);
    setPhoneProfile(null);
    (async () => {
      try {
        const p = await apiFetch<CustomerProfileResponse>(
          `/api/admin/customers/by-phone/${encodeURIComponent(selectedPhone)}`,
        );
        if (!cancelled) setPhoneProfile(p);
      } catch (e) {
        if (!cancelled) setProfileErr(e instanceof Error ? e.message : "加载客户详情失败");
      } finally {
        if (!cancelled) setProfileBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPhone]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  const openEdit = useCallback(async (id: number) => {
    try {
      const c = await apiFetch<CustomerItem>(`/api/admin/customers/${id}`);
      setEditingId(id);
      setForm({
        phone: c.phone,
        display_name: c.display_name,
        email: c.email ?? "",
        tags: c.tags ?? "",
        note: c.note ?? "",
      });
      setModalOpen(true);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/api/admin/customers/${editingId}`, {
          method: "PATCH",
          json: {
            display_name: form.display_name.trim(),
            email: form.email.trim() || null,
            tags: form.tags.trim(),
            note: form.note.trim() || null,
          },
        });
      } else {
        await apiFetch("/api/admin/customers", {
          method: "POST",
          json: {
            phone: form.phone.trim(),
            display_name: form.display_name.trim(),
            email: form.email.trim() || null,
            tags: form.tags.trim(),
            note: form.note.trim() || null,
          },
        });
      }
      setModalOpen(false);
      await loadList();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editingId) return;
    if (!window.confirm("确定删除该客户档案？已有预订仍可通过手机号关联，但档案将移除。")) return;
    try {
      await apiFetch(`/api/admin/customers/${editingId}`, { method: "DELETE" });
      setModalOpen(false);
      await loadList();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  function splitTags(tags: string | null | undefined) {
    if (!tags) return [];
    return tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-0 flex-1 w-full overflow-hidden">
      {/* 左侧固定列表（Tablera 对齐） */}
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-stone-200 bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-2.5">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold">食客</h1>
            <p className="mt-0.5 text-xs text-stone-500">客户档案；可补充标签与备注。</p>
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="rounded-xl bg-brand-coral px-3 py-2 text-xs font-semibold text-white"
          >
            新建
          </button>
        </div>
        <div className="border-b border-stone-100 px-3 py-2">
          <input
            type="search"
            placeholder="搜索姓名/手机"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && <p className="px-2 py-2 text-xs text-stone-500">加载中…</p>}
          {err && !loading && <p className="px-2 py-2 text-xs text-red-600">{err}</p>}

          <ul className="space-y-0.5">
            {!loading &&
              list.map((c) => {
                const active = selectedPhone === c.phone;
                const tags = splitTags(c.tags);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPhone(c.phone)}
                      className={`w-full rounded-2xl border px-3 py-1.5 text-left transition ${
                        active
                          ? "border-brand-coral/40 bg-brand-coral/10"
                          : "border-transparent hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink-900">{c.display_name || "—"}</div>
                          <div className="font-mono text-xs text-stone-500">{c.phone}</div>
                        </div>
                        <div className="shrink-0 text-xs font-semibold text-stone-600">{c.reservation_count}次</div>
                      </div>
                      {tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tags.map((t) => (
                            <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>

        <div className="border-t border-stone-100 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-stone-600">
            <span>
              共 {total} 条 · 第 {page} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="rounded-lg border px-2 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page * pageSize >= total}
                className="rounded-lg border px-2 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 右侧详情（Tablera 对齐） */}
      <section className="min-w-0 flex-1 overflow-y-auto bg-transparent p-4">
        {profileBusy && <p className="text-xs text-stone-500">识别手机号中…</p>}
        {profileErr && <p className="text-xs text-red-600">{profileErr}</p>}

        {!profileBusy && phoneProfile && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-xl font-semibold">
                    {phoneProfile.customer?.display_name || "—"}
                  </div>
                  <div className="mt-1 font-mono text-xs text-stone-500">{phoneProfile.phone}</div>
                  <div className="mt-2 text-sm text-stone-700">预订次数：{phoneProfile.reservation_count}</div>
                  {phoneProfile.customer?.last_seen_name &&
                    phoneProfile.customer.last_seen_name.trim() &&
                    phoneProfile.customer.last_seen_name.trim() !==
                      (phoneProfile.customer.display_name || "").trim() && (
                      <div className="mt-2 text-xs text-stone-600">
                        最近一次姓名：{phoneProfile.customer.last_seen_name}
                      </div>
                    )}
                  {phoneProfile.customer?.alias_names &&
                    phoneProfile.customer.alias_names.length > 0 && (
                      <div className="mt-2 text-xs text-stone-600">
                        历史别名：
                        <span className="ml-1">
                          {phoneProfile.customer.alias_names.slice(0, 8).join("、")}
                          {phoneProfile.customer.alias_names.length > 8 ? "…" : ""}
                        </span>
                      </div>
                    )}
                </div>

                {phoneProfile.customer && (
                  <button
                    type="button"
                    onClick={() => void openEdit(phoneProfile.customer?.id ?? 0)}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    编辑
                  </button>
                )}
              </div>

              {phoneProfile.customer?.tags && phoneProfile.customer.tags.trim() && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {splitTags(phoneProfile.customer.tags).map((t) => (
                    <span key={t} className="rounded-full bg-brand-coral/10 px-3 py-1 text-xs font-semibold text-brand-coral">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {phoneProfile.customer?.note && phoneProfile.customer.note.trim() && (
                <div className="mt-3 text-sm text-stone-600">
                  <div className="text-xs font-semibold text-stone-500">备注</div>
                  <div className="mt-1 whitespace-pre-wrap">{phoneProfile.customer.note}</div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold">历史预订</div>
                  <div className="mt-1 text-xs text-stone-500">最近 {phoneProfile.reservations.length} 条</div>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
                      <th className="px-3 py-2">日期</th>
                      <th className="px-3 py-2">时段</th>
                      <th className="px-3 py-2">人数</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2">桌台</th>
                      <th className="px-3 py-2">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phoneProfile.reservations.map((r: ReservationAdminItem) => (
                      <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="px-3 py-2 text-xs text-stone-700">{r.reservation_date}</td>
                        <td className="px-3 py-2">{r.time_slot}</td>
                        <td className="px-3 py-2">{r.party_size}</td>
                        <td className="px-3 py-2 text-stone-600">{r.flow_status}</td>
                        <td className="px-3 py-2">{r.table_label ?? r.table_code ?? "—"}</td>
                        <td className="px-3 py-2 text-stone-600">{r.note ?? "—"}</td>
                      </tr>
                    ))}
                    {phoneProfile.reservations.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-xs text-stone-400">
                          暂无历史预订
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <form
            onSubmit={onSubmit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 className="font-display text-lg font-semibold">{editingId ? "编辑客户" : "新建客户"}</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-stone-500">手机（11 位）</span>
                <input
                  required
                  disabled={!!editingId}
                  inputMode="numeric"
                  pattern="^1\d{10}$"
                  title="请输入 11 位中国大陆手机号"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 disabled:bg-stone-100"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">称呼</span>
                <input
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">邮箱</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">标签</span>
                <input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">备注</span>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700"
                >
                  删除
                </button>
              )}
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
