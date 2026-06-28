import type { HudFxBudget, OrbitParticleStyle } from './types.ts';

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
