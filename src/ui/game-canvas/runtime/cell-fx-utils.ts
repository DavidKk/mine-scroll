import type { LayoutMetrics } from '../../renderer/index.ts';

export function cellPixelForFx(
  row: number,
  col: number,
  gridOriginX: number,
  gridOriginY: number,
  grid: LayoutMetrics['grid'],
): { x: number; y: number } {
  return {
    x: gridOriginX + col * grid.cellStep,
    y: gridOriginY + row * grid.cellStep,
  };
}
