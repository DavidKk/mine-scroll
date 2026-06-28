import { drawFeedbackStripLightWrap } from '../cell-fx.ts';
import { drawFxSpriteFrame, GAME_ASSET_TUNING } from '../game-assets.ts';
import { easeOutCubic } from '../primitives/index.ts';
import { drawFilteredContainedFeedbackAsset, measureContainedAsset } from './asset-draw.ts';
import { getComboFeedbackPalette, getComboRailFilter } from './combo-palette.ts';
import { drawScorePopPreviewDecorations } from './preview.ts';
import type {
  HudFxBudget,
  ScorePopBottomStripDrawOptions,
  ScorePopFxDrawOptions,
  ScorePopFxProgress,
  ScorePopStripOrbit,
  ScorePopV3DrawOptions,
  ScorePopV3Layout,
} from './types.ts';

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

export function createScorePopFallbackDrawer(stageScale: number) {
  return (ctx: CanvasRenderingContext2D, t: number): void => {
    drawFxSpriteFrame(ctx, 'score-pop', t, 0, 0, 132 * stageScale, 56 * stageScale, GAME_ASSET_TUNING.fx.scorePop.spriteAlpha);
  };
}
