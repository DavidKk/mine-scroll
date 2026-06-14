import type { CellView, GameStatus } from '../core/types.ts';
import {
  CELL_GAP,
  CELL_RADIUS,
  CELL_SIZE,
  CELL_STEP,
  GRID_PADDING,
  HUD_GAP,
  HUD_HEIGHT,
  PANEL_RADIUS,
  THEME,
  cellPixelOrigin,
  getGridOrigin,
} from './theme.ts';

export interface LayoutMetrics {
  width: number;
  height: number;
  gridOriginX: number;
  gridOriginY: number;
  gridWidth: number;
  gridHeight: number;
  resetButton: { x: number; y: number; size: number };
}

export function getLayoutMetrics(rows: number, cols: number): LayoutMetrics {
  const gridWidth = cols * CELL_STEP - CELL_GAP + GRID_PADDING * 2;
  const gridHeight = rows * CELL_STEP - CELL_GAP + GRID_PADDING * 2;
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
  };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke: string,
  lineWidth = 1,
): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawHiddenCell(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const grad = ctx.createLinearGradient(x, y, x, y + CELL_SIZE);
  grad.addColorStop(0, THEME.cellHiddenHighlight);
  grad.addColorStop(1, THEME.cellHidden);
  fillRoundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS, grad);
  strokeRoundRect(ctx, x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1, CELL_RADIUS, THEME.panelBorder);
}

function drawRevealedCellBg(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  fillRoundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS, THEME.cellRevealed);
  strokeRoundRect(ctx, x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1, CELL_RADIUS, THEME.cellRevealedBorder);
}

function drawFlag(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const px = cx - 5;
  const py = cy - 7;
  ctx.strokeStyle = THEME.flagPole;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py + 14);
  ctx.stroke();

  ctx.fillStyle = THEME.flagCloth;
  ctx.beginPath();
  ctx.moveTo(px + 1, py);
  ctx.lineTo(px + 11, py + 4);
  ctx.lineTo(px + 1, py + 8);
  ctx.closePath();
  ctx.fill();
}

function drawMine(ctx: CanvasRenderingContext2D, cx: number, cy: number, explosive: boolean): void {
  const r = 9;
  if (explosive) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 6);
    glow.addColorStop(0, 'rgba(239,68,68,0.45)');
    glow.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = THEME.mineBody;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = THEME.mineCore;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = THEME.mineSpark;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (r + 2), cy + Math.sin(angle) * (r + 2));
    ctx.lineTo(cx + Math.cos(angle) * (r + 6), cy + Math.sin(angle) * (r + 6));
    ctx.stroke();
  }
}

function drawStatusIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  status: GameStatus,
): void {
  ctx.strokeStyle =
    status === 'won' ? THEME.resetWon : status === 'lost' ? THEME.resetLost : THEME.resetIcon;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (status === 'won') {
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx - 2, cy + 7);
    ctx.lineTo(cx + 9, cy - 6);
    ctx.stroke();
    return;
  }

  if (status === 'lost') {
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 7);
    ctx.lineTo(cx + 7, cy + 7);
    ctx.moveTo(cx + 7, cy - 7);
    ctx.lineTo(cx - 7, cy + 7);
    ctx.stroke();
    return;
  }

  if (status === 'playing') {
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // idle — refresh arrow
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0.2 * Math.PI, 1.6 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 8, cy - 5);
  ctx.lineTo(cx + 11, cy - 1);
  ctx.lineTo(cx + 6, cy + 1);
  ctx.closePath();
  ctx.fill();
}

function drawHudPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  align: 'left' | 'right',
): void {
  fillRoundRect(ctx, x, y, w, h, h / 2, THEME.hudPillBg);
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2, THEME.hudPillBorder);

  ctx.fillStyle = THEME.hudAccent;
  ctx.font = '600 22px "SF Mono", "JetBrains Mono", "Fira Code", monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const tx = align === 'left' ? x + 14 : x + w - 14;
  ctx.fillText(text, tx, y + h / 2);
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  view: CellView,
): void {
  const cx = x + CELL_SIZE / 2;
  const cy = y + CELL_SIZE / 2;

  if (view.flagged && !view.revealed) {
    drawHiddenCell(ctx, x, y);
    drawFlag(ctx, cx, cy);
    return;
  }

  if (!view.revealed) {
    drawHiddenCell(ctx, x, y);
    return;
  }

  drawRevealedCellBg(ctx, x, y);

  if (view.isMine) {
    drawMine(ctx, cx, cy, true);
    return;
  }

  if (view.adjacentMines && view.adjacentMines > 0) {
    ctx.fillStyle = THEME.numbers[view.adjacentMines] ?? THEME.hudText;
    ctx.font = '700 17px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(view.adjacentMines), cx, cy + 0.5);
  }
}

export interface RenderState {
  views: CellView[];
  rows: number;
  cols: number;
  status: GameStatus;
  mineTotal: number;
  flagCount: number;
  elapsedSeconds: number;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  state: RenderState,
): void {
  const { width, height, gridOriginX, gridOriginY, resetButton, gridWidth, gridHeight } = layout;

  ctx.clearRect(0, 0, width, height);

  // Canvas background
  fillRoundRect(ctx, 0, 0, width, height, PANEL_RADIUS, THEME.canvasBg);
  strokeRoundRect(ctx, 0.5, 0.5, width - 1, height - 1, PANEL_RADIUS, THEME.panelBorder);

  // HUD
  fillRoundRect(ctx, GRID_PADDING / 2, 6, width - GRID_PADDING, HUD_HEIGHT - 6, 10, THEME.panelBg);

  const pillW = 72;
  const pillH = 34;
  const pillY = (HUD_HEIGHT - pillH) / 2;
  const mineRemaining = state.mineTotal - state.flagCount;
  drawHudPill(ctx, 12, pillY, pillW, pillH, String(mineRemaining).padStart(3, '0'), 'left');
  drawHudPill(
    ctx,
    width - pillW - 12,
    pillY,
    pillW,
    pillH,
    String(state.elapsedSeconds).padStart(3, '0'),
    'right',
  );

  fillRoundRect(
    ctx,
    resetButton.x,
    resetButton.y,
    resetButton.size,
    resetButton.size,
    resetButton.size / 2,
    THEME.resetBg,
  );
  strokeRoundRect(
    ctx,
    resetButton.x + 0.5,
    resetButton.y + 0.5,
    resetButton.size - 1,
    resetButton.size - 1,
    resetButton.size / 2,
    THEME.panelBorder,
  );
  drawStatusIcon(
    ctx,
    resetButton.x + resetButton.size / 2,
    resetButton.y + resetButton.size / 2,
    state.status,
  );

  // Grid area
  const gridTop = HUD_HEIGHT + HUD_GAP;
  fillRoundRect(ctx, 0, gridTop, gridWidth, gridHeight, 12, THEME.panelBg);

  for (const view of state.views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY);
    drawCell(ctx, x, y, view);
  }
}

export function hitTestCell(
  layout: LayoutMetrics,
  rows: number,
  cols: number,
  x: number,
  y: number,
): { row: number; col: number } | null {
  const localX = x - layout.gridOriginX;
  const localY = y - layout.gridOriginY;
  if (localX < 0 || localY < 0) return null;

  const col = Math.floor(localX / CELL_STEP);
  const row = Math.floor(localY / CELL_STEP);
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;

  const inCellX = localX - col * CELL_STEP;
  const inCellY = localY - row * CELL_STEP;
  if (inCellX > CELL_SIZE || inCellY > CELL_SIZE) return null;

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
  event: MouseEvent,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}
