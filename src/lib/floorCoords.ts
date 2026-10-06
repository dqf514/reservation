/** 将指针坐标转为平面图容器内百分比（0–100），与桌台中心点对齐。 */

export function clientPointToContainerPercent(
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const w = rect.width || 1;
  const h = rect.height || 1;
  const x = ((clientX - rect.left) / w) * 100;
  const y = ((clientY - rect.top) / h) * 100;
  return {
    x: roundPercent(clamp(x, 0, 100)),
    y: roundPercent(clamp(y, 0, 100)),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function roundPercent(v: number): number {
  return Math.round(v * 100) / 100;
}
