import { seededUnit } from '../primitives/index.ts';
import { getComboFeedbackPalette, getComboHudTier } from './combo-palette.ts';
import { drawElectricBolt } from './electric-field.ts';
import type { ComboBurstFxProgress, ScorePopFxProgress } from './types.ts';

export function drawComboBurstPreviewDecorations(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  combo: number,
  progress: ComboBurstFxProgress,
  effectRadius = Math.min(w, h) * 0.48,
): void {
  const palette = getComboFeedbackPalette(combo);
  const { t, fade } = progress;
  const timeSeed = t * 88 + combo * 0.23;
  const boltCount = getComboHudTier(combo) >= 2 ? 7 : 5;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < boltCount; i += 1) {
    const p = (t * 1.08 + i * 0.117) % 1;
    if (p > 0.78) continue;
    const lifeAlpha = Math.sin(p * Math.PI) * fade * (getComboHudTier(combo) >= 2 ? 0.34 : 0.26);
    const seed = combo * 0.41 + i * 7.3 + timeSeed;
    const angle = seededUnit(seed) * Math.PI * 2 + t * Math.PI * 2.6;
    const startR = effectRadius * (0.04 + seededUnit(seed + 1.4) * 0.08);
    const endR = effectRadius * (0.22 + p * 0.34);
    const drift = (seededUnit(seed + 2.8) - 0.5) * 0.55;
    const x1 = cx + Math.cos(angle) * startR;
    const y1 = cy + Math.sin(angle) * startR;
    const x2 = cx + Math.cos(angle + drift) * endR;
    const y2 = cy + Math.sin(angle + drift) * endR;
    drawElectricBolt(
      ctx,
      x1,
      y1,
      x2,
      y2,
      palette,
      lifeAlpha,
      Math.max(1, effectRadius * 0.0065),
      seed + 18.6,
      getComboHudTier(combo) >= 2 ? 4 : 3,
      i % 2 === 0,
    );
  }
  ctx.restore();
}

export function drawScorePopPreviewDecorations(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  progress: ScorePopFxProgress,
  comboTier = 0,
): void {
  const palette = getComboFeedbackPalette(Math.max(1, comboTier));
  const timeSeed = progress.t * 72;
  const radius = Math.min(w, h) * 0.11;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.4);
  glow.addColorStop(0, `rgba(255, 213, 92, ${0.26 * progress.alpha})`);
  glow.addColorStop(0.45, `rgba(${palette.main}, ${0.14 * progress.alpha})`);
  glow.addColorStop(1, 'rgba(45, 236, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const boltCount = getComboHudTier(comboTier) >= 1 ? 6 : 4;
  for (let i = 0; i < boltCount; i += 1) {
    const p = (progress.t * 1.22 + i * 0.19) % 1;
    if (p > 0.82) continue;
    const lifeAlpha = Math.sin(p * Math.PI) * progress.alpha * 0.58;
    const seed = comboTier + i * 5.9 + timeSeed;
    const angle = seededUnit(seed) * Math.PI * 2 + progress.t * Math.PI * 4.2;
    const startR = radius * (0.08 + seededUnit(seed + 2.1) * 0.12);
    const endR = radius * (0.55 + p * 0.75);
    const drift = (seededUnit(seed + 4.4) - 0.5) * 0.62;
    drawElectricBolt(
      ctx,
      cx + Math.cos(angle) * startR,
      cy + Math.sin(angle) * startR,
      cx + Math.cos(angle + drift) * endR,
      cy + Math.sin(angle + drift) * endR,
      palette,
      lifeAlpha,
      Math.max(1, radius * 0.045),
      seed + 11.7,
      3,
      i % 2 === 0,
    );
  }
  ctx.restore();
}
