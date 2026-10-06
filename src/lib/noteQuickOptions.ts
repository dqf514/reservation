export const DEFAULT_NOTE_QUICK_OPTIONS = [
  "靠窗",
  "宝宝椅",
  "生日",
  "纪念日",
  "安静位",
  "不吃辣",
] as const;

export const NOTE_QUICK_OPTIONS_MAX = 20;

export function parseNoteQuickOptionText(raw: string): string[] {
  const uniq = new Set<string>();
  raw
    .split(/[\n,，]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((x) => uniq.add(x));
  return Array.from(uniq).slice(0, NOTE_QUICK_OPTIONS_MAX);
}
