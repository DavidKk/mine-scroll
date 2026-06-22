import type { AiHintDisplay } from '../../core/ai/types.ts';
import { GRID_PADDING, HUD_HEIGHT, HUD_GAP, THEME, cellPixelOrigin } from '../theme.ts';
import type { LayoutMetrics } from './layout.ts';
import { fillRoundRect, strokeRoundRect } from './primitives.ts';
import type { ScrollPressureState } from './types.ts';

function scrollCountdownRemaining(progress: number): number {
  return Math.max(0, 1 - progress);
}

export function drawScrollPressureBar(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  pressure: ScrollPressureState,
): void {
  const { gridWidth } = layout;
  const gridTop = HUD_HEIGHT + HUD_GAP;
  const barY = gridTop + 2;
  const barH = 5;
  const barW = gridWidth - GRID_PADDING * 2;
  const barX = GRID_PADDING;

  ctx.save();

  fillRoundRect(ctx, barX, barY, barW, barH, 3, 'rgba(39, 39, 42, 0.95)');
  const fillW = barW * scrollCountdownRemaining(pressure.progress);
  if (fillW >= 1) {
    fillRoundRect(
      ctx,
      barX,
      barY,
      fillW,
      barH,
      3,
      pressure.urgent ? THEME.danger : THEME.warning,
    );
  }

  ctx.restore();
}

/** 即将离屏行警戒色带（不绘制数字，避免与盘面冲突） */
export function drawScrollDangerBand(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  pressure: ScrollPressureState,
  visibleRows: number,
): void {
  const { gridOriginX, gridOriginY, gridWidth, grid } = layout;
  const coveredRows = Math.max(1, Math.min(visibleRows, Math.floor(pressure.batchRows ?? 1)));
  const startScreenRow = Math.max(0, visibleRows - coveredRows);
  const rowY = gridOriginY + startScreenRow * grid.cellStep;
  const rowH = (coveredRows - 1) * grid.cellStep + grid.cellSize;
  const pulse = pressure.urgent ? 0.5 + Math.sin(Date.now() / 90) * 0.5 : 0;
  const bandAlpha = pressure.urgent ? 0.28 + pulse * 0.16 : 0.12 + pressure.progress * 0.14;
  const bandW = gridWidth - GRID_PADDING * 2 + 4;
  const boundaryColor = pressure.urgent
    ? `rgba(254, 202, 202, ${0.72 + pulse * 0.24})`
    : pressure.progress > 0.62
      ? `rgba(251, 191, 36, ${0.62 + pressure.progress * 0.2})`
      : `rgba(96, 165, 250, ${0.42 + pressure.progress * 0.28})`;

  ctx.save();

  const gradient = ctx.createLinearGradient(0, rowY, 0, rowY + rowH);
  if (pressure.urgent) {
    gradient.addColorStop(0, `rgba(239, 68, 68, ${bandAlpha * 0.45})`);
    gradient.addColorStop(0.5, `rgba(239, 68, 68, ${bandAlpha})`);
    gradient.addColorStop(1, `rgba(127, 29, 29, ${bandAlpha * 0.95})`);
  } else {
    gradient.addColorStop(0, `rgba(245, 158, 11, ${bandAlpha * 0.35})`);
    gradient.addColorStop(1, `rgba(245, 158, 11, ${bandAlpha})`);
  }

  fillRoundRect(
    ctx,
    gridOriginX - 2,
    rowY - 2,
    bandW,
    rowH + 4,
    grid.cellRadius + 2,
    gradient,
  );

  ctx.globalAlpha = pressure.urgent ? 0.55 + pulse * 0.25 : 0.28;
  ctx.strokeStyle = pressure.urgent ? '#fecaca' : '#fde68a';
  ctx.lineWidth = 1;
  for (let y = rowY + 4; y < rowY + rowH; y += 7) {
    ctx.beginPath();
    ctx.moveTo(gridOriginX + 2, y);
    ctx.lineTo(gridOriginX + bandW - 6, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const boundaryY = rowY - 3;
  const boundaryW = bandW * scrollCountdownRemaining(pressure.progress);
  if (boundaryW >= 1) {
    const boundaryX = gridOriginX - 2 + (bandW - boundaryW) / 2;
    ctx.shadowColor = boundaryColor;
    ctx.shadowBlur = pressure.urgent ? 12 : 7;
    fillRoundRect(
      ctx,
      boundaryX,
      boundaryY,
      boundaryW,
      Math.max(3, grid.cellSize * 0.14),
      4,
      boundaryColor,
    );
    ctx.shadowBlur = 0;
  }

  ctx.globalAlpha = pressure.urgent ? 0.38 + pulse * 0.2 : 0.18 + pressure.progress * 0.16;
  ctx.strokeStyle = boundaryColor;
  ctx.lineWidth = 1;
  for (let x = gridOriginX; x < gridOriginX + bandW; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, boundaryY - 2);
    ctx.lineTo(x + 5, boundaryY - 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (pressure.urgent) {
    strokeRoundRect(
      ctx,
      gridOriginX - 2,
      rowY - 2,
      bandW,
      rowH + 4,
      grid.cellRadius + 2,
      `rgba(254, 202, 202, ${0.55 + pulse * 0.35})`,
      2,
    );
  }

  ctx.restore();
}

export function drawAiHint(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  hint: AiHintDisplay,
): void {
  const { gridOriginX, gridOriginY, grid } = layout;
  const { x, y } = cellPixelOrigin(hint.row, hint.col, gridOriginX, gridOriginY, grid);

  const isGuess = hint.confidence === 'guess';
  const color =
    hint.kind === 'flag'
      ? 'rgba(239, 68, 68, 0.28)'
      : hint.kind === 'unflag'
        ? 'rgba(251, 146, 60, 0.28)'
        : hint.kind === 'chord'
          ? 'rgba(99, 102, 241, 0.28)'
          : isGuess
            ? 'rgba(245, 158, 11, 0.28)'
            : 'rgba(34, 197, 94, 0.28)';

  ctx.save();
  fillRoundRect(ctx, x - 2, y - 2, grid.cellSize + 4, grid.cellSize + 4, grid.cellRadius + 2, color);
  strokeRoundRect(
    ctx,
    x - 2,
    y - 2,
    grid.cellSize + 4,
    grid.cellSize + 4,
    grid.cellRadius + 2,
    isGuess ? THEME.warning : THEME.accent,
    2,
  );
  ctx.restore();
}
