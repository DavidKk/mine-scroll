export const CELL_GAP = 3;
export const DEFAULT_CELL_SIZE = 36;
export const PANEL_RADIUS = 14;
export const GRID_PADDING = 14;
export const HUD_HEIGHT = 58;
export const HUD_GAP = 10;

export interface GridMetrics {
  cellSize: number;
  cellGap: number;
  cellStep: number;
  cellRadius: number;
}

export const THEME = {
  canvasBg: '#16161f',
  panelBg: '#1c1c28',
  panelBorder: 'rgba(255,255,255,0.06)',

  cellHidden: '#2a2a3d',
  cellHiddenHighlight: '#35354a',
  cellRevealed: '#222230',
  cellRevealedBorder: 'rgba(255,255,255,0.04)',

  shadow: 'rgba(0,0,0,0.35)',
  glow: 'rgba(99,102,241,0.15)',

  flagPole: '#94a3b8',
  flagCloth: '#f43f5e',

  mineBody: '#1e1e2e',
  mineCore: '#ef4444',
  mineSpark: '#fca5a5',

  hudPillBg: '#0f0f16',
  hudPillBorder: 'rgba(255,255,255,0.08)',
  hudText: '#e2e8f0',
  hudAccent: '#818cf8',

  resetBg: '#2d2d42',
  resetBgHover: '#3d3d58',
  resetIcon: '#e2e8f0',
  resetWon: '#34d399',
  resetLost: '#f87171',

  numbers: [
    '',
    '#60a5fa',
    '#4ade80',
    '#fb7185',
    '#c084fc',
    '#fbbf24',
    '#2dd4bf',
    '#f472b6',
    '#94a3b8',
  ] as const,
} as const;

/** 大棋盘时自动缩小格子，避免 Canvas 超出视口；fixedCellSize 强制固定格宽 */
export function computeGridMetrics(
  rows: number,
  cols: number,
  maxGrid?: { width: number; height: number },
  fixedCellSize?: number,
): GridMetrics {
  if (fixedCellSize !== undefined) {
    return {
      cellSize: fixedCellSize,
      cellGap: CELL_GAP,
      cellStep: fixedCellSize + CELL_GAP,
      cellRadius: Math.max(4, Math.round(fixedCellSize * 0.19)),
    };
  }

  const maxGridW = maxGrid?.width ?? 540;
  const maxGridH = maxGrid?.height ?? 440;
  const padding = GRID_PADDING * 2;

  const fromWidth = Math.floor((maxGridW - padding + CELL_GAP) / cols - CELL_GAP);
  const fromHeight = Math.floor((maxGridH - padding + CELL_GAP) / rows - CELL_GAP);
  const cellSize = Math.max(22, Math.min(DEFAULT_CELL_SIZE, fromWidth, fromHeight));

  return {
    cellSize,
    cellGap: CELL_GAP,
    cellStep: cellSize + CELL_GAP,
    cellRadius: Math.max(4, Math.round(cellSize * 0.19)),
  };
}

export function getCanvasSize(
  rows: number,
  cols: number,
  grid: GridMetrics,
): { width: number; height: number } {
  const gridWidth = cols * grid.cellStep - grid.cellGap + GRID_PADDING * 2;
  const gridHeight = rows * grid.cellStep - grid.cellGap + GRID_PADDING * 2;
  return { width: gridWidth, height: HUD_HEIGHT + HUD_GAP + gridHeight };
}

export function getGridOrigin(): { x: number; y: number } {
  return { x: GRID_PADDING, y: HUD_HEIGHT + HUD_GAP + GRID_PADDING };
}

export function cellPixelOrigin(
  row: number,
  col: number,
  gridOriginX: number,
  gridOriginY: number,
  grid: GridMetrics,
): { x: number; y: number } {
  return {
    x: gridOriginX + col * grid.cellStep,
    y: gridOriginY + row * grid.cellStep,
  };
}
