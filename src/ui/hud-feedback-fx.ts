import { drawFeedbackFireflyOrbit, drawFeedbackStripLightWrap, type HudFxBudget } from './cell-fx.ts';
import { drawFxSpriteFrame, GAME_ASSET_TUNING } from './game-assets.ts';

export const SCORE_POP_FX_MS = GAME_ASSET_TUNING.fx.scorePop.durationMs;
export const COMBO_BURST_FX_MS = GAME_ASSET_TUNING.fx.comboBurst.durationMs;

export interface ComboFeedbackPalette {
  main: string;
  soft: string;
  text: string;
  hot: string;
  stroke: string;
  glow: string;
  digitColor: string;
}

export interface ScorePopFxProgress {
  t: number;
  alpha: number;
  pop: number;
  fireflyFade: number;
}

export interface ComboBurstFxProgress {
  t: number;
  alpha: number;
  fade: number;
  hit: number;
  burstScale: number;
  shakeX: number;
  fireflyFade: number;
}

export interface ScorePopStripOrbit {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface ScorePopFxDrawOptions {
  cx: number;
  cy: number;
  scoreText: string;
  comboTier: number;
  progress: ScorePopFxProgress;
  stageScale: number;
  scorePopBase: HTMLImageElement | null;
  assetMaxW: number;
  assetMaxH: number;
  assetCyOffset?: number;
  fontPx?: number;
  fontFamily: string;
  drawFallbackFx?: (ctx: CanvasRenderingContext2D, t: number) => void;
}

export interface ComboBurstFxDrawOptions {
  cx: number;
  cy: number;
  combo: number;
  progress: ComboBurstFxProgress;
  stageScale: number;
  isMobile?: boolean;
  comboBurstBase: HTMLImageElement | null;
  burstW: number;
  burstH: number;
  fontFamilyMono: string;
  fontFamilyDisplay: string;
  hudFxBudget?: HudFxBudget;
  drawFallbackFx?: (ctx: CanvasRenderingContext2D, t: number) => void;
}

export type { HudFxBudget };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Hold through ~55%, then smooth fade to zero by t=1. */
function comboBurstFadeAlpha(t: number, exitStart = 0.55): number {
  if (t <= exitStart) return 1;
  return 1 - easeOutCubic((t - exitStart) / (1 - exitStart));
}

/** Combo HUD v3 has four color states: cyan → gold → hot → purple (x50+). */
export const COMBO_HUD_TIER_THRESHOLDS = [10, 20, 50] as const;

export function getComboHudTier(combo: number): 0 | 1 | 2 | 3 {
  if (combo >= COMBO_HUD_TIER_THRESHOLDS[2]) return 3;
  if (combo >= COMBO_HUD_TIER_THRESHOLDS[1]) return 2;
  if (combo >= COMBO_HUD_TIER_THRESHOLDS[0]) return 1;
  return 0;
}

export function getComboFeedbackPalette(combo: number): ComboFeedbackPalette {
  const tier = getComboHudTier(combo);
  if (tier === 3) {
    return {
      main: '239, 68, 68',
      soft: '248, 113, 113',
      text: '#fca5a5',
      hot: '#fecaca',
      stroke: 'rgba(252, 165, 165, 0.95)',
      glow: 'rgba(239, 68, 68, 0.3)',
      digitColor: '#ef4444',
    };
  }
  if (tier === 2) {
    return {
      main: '251, 113, 36',
      soft: '239, 68, 68',
      text: '#ffffff',
      hot: '#fde047',
      stroke: 'rgba(251, 146, 60, 0.9)',
      glow: 'rgba(245, 158, 11, 0.22)',
      digitColor: '#fb923c',
    };
  }
  if (tier === 1) {
    return {
      main: '250, 204, 21',
      soft: '255, 213, 92',
      text: '#ffffff',
      hot: '#fef08a',
      stroke: 'rgba(250, 204, 21, 0.88)',
      glow: 'rgba(245, 158, 11, 0.2)',
      digitColor: '#facc15',
    };
  }
  return {
    main: '45, 236, 255',
    soft: '96, 165, 250',
    text: '#67e8f9',
    hot: '#dbeafe',
    stroke: 'rgba(147, 197, 253, 0.95)',
    glow: 'rgba(45, 236, 255, 0.14)',
    digitColor: '#93c5fd',
  };
}

/** CSS filter for the shared combo rail sprite — one shift per HUD tier. */
export function getComboRailFilter(combo: number): string {
  const tier = getComboHudTier(combo);
  if (tier === 3) return 'hue-rotate(180deg) saturate(1.62) brightness(1.06)';
  if (tier === 2) return 'hue-rotate(-150deg) saturate(1.45) brightness(1.08)';
  if (tier === 1) return 'hue-rotate(-118deg) saturate(1.45) brightness(1.08)';
  return 'none';
}

export function comboHudGlowRgba(combo: number, alpha: number): string {
  const { main } = getComboFeedbackPalette(combo);
  return `rgba(${main}, ${alpha})`;
}

export function getComboFireflyAccent(combo: number): string {
  const tier = getComboHudTier(combo);
  if (tier === 3) return 'rgba(254, 202, 202, 0.95)';
  if (tier >= 1) return 'rgba(251, 191, 36, 0.95)';
  return 'rgba(45, 236, 255, 0.92)';
}

export function scorePopRuntimeProgress(elapsedMs: number, durationMs = SCORE_POP_FX_MS): ScorePopFxProgress {
  const t = clamp01(elapsedMs / durationMs);
  const alpha = Math.max(0, 1 - t);
  const pop = 1 + Math.sin(Math.min(1, t * 2.2) * Math.PI) * 0.12;
  return { t, alpha, pop, fireflyFade: alpha * Math.min(1, t * 4.5) };
}

export function scorePopPreviewProgress(tMs: number, durationMs = SCORE_POP_FX_MS): ScorePopFxProgress {
  const t = (tMs % durationMs) / durationMs;
  const alpha = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28;
  const pop = 0.88 + Math.sin(t * Math.PI) * 0.08;
  return { t, alpha, pop, fireflyFade: alpha * Math.min(1, t * 4.5) };
}

export function comboBurstRuntimeProgress(
  elapsedMs: number,
  _combo: number,
  durationMs = COMBO_BURST_FX_MS,
): ComboBurstFxProgress {
  const t = clamp01(elapsedMs / durationMs);
  const alpha = comboBurstFadeAlpha(t);
  const maxScale = GAME_ASSET_TUNING.fx.comboBurst.maxScale;
  const pop = 1.12 + Math.sin(Math.min(1, t * 2.5) * Math.PI) * (maxScale - 1);
  const exitScale = alpha < 1 ? 0.9 + alpha * 0.1 : 1;
  const burstScale = Math.max(0.9, Math.min(maxScale, pop)) * exitScale;
  return {
    t,
    alpha,
    fade: alpha,
    hit: clamp01(t / 0.24),
    burstScale,
    shakeX: 0,
    fireflyFade: alpha,
  };
}

export function comboBurstPreviewProgress(
  tMs: number,
  combo: number,
  durationMs = COMBO_BURST_FX_MS,
  canvasMin = 240,
): ComboBurstFxProgress {
  const t = (tMs % durationMs) / durationMs;
  const hit = clamp01(t / 0.24);
  const fade = comboBurstFadeAlpha(t);
  const burstScale = (0.82 + easeOutBack(hit) * 0.28) * (fade < 1 ? 0.9 + fade * 0.1 : 1);
  const shakeX =
    combo >= 20 && t < 0.25 ? Math.sin(t * Math.PI * 32) * (1 - t / 0.25) * canvasMin * 0.012 : 0;
  return {
    t,
    alpha: fade,
    fade,
    hit,
    burstScale,
    shakeX,
    fireflyFade: fade,
  };
}

export function measureContainedAsset(
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  image: HTMLImageElement | null,
  scale = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image || !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return null;
  const fit = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight) * scale;
  const w = image.naturalWidth * fit;
  const h = image.naturalHeight * fit;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function drawContainedFeedbackAsset(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  const bounds = measureContainedAsset(cx, cy, maxW, maxH, image, scale);
  if (!bounds || !image) return null;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
  return bounds;
}

/** Centered wrap bounds aligned to the drawn strip / panel rect. */
export function resolveStripWrapBounds(
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  image: HTMLImageElement | null,
  scale = 1,
): ScorePopStripOrbit {
  const bounds = measureContainedAsset(cx, cy, maxW, maxH, image, scale);
  const wrapLift = 0.2;
  if (bounds) {
    return {
      cx: bounds.x + bounds.w / 2,
      cy: bounds.y + bounds.h * (0.5 - wrapLift),
      width: bounds.w * 0.84,
      height: bounds.h * 0.42,
    };
  }
  return {
    cx,
    cy: cy - maxH * wrapLift * 0.5,
    width: maxW * 0.78,
    height: maxH * 0.34,
  };
}

export function drawScorePopStripOrbit(
  ctx: CanvasRenderingContext2D,
  strip: ScorePopStripOrbit,
  comboTier: number,
  progress: ScorePopFxProgress,
  layer: 'all' | 'behind' | 'front' = 'all',
  budget: HudFxBudget = 'normal',
): void {
  const wrapPrimary =
    comboTier >= 50 ? 'rgba(248, 113, 113, 0.95)' : comboTier >= 10 ? 'rgba(255, 213, 92, 0.95)' : 'rgba(125, 211, 252, 0.95)';
  drawFeedbackStripLightWrap(
    ctx,
    strip.cx,
    strip.cy,
    strip.width,
    strip.height,
    wrapPrimary,
    'rgba(45, 236, 255, 0.92)',
    progress.t,
    progress.fireflyFade,
    3.7,
    layer,
    budget,
  );
}

export interface ScorePopBottomStripDrawOptions {
  stripCx: number;
  stripTopY: number;
  chipW: number;
  chipH: number;
  scoreStrip: HTMLImageElement | null;
  comboTier: number;
  progress: ScorePopFxProgress;
  budget?: HudFxBudget;
}

/** Bottom score-energy strip with firefly wrap — matches Score pop v3 preview stack. */
export function drawScorePopBottomStrip(
  ctx: CanvasRenderingContext2D,
  opts: ScorePopBottomStripDrawOptions,
): void {
  const { stripCx, stripTopY, chipW, chipH, scoreStrip, comboTier, progress, budget = 'normal' } = opts;
  if (progress.alpha <= 0.008) return;

  const stripDrawH = chipH * 1.35;
  const stripCy = stripTopY + stripDrawH / 2;
  const stripBounds = resolveStripWrapBounds(stripCx, stripCy, chipW, stripDrawH, scoreStrip);
  drawScorePopStripOrbit(ctx, stripBounds, comboTier, progress, 'behind', budget);
  drawContainedFeedbackAsset(ctx, scoreStrip, stripCx, stripCy, chipW, stripDrawH, 1, progress.alpha);
  drawScorePopStripOrbit(ctx, stripBounds, comboTier, progress, 'front', budget);
}

export function drawScorePopFx(ctx: CanvasRenderingContext2D, opts: ScorePopFxDrawOptions): void {
  const {
    cx,
    cy,
    scoreText,
    comboTier,
    progress,
    stageScale,
    scorePopBase,
    assetMaxW,
    assetMaxH,
    fontFamily,
    drawFallbackFx,
  } = opts;
  const assetCyOffset = opts.assetCyOffset ?? 8 * stageScale;

  ctx.save();
  ctx.globalAlpha = progress.alpha;
  ctx.translate(cx, cy);
  ctx.scale(progress.pop, progress.pop);

  const assetAlpha = Math.min(0.92, progress.alpha);
  const drawn = drawContainedFeedbackAsset(
    ctx,
    scorePopBase,
    0,
    assetCyOffset,
    assetMaxW,
    assetMaxH,
    0.92,
    assetAlpha,
  );
  if (!drawn && drawFallbackFx) drawFallbackFx(ctx, progress.t);

  const palette = getComboFeedbackPalette(comboTier);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = palette.stroke;
  ctx.shadowBlur = 10 * stageScale;
  ctx.font = `900 ${opts.fontPx ?? 22 * stageScale}px ${fontFamily}`;
  ctx.fillStyle = comboTier >= 10 ? '#fef08a' : '#dbeafe';
  ctx.fillText(scoreText, 0, 0);
  ctx.restore();
}

export function drawComboBurstFx(ctx: CanvasRenderingContext2D, opts: ComboBurstFxDrawOptions): void {
  const {
    cx,
    cy,
    combo,
    progress,
    stageScale,
    comboBurstBase,
    burstW,
    burstH,
    fontFamilyMono,
    fontFamilyDisplay,
    drawFallbackFx,
  } = opts;
  if (progress.alpha <= 0.008) return;

  const palette = getComboFeedbackPalette(combo);
  const isMobile = opts.isMobile ?? false;
  const spriteW = burstW * GAME_ASSET_TUNING.fx.comboBurst.spriteW;
  const spriteH = burstH * GAME_ASSET_TUNING.fx.comboBurst.spriteH;
  const fireflySize = Math.max(burstW, burstH) * 0.62;
  const budget = opts.hudFxBudget ?? 'normal';
  const fade = progress.alpha;

  ctx.save();
  ctx.translate(cx + progress.shakeX, cy);

  drawFeedbackFireflyOrbit(
    ctx,
    0,
    0,
    fireflySize,
    palette.stroke,
    getComboFireflyAccent(combo),
    progress.t,
    fade,
    combo * 0.37,
    combo >= 20 ? 16 : 14,
    budget,
  );

  ctx.globalAlpha = fade;
  ctx.scale(progress.burstScale, progress.burstScale);

  const drawn = drawContainedFeedbackAsset(
    ctx,
    comboBurstBase,
    0,
    0,
    spriteW,
    spriteH,
    1,
    Math.min(0.9, fade),
  );
  if (!drawn && drawFallbackFx) {
    ctx.save();
    ctx.globalAlpha = fade;
    drawFallbackFx(ctx, progress.t);
    ctx.restore();
  }

  const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, burstW * 0.52);
  glow.addColorStop(0, palette.glow.replace(/[\d.]+\)$/u, `${0.25 * fade})`));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-burstW / 2, -burstH / 2, burstW, burstH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, 5 * stageScale);
  ctx.strokeStyle = `rgba(15, 23, 42, ${0.86 * fade})`;
  ctx.fillStyle = palette.digitColor;
  ctx.font = `900 ${Math.min(isMobile ? 42 : 56, (isMobile ? 34 : 44) + String(combo).length * 3) * stageScale}px ${fontFamilyMono}`;
  ctx.strokeText(`x${combo}`, 0, -4 * stageScale);
  ctx.fillText(`x${combo}`, 0, -4 * stageScale);
  ctx.font = `900 ${11 * stageScale}px ${fontFamilyDisplay}`;
  ctx.fillStyle = palette.text;
  ctx.globalAlpha = fade * 0.76;
  ctx.fillText('COMBO', 0, 28 * stageScale);
  ctx.restore();
}

export function resolveComboBurstAmbientRadius(burstW: number, burstH: number): number {
  return Math.max(burstW, burstH * 1.15) * 0.98;
}

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

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, effectRadius);
  core.addColorStop(0, `rgba(${palette.main}, ${0.34 * fade})`);
  core.addColorStop(0.32, `rgba(${palette.soft}, ${0.22 * fade})`);
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < (combo >= 50 ? 3 : combo >= 20 ? 2 : 1); i += 1) {
    const ringT = clamp01((t - i * 0.1) / 0.62);
    if (ringT <= 0 || ringT >= 1) continue;
    ctx.strokeStyle = `rgba(${i % 2 ? palette.soft : palette.main}, ${(1 - ringT) * 0.78})`;
    ctx.lineWidth = effectRadius * 0.028 * (1 - ringT) + 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, effectRadius * (0.25 + 0.75 * ringT ** 0.5), 0, Math.PI * 2);
    ctx.stroke();
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
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.22);
  glow.addColorStop(0, `rgba(255, 213, 92, ${0.22 * progress.alpha})`);
  glow.addColorStop(0.45, `rgba(45, 236, 255, ${0.12 * progress.alpha})`);
  glow.addColorStop(1, 'rgba(45, 236, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export type ScorePopV3Layer = 'all' | 'strip' | 'pop';

export interface ScorePopV3Layout {
  stripCx: number;
  stripTopY: number;
  chipW: number;
  chipH: number;
  popCx: number;
  popCy: number;
  stageScale: number;
  assetMaxW: number;
  assetMaxH: number;
  assetCyOffset?: number;
  fontPx?: number;
}

export interface ScorePopV3DrawOptions {
  canvasW: number;
  canvasH: number;
  progress: ScorePopFxProgress;
  layout: ScorePopV3Layout;
  comboTier: number;
  scoreText: string;
  scoreStrip: HTMLImageElement | null;
  scorePopBase: HTMLImageElement | null;
  fontFamily: string;
  layer?: ScorePopV3Layer;
  hudFxBudget?: HudFxBudget;
  drawFallbackFx?: (ctx: CanvasRenderingContext2D, t: number) => void;
  drawStripFallback?: (ctx: CanvasRenderingContext2D) => void;
}

export function resolveScorePopV3PreviewLayout(
  canvasW: number,
  canvasH: number,
  progress: ScorePopFxProgress,
): ScorePopV3Layout {
  const chipW = Math.min(canvasW * 0.7, 230);
  const chipH = Math.min(canvasH * 0.28, 60);
  const chipY = canvasH * 0.56;
  const rise = easeOutCubic(progress.t);
  return {
    stripCx: canvasW / 2,
    stripTopY: chipY,
    chipW,
    chipH,
    popCx: canvasW / 2,
    popCy: chipY - canvasH * (0.05 + rise * 0.34),
    stageScale: canvasW / 390,
    assetMaxW: canvasW * 0.62,
    assetMaxH: canvasH * 0.42,
    assetCyOffset: canvasH * 0.06,
    fontPx: Math.min(48, canvasW * 0.16),
  };
}

export function resolveScorePopV3RuntimeLayout(
  comboBurst: { x: number; y: number },
  scorePop: { x: number; y: number },
  canvasW: number,
  progress: ScorePopFxProgress,
  stageScale: number,
): ScorePopV3Layout {
  const chipW = Math.min(canvasW * 0.58, 230 * stageScale);
  const chipH = 60 * stageScale;
  const stripDrawH = chipH * 1.35;
  return {
    stripCx: comboBurst.x,
    stripTopY: comboBurst.y - stripDrawH / 2,
    chipW,
    chipH,
    popCx: scorePop.x,
    popCy: scorePop.y - progress.t * 36 * stageScale,
    stageScale,
    assetMaxW: 152 * stageScale,
    assetMaxH: 92 * stageScale,
  };
}

/** Score pop v3 stack: bottom strip + pop glow + floating score. */
export function drawScorePopV3(ctx: CanvasRenderingContext2D, opts: ScorePopV3DrawOptions): void {
  const layer = opts.layer ?? 'all';
  const { layout, progress, comboTier, scoreStrip, scorePopBase, scoreText, fontFamily, canvasW, canvasH } = opts;

  if (layer === 'all' || layer === 'strip') {
    drawScorePopBottomStrip(ctx, {
      stripCx: layout.stripCx,
      stripTopY: layout.stripTopY,
      chipW: layout.chipW,
      chipH: layout.chipH,
      scoreStrip,
      comboTier,
      progress,
      budget: opts.hudFxBudget,
    });
    opts.drawStripFallback?.(ctx);
  }

  if (layer === 'all' || layer === 'pop') {
    drawScorePopPreviewDecorations(ctx, layout.popCx, layout.popCy, canvasW, canvasH, progress);
    drawScorePopFx(ctx, {
      cx: layout.popCx,
      cy: layout.popCy,
      scoreText,
      comboTier,
      progress,
      stageScale: layout.stageScale,
      scorePopBase,
      assetMaxW: layout.assetMaxW,
      assetMaxH: layout.assetMaxH,
      assetCyOffset: layout.assetCyOffset,
      fontPx: layout.fontPx,
      fontFamily,
      drawFallbackFx: opts.drawFallbackFx,
    });
  }
}

export interface ComboBurstV3Layout {
  cx: number;
  cy: number;
  burstW: number;
  burstH: number;
  stageScale: number;
  isMobile: boolean;
}

export interface ComboBurstV3DrawOptions {
  canvasW: number;
  canvasH: number;
  combo: number;
  progress: ComboBurstFxProgress;
  layout: ComboBurstV3Layout;
  comboBurstBase: HTMLImageElement | null;
  fontFamilyMono: string;
  fontFamilyDisplay: string;
  hudFxBudget?: HudFxBudget;
  drawFallbackFx?: (ctx: CanvasRenderingContext2D, t: number) => void;
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

/** Combo burst v3 stack: ambient rings/glow + burst body. */
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
    comboBurstBase: opts.comboBurstBase,
    burstW: layout.burstW,
    burstH: layout.burstH,
    fontFamilyMono: opts.fontFamilyMono,
    fontFamilyDisplay: opts.fontFamilyDisplay,
    hudFxBudget: opts.hudFxBudget,
    drawFallbackFx: opts.drawFallbackFx,
  });
}

export function isScorePopFxVisible(progress: ScorePopFxProgress): boolean {
  return progress.alpha > 0.008;
}

export function isComboBurstFxVisible(progress: ComboBurstFxProgress): boolean {
  return progress.alpha > 0.008;
}

export function createScorePopFallbackDrawer(stageScale: number) {
  return (ctx: CanvasRenderingContext2D, t: number): void => {
    drawFxSpriteFrame(ctx, 'score-pop', t, 0, 0, 132 * stageScale, 56 * stageScale, GAME_ASSET_TUNING.fx.scorePop.spriteAlpha);
  };
}

export function createComboBurstFallbackDrawer(burstW: number, burstH: number) {
  return (ctx: CanvasRenderingContext2D, t: number): void => {
    drawFxSpriteFrame(
      ctx,
      'combo-burst',
      t,
      0,
      0,
      burstW * GAME_ASSET_TUNING.fx.comboBurst.spriteW,
      burstH * GAME_ASSET_TUNING.fx.comboBurst.spriteH,
      GAME_ASSET_TUNING.fx.comboBurst.spriteAlpha,
    );
  };
}
