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
import { drawHiddenCellUnderlay, drawSpriteInCell, getTileSprites } from './tile-sprites.ts';

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
  radiusX?: number;
  radiusY?: number;
}

export type HudFxBudget = 'normal' | 'lite';

function drawSoftFireflyDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  glow = true,
): void {
  if (glow) {
    ctx.globalAlpha = alpha * 0.34;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
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
  const radiusX = style.radiusX ?? 1;
  const radiusY = style.radiusY ?? 0.72;
  const envelope = ctx.globalAlpha;

  for (let i = 0; i < count; i += 1) {
    const orbitDir = i % 2 === 0 ? 1 : -1;
    const angle = i * 2.399 + spin * orbitDir;
    const drift = Math.sin(spin + i * 1.7) * size * driftScale;
    const radius = size * (radiusBase + (i % 5) * radiusStep) + drift;
    const p = (phase + i * 0.071) % 1;
    const alpha = (alphaBase + Math.sin(p * Math.PI) * alphaPulse) * envelope;
    const dot = size * (dotBase + (i % 3) * dotStep);
    const px = cx + Math.cos(angle) * radius * radiusX;
    const py = cy + Math.sin(angle) * radius * radiusY;
    drawSoftFireflyDot(ctx, px, py, dot, color, alpha, style.shadow ?? false);
  }
}

/** Firefly particles winding along a horizontal score strip. */
export function drawFeedbackStripLightWrap(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  primaryColor: string,
  accentColor: string,
  phase: number,
  fadeAlpha: number,
  seed: number,
  layer: 'all' | 'behind' | 'front' = 'all',
  budget: HudFxBudget = 'normal',
): void {
  if (fadeAlpha <= 0.01) return;

  const hw = width * 0.82 * (2 / 3);
  const hh = height * 0.41;
  const lite = budget === 'lite';

  const tipFade = (u: number): number => {
    if (u < 0.06) return u / 0.06;
    if (u > 0.94) return (1 - u) / 0.06;
    return 1;
  };

  type CoilPoint = { x: number; y: number; depth: number; tip: number };

  const sampleCoil = (u: number, slide: number, bulge: number): CoilPoint => {
    const coil = 2.05 + Math.sin(bulge * 0.35) * 0.18;
    const angle =
      u * coil * Math.PI * 2 +
      slide +
      Math.sin(u * 5.4 + bulge) * 0.48 +
      Math.cos(u * 3.2 + slide * 0.42) * 0.26;
    const wobbleY =
      Math.sin(u * 12.8 + slide * 1.2 + bulge) * hh * 0.12 +
      Math.sin(u * 6.7 + bulge * 0.8) * hh * 0.07;
    const wobbleX = Math.sin(u * 8.9 + slide * 0.35) * hw * 0.022;
    return {
      x: cx - hw + u * hw * 2 + wobbleX,
      y: cy + Math.sin(angle) * hh + wobbleY,
      depth: -Math.sin(angle) + Math.sin(u * 9.6 + bulge) * 0.08,
      tip: tipFade(u),
    };
  };

  type Firefly = {
    x: number;
    y: number;
    depth: number;
    alpha: number;
    color: string;
    size: number;
  };

  const hash01 = (n: number): number => {
    const x = Math.sin(n * 12.9898 + seed * 0.17) * 43758.5453;
    return x - Math.floor(x);
  };

  const particles: Firefly[] = [];
  const sizeScale = Math.max(width * 0.013, height * 0.085);
  const flyCount = lite ? 8 : 16;

  const addFly = (
    u: number,
    slide: number,
    bulge: number,
    color: string,
    seedI: number,
    trail: number,
    bright: number,
    jitterX: number,
    jitterY: number,
  ): void => {
    const uClamped = Math.max(0, Math.min(1, u));
    const pt = sampleCoil(uClamped, slide - trail * 0.12, bulge);
    if (pt.tip <= 0) return;
    const twinkleRate = 0.7 + hash01(seedI + 11) * 1.6;
    const twinkle =
      bright *
      (0.28 + Math.sin(phase * Math.PI * 2 * twinkleRate + seedI * 2.17 + trail * 0.9) * 0.72);
    const sizeJitter = 0.75 + hash01(seedI + 13) * 0.55;
    particles.push({
      x: pt.x + jitterX * (1 - trail * 0.35),
      y: pt.y + jitterY * (1 - trail * 0.35),
      depth: pt.depth - trail * 0.04,
      alpha: fadeAlpha * pt.tip * twinkle,
      color,
      size: sizeScale * sizeJitter * (1 - trail * 0.22),
    });
  };

  for (let i = 0; i < flyCount; i += 1) {
    const seedI = seed + i * 2.399 + hash01(i + seed) * 6.1;
    const color = hash01(seedI + 4) > 0.42 ? primaryColor : accentColor;
    const bulge = seed + hash01(seedI + 1) * 4.2;
    const baseU = hash01(seedI + 2);
    const driftAmp = 0.03 + hash01(seedI + 3) * 0.05;
    const speed = 0.025 + hash01(seedI + 5) * 0.055;
    const dir = hash01(seedI + 6) > 0.35 ? 1 : -1;
    const wander = Math.sin(phase * Math.PI * 2 * (0.35 + hash01(seedI + 7) * 0.9) + seedI * 1.9);
    const u = ((baseU + phase * speed * dir + wander * driftAmp) % 1 + 1) % 1;
    const slide = phase * Math.PI * 0.42 + seedI * 0.35;
    const jitterX =
      (hash01(seedI + 8) - 0.5) * hw * 0.05 +
      Math.sin(phase * Math.PI * 2 * (0.4 + hash01(seedI + 9)) + seedI) * hw * 0.028;
    const jitterY =
      (hash01(seedI + 10) - 0.5) * hh * 0.14 +
      Math.sin(phase * Math.PI * 2 * (0.55 + hash01(seedI + 12)) + seedI * 1.4) * hh * 0.09;
    const trailLen = lite ? (hash01(seedI + 14) > 0.72 ? 1 : 0) : hash01(seedI + 14) > 0.55 ? 2 : hash01(seedI + 15) > 0.7 ? 1 : 0;

    for (let trail = 0; trail <= trailLen; trail += 1) {
      const trailStep = 0.011 + hash01(seedI + 16) * 0.008;
      addFly(
        u - trail * trailStep * dir,
        slide,
        bulge,
        color,
        seedI,
        trail,
        trail === 0 ? 0.85 + hash01(seedI + 17) * 0.15 : 0.35 + hash01(seedI + 18) * 0.25,
        jitterX,
        jitterY,
      );
    }
  }

  if (!lite) {
    for (let i = 0; i < 10; i += 1) {
      const seedI = seed + i * 1.618 + 9;
      const u = ((i + 0.5) / 10 + Math.sin(phase * Math.PI * 2 + seedI) * 0.045) % 1;
      const slide = phase * Math.PI * 1.6 + seedI;
      addFly(u, slide, seed + i * 0.45, i % 2 === 0 ? primaryColor : accentColor, seedI, 0, 0.38, 0, 0);
    }
  }

  particles.sort((a, b) => a.depth - b.depth);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const fly of particles) {
    const behind = fly.depth < 0;
    if (layer === 'behind' && !behind) continue;
    if (layer === 'front' && behind) continue;
    const depthMix = behind ? 0.22 : 0.96;
    const alpha = fly.alpha * depthMix;
    if (alpha <= 0.015) continue;
    const dotSize = fly.size * (behind ? 0.88 : 1);
    drawSoftFireflyDot(ctx, fly.x, fly.y, dotSize, fly.color, alpha);
  }

  ctx.restore();
}

/** Firefly-like orbit particles for HUD feedback pops; fade envelope matches parent FX lifetime. */
export function drawFeedbackFireflyOrbit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  primaryColor: string,
  accentColor: string,
  phase: number,
  fadeAlpha: number,
  seed: number,
  count = 14,
  budget: HudFxBudget = 'normal',
): void {
  if (fadeAlpha <= 0.01) return;

  const lite = budget === 'lite';
  const primaryCount = lite ? 9 : count;
  const secondaryCount = lite ? 5 : Math.max(8, count - 5);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = fadeAlpha;
  drawProceduralOrbitParticles(ctx, cx, cy, size, primaryColor, phase, seed, primaryCount, {
    radiusBase: 0.36,
    radiusStep: 0.042,
    dotBase: 0.016,
    dotStep: 0.006,
    alphaBase: 0.2,
    alphaPulse: 0.62,
    driftScale: 0.052,
    shadow: true,
  });
  drawProceduralOrbitParticles(ctx, cx, cy, size * 0.84, accentColor, phase + 0.19, seed + 2.1, secondaryCount, {
    radiusBase: 0.26,
    radiusStep: 0.034,
    dotBase: 0.011,
    dotStep: 0.004,
    alphaBase: 0.14,
    alphaPulse: 0.48,
    driftScale: 0.068,
    shadow: true,
  });
  ctx.restore();
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

  const sprites = getTileSprites();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pressed ? 0.28 : 0.38;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.cellSize * (pressed ? 0.58 : 0.74));
  glow.addColorStop(0, pressed ? 'rgba(255, 211, 90, 0.58)' : 'rgba(45, 236, 255, 0.58)');
  glow.addColorStop(1, 'rgba(45, 236, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, g.cellSize * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = ringAlpha;
  ctx.strokeStyle = pressed ? '#fbbf24' : '#2decff';
  ctx.lineWidth = Math.max(1.5, g.cellSize * 0.045);
  roundedRectPath(ctx, drawX - 2, drawY - 2, drawSize + 4, drawSize + 4, g.cellRadius + 2);
  ctx.stroke();
  ctx.restore();

  if (!sprites) return;
  ctx.save();
  ctx.globalAlpha = pressed ? 0.98 : 0.96;
  drawHiddenCellUnderlay(ctx, drawX, drawY, drawSize);
  drawSpriteInCell(ctx, pressed ? sprites.pressed : sprites.hover, drawX, drawY, drawSize);
  ctx.restore();
  if (!usedSprite) return;
}

export function drawCellRevealTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
  progress: number,
): void {
  const t = clamp01(progress);
  const sprites = getTileSprites();
  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;
  const flash = Math.sin(Math.min(1, t * 1.25) * Math.PI);
  const reveal = clamp01(t / 0.5);

  if (sprites && t < 0.58) {
    ctx.save();
    ctx.globalAlpha = (1 - reveal) * 0.9;
    drawHiddenCellUnderlay(ctx, x, y, g.cellSize);
    drawSpriteInCell(ctx, sprites.pressed, x, y, g.cellSize);
    ctx.restore();
  }

  if (sprites && t > 0.14 && t < 0.82) {
    const safeT = clamp01((t - 0.14) / 0.5);
    const scale = 0.94 + safeT * 0.1;
    const size = g.cellSize * scale;
    ctx.save();
    ctx.globalAlpha = Math.sin(safeT * Math.PI) * 0.72;
    ctx.globalCompositeOperation = 'lighter';
    drawSpriteInCell(ctx, sprites.safe, cx - size / 2, cy - size / 2, size);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bloomRadius = g.cellSize * (0.32 + t * 0.74);
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomRadius);
  bloom.addColorStop(0, `rgba(235, 255, 255, ${0.52 * flash})`);
  bloom.addColorStop(0.32, `rgba(45, 236, 255, ${0.34 * flash})`);
  bloom.addColorStop(1, 'rgba(45, 236, 255, 0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(cx, cy, bloomRadius, 0, Math.PI * 2);
  ctx.fill();

  const ringAlpha = (1 - t) * 0.78;
  ctx.strokeStyle = `rgba(45, 236, 255, ${ringAlpha})`;
  ctx.lineWidth = Math.max(1, g.cellSize * (0.06 - t * 0.035));
  roundedRectPath(
    ctx,
    x - g.cellSize * 0.08 * t,
    y - g.cellSize * 0.08 * t,
    g.cellSize * (1 + 0.16 * t),
    g.cellSize * (1 + 0.16 * t),
    g.cellRadius + 4,
  );
  ctx.stroke();

  for (let i = 0; i < 8; i += 1) {
    const angle = i * (Math.PI * 2 / 8) + t * 0.7;
    const dist = g.cellSize * (0.18 + t * 0.46) * (i % 2 === 0 ? 1 : 0.75);
    const alpha = (1 - t) * 0.58;
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 211, 90, ${alpha})` : `rgba(45, 236, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.72, Math.max(1, g.cellSize * (0.035 - t * 0.018)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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

export interface PanelV3Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getPanelV3InnerRect(bounds: PanelV3Bounds): PanelV3Bounds {
  const padX = bounds.w * 0.24;
  const padY = bounds.h * 0.18;
  return { x: bounds.x + padX, y: bounds.y + padY, w: bounds.w - padX * 2, h: bounds.h - padY * 2 };
}

export function drawPanelV3ScanBeams(
  ctx: CanvasRenderingContext2D,
  bounds: PanelV3Bounds,
  color: string,
  phase: number,
  pulse: number,
): void {
  const inner = getPanelV3InnerRect(bounds);
  const beamHalfLen = inner.w * 0.21;
  const scanTravel = 1 - Math.abs(phase * 2 - 1);
  const scanX = inner.x + beamHalfLen + scanTravel * Math.max(0, inner.w - beamHalfLen * 2);
  const yTop = inner.y + inner.h * 0.12;
  const yBottom = inner.y + inner.h * 0.88;
  const lineWidth = Math.max(1.2, bounds.h * 0.0055);
  const peakAlpha = 0.32 + pulse * 0.11;

  const drawBeam = (y: number): void => {
    const x1 = Math.max(inner.x, scanX - beamHalfLen);
    const x2 = Math.min(inner.x + inner.w, scanX + beamHalfLen);
    if (x2 - x1 < 2) return;

    const cx = (x1 + x2) / 2;
    const scan = ctx.createLinearGradient(x1, y, x2, y);
    scan.addColorStop(0, `rgba(${color}, 0)`);
    scan.addColorStop(0.1, `rgba(${color}, ${peakAlpha * 0.1})`);
    scan.addColorStop(0.24, `rgba(${color}, ${peakAlpha * 0.45})`);
    scan.addColorStop(0.5, `rgba(${color}, ${peakAlpha})`);
    scan.addColorStop(0.76, `rgba(${color}, ${peakAlpha * 0.45})`);
    scan.addColorStop(0.9, `rgba(${color}, ${peakAlpha * 0.1})`);
    scan.addColorStop(1, `rgba(${color}, 0)`);

    ctx.fillStyle = scan;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.quadraticCurveTo(cx, y - lineWidth, x2, y);
    ctx.quadraticCurveTo(cx, y + lineWidth, x1, y);
    ctx.closePath();
    ctx.fill();
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  drawBeam(yTop);
  drawBeam(yBottom);
  ctx.restore();
}
