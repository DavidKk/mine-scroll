import {
  GRID_PADDING,
  HUD_HEIGHT,
  HUD_GAP,
  computeGridMetrics,
  getGridOrigin,
  type GridMetrics,
} from '../theme.ts';

export interface LayoutMetrics {
  width: number;
  height: number;
  gridOriginX: number;
  gridOriginY: number;
  gridWidth: number;
  gridHeight: number;
  resetButton: { x: number; y: number; size: number };
  grid: GridMetrics;
}

export function getLayoutMetrics(
  rows: number,
  cols: number,
  maxGrid?: { width: number; height: number },
  fixedCellSize?: number,
): LayoutMetrics {
  const grid = computeGridMetrics(rows, cols, maxGrid, fixedCellSize);
  const gridWidth = cols * grid.cellStep - grid.cellGap + GRID_PADDING * 2;
  const gridHeight = rows * grid.cellStep - grid.cellGap + GRID_PADDING * 2;
  const origin = getGridOrigin();
  const resetSize = 40;
  const resetX = (gridWidth - resetSize) / 2;
  const resetY = (HUD_HEIGHT - resetSize) / 2;

  return {
    width: gridWidth,
    height: HUD_HEIGHT + HUD_GAP + gridHeight,
    gridOriginX: origin.x,
    gridOriginY: origin.y,
    gridWidth,
    gridHeight,
    resetButton: { x: resetX, y: resetY, size: resetSize },
    grid,
  };
}

export function getBoardOnlyLayoutMetrics(
  rows: number,
  cols: number,
  maxGrid?: { width: number; height: number },
  fixedCellSize?: number,
): LayoutMetrics {
  const grid = computeGridMetrics(rows, cols, maxGrid, fixedCellSize);
  const gridWidth = cols * grid.cellStep - grid.cellGap + GRID_PADDING * 2;
  const gridHeight = rows * grid.cellStep - grid.cellGap + GRID_PADDING * 2;

  return {
    width: gridWidth,
    height: gridHeight,
    gridOriginX: GRID_PADDING,
    gridOriginY: GRID_PADDING,
    gridWidth,
    gridHeight,
    resetButton: { x: -9999, y: -9999, size: 0 },
    grid,
  };
}

/** Endless top preview band: half-hidden row area above the board; playable origin shifts down. */
export function applyBoardPreviewBand(
  layout: LayoutMetrics,
  previewRows: number,
): LayoutMetrics {
  if (previewRows <= 0) return layout;
  const band = previewRows * layout.grid.cellStep;
  return {
    ...layout,
    height: layout.height + band,
    gridOriginY: layout.gridOriginY + band,
    gridHeight: layout.gridHeight + band,
  };
}
