import type { AiHintDisplay } from '../../core/ai/types.ts';
import type { CellView, GameStatus } from '../../core/types.ts';
import { drawImageContained, getGameCutout, type GameCutoutName } from '../game-assets.ts';
import type { GridMetrics } from '../theme.ts';
import { drawCellBreathOverlay, drawCellHoverOverlay } from './breath-hover.ts';
import { drawDigitAmbientOverlay } from './digit-overlay.ts';
import type { BoardPointerState } from './types.ts';

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
