import type { GameCanvasRuntime } from '../runtime/context.ts';
import { getBoardOnlyLayoutMetrics, getLayoutMetrics, applyBoardPreviewBand, type LayoutMetrics } from '../../renderer/index.ts';
import { computeGameStageLayout, getMobileBoardCanvasY } from '../../game-stage-layout.ts';
import { applyCanvasSize } from '../types.ts';
import { syncViewportFitLayout } from './viewport-fit.ts';

export function boardBaseLayout(rt: GameCanvasRuntime, nextRows: number, nextCols: number): LayoutMetrics {
  return rt.fullscreen
    ? getBoardOnlyLayoutMetrics(nextRows, nextCols, rt.canvasOptions.maxGrid, rt.state.fittedCellSize)
    : getLayoutMetrics(nextRows, nextCols, rt.canvasOptions.maxGrid, rt.fixedCellSize);
}

export function withPreviewBand(rt: GameCanvasRuntime, layout: LayoutMetrics, previewRows: number): LayoutMetrics {
  return rt.fullscreen && previewRows > 0 ? applyBoardPreviewBand(layout, previewRows) : layout;
}

export function applySquareLayout(
  rt: GameCanvasRuntime,
  nextRows: number,
  nextCols: number,
  previewRows = rt.state.currentPreviewRows,
): void {
  rt.state.squareLayout = withPreviewBand(rt, boardBaseLayout(rt, nextRows, nextCols), previewRows);
  rt.state.boardWidth = rt.state.squareLayout.width;
  rt.state.boardHeight = rt.state.squareLayout.height;
}

export function syncPreviewLayout(rt: GameCanvasRuntime, previewRows: number): void {
  if (!rt.state.squareLayout) return;
  const capped = rt.endlessPreviewRows > 0 ? Math.min(previewRows, rt.endlessPreviewRows) : previewRows;
  if (capped === rt.state.currentPreviewRows) return;
  rt.state.currentPreviewRows = capped;
  applySquareLayout(rt, rt.state.currentRows, rt.state.currentCols, rt.state.currentPreviewRows);
}

export function syncSquareLayout(rt: GameCanvasRuntime, nextRows: number, nextCols: number): void {
  if (!rt.state.squareLayout || rt.fixedGridRows !== undefined) return;
  applySquareLayout(rt, nextRows, nextCols, rt.state.currentPreviewRows);
  if (!rt.fullscreen) {
    rt.state.width = rt.state.boardWidth;
    rt.state.height = rt.state.boardHeight;
    applyCanvasSize(rt.canvas, rt.ctx, rt.state.width, rt.state.height);
  }
}

export function syncBoardSizeFromLayout(rt: GameCanvasRuntime): void {
  if (rt.fullscreen && rt.fitViewport) syncViewportFitLayout(rt);
  rt.state.boardWidth = rt.state.squareLayout!.width;
  rt.state.boardHeight = rt.state.squareLayout!.height;
  if (rt.fullscreen) {
    rt.state.stageLayout = computeGameStageLayout(
      rt.state.width,
      rt.state.height,
      rt.state.boardWidth,
      rt.state.boardHeight,
    );
    rt.state.boardOffsetX = Math.round(rt.state.stageLayout.boardX);
    const gridOriginY = rt.state.squareLayout!.gridOriginY;
    rt.state.boardOffsetY =
      rt.state.stageLayout.profile === 'mobile'
        ? Math.round(getMobileBoardCanvasY(rt.state.stageLayout, gridOriginY))
        : Math.round(rt.state.stageLayout.boardY);
  }
}

export function initialSquareLayout(
  rt: GameCanvasRuntime,
  rows: number,
  cols: number,
): LayoutMetrics {
  return withPreviewBand(rt, boardBaseLayout(rt, rows, cols), rt.state.currentPreviewRows);
}
