import type { CellView, GameStatus } from '../../core/types.ts';
import { FONTS, THEME, type GridMetrics } from '../theme.ts';
import { GAME_ASSET_TUNING, drawImageVisibleContained, getGameCutout } from '../game-assets.ts';
import { getTileSprites } from '../tile-sprites.ts';
import { fillRoundRect, strokeRoundRect } from './primitives.ts';

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
  const inset = ctx.createLinearGradient(x, y, x, y + g.cellSize);
  inset.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  inset.addColorStop(0.38, 'rgba(0, 0, 0, 0.08)');
  inset.addColorStop(1, 'rgba(255, 255, 255, 0.025)');
  fillRoundRect(ctx, x + 1, y + 1, g.cellSize - 2, g.cellSize - 2, Math.max(2, g.cellRadius - 1), inset);
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

export function drawStatusIcon(
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

export function drawHudPill(
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

export function hudPillWidth(text: string, min = 48, max = 88): number {
  return Math.min(max, Math.max(min, text.length * 13 + 22));
}

export function drawCellMarksOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  view: CellView,
  g: GridMetrics,
): void {
  if (view.revealed || !view.flagged) return;

  const gameFlag = getGameCutout('flag-blue');
  if (gameFlag) {
    drawImageVisibleContained(ctx, gameFlag, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.cutouts.flagScale);
    return;
  }

  const sprites = getTileSprites();
  if (sprites) {
    drawImageVisibleContained(ctx, sprites.flag, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.cutouts.flagScale);
    return;
  }

  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;
  drawFlag(ctx, cx, cy, g.cellSize * GAME_ASSET_TUNING.cutouts.flagScale);
}

export function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  view: CellView,
  g: GridMetrics,
): void {
  const sprites = getTileSprites();
  if (sprites) {
    if (!view.revealed) {
      drawImageVisibleContained(ctx, sprites.hidden, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.tiles.cellScale);
      return;
    }

    if (view.isMine) {
      drawImageVisibleContained(ctx, sprites.revealed, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.tiles.cellScale);
      const gameMine = getGameCutout('mine-standard');
      if (gameMine) {
        drawImageVisibleContained(ctx, gameMine, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.cutouts.mineScale);
      } else {
        drawImageVisibleContained(ctx, sprites.mine, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.cutouts.mineScale);
      }
      return;
    }

    const n = view.adjacentMines ?? 0;
    if (n > 0 && n <= sprites.digits.length) {
      drawImageVisibleContained(ctx, sprites.revealed, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.tiles.cellScale);
      drawImageVisibleContained(ctx, sprites.digits[n - 1]!, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.tiles.digitScale);
      return;
    }

    if (n > 0 && n <= sprites.numbers.length) {
      drawImageVisibleContained(ctx, sprites.numbers[n - 1]!, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.tiles.cellScale);
      return;
    }

    drawRevealedCellBg(ctx, x, y, g);
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
      drawImageVisibleContained(ctx, gameMine, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.cutouts.mineScale);
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
