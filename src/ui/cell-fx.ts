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
import { drawHiddenCellSprite, getTileSprites } from './tile-sprites.ts';

export interface BoardPointerState {
  row: number;
  col: number;
  pressed: boolean;
}

const DIGIT_COLORS = [
  '#60a5fa',
  '#34d399',
  '#f87171',
  '#fbbf24',
  '#c084fc',
  '#22d3ee',
  '#ec4899',
  '#fb923c',
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

export interface OrbitParticleStyle {
  radiusBase?: number;
  radiusStep?: number;
  dotBase?: number;
  dotStep?: number;
  alphaBase?: number;
  alphaPulse?: number;
  driftScale?: number;
  shadow?: boolean;
}

/** Orbit particles with phase in [0,1); phase 0 and 1 share identical layout (seamless loop). */
export function drawProceduralOrbitParticles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  phase: number,
  seed: number,
  count: number,
  style: OrbitParticleStyle = {},
): void {
  const spin = phase * Math.PI * 2 + seed * 0.3;
  const radiusBase = style.radiusBase ?? 0.3;
  const radiusStep = style.radiusStep ?? 0.03;
  const dotBase = style.dotBase ?? 0.014;
  const dotStep = style.dotStep ?? 0.005;
  const alphaBase = style.alphaBase ?? 0.16;
  const alphaPulse = style.alphaPulse ?? 0.5;
  const driftScale = style.driftScale ?? 0.035;

  for (let i = 0; i < count; i += 1) {
    const orbitDir = i % 2 === 0 ? 1 : -1;
    const angle = i * 2.399 + spin * orbitDir;
    const drift = Math.sin(spin + i * 1.7) * size * driftScale;
    const radius = size * (radiusBase + (i % 5) * radiusStep) + drift;
    const p = (phase + i * 0.071) % 1;
    const alpha = alphaBase + Math.sin(p * Math.PI) * alphaPulse;
    const dot = size * (dotBase + (i % 3) * dotStep);
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius * 0.72;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (style.shadow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = dot * 5;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, dot, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
  const drawSize = Math.max(size * 1.45, 52);
  drawProceduralOrbitParticles(ctx, cx, cy, drawSize, color, phase, seed, 14, {
    radiusBase: 0.34,
    radiusStep: 0.044,
    dotBase: 0.024,
    dotStep: 0.009,
    alphaBase: 0.26,
    alphaPulse: 0.74,
    driftScale: 0.045,
    shadow: true,
  });
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
    (nowMs % tuning.cycleMs) / tuning.cycleMs,
    cx,
    cy,
    g.cellSize * tuning.spriteW,
    g.cellSize * tuning.spriteH,
    tuning.spriteAlpha * (0.72 + (wave + 1) * 0.14),
    { loop: true },
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
  drawHiddenCellSprite(ctx, sprites, drawX, drawY, drawSize);
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
  const fxSize = Math.max(g.cellSize, 34);
  const usedSprite = drawFxSpriteFrame(
    ctx,
    'digit-particles',
    progress,
    cx,
    cy,
    fxSize * tuning.spriteW,
    fxSize * tuning.spriteH,
    tuning.spriteAlpha,
    { loop: true },
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
    { loop: true },
  );

  if (flag) {
    const sway = Math.sin(progress * Math.PI * 2) * 0.035;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sway);
    drawImageContained(
      ctx,
      flag,
      -g.cellSize / 2,
      -g.cellSize / 2,
      g.cellSize,
      g.cellSize,
      GAME_ASSET_TUNING.cutouts.flagScale * 1.08,
    );
    ctx.restore();
  } else {
    drawImageContained(ctx, img, x, y, g.cellSize, g.cellSize, GAME_ASSET_TUNING.cutouts.flagScale);
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function drawSmokePuff(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  radius: number,
  alpha: number,
): void {
  if (alpha <= 0.01) return;
  const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
  g.addColorStop(0, `rgba(203, 213, 225, ${alpha * 0.55})`);
  g.addColorStop(0.45, `rgba(100, 116, 139, ${alpha * 0.32})`);
  g.addColorStop(1, 'rgba(71, 85, 105, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Forward burst smoke during detonation (progress 0→1). */
export function drawMineBurstSmoke(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  progress: number,
  intensity = 1,
): void {
  const t = clamp01(progress);
  if (t <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i += 1) {
    const seed = i * 2.17;
    const stagger = (i / 14) * 0.32;
    const puffT = clamp01((t - stagger) / 0.68);
    if (puffT <= 0) continue;
    const rise = puffT * cellSize * (0.18 + (i % 4) * 0.05);
    const spread = Math.sin(seed * 1.3) * cellSize * 0.16 * puffT;
    const px = cx + spread;
    const py = cy - rise + cellSize * 0.04;
    const radius = cellSize * (0.07 + (i % 3) * 0.028) * (0.45 + puffT * 0.95);
    const alpha = intensity * (1 - puffT * 0.55) * 0.5;
    drawSmokePuff(ctx, px, py, radius, alpha);
  }
  ctx.restore();
}

/** Gentle rising smoke after the blast has settled. */
export function drawMineSettledSmoke(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  nowMs: number,
  intensity = 1,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i += 1) {
    const seed = i * 1.91;
    const cycle = 2600 + (i % 4) * 420;
    const phase = ((nowMs + seed * 140) % cycle) / cycle;
    const life = Math.sin(phase * Math.PI);
    if (life <= 0.05) continue;
    const rise = phase * cellSize * 0.52;
    const spread = Math.sin(seed) * cellSize * 0.11;
    const px = cx + spread;
    const py = cy - rise + cellSize * 0.06;
    const radius = cellSize * (0.05 + (i % 3) * 0.022) * (0.7 + life * 0.5);
    const alpha = intensity * life * 0.34;
    drawSmokePuff(ctx, px, py, radius, alpha);
  }
  ctx.restore();
}

export function drawMineScorchMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.ellipse(cx, cy + cellSize * 0.12, cellSize * 0.33, cellSize * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function resolveMineCutout(status: GameStatus, isHitMine = false): GameCutoutName {
  if (isHitMine) return 'mine-cracked';
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

  if (
    !view.revealed &&
    !view.flagged &&
    options.status === 'idle' &&
    !isPointer
  ) {
    drawCellBreathOverlay(ctx, x, y, g, options.nowMs);
  }

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
