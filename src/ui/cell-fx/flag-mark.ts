import { GAME_ASSET_TUNING, drawFxSpriteFrame, drawImageContained, getGameCutout } from '../game-assets.ts';
import type { GridMetrics } from '../theme.ts';
import { getTileSprites } from '../tile-sprites.ts';

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
