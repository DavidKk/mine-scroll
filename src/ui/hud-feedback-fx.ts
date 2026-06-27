import { drawFeedbackStripLightWrap, type HudFxBudget } from './cell-fx.ts';
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
  burstW: number;
  burstH: number;
  fontFamilyMono: string;
  fontFamilyDisplay: string;
  hudFxBudget?: HudFxBudget;
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

/** Combo HUD v3 tier gates — wide spans so color does not flip at x10. */
export const COMBO_HUD_TIER_THRESHOLDS = [25, 55, 100] as const;

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

/** Legacy stroke/fill bundle — same tier colors as top COMBO HUD. */
export function getComboHudAccentColors(combo: number): {
  fill: string;
  stroke: string;
  glow: string;
  text: string;
} {
  const palette = getComboFeedbackPalette(combo);
  return {
    fill: `rgba(${palette.main}, 0.92)`,
    stroke: palette.stroke,
    glow: palette.glow,
    text: palette.digitColor,
  };
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
    getComboHudTier(combo) >= 2 && t < 0.25 ? Math.sin(t * Math.PI * 32) * (1 - t / 0.25) * canvasMin * 0.012 : 0;
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

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

interface FxPoint {
  x: number;
  y: number;
}

function buildLightningPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  depth: number,
  displacement: number,
  seed: number,
): FxPoint[] {
  if (depth <= 0 || displacement < 0.35) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }
  const mx = (x1 + x2) * 0.5;
  const my = (y1 + y2) * 0.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const jitter = (seededUnit(seed + depth * 17.3) - 0.5) * 2 * displacement;
  const midX = mx + nx * jitter;
  const midY = my + ny * jitter;
  const left = buildLightningPath(x1, y1, midX, midY, depth - 1, displacement * 0.56, seed + 2.1);
  const right = buildLightningPath(midX, midY, x2, y2, depth - 1, displacement * 0.56, seed + 5.7);
  return left.slice(0, -1).concat(right);
}

function strokeLightningPath(
  ctx: CanvasRenderingContext2D,
  points: FxPoint[],
  palette: ComboFeedbackPalette,
  alpha: number,
  lineWidth: number,
  hot = false,
): void {
  if (points.length < 2 || alpha <= 0.012) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = hot ? `rgba(255, 245, 190, ${alpha * 0.28})` : `rgba(${palette.main}, ${alpha * 0.32})`;
  ctx.lineWidth = lineWidth * 2.8;
  ctx.stroke();

  ctx.strokeStyle = hot ? `rgba(255, 221, 100, ${alpha * 0.72})` : `rgba(${palette.soft}, ${alpha * 0.58})`;
  ctx.lineWidth = lineWidth * 1.35;
  ctx.stroke();

  ctx.strokeStyle = hot ? `rgba(255, 255, 255, ${alpha * 0.82})` : `rgba(255, 255, 255, ${alpha * 0.46})`;
  ctx.lineWidth = Math.max(0.75, lineWidth * 0.55);
  ctx.stroke();
}

function drawElectricBolt(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  palette: ComboFeedbackPalette,
  alpha: number,
  stageScale: number,
  seed: number,
  depth: number,
  branch: boolean,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2 || alpha <= 0.012) return;

  const displacement = len * (0.16 + seededUnit(seed + 11.2) * 0.1);
  const points = buildLightningPath(x1, y1, x2, y2, depth, displacement, seed);
  const hot = seededUnit(seed + 19.4) > 0.68;
  strokeLightningPath(ctx, points, palette, alpha, Math.max(1, 1.25 * stageScale), hot);

  if (!branch || len < stageScale * 10 || depth <= 2) return;

  const branchIndex = Math.min(
    points.length - 2,
    Math.max(1, Math.floor(points.length * (0.34 + seededUnit(seed + 23.6) * 0.22))),
  );
  const origin = points[branchIndex];
  const baseAngle = Math.atan2(dy, dx);
  const branchAngle = baseAngle + (seededUnit(seed + 29.1) - 0.5) * 1.35;
  const branchLen = len * (0.24 + seededUnit(seed + 31.8) * 0.2);
  drawElectricBolt(
    ctx,
    origin.x,
    origin.y,
    origin.x + Math.cos(branchAngle) * branchLen,
    origin.y + Math.sin(branchAngle) * branchLen,
    palette,
    alpha * 0.62,
    stageScale,
    seed + 37.5,
    depth - 1,
    false,
  );
}

function drawComboBurstElectricField(
  ctx: CanvasRenderingContext2D,
  burstW: number,
  burstH: number,
  combo: number,
  progress: ComboBurstFxProgress,
  palette: ComboFeedbackPalette,
  stageScale: number,
  budget: HudFxBudget = 'normal',
): void {
  const flicker = 0.68 + Math.abs(Math.sin((progress.t + combo * 0.011) * Math.PI * 9)) * 0.32;
  const alpha = progress.fade * flicker;
  const boltCount = budget === 'lite'
    ? combo >= 50 ? 8 : combo >= 20 ? 6 : 5
    : combo >= 50 ? 14 : combo >= 20 ? 11 : 9;
  const depth = budget === 'lite' ? 3 : combo >= 20 ? 5 : 4;
  const timeSeed = progress.t * 96 + combo * 0.17;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < boltCount; i += 1) {
    const p = (progress.t * 1.18 + i * 0.083) % 1;
    if (p > 0.86) continue;
    const lifeAlpha = Math.sin(p * Math.PI) * alpha;
    const seed = combo + i * 3.41 + timeSeed;

    if (i % 3 !== 2) {
      const side = i % 2 === 0 ? -1 : 1;
      const baseX = side * burstW * (0.14 + p * 0.3);
      const baseY = (seededUnit(combo + i * 1.7 + timeSeed) - 0.5) * burstH * 0.48;
      const reach = burstW * (0.1 + seededUnit(combo + i * 3.4 + timeSeed) * 0.12) * (1 - p * 0.28);
      const endY = baseY + (seededUnit(combo + i * 5.6 + timeSeed) - 0.5) * burstH * 0.22;
      drawElectricBolt(
        ctx,
        baseX,
        baseY,
        baseX + side * reach,
        endY,
        palette,
        lifeAlpha * 0.82,
        stageScale,
        seed,
        depth,
        budget === 'normal' && getComboHudTier(combo) >= 1,
      );
    }

    const angle =
      seededUnit(combo + i * 2.13 + timeSeed * 0.31) * Math.PI * 2 + progress.t * Math.PI * 3.4;
    const startR = burstW * (0.03 + seededUnit(seed + 4.2) * 0.07);
    const endR = burstW * (0.24 + p * 0.36) * (0.78 + seededUnit(seed + 8.6) * 0.28);
    const yScale = burstH / Math.max(burstW, 1);
    const drift = (seededUnit(seed + 14.8) - 0.5) * 0.42;
    const x1 = Math.cos(angle) * startR;
    const y1 = Math.sin(angle) * startR * yScale;
    const x2 = Math.cos(angle + drift) * endR;
    const y2 = Math.sin(angle + drift) * endR * yScale;
    drawElectricBolt(
      ctx,
      x1,
      y1,
      x2,
      y2,
      palette,
      lifeAlpha * 0.74,
      stageScale,
      seed + 51.2,
      depth,
      budget === 'normal' && i % 2 === 0,
    );
  }
  ctx.restore();
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

function drawFilteredContainedFeedbackAsset(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  filter: string,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image || filter === 'none') {
    return drawContainedFeedbackAsset(ctx, image, cx, cy, maxW, maxH, scale, alpha);
  }
  ctx.save();
  ctx.filter = filter;
  const bounds = drawContainedFeedbackAsset(ctx, image, cx, cy, maxW, maxH, scale, alpha);
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
  const palette = getComboFeedbackPalette(comboTier);
  drawFeedbackStripLightWrap(
    ctx,
    strip.cx,
    strip.cy,
    strip.width,
    strip.height,
    `rgba(${palette.soft}, 0.95)`,
    `rgba(${palette.main}, 0.92)`,
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
  drawFilteredContainedFeedbackAsset(
    ctx,
    scoreStrip,
    stripCx,
    stripCy,
    chipW,
    stripDrawH,
    getComboRailFilter(comboTier),
    1,
    progress.alpha,
  );
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
  const tierFilter = getComboRailFilter(comboTier);
  const drawn = drawFilteredContainedFeedbackAsset(
    ctx,
    scorePopBase,
    0,
    assetCyOffset,
    assetMaxW,
    assetMaxH,
    tierFilter,
    0.92,
    assetAlpha,
  );
  if (!drawn && drawFallbackFx) drawFallbackFx(ctx, progress.t);

  const palette = getComboFeedbackPalette(comboTier);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = palette.digitColor;
  ctx.shadowBlur = 10 * stageScale;
  ctx.font = `900 ${opts.fontPx ?? 22 * stageScale}px ${fontFamily}`;
  ctx.fillStyle = palette.digitColor;
  ctx.fillText(scoreText, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = progress.alpha * 0.42;
  ctx.fillStyle = palette.hot;
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
    drawScorePopPreviewDecorations(ctx, layout.popCx, layout.popCy, canvasW, canvasH, progress, comboTier);
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
  fontFamilyMono: string;
  fontFamilyDisplay: string;
  hudFxBudget?: HudFxBudget;
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
