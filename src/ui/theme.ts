export const CELL_GAP = 3;
export const DEFAULT_CELL_SIZE = 36;
export const PANEL_RADIUS = 12;
export const GRID_PADDING = 12;
export const HUD_HEIGHT = 58;
export const HUD_GAP = 10;

/** 现代 UI 字体（index.html 加载 DM Sans + IBM Plex Mono） */
export const FONTS = {
  display: '"DM Sans", "Segoe UI", system-ui, sans-serif',
  mono: '"IBM Plex Mono", "SF Mono", monospace',
} as const;

export interface GridMetrics {
  cellSize: number;
  cellGap: number;
  cellStep: number;
  cellRadius: number;
}

export const THEME = {
  /** Neon-Noir v1 — see docs/DESIGN-AI-PROMPTS.md §3 */
  canvasBg: '#060912',
  panelBg: '#0e1420',
  panelElevated: '#151d2e',
  panelBorder: 'rgba(0, 184, 255, 0.22)',

  cellHidden: '#1a2233',
  cellHiddenHighlight: '#243044',
  cellHiddenBorder: 'rgba(0, 184, 255, 0.12)',
  cellRevealed: '#0a0e16',
  cellRevealedBorder: 'rgba(0, 184, 255, 0.06)',

  accent: '#00b8ff',
  accentSoft: 'rgba(0, 184, 255, 0.14)',
  accentMuted: 'rgba(0, 184, 255, 0.45)',
  info: '#00b8ff',
  success: '#00e676',
  successSoft: 'rgba(0, 230, 118, 0.14)',
  warning: '#ffb020',
  warningSoft: 'rgba(255, 176, 32, 0.14)',
  urgent: '#ff7800',
  urgentSoft: 'rgba(255, 120, 0, 0.14)',
  danger: '#ff3344',
  dangerSoft: 'rgba(255, 51, 68, 0.14)',
  chord: '#b44aff',
  epic: '#e040fb',

  shadow: 'rgba(0, 0, 0, 0.5)',

  flagPole: '#8899aa',
  flagCloth: '#00b8ff',

  mineBody: '#1a2233',
  mineCore: '#ff3344',
  mineSpark: '#ff7800',

  hudPanelBg: 'rgba(14, 20, 32, 0.88)',
  hudPillBg: 'rgba(26, 34, 51, 0.92)',
  hudPillBorder: 'rgba(0, 184, 255, 0.18)',
  hudText: '#e8f4ff',
  hudMuted: '#6b8299',
  hudAccent: '#00b8ff',
  hudWarn: '#ffb020',

  resetBg: '#1a2233',
  resetBgHover: '#243044',
  resetIcon: '#8899aa',
  resetWon: '#00e676',
  resetLost: '#ff3344',

  boardFrameBorder: 'rgba(0, 184, 255, 0.18)',
  boardFrameGlow: 'rgba(0, 184, 255, 0.08)',

  overlayScrim: 'rgba(6, 9, 18, 0.78)',

  numbers: [
    '',
    '#00b8ff',
    '#00e676',
    '#ff4757',
    '#b44aff',
    '#00e5ff',
    '#ffb020',
    '#e040fb',
    '#ffd740',
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
      cellRadius: Math.max(4, Math.round(fixedCellSize * 0.14)),
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
    cellRadius: Math.max(4, Math.round(cellSize * 0.14)),
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

/** 按视口与预留区拟合格子尺寸（mobile：contain；desktop 请用 computeEndlessBoardCellSize） */
export function computeViewportCellSize(
  cols: number,
  rows: number,
  viewportW: number,
  viewportH: number,
  reserves: { safe: number; top: number; bottom: number },
  limits: { min?: number; max?: number; fillHeight?: boolean } = {},
): number {
  const min = limits.min ?? 18;
  const requestedMax = limits.max ?? DEFAULT_CELL_SIZE;
  const aestheticMax =
    viewportW < 520
      ? 23
      : viewportW < 760
        ? 25
        : viewportW < 1100
          ? 28
          : 30;
  const max = limits.fillHeight ? requestedMax : Math.min(requestedMax, aestheticMax);
  const pad = GRID_PADDING * 2;
  const availW = Math.max(120, viewportW - reserves.safe * 2 - pad);
  const availH = Math.max(160, viewportH - reserves.top - reserves.bottom - pad);
  const fromW = Math.floor((availW + CELL_GAP) / cols - CELL_GAP);
  const fromH = Math.floor((availH + CELL_GAP) / rows - CELL_GAP);
  return Math.max(min, Math.min(max, fromW, fromH));
}
