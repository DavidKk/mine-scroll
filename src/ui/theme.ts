export const CELL_SIZE = 36;
export const CELL_GAP = 3;
export const CELL_STEP = CELL_SIZE + CELL_GAP;
export const CELL_RADIUS = 7;
export const PANEL_RADIUS = 14;
export const GRID_PADDING = 14;
export const HUD_HEIGHT = 58;
export const HUD_GAP = 10;

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

  /** 现代数字配色 */
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

export type StatusKind = 'idle' | 'playing' | 'won' | 'lost';

export function getCanvasSize(rows: number, cols: number): { width: number; height: number } {
  const gridWidth = cols * CELL_STEP - CELL_GAP + GRID_PADDING * 2;
  const gridHeight = rows * CELL_STEP - CELL_GAP + GRID_PADDING * 2;
  const width = gridWidth;
  const height = HUD_HEIGHT + HUD_GAP + gridHeight;
  return { width, height };
}

export function getGridOrigin(): { x: number; y: number } {
  return { x: GRID_PADDING, y: HUD_HEIGHT + HUD_GAP + GRID_PADDING };
}

export function cellPixelOrigin(row: number, col: number, gridOriginX: number, gridOriginY: number): { x: number; y: number } {
  return {
    x: gridOriginX + col * CELL_STEP,
    y: gridOriginY + row * CELL_STEP,
  };
}
