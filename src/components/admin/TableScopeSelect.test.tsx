import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TableScopeSelect, type TableScopeOption } from "./TableScopeSelect";

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

const OPTIONS: TableScopeOption[] = [
  { value: "5D", label: "5D Room", badge: "房间", total: 120 },
  { value: "c1", label: "C1", total: 35 },
  { value: "v1", label: "V1", total: 0 },
];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(node: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(node);
  });
  return container;
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("TableScopeSelect", () => {
  it("未选择时展示「全店」与总人数", () => {
    const el = render(
      <TableScopeSelect
        value=""
        options={OPTIONS}
        onChange={() => {}}
        allLabel="全店"
        allTotal={999}
      />,
    );
    const btn = el.querySelector("button");
    expect(btn?.textContent).toContain("全店");
    expect(btn?.textContent).toContain("999 人");
  });

  it("选中项展示名称、房间角标与淡色总人数", () => {
    const el = render(
      <TableScopeSelect
        value="5D"
        options={OPTIONS}
        onChange={() => {}}
        allTotal={999}
      />,
    );
    const btn = el.querySelector("button");
    expect(btn?.textContent).toContain("5D Room");
    expect(btn?.textContent).toContain("房间");
    expect(btn?.textContent).toContain("120 人");
    // 总人数使用更淡的字体颜色
    const total = Array.from(btn?.querySelectorAll("span") ?? []).find(
      (s) => s.textContent?.trim() === "120 人",
    );
    expect(total?.className).toContain("text-stone-400");
  });

  it("展开后列出全部选项（含总人数）并可回调选择", () => {
    const picked: string[] = [];
    const el = render(
      <TableScopeSelect
        value=""
        options={OPTIONS}
        onChange={(v) => picked.push(v)}
        allTotal={999}
      />,
    );
    const btn = el.querySelector("button")!;
    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const listbox = el.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    const text = listbox?.textContent ?? "";
    expect(text).toContain("全店");
    expect(text).toContain("5D Room");
    expect(text).toContain("35 人");
    expect(text).toContain("0 人");

    const opt = Array.from(listbox?.querySelectorAll('[role="option"]') ?? []).find(
      (o) => o.textContent?.includes("C1"),
    );
    act(() => {
      opt?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(picked).toEqual(["c1"]);
  });
});
