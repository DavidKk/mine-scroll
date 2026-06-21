import type { CellView, GameStatus } from '../core/types.ts';
import type { AiHintDisplay } from '../core/ai/types.ts';
import {
  GRID_PADDING,
  HUD_HEIGHT,
  HUD_GAP,
  PANEL_RADIUS,
  FONTS,
  THEME,
  cellPixelOrigin,
  computeGridMetrics,
  getGridOrigin,
  type GridMetrics,
} from './theme.ts';
import { drawImageContained, getGameCutout } from './game-assets.ts';
import { drawSpriteInCell, getTileSprites } from './tile-sprites.ts';

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

function drawHiddenCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
): void {
  fillRoundRect(ctx, x, y, g.cellSize, g.cellSize, g.cellRadius, THEME.cellHidden);
  strokeRoundRect(
    ctx,
    x + 0.5,
    y + 0.5,
    g.cellSize - 1,
    g.cellSize - 1,
    g.cellRadius,
    THEME.cellHiddenBorder,
  );
  // 顶部微高光
  const hi = ctx.createLinearGradient(x, y, x, y + g.cellSize * 0.45);
  hi.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
  hi.addColorStop(1, 'rgba(255, 255, 255, 0)');
  fillRoundRect(ctx, x + 1, y + 1, g.cellSize - 2, g.cellSize * 0.42, g.cellRadius, hi);
}

function drawRevealedCellBg(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
): void {
  fillRoundRect(ctx, x, y, g.cellSize, g.cellSize, g.cellRadius, THEME.cellRevealed);
  strokeRoundRect(
    ctx,
    x + 0.5,
    y + 0.5,
    g.cellSize - 1,
    g.cellSize - 1,
    g.cellRadius,
    THEME.cellRevealedBorder,
  );
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
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 8 * scale);
    glow.addColorStop(0, 'rgba(255, 34, 102, 0.65)');
    glow.addColorStop(0.5, 'rgba(255, 0, 170, 0.25)');
    glow.addColorStop(1, 'rgba(255, 0, 170, 0)');
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
  align: 'left' | 'right' | 'center',
): void {
  fillRoundRect(ctx, x, y, w, h, h / 2, THEME.hudPillBg);
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2, THEME.hudPillBorder);

  ctx.fillStyle = THEME.hudAccent;
  ctx.font = `700 22px ${FONTS.mono}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const tx =
    align === 'left' ? x + 14 : align === 'right' ? x + w - 14 : x + w / 2;
  ctx.fillText(text, tx, y + h / 2);
}

function hudPillWidth(text: string, min = 48, max = 88): number {
  return Math.min(max, Math.max(min, text.length * 13 + 22));
}

/** 旗子画在格子之上 */
function drawCellMarksOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  view: CellView,
  g: GridMetrics,
): void {
  if (view.revealed || !view.flagged) return;

  const gameFlag = getGameCutout('flag-blue');
  if (gameFlag) {
    drawImageContained(ctx, gameFlag, x, y, g.cellSize, g.cellSize, 1.18);
    return;
  }

  const sprites = getTileSprites();
  if (sprites) {
    drawSpriteInCell(ctx, sprites.flag, x, y, g.cellSize);
    return;
  }

  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;
  drawFlag(ctx, cx, cy, g.cellSize);
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  view: CellView,
  g: GridMetrics,
): void {
  const sprites = getTileSprites();
  if (sprites) {
    if (!view.revealed) {
      drawSpriteInCell(ctx, sprites.hidden, x, y, g.cellSize);
      return;
    }

    if (view.isMine) {
      drawSpriteInCell(ctx, sprites.revealed, x, y, g.cellSize);
      const gameMine = getGameCutout('mine-standard');
      if (gameMine) {
        drawImageContained(ctx, gameMine, x, y, g.cellSize, g.cellSize, 1.1);
      } else {
        drawSpriteInCell(ctx, sprites.mine, x, y, g.cellSize);
      }
      return;
    }

    const n = view.adjacentMines ?? 0;
    if (n > 0 && n <= sprites.numbers.length) {
      drawSpriteInCell(ctx, sprites.numbers[n - 1]!, x, y, g.cellSize);
      return;
    }

    drawSpriteInCell(ctx, sprites.revealed, x, y, g.cellSize);
    return;
  }

  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;

  if (!view.revealed) {
    drawHiddenCell(ctx, x, y, g);
    return;
  }

  drawRevealedCellBg(ctx, x, y, g);

  if (view.isMine) {
    const gameMine = getGameCutout('mine-standard');
    if (gameMine) {
      drawImageContained(ctx, gameMine, x, y, g.cellSize, g.cellSize, 1.1);
    } else {
      drawMine(ctx, cx, cy, g.cellSize, true);
    }
    return;
  }

  if (view.adjacentMines && view.adjacentMines > 0) {
    const color = THEME.numbers[view.adjacentMines] ?? THEME.hudText;
    const fontSize = Math.max(12, Math.round(g.cellSize * 0.48));
    ctx.font = `600 ${fontSize}px ${FONTS.mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(String(view.adjacentMines), cx, cy + 0.5);
  }
}

export interface ScrollPressureState {
  /** 剩余整秒（显示用） */
  seconds: number;
  /** 0→1，越满越接近上移 */
  progress: number;
  /** 最后 3 秒高亮 */
  urgent: boolean;
  /** 本次卷轴事件会离屏的行数 */
  batchRows?: number;
}

export interface RenderState {
  views: CellView[];
  rows: number;
  cols: number;
  status: GameStatus;
  mineTotal: number;
  flagCount: number;
  elapsedSeconds: number;
  hudLeftDisplay?: string;
  /** 无尽：消雷数（独立胶囊，靠左、重开按钮前） */
  hudDefusedDisplay?: string;
  /** 覆盖右侧 HUD（无尽模式卷轴倒计时） */
  hudRightDisplay?: string;
  /** 无尽卷轴：准备上移压迫感 UI */
  scrollPressure?: ScrollPressureState;
  /** AI 建议高亮（屏幕行坐标） */
  aiHint?: AiHintDisplay | null;
}

function drawScrollPressureBar(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  pressure: ScrollPressureState,
): void {
  const { gridWidth } = layout;
  const gridTop = HUD_HEIGHT + HUD_GAP;
  const barY = gridTop + 2;
  const barH = 5;
  const barW = gridWidth - GRID_PADDING * 2;
  const barX = GRID_PADDING;

  ctx.save();

  fillRoundRect(ctx, barX, barY, barW, barH, 3, 'rgba(39, 39, 42, 0.95)');
  const fillW = Math.max(barH, barW * pressure.progress);
  fillRoundRect(
    ctx,
    barX,
    barY,
    fillW,
    barH,
    3,
    pressure.urgent ? THEME.danger : THEME.warning,
  );

  const batchNote = pressure.batchRows && pressure.batchRows > 1 ? ` ×${pressure.batchRows}` : '';
  const label = pressure.urgent
    ? `上移${batchNote} · ${pressure.seconds}s`
    : `倒数${batchNote} · ${pressure.seconds}s`;
  const fontSize = pressure.urgent ? 12 : 11;
  ctx.font = `600 ${fontSize}px ${FONTS.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pressure.urgent ? '#fca5a5' : '#fcd34d';
  ctx.fillText(label, barX + barW / 2, HUD_HEIGHT + HUD_GAP / 2);

  ctx.restore();
}

/** 即将离屏行警戒色带（不绘制数字，避免与盘面冲突） */
function drawScrollDangerBand(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  pressure: ScrollPressureState,
  visibleRows: number,
): void {
  const { gridOriginX, gridOriginY, gridWidth, grid } = layout;
  const coveredRows = Math.max(1, Math.min(visibleRows, Math.floor(pressure.batchRows ?? 1)));
  const startScreenRow = Math.max(0, visibleRows - coveredRows);
  const rowY = gridOriginY + startScreenRow * grid.cellStep;
  const rowH = (coveredRows - 1) * grid.cellStep + grid.cellSize;
  const bandAlpha = pressure.urgent ? 0.32 : 0.12 + pressure.progress * 0.1;
  const bandW = gridWidth - GRID_PADDING * 2 + 4;

  ctx.save();

  fillRoundRect(
    ctx,
    gridOriginX - 2,
    rowY - 2,
    bandW,
    rowH + 4,
    grid.cellRadius + 2,
    pressure.urgent ? `rgba(239, 68, 68, ${bandAlpha})` : `rgba(245, 158, 11, ${bandAlpha})`,
  );

  if (pressure.urgent) {
    strokeRoundRect(
      ctx,
      gridOriginX - 2,
      rowY - 2,
      bandW,
      rowH + 4,
      grid.cellRadius + 2,
      'rgba(239, 68, 68, 0.5)',
      1.5,
    );
  }

  ctx.restore();
}

function drawAiHint(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  hint: AiHintDisplay,
): void {
  const { gridOriginX, gridOriginY, grid } = layout;
  const { x, y } = cellPixelOrigin(hint.row, hint.col, gridOriginX, gridOriginY, grid);

  const isGuess = hint.confidence === 'guess';
  const color =
    hint.kind === 'flag'
      ? 'rgba(239, 68, 68, 0.28)'
      : hint.kind === 'unflag'
        ? 'rgba(251, 146, 60, 0.28)'
        : hint.kind === 'chord'
          ? 'rgba(99, 102, 241, 0.28)'
          : isGuess
            ? 'rgba(245, 158, 11, 0.28)'
            : 'rgba(34, 197, 94, 0.28)';

  ctx.save();
  fillRoundRect(ctx, x - 2, y - 2, grid.cellSize + 4, grid.cellSize + 4, grid.cellRadius + 2, color);
  strokeRoundRect(
    ctx,
    x - 2,
    y - 2,
    grid.cellSize + 4,
    grid.cellSize + 4,
    grid.cellRadius + 2,
    isGuess ? THEME.warning : THEME.accent,
    2,
  );
  ctx.restore();
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  state: RenderState,
): void {
  const { width, height, gridOriginX, gridOriginY, resetButton, gridWidth, gridHeight, grid } =
    layout;

  ctx.clearRect(0, 0, width, height);

  // Canvas background
  fillRoundRect(ctx, 0, 0, width, height, PANEL_RADIUS, THEME.canvasBg);
  strokeRoundRect(ctx, 0.5, 0.5, width - 1, height - 1, PANEL_RADIUS, THEME.panelBorder);

  // HUD
  fillRoundRect(ctx, GRID_PADDING / 2, 6, width - GRID_PADDING, HUD_HEIGHT - 6, 10, THEME.panelBg);

  const pillH = 34;
  const pillY = (HUD_HEIGHT - pillH) / 2;
  const hudLeft =
    state.hudLeftDisplay ?? String(state.mineTotal - state.flagCount).padStart(3, '0');
  const leftPillW = hudPillWidth(
    hudLeft,
    state.hudLeftDisplay?.includes('♥') ? 72 : 48,
    state.hudLeftDisplay?.includes('♥') ? 80 : 88,
  );
  drawHudPill(ctx, 12, pillY, leftPillW, pillH, hudLeft, 'left');

  const resetGap = 8;
  if (state.hudDefusedDisplay) {
    const defusedPillW = hudPillWidth(state.hudDefusedDisplay, 56, 118);
    const defusedX = Math.max(
      12 + leftPillW + 6,
      resetButton.x - resetGap - defusedPillW,
    );
    drawHudPill(ctx, defusedX, pillY, defusedPillW, pillH, state.hudDefusedDisplay, 'center');
  }

  const hudRight =
    state.hudRightDisplay ?? String(state.elapsedSeconds).padStart(3, '0');
  const rightPillW = hudPillWidth(hudRight, 48, state.hudRightDisplay?.startsWith('↑') ? 80 : 72);
  drawHudPill(
    ctx,
    width - rightPillW - 12,
    pillY,
    rightPillW,
    pillH,
    hudRight,
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

  if (state.scrollPressure && state.status === 'playing') {
    drawScrollPressureBar(ctx, layout, state.scrollPressure);
  }

  for (const view of state.views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawCell(ctx, x, y, view, grid);
  }

  for (const view of state.views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawCellMarksOverlay(ctx, x, y, view, grid);
  }

  if (state.scrollPressure && state.status === 'playing') {
    drawScrollDangerBand(ctx, layout, state.scrollPressure, state.rows);
  }

  if (state.aiHint && state.status !== 'lost') {
    drawAiHint(ctx, layout, state.aiHint);
  }
}

export function renderBoardOnlyFrame(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  state: RenderState,
): void {
  const { width, height, gridOriginX, gridOriginY, gridWidth, gridHeight, grid } = layout;

  ctx.clearRect(0, 0, width, height);

  fillRoundRect(ctx, 0, 0, gridWidth, gridHeight, PANEL_RADIUS, THEME.panelBg);
  strokeRoundRect(ctx, 0.5, 0.5, gridWidth - 1, gridHeight - 1, PANEL_RADIUS, THEME.boardFrameBorder);
  strokeRoundRect(
    ctx,
    3,
    3,
    gridWidth - 6,
    gridHeight - 6,
    PANEL_RADIUS - 2,
    THEME.boardFrameGlow,
    1,
  );

  for (const view of state.views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawCell(ctx, x, y, view, grid);
  }

  for (const view of state.views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawCellMarksOverlay(ctx, x, y, view, grid);
  }

  if (state.scrollPressure && state.status === 'playing') {
    drawScrollDangerBand(ctx, layout, state.scrollPressure, state.rows);
  }

  if (state.aiHint && state.status !== 'lost') {
    drawAiHint(ctx, layout, state.aiHint);
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

  const { grid } = layout;
  const col = Math.floor(localX / grid.cellStep);
  const row = Math.floor(localY / grid.cellStep);
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;

  const inCellX = localX - col * grid.cellStep;
  const inCellY = localY - row * grid.cellStep;
  if (inCellX > grid.cellSize || inCellY > grid.cellSize) return null;

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
