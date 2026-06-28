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
import { drawSpriteInCell, getTileSprites } from '../tile-sprites.ts';
import type { LayoutMetrics } from './layout.ts';
import { fillRoundRect, strokeRoundRect } from './primitives.ts';
import { drawAiHint, drawScrollDangerBand, drawScrollPressureBar } from './scroll-ui.ts';
import type { RenderState } from './types.ts';
import { clamp01 } from '../primitives/index.ts';

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
    if (state.status === 'idle') {
      drawIntroCellSurface(ctx, x, y, view, grid, state.status);
    } else {
      drawCell(ctx, x, y, view, grid, state.status);
    }
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
    flagSwipeActive: state.flagSwipeActive,
  };
  for (const view of views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawBoardCellOverlays(ctx, state.views, grid, x, y, view, overlayOptions);
  }
}

interface PreviewBandMask {
  x: number;
  y: number;
  w: number;
  h: number;
  bandTop: number;
  bandH: number;
  visibleH: number;
}

function getPreviewBandMask(layout: LayoutMetrics, previewRows: number): PreviewBandMask {
  const { gridOriginX, gridOriginY, gridWidth, grid } = layout;
  const bandTop = gridOriginY - grid.cellStep;
  const bandH = grid.cellStep;
  const visibleH = previewRows * grid.cellStep;
  return {
    x: gridOriginX - 2,
    y: bandTop - 2,
    w: gridWidth + 4,
    h: bandH + 4,
    bandTop,
    bandH,
    visibleH,
  };
}

function applyPreviewBandMask(
  ctx: CanvasRenderingContext2D,
  mask: PreviewBandMask,
  originX = 0,
  originY = 0,
): void {
  const fade = ctx.createLinearGradient(0, mask.bandTop - originY, 0, mask.bandTop + mask.bandH - originY);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(Math.max(0, 1 - mask.visibleH / mask.bandH - 0.08), 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = fade;
  ctx.fillRect(mask.x - originX, mask.y - originY, mask.w, mask.h);
}

function drawMaskedPreviewLayer(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  previewRows: number,
  drawLayer: (layerCtx: CanvasRenderingContext2D) => void,
): void {
  const mask = getPreviewBandMask(layout, previewRows);
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.ceil(mask.w));
  layer.height = Math.max(1, Math.ceil(mask.h));

  const layerCtx = layer.getContext('2d');
  if (!layerCtx) return;

  layerCtx.translate(-mask.x, -mask.y);
  drawLayer(layerCtx);
  layerCtx.setTransform(1, 0, 0, 1, 0, 0);
  applyPreviewBandMask(layerCtx, mask, mask.x, mask.y);
  ctx.drawImage(layer, mask.x, mask.y);
}

/** Board static layer: cells + flags + AI hint (cacheable; no scroll pressure or pointer FX). */
export function renderBoardStaticFrame(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  state: RenderState,
): void {
  const { gridOriginY, gridWidth, gridHeight } = layout;

  ctx.clearRect(0, 0, layout.width, layout.height);
  const previewRows = state.previewRows ?? 0;

  const trackBg = ctx.createLinearGradient(0, 0, gridWidth, 0);
  trackBg.addColorStop(0, 'rgba(24, 24, 27, 0.34)');
  trackBg.addColorStop(0.08, THEME.panelBg);
  trackBg.addColorStop(0.92, THEME.panelBg);
  trackBg.addColorStop(1, 'rgba(24, 24, 27, 0.34)');
  ctx.fillStyle = trackBg;
  const trackTop = previewRows > 0 ? gridOriginY : 0;
  ctx.fillRect(0, trackTop, gridWidth, gridHeight - trackTop);

  drawBoardSideRails(ctx, layout, previewRows);

  const previewViews = previewRows > 0 ? state.views.filter((view) => view.preview) : [];
  const playableViews = previewRows > 0 ? state.views.filter((view) => !view.preview) : state.views;

  if (previewViews.length > 0) {
    ctx.save();
    drawPlayableCells(ctx, previewViews, layout, state);
    drawPlayableMarks(ctx, previewViews, layout, state, false);
    applyPreviewBandMask(ctx, getPreviewBandMask(layout, previewRows));
    ctx.restore();
  }

  drawPlayableCells(ctx, playableViews, layout, state);
  drawPlayableMarks(ctx, playableViews, layout, state, false);

  if (state.aiHint && state.status !== 'lost') {
    drawAiHint(ctx, layout, state.aiHint);
  }
}

export function getCellIntroRippleDist(row: number, col: number, rows: number, cols: number): number {
  const centerRow = (rows - 1) / 2;
  const centerCol = (cols - 1) / 2;
  return Math.hypot(row - centerRow, col - centerCol);
}

export function getMaxCellIntroRippleDist(rows: number, cols: number): number {
  let maxDist = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      maxDist = Math.max(maxDist, getCellIntroRippleDist(row, col, rows, cols));
    }
  }
  return maxDist;
}

/** Ripple wave from center: linear alpha 0→1 as the front reaches each cell. */
export function getCellIntroRippleAlpha(reveal: number, dist: number, maxDist: number): number {
  if (reveal <= 0) return 0;
  if (maxDist <= 0) return clamp01(reveal);
  const rippleBand = Math.max(2, maxDist * 0.42);
  const rippleFront = reveal * (maxDist + rippleBand);
  return clamp01((rippleFront - dist) / rippleBand);
}

/** Hidden tile frame only — no dark underlay (intro draws over starfield). */
function drawIntroCellSurface(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  view: CellView,
  grid: LayoutMetrics['grid'],
  status: RenderState['status'],
): void {
  const sprites = getTileSprites();
  if (sprites && !view.revealed) {
    drawSpriteInCell(ctx, sprites.hidden, x, y, grid.cellSize);
    return;
  }
  drawCell(ctx, x, y, view, grid, status);
}

/** Intro board: fixed grid slots; ripple fade 0→1 from center outward. */
export function renderBoardIntroFrame(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  state: RenderState,
  reveal: number,
  rows: number,
  cols: number,
): void {
  const { gridOriginX, gridOriginY, grid } = layout;

  // Do not clearRect — transparency would punch through the canvas to the DOM (black box).
  // Cells composite directly over the ambient backdrop already painted on the shell layer.

  const maxDist = getMaxCellIntroRippleDist(rows, cols);
  const previewRows = state.previewRows ?? 0;
  const previewViews = previewRows > 0 ? state.views.filter((view) => view.preview) : [];
  const playableViews = previewRows > 0 ? state.views.filter((view) => !view.preview) : state.views;

  const drawIntroCell = (targetCtx: CanvasRenderingContext2D, view: CellView) => {
    const dist = getCellIntroRippleDist(view.row, view.col, rows, cols);
    const alpha = getCellIntroRippleAlpha(reveal, dist, maxDist);
    if (alpha <= 0) return;

    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);

    targetCtx.save();
    targetCtx.globalAlpha = alpha;
    drawIntroCellSurface(targetCtx, x, y, view, grid, state.status);
    targetCtx.restore();
  };

  const drawIntroMark = (targetCtx: CanvasRenderingContext2D, view: CellView) => {
    const dist = getCellIntroRippleDist(view.row, view.col, rows, cols);
    const alpha = getCellIntroRippleAlpha(reveal, dist, maxDist);
    if (alpha <= 0) return;
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);

    targetCtx.save();
    targetCtx.globalAlpha = alpha;
    drawCellMarksOverlay(targetCtx, x, y, view, grid, state.nowMs ?? 0, false);
    targetCtx.restore();
  };

  if (previewViews.length > 0) {
    drawMaskedPreviewLayer(ctx, layout, previewRows, (layerCtx) => {
      for (const view of previewViews) drawIntroCell(layerCtx, view);
      for (const view of previewViews) drawIntroMark(layerCtx, view);
    });
  }

  for (const view of playableViews) drawIntroCell(ctx, view);
  for (const view of playableViews) drawIntroMark(ctx, view);

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

  if (state.scrollPressure) {
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

  if (state.scrollPressure) {
    drawScrollPressureBar(ctx, layout, state.scrollPressure);
  }

  for (const view of state.views) {
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid);
    drawCell(ctx, x, y, view, grid, state.status);
  }

  if (state.scrollPressure) {
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
