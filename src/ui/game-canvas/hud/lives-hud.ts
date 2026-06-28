import type { GameCanvasRuntime } from '../runtime/context.ts';
import { drawLivesRow, parseLivesDisplay, type LivesDisplay } from '../../hud-sprites.ts';
import { FONTS } from '../../theme.ts';

export function drawLivesHud(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D, x: number, y: number, raw: string | undefined, scale: number): void {
  const lives = parseLivesDisplay(raw);
  if (!lives) return;
  const metrics = hudHeartRowMetrics(rt, x, y, lives, scale);
  shellCtx.save();
  shellCtx.shadowColor = 'rgba(248, 113, 113, 0.44)';
  shellCtx.shadowBlur = 12 * scale;
  if (!drawLivesRow(shellCtx, metrics.x, metrics.cy, lives, metrics.iconSize, metrics.gap)) {
    shellCtx.fillStyle = '#ef4444';
    shellCtx.font = `700 ${16 * scale}px ${FONTS.mono}`;
    shellCtx.textAlign = 'right';
    shellCtx.textBaseline = 'middle';
    shellCtx.fillText(raw ?? '', x, metrics.cy);
  }
  shellCtx.restore();
}

export function hudHeartIconSize(_rt: GameCanvasRuntime, scale: number): number {
  return Math.max(28, Math.min(38, 34 * scale));
}

export function hudHeartGap(scale: number): number {
  return Math.max(5, 7 * scale);
}

export function hudHeartRowMetrics(rt: GameCanvasRuntime, anchorX: number,
  hudY: number,
  lives: LivesDisplay,
  scale: number,
): { x: number; cy: number; iconSize: number; gap: number; rowW: number } {
  const iconSize = hudHeartIconSize(rt, scale);
  const gap = hudHeartGap(scale);
  const rowW = lives.max * iconSize + (lives.max - 1) * gap;
  return {
    x: anchorX - rowW,
    cy: hudY + 31 * scale,
    iconSize,
    gap,
    rowW,
  };
}
