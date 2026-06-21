import type { CellView, GameStatus } from '../core/types.ts';
import type { AiHintDisplay } from '../core/ai/types.ts';
import {
  GRID_PADDING,
  HUD_GAP,
  HUD_HEIGHT,
  PANEL_RADIUS,
  THEME,
} from './theme.ts';

export interface HexRenderState {
  views: CellView[];
  status: GameStatus;
  mineTotal: number;
  flagCount: number;
  elapsedSeconds: number;
  hudLeftDisplay?: string;
  aiHint?: AiHintDisplay | null;
}

const SQRT3 = Math.sqrt(3);

export interface HexLayoutMetrics {
  hexSize: number;
  hexWidth: number;
  hexVertStep: number;
  gridOriginX: number;
  gridOriginY: number;
  gridWidth: number;
  gridHeight: number;
  width: number;
  height: number;
  resetButton: { x: number; y: number; size: number };
  hexRadius: number;
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

/** flat-top 六边形，odd-r 偏移 */
export function getHexLayoutMetrics(hexRadius: number): HexLayoutMetrics {
  const rows = hexRadius * 2 + 1;
  const cols = rows;
  const maxGridW = 540;
  const maxGridH = 440;
  const padding = GRID_PADDING * 2;

  const fromWidth = (maxGridW - padding) / ((cols + 0.5) * SQRT3);
  const fromHeight = (maxGridH - padding) / ((rows - 1) * 1.5 + 2);
  const hexSize = Math.max(14, Math.min(22, fromWidth, fromHeight));

  const hexWidth = SQRT3 * hexSize;
  const hexVertStep = 1.5 * hexSize;
  const gridWidth = hexWidth * (cols + 0.5) + GRID_PADDING * 2;
  const gridHeight = hexVertStep * (rows - 1) + hexSize * 2 + GRID_PADDING * 2;
  const resetSize = 40;

  return {
    hexSize,
    hexWidth,
    hexVertStep,
    gridOriginX: GRID_PADDING,
    gridOriginY: HUD_HEIGHT + HUD_GAP + GRID_PADDING,
    gridWidth,
    gridHeight,
    width: gridWidth,
    height: HUD_HEIGHT + HUD_GAP + gridHeight,
    resetButton: { x: (gridWidth - resetSize) / 2, y: (HUD_HEIGHT - resetSize) / 2, size: resetSize },
    hexRadius,
  };
}

export function hexCellCenter(
  layout: HexLayoutMetrics,
  row: number,
  col: number,
): { cx: number; cy: number } {
  const cx = layout.gridOriginX + (col + 0.5 * (row & 1)) * layout.hexWidth;
  const cy = layout.gridOriginY + row * layout.hexVertStep + layout.hexSize;
  return { cx, cy };
}

function hexCornerPoints(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return points;
}

function traceHexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const pts = hexCornerPoints(cx, cy, size - 0.5);
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.closePath();
}

function drawHiddenHex(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  traceHexPath(ctx, cx, cy, size);
  const grad = ctx.createLinearGradient(cx, cy - size, cx, cy + size);
  grad.addColorStop(0, THEME.cellHiddenHighlight);
  grad.addColorStop(1, THEME.cellHidden);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = THEME.panelBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawRevealedHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  traceHexPath(ctx, cx, cy, size);
  ctx.fillStyle = THEME.cellRevealed;
  ctx.fill();
  ctx.strokeStyle = THEME.cellRevealedBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFlag(ctx: CanvasRenderingContext2D, cx: number, cy: number, cellSize: number): void {
  const scale = cellSize / 36;
  const px = cx - 5 * scale;
  const py = cy - 7 * scale;
  ctx.strokeStyle = THEME.flagPole;
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py + 14 * scale);
  ctx.stroke();

  ctx.fillStyle = THEME.flagCloth;
  ctx.beginPath();
  ctx.moveTo(px + scale, py);
  ctx.lineTo(px + 11 * scale, py + 4 * scale);
  ctx.lineTo(px + scale, py + 8 * scale);
  ctx.closePath();
  ctx.fill();
}

function drawMine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  explosive: boolean,
): void {
  const scale = cellSize / 36;
  const r = 9 * scale;
  if (explosive) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 6 * scale);
    glow.addColorStop(0, 'rgba(239,68,68,0.45)');
    glow.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = THEME.mineBody;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = THEME.mineCore;
  ctx.beginPath();
  ctx.arc(cx, cy, 5 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = THEME.mineSpark;
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (r + 2 * scale), cy + Math.sin(angle) * (r + 2 * scale));
    ctx.lineTo(cx + Math.cos(angle) * (r + 6 * scale), cy + Math.sin(angle) * (r + 6 * scale));
    ctx.stroke();
  }
}

function drawHexCell(
  ctx: CanvasRenderingContext2D,
  layout: HexLayoutMetrics,
  view: CellView,
): void {
  const { cx, cy } = hexCellCenter(layout, view.row, view.col);
  const size = layout.hexSize;

  if (!view.revealed) {
    drawHiddenHex(ctx, cx, cy, size);
    return;
  }

  drawRevealedHex(ctx, cx, cy, size);

  if (view.isMine) {
    drawMine(ctx, cx, cy, size * 2, true);
    return;
  }

  if (view.adjacentMines && view.adjacentMines > 0) {
    ctx.fillStyle = THEME.numbers[view.adjacentMines] ?? THEME.hudText;
    const fontSize = Math.max(12, Math.round(size * 0.85));
    ctx.font = `700 ${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(view.adjacentMines), cx, cy + 0.5);
  }
}

function drawHexMarks(
  ctx: CanvasRenderingContext2D,
  layout: HexLayoutMetrics,
  view: CellView,
): void {
  if (view.revealed) return;
  const { cx, cy } = hexCellCenter(layout, view.row, view.col);
  if (view.flagged) {
    drawFlag(ctx, cx, cy, layout.hexSize * 2);
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

export function renderHexFrame(
  ctx: CanvasRenderingContext2D,
  layout: HexLayoutMetrics,
  state: HexRenderState,
): void {
  const { width, height, resetButton, gridWidth, gridHeight } = layout;

  ctx.clearRect(0, 0, width, height);

  fillRoundRect(ctx, 0, 0, width, height, PANEL_RADIUS, THEME.canvasBg);
  strokeRoundRect(ctx, 0.5, 0.5, width - 1, height - 1, PANEL_RADIUS, THEME.panelBorder);

  fillRoundRect(ctx, GRID_PADDING / 2, 6, width - GRID_PADDING, HUD_HEIGHT - 6, 10, THEME.panelBg);

  const pillW = 72;
  const pillH = 34;
  const pillY = (HUD_HEIGHT - pillH) / 2;
  const mineRemaining = String(state.mineTotal - state.flagCount).padStart(3, '0');
  drawHudPill(ctx, 12, pillY, pillW, pillH, mineRemaining, 'left');
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

  const gridTop = HUD_HEIGHT + HUD_GAP;
  fillRoundRect(ctx, 0, gridTop, gridWidth, gridHeight, 12, THEME.panelBg);

  for (const view of state.views) {
    drawHexCell(ctx, layout, view);
  }

  for (const view of state.views) {
    drawHexMarks(ctx, layout, view);
  }

  if (state.aiHint && state.status !== 'lost') {
    const hintView = state.views.find(
      (v) => v.row === state.aiHint!.row && v.col === state.aiHint!.col,
    );
    if (hintView) {
      const { cx, cy } = hexCellCenter(layout, hintView.row, hintView.col);
      const isGuess = state.aiHint.confidence === 'guess';
      const stroke =
        state.aiHint.kind === 'flag'
          ? 'rgba(244, 63, 94, 0.95)'
          : state.aiHint.kind === 'unflag'
            ? 'rgba(251, 146, 60, 0.95)'
            : state.aiHint.kind === 'chord'
            ? 'rgba(129, 140, 248, 0.95)'
            : isGuess
              ? 'rgba(251, 191, 36, 0.95)'
              : 'rgba(52, 211, 153, 0.95)';
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        const px = cx + layout.hexSize * Math.cos(angle);
        const py = cy + layout.hexSize * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }
}

function pointInHex(px: number, py: number, cx: number, cy: number, size: number): boolean {
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  const h = size * SQRT3;
  if (dx > h / 2 || dy > size) return false;
  return h * size - h * dy - size * dx >= 0;
}

export function hitTestHexCell(
  layout: HexLayoutMetrics,
  views: CellView[],
  x: number,
  y: number,
): { row: number; col: number } | null {
  let best: { row: number; col: number; dist: number } | null = null;

  for (const view of views) {
    const { cx, cy } = hexCellCenter(layout, view.row, view.col);
    if (!pointInHex(x, y, cx, cy, layout.hexSize)) continue;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (!best || dist < best.dist) {
      best = { row: view.row, col: view.col, dist };
    }
  }

  return best ? { row: best.row, col: best.col } : null;
}

export function hitTestHexReset(layout: HexLayoutMetrics, x: number, y: number): boolean {
  const { resetButton } = layout;
  const cx = resetButton.x + resetButton.size / 2;
  const cy = resetButton.y + resetButton.size / 2;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= (resetButton.size / 2) ** 2;
}
