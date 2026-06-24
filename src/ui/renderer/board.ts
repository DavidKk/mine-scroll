import type { CellView } from '../../core/types.ts';
import { GRID_PADDING, HUD_HEIGHT, HUD_GAP, PANEL_RADIUS, THEME, cellPixelOrigin } from '../theme.ts';
import { drawBoardCellOverlays, type BoardPointerState } from '../cell-fx.ts';
import {
  drawCell,
  drawCellMarksOverlay,
  drawHudPill,
  drawStatusIcon,
  hudPillWidth,
} from './cells.ts';
import type { LayoutMetrics } from './layout.ts';
import { fillRoundRect, strokeRoundRect } from './primitives.ts';
import { drawAiHint, drawScrollDangerBand, drawScrollPressureBar } from './scroll-ui.ts';
import type { RenderState } from './types.ts';

export type { LayoutMetrics } from './layout.ts';
export type { ScrollPressureState, RenderState } from './types.ts';
export {
  getLayoutMetrics,
  getBoardOnlyLayoutMetrics,
  applyBoardPreviewBand,
} from './layout.ts';

function isPointerCell(pointer: BoardPointerState | null | undefined, view: CellView): boolean {
  return Boolean(pointer && pointer.row === view.row && pointer.col === view.col);
}

function drawPlayableCells(
  ctx: CanvasRenderingContext2D,
  views: CellView[],
  layout: LayoutMetrics,
  state: RenderState,
): void {
  const { gridOriginX, gridOriginY, grid } = layout;
  for (const view of views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawCell(ctx, x, y, view, grid, state.status);
  }
}

function drawPlayableMarks(
  ctx: CanvasRenderingContext2D,
  views: CellView[],
  layout: LayoutMetrics,
  state: RenderState,
  animateFlags: boolean,
): void {
  const { gridOriginX, gridOriginY, grid } = layout;
  for (const view of views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    const animate = animateFlags && isPointerCell(state.pointer, view);
    drawCellMarksOverlay(ctx, x, y, view, grid, state.nowMs ?? 0, animate);
  }
}

function drawPlayableAmbientOverlays(
  ctx: CanvasRenderingContext2D,
  views: CellView[],
  layout: LayoutMetrics,
  state: RenderState,
): void {
  const { gridOriginX, gridOriginY, grid } = layout;
  const overlayOptions = {
    status: state.status,
    nowMs: state.nowMs ?? 0,
    pointer: state.pointer,
  };
  for (const view of views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawBoardCellOverlays(ctx, state.views, grid, x, y, view, overlayOptions);
  }
}

/** Board static layer: cells + flags + AI hint (cacheable; no scroll pressure or pointer FX). */
export function renderBoardStaticFrame(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  state: RenderState,
): void {
  const { gridOriginX, gridOriginY, gridWidth, gridHeight, grid } = layout;

  ctx.clearRect(0, 0, layout.width, layout.height);

  const trackBg = ctx.createLinearGradient(0, 0, gridWidth, 0);
  trackBg.addColorStop(0, 'rgba(24, 24, 27, 0.34)');
  trackBg.addColorStop(0.08, THEME.panelBg);
  trackBg.addColorStop(0.92, THEME.panelBg);
  trackBg.addColorStop(1, 'rgba(24, 24, 27, 0.34)');
  ctx.fillStyle = trackBg;
  ctx.fillRect(0, 0, gridWidth, gridHeight);

  const previewRows = state.previewRows ?? 0;
  drawBoardSideRails(ctx, layout, previewRows);

  const previewViews = previewRows > 0 ? state.views.filter((view) => view.preview) : [];
  const playableViews = previewRows > 0 ? state.views.filter((view) => !view.preview) : state.views;

  if (previewViews.length > 0) {
    const bandTop = gridOriginY - grid.cellStep;
    const bandH = grid.cellStep;
    const visibleH = previewRows * grid.cellStep;

    ctx.save();
    drawPlayableCells(ctx, previewViews, layout, state);
    drawPlayableMarks(ctx, previewViews, layout, state, false);

    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(Math.max(0, 1 - visibleH / bandH - 0.08), 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(gridOriginX - 2, bandTop - 2, gridWidth + 4, bandH + 4);
    ctx.restore();
  }

  drawPlayableCells(ctx, playableViews, layout, state);
  drawPlayableMarks(ctx, playableViews, layout, state, false);

  if (state.aiHint && state.status !== 'lost') {
    drawAiHint(ctx, layout, state.aiHint);
  }
}

/** Board dynamic layer: scroll pressure + pointer-adjacent FX. */
export function renderBoardDynamicFrame(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  state: RenderState,
): void {
  const previewRows = state.previewRows ?? 0;
  const playableViews = previewRows > 0 ? state.views.filter((view) => !view.preview) : state.views;

  if (state.scrollPressure && state.status === 'playing') {
    drawScrollDangerBand(ctx, layout, state.scrollPressure, state.rows);
  }

  drawPlayableAmbientOverlays(ctx, playableViews, layout, state);

  const { gridOriginX, gridOriginY, grid } = layout;
  for (const view of playableViews) {
    if (!view.flagged || view.revealed || !isPointerCell(state.pointer, view)) continue;
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawCellMarksOverlay(ctx, x, y, view, grid, state.nowMs ?? 0, true);
  }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  state: RenderState,
): void {
  const { width, height, gridOriginX, gridOriginY, resetButton, gridWidth, gridHeight, grid } =
    layout;

  ctx.clearRect(0, 0, width, height);

  fillRoundRect(ctx, 0, 0, width, height, PANEL_RADIUS, THEME.canvasBg);
  strokeRoundRect(ctx, 0.5, 0.5, width - 1, height - 1, PANEL_RADIUS, THEME.panelBorder);

  fillRoundRect(ctx, GRID_PADDING / 2, 6, width - GRID_PADDING, HUD_HEIGHT - 6, 10, THEME.panelBg);

  const pillH = 34;
  const pillY = (HUD_HEIGHT - pillH) / 2;
  const hudLeft =
    state.hudLeftDisplay ?? String(state.mineTotal - state.flagCount).padStart(3, '0');
  const leftPillW = hudPillWidth(
    hudLeft,
    state.hudLeftDisplay?.includes('♥') ? 72 : 48,
    state.hudLeftDisplay?.includes('♥') ? 80 : 88,
  );
  drawHudPill(ctx, 12, pillY, leftPillW, pillH, hudLeft, 'left');

  const hudRight =
    state.hudRightDisplay ?? String(state.elapsedSeconds).padStart(3, '0');
  const rightPillW = hudPillWidth(hudRight, 48, state.hudRightDisplay?.startsWith('↑') ? 80 : 72);
  drawHudPill(
    ctx,
    width - rightPillW - 12,
    pillY,
    rightPillW,
    pillH,
    hudRight,
    'right',
  );

  fillRoundRect(
    ctx,
    resetButton.x,
    resetButton.y,
    resetButton.size,
    resetButton.size,
    resetButton.size / 2,
    THEME.resetBg,
  );
  strokeRoundRect(
    ctx,
    resetButton.x + 0.5,
    resetButton.y + 0.5,
    resetButton.size - 1,
    resetButton.size - 1,
    resetButton.size / 2,
    THEME.panelBorder,
  );
  drawStatusIcon(
    ctx,
    resetButton.x + resetButton.size / 2,
    resetButton.y + resetButton.size / 2,
    state.status,
  );

  const gridTop = HUD_HEIGHT + HUD_GAP;
  fillRoundRect(ctx, 0, gridTop, gridWidth, gridHeight, 12, THEME.panelBg);

  if (state.scrollPressure && state.status === 'playing') {
    drawScrollPressureBar(ctx, layout, state.scrollPressure);
  }

  for (const view of state.views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawCell(ctx, x, y, view, grid, state.status);
  }

  if (state.scrollPressure && state.status === 'playing') {
    drawScrollDangerBand(ctx, layout, state.scrollPressure, state.rows);
  }

  drawPlayableAmbientOverlays(ctx, state.views, layout, state);

  for (const view of state.views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    const animate = isPointerCell(state.pointer, view);
    drawCellMarksOverlay(ctx, x, y, view, grid, state.nowMs ?? 0, animate);
  }

  if (state.aiHint && state.status !== 'lost') {
    drawAiHint(ctx, layout, state.aiHint);
  }
}

/** Side rail vertical span; extends to preview band top with fade when preview rows exist. */
export interface BoardSideRailLayout {
  top: number;
  bottom: number;
  fadeInStart: number | null;
  fadeInEnd: number | null;
}

export function getBoardSideRailLayout(
  layout: LayoutMetrics,
  previewRows: number,
): BoardSideRailLayout {
  const bottom = layout.gridHeight - GRID_PADDING;
  if (previewRows <= 0) {
    return { top: GRID_PADDING, bottom, fadeInStart: null, fadeInEnd: null };
  }
  const { gridOriginY, grid } = layout;
  const bandTop = gridOriginY - grid.cellStep;
  const visibleH = previewRows * grid.cellStep;
  return {
    top: bandTop,
    bottom,
    fadeInStart: bandTop + grid.cellStep - visibleH,
    fadeInEnd: gridOriginY,
  };
}

export function getBoardSideRailBounds(
  layout: LayoutMetrics,
  previewRows: number,
): { top: number; bottom: number } {
  const rails = getBoardSideRailLayout(layout, previewRows);
  return { top: rails.top, bottom: rails.bottom };
}

function railGradientStop(railTop: number, railBottom: number, y: number): number {
  const span = railBottom - railTop;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (y - railTop) / span));
}

/** Side rail stroke gradient: same fade as preview band top edge. */
export function createBoardSideRailGradient(
  ctx: CanvasRenderingContext2D,
  railTop: number,
  railBottom: number,
  peakColor: string,
  fadeInStart: number | null,
  fadeInEnd: number | null,
): CanvasGradient {
  const transparent = peakColor.replace(/[\d.]+\)$/u, '0)');
  const gradient = ctx.createLinearGradient(0, railTop, 0, railBottom);
  if (fadeInStart === null || fadeInEnd === null) {
    gradient.addColorStop(0, transparent);
    gradient.addColorStop(0.12, peakColor);
    gradient.addColorStop(0.88, peakColor);
    gradient.addColorStop(1, transparent);
    return gradient;
  }
  gradient.addColorStop(0, transparent);
  gradient.addColorStop(railGradientStop(railTop, railBottom, fadeInStart), transparent);
  gradient.addColorStop(railGradientStop(railTop, railBottom, fadeInEnd), peakColor);
  gradient.addColorStop(0.88, peakColor);
  gradient.addColorStop(1, transparent);
  return gradient;
}

function drawBoardSideRails(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  previewRows: number,
  peakColor = 'rgba(96, 165, 250, 0.18)',
): void {
  const { gridWidth } = layout;
  const rails = getBoardSideRailLayout(layout, previewRows);
  ctx.save();
  ctx.strokeStyle = createBoardSideRailGradient(
    ctx,
    rails.top,
    rails.bottom,
    peakColor,
    rails.fadeInStart,
    rails.fadeInEnd,
  );
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(1.5, rails.top);
  ctx.lineTo(1.5, rails.bottom);
  ctx.moveTo(gridWidth - 1.5, rails.top);
  ctx.lineTo(gridWidth - 1.5, rails.bottom);
  ctx.stroke();
  ctx.restore();
}

export function renderBoardOnlyFrame(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  state: RenderState,
): void {
  renderBoardStaticFrame(ctx, layout, state);
  renderBoardDynamicFrame(ctx, layout, state);
}
