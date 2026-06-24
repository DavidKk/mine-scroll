import type { AiHintDisplay } from '../core/ai/types.ts';
import type { CellView, GameStatus } from '../core/types.ts';
import {
  GAME_ASSET_TUNING,
  drawFxSpriteFrame,
  drawImageContained,
  getGameCutout,
  type GameCutoutName,
} from './game-assets.ts';
import type { GridMetrics } from './theme.ts';
import { drawSpriteInCell, getTileSprites } from './tile-sprites.ts';

export interface BoardPointerState {
  row: number;
  col: number;
  pressed: boolean;
}

const DIGIT_COLORS = [
  '#60a5fa',
  '#34d399',
  '#f87171',
  '#a78bfa',
  '#fb7185',
  '#22d3ee',
  '#facc15',
  '#f8fafc',
];

function roundedRectPath(
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

function breathPhase(tMs: number): number {
  const cycle = GAME_ASSET_TUNING.fx.cellBreath.cycleMs;
  return Math.sin(((tMs % cycle) / cycle) * Math.PI * 2);
}

function drawWaveImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  tMs: number,
  amplitude: number,
): void {
  const segments = 4;
  const cycle = GAME_ASSET_TUNING.fx.flagWave.cycleMs;
  const phase = (tMs % cycle) / cycle;
  for (let i = 0; i < segments; i += 1) {
    const sx = (img.naturalWidth / segments) * i;
    const sw = img.naturalWidth / segments;
    const dx = x + (w / segments) * i;
    const dw = w / segments + 1;
    const local = i / Math.max(1, segments - 1);
    const wave = Math.sin(phase * Math.PI * 2 + local * Math.PI * 2.2);
    const dy = y + wave * amplitude * local;
    const dh = h * (1 + Math.cos(phase * Math.PI * 2 + local * Math.PI) * 0.02 * local);
    ctx.drawImage(img, sx, 0, sw, img.naturalHeight, dx, dy, dw, dh);
  }
}

function drawProceduralDigitParticles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  tMs: number,
  seed: number,
): void {
  const cycle = GAME_ASSET_TUNING.fx.digitParticles.cycleMs;
  const phase = (tMs % cycle) / cycle;
  for (let i = 0; i < 6; i += 1) {
    const spin = phase * Math.PI * 2 + seed * 0.3;
    const angle = i * 2.399 + spin * (i % 2 === 0 ? 0.42 : -0.28);
    const radius = size * (0.3 + (i % 5) * 0.03);
    const p = (phase + i * 0.071) % 1;
    const alpha = 0.16 + Math.sin(p * Math.PI) * 0.5;
    const dot = size * (0.014 + (i % 3) * 0.005);
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius * 0.72;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, dot, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawCellBreathOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
  nowMs: number,
): void {
  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;
  const wave = breathPhase(nowMs);
  const tuning = GAME_ASSET_TUNING.fx.cellBreath;
  const usedSprite = drawFxSpriteFrame(
    ctx,
    'cell-breath',
    ((nowMs % tuning.cycleMs) / tuning.cycleMs + 1) % 1,
    cx,
    cy,
    g.cellSize * tuning.spriteW,
    g.cellSize * tuning.spriteH,
    tuning.spriteAlpha * (0.72 + (wave + 1) * 0.14),
  );
  if (usedSprite) return;

  ctx.save();
  ctx.globalAlpha = 0.1 + (wave + 1) * 0.08;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.cellSize * 0.62);
  glow.addColorStop(0, 'rgba(129, 140, 248, 0.55)');
  glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, g.cellSize * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCellHoverOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
  pressed: boolean,
): void {
  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;
  const tuning = GAME_ASSET_TUNING.fx.cellHover;
  const usedSprite = drawFxSpriteFrame(
    ctx,
    'cell-hover',
    pressed ? 0.92 : 0.42,
    cx,
    cy,
    g.cellSize * tuning.spriteW,
    g.cellSize * tuning.spriteH,
    tuning.spriteAlpha,
  );

  const lift = pressed ? 1.5 : -1.5;
  const scale = pressed ? 0.97 : 1.04;
  const ringAlpha = pressed ? 0.3 : 0.5;
  const drawSize = g.cellSize * scale;
  const drawX = cx - drawSize / 2;
  const drawY = cy - drawSize / 2 + lift;

  if (!usedSprite) {
    ctx.save();
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = Math.max(1.5, g.cellSize * 0.04);
    roundedRectPath(ctx, drawX - 2, drawY - 2, drawSize + 4, drawSize + 4, g.cellRadius + 2);
    ctx.stroke();
    ctx.restore();
  }

  const sprites = getTileSprites();
  if (!sprites) return;
  drawSpriteInCell(ctx, sprites.hidden, drawX, drawY, drawSize);
}

export function drawDigitAmbientOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
  digit: number,
  nowMs: number,
): void {
  if (digit < 1 || digit > 8) return;
  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;
  const color = DIGIT_COLORS[digit - 1] ?? '#dbeafe';
  const tuning = GAME_ASSET_TUNING.fx.digitParticles;
  const progress = (nowMs % tuning.cycleMs) / tuning.cycleMs;
  const usedSprite = drawFxSpriteFrame(
    ctx,
    'digit-particles',
    progress,
    cx,
    cy,
    g.cellSize * tuning.spriteW,
    g.cellSize * tuning.spriteH,
    tuning.spriteAlpha,
  );
  if (!usedSprite) {
    drawProceduralDigitParticles(ctx, cx, cy, g.cellSize, color, nowMs, digit);
  }
}

export function drawSimpleFlagMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
): void {
  const flag = getGameCutout('flag-blue');
  const sprites = getTileSprites();
  const img = flag ?? sprites?.flag;
  if (!img) return;
  drawImageContained(ctx, img, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.cutouts.flagScale);
}

export function drawWavingFlagMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
  nowMs: number,
): void {
  const flag = getGameCutout('flag-blue');
  const sprites = getTileSprites();
  const img = flag ?? sprites?.flag;
  if (!img) return;

  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;
  const tuning = GAME_ASSET_TUNING.fx.flagWave;
  const progress = (nowMs % tuning.cycleMs) / tuning.cycleMs;
  drawFxSpriteFrame(
    ctx,
    'flag-wave',
    progress,
    cx,
    cy,
    g.cellSize * tuning.spriteW,
    g.cellSize * tuning.spriteH,
    tuning.spriteAlpha * 0.55,
  );

  const drawW = g.cellSize * 0.74;
  const drawH = g.cellSize * 0.74;
  if (flag) {
    drawWaveImage(ctx, flag, cx - drawW / 2, cy - drawH / 2, drawW, drawH, nowMs, g.cellSize * 0.02);
  } else {
    drawImageContained(ctx, img, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.cutouts.flagScale);
  }
}

export function resolveMineCutout(status: GameStatus, isHitMine = false): GameCutoutName {
  if (status === 'lost' && isHitMine) return 'mine-hit-flash';
  if (status === 'lost') return 'mine-exploded';
  return 'mine-standard';
}

export function drawBoardCellOverlays(
  ctx: CanvasRenderingContext2D,
  _views: CellView[],
  g: GridMetrics,
  x: number,
  y: number,
  view: CellView,
  options: {
    status: GameStatus;
    nowMs: number;
    pointer?: BoardPointerState | null;
    preview?: boolean;
  },
): void {
  if (options.preview) return;
  const isPointer =
    options.pointer &&
    options.pointer.row === view.row &&
    options.pointer.col === view.col;

  if (!view.revealed && !view.flagged && options.status === 'playing' && isPointer) {
    drawCellHoverOverlay(ctx, x, y, g, options.pointer!.pressed);
    return;
  }

  if (
    view.revealed &&
    !view.isMine &&
    (view.adjacentMines ?? 0) > 0 &&
    isPointer
  ) {
    drawDigitAmbientOverlay(ctx, x, y, g, view.adjacentMines ?? 0, options.nowMs);
  }
}

export function drawAiHintCutout(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
  hint: AiHintDisplay,
): void {
  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;
  let cutout: GameCutoutName | null = null;
  let scale = 0.62;

  if (hint.kind === 'chord') cutout = 'chord-crosshair';
  else if (hint.kind === 'flag') cutout = 'flag-danger-red';
  else if (hint.kind === 'unflag') cutout = 'flag-wrong-correction';
  else if (hint.confidence === 'guess') cutout = 'warning-triangle';
  else cutout = 'shield-safe-zone';

  const img = cutout ? getGameCutout(cutout) : null;
  if (!img) return;

  if (hint.confidence === 'guess') scale = 0.5;
  ctx.save();
  ctx.globalAlpha = 0.88;
  drawImageContained(ctx, img, cx - g.cellSize / 2, cy - g.cellSize / 2, g.cellSize, g.cellSize, scale);
  ctx.restore();
}
