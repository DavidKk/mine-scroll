import { GAME_ASSET_TUNING } from '../game-assets.ts';
import { getComboFeedbackPalette, getComboHudTier } from './combo-palette.ts';
import { drawComboBurstElectricField } from './electric-field.ts';
import { drawComboBurstPreviewDecorations } from './preview.ts';
import type {
  ComboBurstFxDrawOptions,
  ComboBurstFxProgress,
  ComboBurstV3DrawOptions,
  ComboBurstV3Layout,
} from './types.ts';

export function drawComboBurstFx(ctx: CanvasRenderingContext2D, opts: ComboBurstFxDrawOptions): void {
  const {
    cx,
    cy,
    combo,
    progress,
    stageScale,
    burstW,
    burstH,
    fontFamilyMono,
  } = opts;
  if (progress.alpha <= 0.008) return;

  const palette = getComboFeedbackPalette(combo);
  const isMobile = opts.isMobile ?? false;
  const fade = progress.alpha;

  ctx.save();
  ctx.translate(cx + progress.shakeX, cy);
  ctx.scale(progress.burstScale, progress.burstScale);

  drawComboBurstElectricField(ctx, burstW, burstH, combo, progress, palette, stageScale, opts.hudFxBudget);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.min(isMobile ? 46 : 64, (isMobile ? 38 : 50) + String(combo).length * 3) * stageScale;
  ctx.font = `1000 ${fontSize}px ${fontFamilyMono}`;
  ctx.lineWidth = Math.max(3, fontSize * 0.11);
  ctx.strokeStyle = `rgba(15, 23, 42, ${0.86 * fade})`;
  ctx.shadowColor = palette.digitColor;
  ctx.shadowBlur = fontSize * (getComboHudTier(combo) >= 2 ? 0.34 : 0.25);
  ctx.strokeText(`x${combo}`, 0, 0);
  ctx.fillStyle = palette.digitColor;
  ctx.globalAlpha = fade;
  ctx.fillText(`x${combo}`, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = palette.stroke;
  ctx.shadowBlur = fontSize * 0.18;
  ctx.fillStyle = palette.hot;
  ctx.globalAlpha = fade * 0.44;
  ctx.fillText(`x${combo}`, 0, 0);
  ctx.restore();
}

export function resolveComboBurstAmbientRadius(burstW: number, burstH: number): number {
  return Math.max(burstW, burstH * 1.15) * 0.98;
}

export function resolveComboBurstV3PreviewLayout(canvasW: number, canvasH: number): ComboBurstV3Layout {
  const stageScale = canvasW / 390;
  return {
    cx: canvasW / 2,
    cy: canvasH / 2,
    burstW: 190 * stageScale,
    burstH: 80 * stageScale,
    stageScale,
    isMobile: false,
  };
}

export function resolveComboBurstV3RuntimeLayout(
  comboBurst: { x: number; y: number },
  progress: ComboBurstFxProgress,
  stageScale: number,
  canvasW: number,
  railTop: number,
): ComboBurstV3Layout {
  const isMobile = canvasW < 560;
  const burstW = (isMobile ? 150 : 190) * stageScale;
  const burstH = (isMobile ? 66 : 80) * stageScale;
  const halfBurstH = burstH * GAME_ASSET_TUNING.fx.comboBurst.spriteH * progress.burstScale * 0.5;
  return {
    cx: comboBurst.x,
    cy: Math.min(comboBurst.y - progress.t * 10 * stageScale, railTop - halfBurstH - 8 * stageScale),
    burstW,
    burstH,
    stageScale,
    isMobile,
  };
}

/** Combo burst v3 — jagged electric arcs + combo digits (no energy base disc). */
export function drawComboBurstV3(ctx: CanvasRenderingContext2D, opts: ComboBurstV3DrawOptions): void {
  const { layout, combo, progress, canvasW, canvasH } = opts;
  const effectRadius = resolveComboBurstAmbientRadius(layout.burstW, layout.burstH);
  drawComboBurstPreviewDecorations(ctx, layout.cx, layout.cy, canvasW, canvasH, combo, progress, effectRadius);
  drawComboBurstFx(ctx, {
    cx: layout.cx,
    cy: layout.cy,
    combo,
    progress,
    stageScale: layout.stageScale,
    isMobile: layout.isMobile,
    burstW: layout.burstW,
    burstH: layout.burstH,
    fontFamilyMono: opts.fontFamilyMono,
    fontFamilyDisplay: opts.fontFamilyDisplay,
    hudFxBudget: opts.hudFxBudget,
  });
}
