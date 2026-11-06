import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FloorCanvas } from "@/components/admin/FloorCanvas";
import { apiFetch } from "@/lib/api";
import { diningTableItemsToNodes } from "@/lib/diningTableNodes";
import type { DiningTableItem, TableType } from "@/types/admin";

const emptyForm = {
  code: "",
  label: "",
  shape: "circle" as "circle" | "square" | "rect_h" | "rect_v",
  pos_x: 50,
  pos_y: 50,
  pos_size: 10,
  sort_order: 0,
  capacity: 4,
  is_active: true,
  table_type: "standard" as TableType,
};

export function AdminTablesPage() {
  function normalizeShape(shape: string): "circle" | "square" | "rect_h" | "rect_v" {
    if (shape === "square") return "square";
    if (shape === "rect_h") return "rect_h";
    if (shape === "rect_v") return "rect_v";
    return "circle";
  }

  function shapeLabel(shape: string): string {
    if (shape === "square") return "方桌";
    if (shape === "rect_h") return "横向矩形";
    if (shape === "rect_v") return "纵向矩形";
    return "圆桌";
  }

  function shortName(label: string): string {
    const raw = (label || "").trim();
    if (!raw) return "";
    return raw.slice(0, 4);
  }

  function typeLabel(t: DiningTableItem): string {
    return t.table_type === "room" ? "房间" : "普通";
  }

  const [list, setList] = useState<DiningTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const raw = await apiFetch<unknown>("/api/admin/dining-tables");
      if (!Array.isArray(raw)) {
        console.error("dining-tables 非数组:", raw);
        throw new Error(
          "接口返回格式异常（非 JSON 数组）。请确认：1) 后端已启动在 8000 端口 2) 使用 npm run dev 或已为 preview 配置 API 代理 3) 已登录后台",
        );
      }
      setList(raw as DiningTableItem[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const floorNodes = useMemo(() => diningTableItemsToNodes(list), [list]);

  const commitTablePosition = useCallback(async (dbId: number, x: number, y: number) => {
    try {
      await apiFetch(`/api/admin/dining-tables/${dbId}`, {
        method: "PATCH",
        json: { pos_x: x, pos_y: y },
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存位置失败");
    } finally {
      await load();
    }
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setSelectedCode(null);
    setForm({ ...emptyForm, code: "", label: "" });
    setModalOpen(true);
  }

  function openEdit(t: DiningTableItem) {
    setEditingId(t.id);
    setSelectedCode(t.code);
    setForm({
      code: t.code,
      label: t.label,
      shape: normalizeShape(t.shape),
      pos_x: t.pos_x,
      pos_y: t.pos_y,
      pos_size: t.pos_size,
      sort_order: t.sort_order,
      capacity: t.capacity,
      is_active: t.is_active,
      table_type: t.table_type === "room" ? "room" : "standard",
    });
    setModalOpen(true);
  }

  /** 列表里快速切换「普通桌 / 房间」 */
  async function toggleTableType(t: DiningTableItem) {
    const next: TableType = t.table_type === "room" ? "standard" : "room";
    const tip =
      next === "room"
        ? `将「${t.label}」设为房间？\n房间可同时接待多组客人（按 ${t.capacity} 个座位合并计算），普通桌仍是「一桌一单」。`
        : `将「${t.label}」改回普通桌？\n改回后该桌同时段只能安排一组客人。`;
    if (!window.confirm(tip)) return;
    try {
      await apiFetch(`/api/admin/dining-tables/${t.id}`, {
        method: "PATCH",
        json: { table_type: next },
      });
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "切换失败");
    }
  }

  function onCanvasSelect(code: string) {
    setSelectedCode(code);
    const row = list.find((x) => x.code === code);
    if (row) openEdit(row);
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const code = form.code.trim();
    const label = form.label.trim();
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(code)) {
      window.alert("编号仅支持英文、数字、下划线与连字符，1–32 位");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/api/admin/dining-tables/${editingId}`, {
          method: "PATCH",
          json: {
            code,
            label,
            shape: form.shape,
            pos_x: form.pos_x,
            pos_y: form.pos_y,
            pos_size: form.pos_size,
            sort_order: form.sort_order,
            capacity: form.capacity,
            is_active: form.is_active,
            table_type: form.table_type,
          },
        });
      } else {
        await apiFetch("/api/admin/dining-tables", {
          method: "POST",
          json: {
            code,
            label,
            shape: form.shape,
            pos_x: form.pos_x,
            pos_y: form.pos_y,
            pos_size: form.pos_size,
            sort_order: form.sort_order,
            capacity: form.capacity,
            is_active: form.is_active,
            table_type: form.table_type,
          },
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(t: DiningTableItem) {
    if (
      !window.confirm(
        `确定删除餐位「${t.label}」（${t.code}）？\n若仍有预订关联此桌台，系统将拒绝删除。`,
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/admin/dining-tables/${t.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-0 w-full flex-col overflow-hidden px-3 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">餐位管理</h1>
          <p className="text-sm text-stone-500">
            下方平面图与「桌台管理」使用同一数据源；拖拽桌台即可调整位置并保存。列表可编辑编号、容量、停用等。
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="rounded-xl bg-brand-coral px-4 py-2 text-sm font-medium text-white"
        >
          新建餐位
        </button>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">加载失败</p>
          <p className="mt-1 text-red-700">{err}</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800"
            onClick={() => void load()}
          >
            重试
          </button>
        </div>
      )}

      <section className="mt-4 flex min-h-0 flex-1 gap-3 overflow-hidden">
        <aside className="flex w-[320px] min-w-0 shrink-0 flex-col rounded-2xl border border-stone-200 bg-white">
          <div className="flex items-center border-b border-stone-200 px-2 py-2">
            <h2 className="font-display text-base font-semibold text-ink-900">餐位列表</h2>
          </div>
          {loading && <p className="px-3 py-2 text-sm text-stone-500">加载中…</p>}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 text-[11px] text-stone-600">
                <tr>
                  <th className="px-2 py-1.5">名称</th>
                  <th className="px-1.5 py-1.5">容量</th>
                  <th className="px-1.5 py-1.5">类型</th>
                  <th className="px-1.5 py-1.5">形状</th>
                  <th className="px-1.5 py-1.5">状态</th>
                  <th className="px-1.5 py-1.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b border-stone-100 hover:bg-stone-50 ${selectedCode === t.code ? "bg-orange-50/80" : ""}`}
                  >
                    <td className="px-2 py-1.5 font-medium" title={t.label}>
                      {shortName(t.label)}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {t.table_type === "room" ? `${t.capacity}座` : `${t.capacity}人`}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => void toggleTableType(t)}
                        title={
                          t.table_type === "room"
                            ? "点击改为普通桌（同时段只能安排一组客人）"
                            : "点击设为房间（同时段可接待多组客人，按座位数合并计算）"
                        }
                        className={`rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${
                          t.table_type === "room"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-stone-200 bg-stone-50 text-stone-600"
                        }`}
                      >
                        {typeLabel(t)}
                      </button>
                    </td>
                    <td className="px-1.5 py-1.5">{shapeLabel(t.shape)}</td>
                    <td className="px-1.5 py-1.5">{t.is_active ? "启用" : "停用"}</td>
                    <td className="px-1.5 py-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-brand-coral hover:underline"
                        onClick={() => openEdit(t)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="ml-3 text-stone-500 hover:text-red-600 hover:underline"
                        onClick={() => void onDelete(t)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>

        <div className="min-h-0 min-w-0 flex-1">
          {loading && <p className="mb-2 text-sm text-stone-500">加载平面图数据…</p>}
          {!loading && !err && list.length === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              当前没有餐位记录。空库首次启动后端时会自动写入演示餐位；若仍为空，请确认数据库文件与后端日志。
            </p>
          )}
          {!loading && floorNodes.length > 0 && (
            <div className="h-full min-h-0">
              <FloorCanvas
                tables={floorNodes}
                selectedId={selectedCode}
                onSelect={onCanvasSelect}
                draggable
                onPositionCommit={commitTablePosition}
              />
            </div>
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <form
            onSubmit={onSubmit}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 className="font-display text-lg font-semibold">{editingId ? "编辑餐位" : "新建餐位"}</h2>
            <p className="mt-1 text-xs text-stone-500">
              平面图横纵坐标与尺寸均为相对画布的百分比（0–100），与「桌台管理」画布一致。
            </p>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-stone-500">内部编号（唯一，勿与现有重复）</span>
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="如 t21、vip_a"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-sm disabled:bg-stone-100"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">展示名称（顾客与员工可见）</span>
                <input
                  required
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-stone-500">
                    {form.table_type === "room" ? "座位数" : "容纳人数"}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-stone-500">列表排序</span>
                  <input
                    type="number"
                    required
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-stone-500">桌台类型</span>
                <select
                  value={form.table_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, table_type: e.target.value as TableType }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                >
                  <option value="standard">普通桌（同时段一桌一单）</option>
                  <option value="room">房间 / 包厢（同时段可接待多组客人）</option>
                </select>
                <span className="mt-1 block text-[11px] leading-4 text-stone-500">
                  {form.table_type === "room"
                    ? "房间按「时段」计算座位池：同一时段内所有预订与散客人数合并累加，超过座位数将被拒绝。"
                    : "普通桌同时段只能安排一组客人，一旦入席/预订即占用该桌。"}
                </span>
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">桌面形状</span>
                <select
                  value={form.shape}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      shape: e.target.value as "circle" | "square" | "rect_h" | "rect_v",
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                >
                  <option value="circle">圆桌</option>
                  <option value="square">方桌</option>
                  <option value="rect_h">横向矩形</option>
                  <option value="rect_v">纵向矩形</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                <span className="text-xs text-stone-600">启用（停用则不可用于新分配，平面图显示维护中）</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-xs text-stone-500">X 位置 %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    required
                    value={form.pos_x}
                    onChange={(e) => setForm((f) => ({ ...f, pos_x: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-2 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-stone-500">Y 位置 %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    required
                    value={form.pos_y}
                    onChange={(e) => setForm((f) => ({ ...f, pos_y: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-2 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-stone-500">尺寸 %</span>
                  <input
                    type="number"
                    min={2}
                    max={45}
                    step="any"
                    required
                    value={form.pos_size}
                    onChange={(e) => setForm((f) => ({ ...f, pos_size: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-2 py-2 text-sm"
                  />
                </label>
              </div>
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
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
