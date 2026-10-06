import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  DEFAULT_NOTE_QUICK_OPTIONS,
  NOTE_QUICK_OPTIONS_MAX,
  parseNoteQuickOptionText,
} from "@/lib/noteQuickOptions";

type Props = {
  /** 弹窗/表单打开时为 true，关闭时收起编辑区并重新拉取最新列表 */
  active?: boolean;
  onPick: (text: string) => void;
};

export function NoteQuickOptionsBar({ active = true, onPick }: Props) {
  const [options, setOptions] = useState<string[]>([...DEFAULT_NOTE_QUICK_OPTIONS]);
  const [editOpen, setEditOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [overflow, setOverflow] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) {
      setEditOpen(false);
      setDrawerOpen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetch<string[]>("/api/admin/reservations/note-quick-options");
        if (!cancelled && Array.isArray(rows) && rows.length > 0) {
          setOptions(rows);
        }
      } catch {
        // 保留当前/默认列表
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const el = wrapRef.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollHeight > el.clientHeight + 1);
    check();
    const id = window.requestAnimationFrame(check);
    window.addEventListener("resize", check);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", check);
    };
  }, [active, options, editOpen]);

  async function saveFromDraft() {
    const parsed = parseNoteQuickOptionText(draft);
    if (parsed.length === 0) {
      window.alert("请至少保留一个备注备选项");
      return;
    }
    if (parsed.length > NOTE_QUICK_OPTIONS_MAX) {
      window.alert(`最多 ${NOTE_QUICK_OPTIONS_MAX} 条备选项`);
      return;
    }
    setSaving(true);
    try {
      const saved = await apiFetch<string[]>("/api/admin/reservations/note-quick-options", {
        method: "PUT",
        json: { items: parsed },
      });
      setOptions(Array.isArray(saved) && saved.length > 0 ? saved : parsed);
      setEditOpen(false);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-start gap-1.5">
        <div
          ref={wrapRef}
          className="flex max-h-[3.25rem] min-w-0 flex-1 flex-wrap gap-1.5 overflow-hidden"
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onPick(opt)}
              className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600 hover:bg-stone-100"
            >
              {opt}
            </button>
          ))}
        </div>
        {overflow && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="shrink-0 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-600 hover:bg-stone-50"
            title="查看全部备选项"
          >
            ...
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setDraft(options.join("，"));
            setEditOpen((v) => !v);
          }}
          className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100"
        >
          编辑
        </button>
      </div>
      {editOpen && (
        <div className="mt-2 rounded-lg border border-stone-200 bg-white p-2">
          <p className="text-[11px] text-stone-500">
            以逗号或换行分隔，最多 {NOTE_QUICK_OPTIONS_MAX} 条；保存后全店同步。
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-stone-200 px-2 py-1.5 text-xs"
            placeholder="例如：靠窗，宝宝椅，生日"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] text-stone-600"
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveFromDraft()}
              className="rounded-lg bg-ink-900 px-2.5 py-1 text-[11px] text-white disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      )}
      {drawerOpen && (
        <div className="fixed inset-0 z-[70] bg-black/20" onClick={() => setDrawerOpen(false)}>
          <div
            className="absolute right-4 top-16 h-[min(80vh,640px)] w-[320px] rounded-2xl border border-stone-200 bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">全部备注备选</h3>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
              >
                关闭
              </button>
            </div>
            <div className="mt-2 max-h-[calc(100%-2.5rem)] overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => (
                  <button
                    key={`drawer-${opt}`}
                    type="button"
                    onClick={() => onPick(opt)}
                    className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
