import type { LayoutMetrics } from './layout.ts';

export function hitTestCell(
  layout: LayoutMetrics,
  rows: number,
  cols: number,
  x: number,
  y: number,
): { row: number; col: number } | null {
  return hitTestCellWithPreview(layout, rows, cols, 0, x, y);
}

export function hitTestCellWithPreview(
  layout: LayoutMetrics,
  rows: number,
  cols: number,
  previewRows: number,
  x: number,
  y: number,
): { row: number; col: number } | null {
  const localX = x - layout.gridOriginX;
  const localY = y - layout.gridOriginY;
  if (localX < 0) return null;

  const { grid } = layout;
  const previewBandTop = -previewRows * grid.cellStep;
  if (localY < previewBandTop) return null;

  const col = Math.floor(localX / grid.cellStep);
  if (col < 0 || col >= cols) return null;

  const inCellX = localX - col * grid.cellStep;
  if (inCellX > grid.cellSize) return null;

  const row = Math.floor(localY / grid.cellStep);

  if (row === -1 && previewRows > 0) {
    const inCellY = localY - row * grid.cellStep;
    if (inCellY > grid.cellSize) return null;
    const visibleFromTop = grid.cellSize - previewRows * grid.cellStep;
    if (inCellY < visibleFromTop) return null;
    return { row: -1, col };
  }

  if (row < 0 || row >= rows) return null;

  const inCellY = localY - row * grid.cellStep;
  if (inCellY > grid.cellSize) return null;

  return { row, col };
}

export function hitTestReset(layout: LayoutMetrics, x: number, y: number): boolean {
  const { resetButton } = layout;
  const cx = resetButton.x + resetButton.size / 2;
  const cy = resetButton.y + resetButton.size / 2;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= (resetButton.size / 2) ** 2;
}

export function getCanvasPointerCoords(
  canvas: HTMLCanvasElement,
  event: MouseEvent | PointerEvent,
  logicalSize?: { width: number; height: number },
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }
  const lw = logicalSize?.width ?? rect.width;
  const lh = logicalSize?.height ?? rect.height;
  return {
    x: ((event.clientX - rect.left) / rect.width) * lw,
    y: ((event.clientY - rect.top) / rect.height) * lh,
  };
}
