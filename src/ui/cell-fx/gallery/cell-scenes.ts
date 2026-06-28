import { drawProceduralOrbitParticles } from '../particles.ts';
import { roundedRectPath } from '../../primitives/index.ts';
import { drawHiddenCellSprite, drawSpriteInCell, type TileSprites } from '../../tile-sprites.ts';
import type { CellEffectDrawOpts, CellMode } from './types.ts';
import { DIGIT_COLORS, DIGIT_PARTICLE_MS } from './types.ts';
import { breathPhase, hoverStateOpts, layoutCell, paintStageBg } from './utils.ts';

export function drawHiddenCellWithEffect(
  ctx: CanvasRenderingContext2D,
  sprites: TileSprites,
  cellX: number,
  cellY: number,
  cellSize: number,
  opts: CellEffectDrawOpts = {},
): void {
  const scale = opts.scale ?? 1;
  const lift = opts.lift ?? 0;
  const brightness = opts.brightness ?? 0;
  const ringAlpha = opts.ringAlpha ?? 0;
  const ringWidth = opts.ringWidth ?? 2;
  const innerGlow = opts.innerGlow ?? 0;

  const cx = cellX + cellSize / 2;
  const cy = cellY + cellSize / 2 + lift;
  const drawSize = cellSize * scale;
  const x = cx - drawSize / 2;
  const y = cy - drawSize / 2;
  const corner = Math.max(6, drawSize * 0.08);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.shadowColor = 'rgba(15, 23, 42, 0.9)';
  ctx.shadowBlur = drawSize * 0.26;
  ctx.fillStyle = '#020617';
  roundedRectPath(ctx, x + drawSize * 0.08, y + drawSize * 0.12, drawSize * 0.84, drawSize * 0.88, corner);
  ctx.fill();
  ctx.restore();

  if (innerGlow > 0) {
    ctx.save();
    ctx.globalAlpha = innerGlow;
    const g = ctx.createRadialGradient(cx, cy - drawSize * 0.12, 0, cx, cy, drawSize * 0.75);
    g.addColorStop(0, 'rgba(125, 211, 252, 0.52)');
    g.addColorStop(0.58, 'rgba(99, 102, 241, 0.24)');
    g.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, drawSize * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (ringAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = '#7dd3fc';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
    ctx.shadowBlur = drawSize * 0.14;
    ctx.lineWidth = ringWidth;
    roundedRectPath(ctx, x - 2, y - 2, drawSize + 4, drawSize + 4, corner + 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  if (brightness !== 0) {
    ctx.filter = `brightness(${1 + brightness})`;
  }
  drawHiddenCellSprite(ctx, sprites, x, y, drawSize);
  ctx.restore();

  if (ringAlpha > 0.35) {
    ctx.save();
    ctx.globalAlpha = ringAlpha * 0.32;
    const hi = ctx.createLinearGradient(x, y, x, y + drawSize * 0.45);
    hi.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    hi.addColorStop(1, 'rgba(255, 255, 255, 0)');
    roundedRectPath(ctx, x + 4, y + 4, drawSize - 8, drawSize * 0.42, corner - 2);
    ctx.fillStyle = hi;
    ctx.fill();
    ctx.restore();
  }
}

export function drawOpenCell(
  ctx: CanvasRenderingContext2D,
  sprites: TileSprites,
  x: number,
  y: number,
  size: number,
  pulse = 0,
): void {
  ctx.save();
  ctx.globalAlpha = 0.18 + pulse * 0.15;
  ctx.shadowColor = 'rgba(52, 211, 153, 0.62)';
  ctx.shadowBlur = size * 0.2;
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2;
  roundedRectPath(ctx, x - 3, y - 3, size + 6, size + 6, size * 0.1);
  ctx.stroke();
  ctx.restore();

  drawSpriteInCell(ctx, sprites.revealed, x, y, size);

  ctx.save();
  ctx.globalAlpha = 0.12 + pulse * 0.1;
  const hi = ctx.createLinearGradient(x, y, x + size, y + size);
  hi.addColorStop(0, 'rgba(255, 255, 255, 0)');
  hi.addColorStop(0.5, 'rgba(255, 255, 255, 0.42)');
  hi.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hi;
  roundedRectPath(ctx, x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84, size * 0.08);
  ctx.fill();
  ctx.restore();
}

export function drawCellScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  mode: CellMode,
  tMs: number,
): void {
  paintStageBg(ctx, w, h);
  const cell = layoutCell(w, h, 0.56);
  if (mode === 'open') {
    drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, 0.5);
    return;
  }
  if (mode === 'hover') {
    drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size, hoverStateOpts(1));
    return;
  }
  if (mode === 'breath') {
    drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size, breathPhase(tMs));
    return;
  }
  drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size);
}

export function drawDigitParticles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  tMs: number,
  seed = 0,
  cycleMs = DIGIT_PARTICLE_MS,
): void {
  const phase = (tMs % cycleMs) / cycleMs;
  drawProceduralOrbitParticles(ctx, cx, cy, size, color, phase, seed, 18, {
    radiusBase: 0.32,
    radiusStep: 0.034,
    dotBase: 0.018,
    dotStep: 0.006,
    alphaBase: 0.2,
    alphaPulse: 0.72,
    shadow: true,
  });
}

export function drawDigitScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  digitIndex: number,
  tMs: number,
): void {
  paintStageBg(ctx, w, h);
  const cell = layoutCell(w, h, 0.56);
  const cx = cell.x + cell.size / 2;
  const cy = cell.y + cell.size / 2;
  const color = DIGIT_COLORS[digitIndex % DIGIT_COLORS.length];
  const wave = Math.sin((tMs / DIGIT_PARTICLE_MS) * Math.PI * 2);

  ctx.save();
  ctx.globalAlpha = 0.28 + (wave + 1) * 0.08;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell.size * 0.7);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, cell.size * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, 0.28);
  drawDigitParticles(ctx, cx, cy, cell.size, color, tMs, digitIndex);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = cell.size * 0.11;
  drawSpriteInCell(ctx, sprites.numbers[digitIndex], cell.x, cell.y, cell.size);
  ctx.restore();
}
