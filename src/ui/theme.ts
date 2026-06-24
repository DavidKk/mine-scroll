export const CELL_GAP = 3;
export const DEFAULT_CELL_SIZE = 36;
export const PANEL_RADIUS = 12;
export const GRID_PADDING = 12;
export const HUD_HEIGHT = 58;
export const HUD_GAP = 10;

/** Modern UI fonts (DM Sans + IBM Plex Mono loaded in index.html). */
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
  canvasBg: '#09090b',
  panelBg: '#18181b',
  panelElevated: '#1f1f23',
  panelBorder: 'rgba(255, 255, 255, 0.08)',

  cellHidden: '#27272a',
  cellHiddenHighlight: '#323238',
  cellHiddenBorder: 'rgba(255, 255, 255, 0.07)',
  cellRevealed: '#1a1f2e',
  cellRevealedBorder: 'rgba(129, 140, 248, 0.28)',

  accent: '#6366f1',
  accentSoft: 'rgba(99, 102, 241, 0.14)',
  accentMuted: 'rgba(99, 102, 241, 0.45)',
  success: '#22c55e',
  successSoft: 'rgba(34, 197, 94, 0.14)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245, 158, 11, 0.14)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239, 68, 68, 0.14)',

  shadow: 'rgba(0, 0, 0, 0.4)',

  flagPole: '#a1a1aa',
  flagCloth: '#ef4444',

  mineBody: '#27272a',
  mineCore: '#ef4444',
  mineSpark: '#fca5a5',

  hudPanelBg: 'rgba(24, 24, 27, 0.82)',
  hudPillBg: 'rgba(39, 39, 42, 0.9)',
  hudPillBorder: 'rgba(255, 255, 255, 0.08)',
  hudText: '#fafafa',
  hudMuted: '#71717a',
  hudAccent: '#6366f1',
  hudWarn: '#f59e0b',

  resetBg: '#27272a',
  resetBgHover: '#3f3f46',
  resetIcon: '#a1a1aa',
  resetWon: '#22c55e',
  resetLost: '#ef4444',

  boardFrameBorder: 'rgba(255, 255, 255, 0.1)',
  boardFrameGlow: 'rgba(99, 102, 241, 0.06)',

  overlayScrim: 'rgba(9, 9, 11, 0.72)',

  numbers: [
    '',
    '#60a5fa',
    '#4ade80',
    '#f472b6',
    '#fbbf24',
    '#fb923c',
    '#a78bfa',
    '#f87171',
    '#94a3b8',
  ] as const,
} as const;

/** Shrink cells on large boards to keep canvas in viewport; fixedCellSize forces a fixed width. */
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

/** Fit cell size to viewport and reserved chrome (mobile: contain; desktop: use computeEndlessBoardCellSize). */
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
