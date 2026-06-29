import { ENDLESS_COLS } from '@shared/core/modes/endless/constants.ts'

import { computeEndlessMobileBoardFit, computeGameStageLayout, getEndlessLayoutProfile } from '../../game-stage-layout.ts'
import { applyBoardPreviewBand, getBoardOnlyLayoutMetrics, getLayoutMetrics, type LayoutMetrics } from '../../renderer/index.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { applyCanvasSize } from '../types.ts'
import { syncViewportFitLayout } from './viewport-fit.ts'

export function boardBaseLayout(rt: GameCanvasRuntime, nextRows: number, nextCols: number): LayoutMetrics {
  return rt.fullscreen
    ? getBoardOnlyLayoutMetrics(nextRows, nextCols, rt.canvasOptions.maxGrid, rt.state.fittedCellSize)
    : getLayoutMetrics(nextRows, nextCols, rt.canvasOptions.maxGrid, rt.fixedCellSize)
}

export function withPreviewBand(rt: GameCanvasRuntime, layout: LayoutMetrics, previewRows: number): LayoutMetrics {
  return rt.fullscreen && previewRows > 0 ? applyBoardPreviewBand(layout, previewRows) : layout
}

export function applySquareLayout(rt: GameCanvasRuntime, nextRows: number, nextCols: number, previewRows = rt.state.currentPreviewRows): void {
  rt.state.squareLayout = withPreviewBand(rt, boardBaseLayout(rt, nextRows, nextCols), previewRows)
  rt.state.boardWidth = rt.state.squareLayout.width
  rt.state.boardHeight = rt.state.squareLayout.height
}

export function syncPreviewLayout(rt: GameCanvasRuntime, previewRows: number): void {
  if (!rt.state.squareLayout) return
  const capped = rt.endlessPreviewRows > 0 ? Math.min(previewRows, rt.endlessPreviewRows) : previewRows
  if (capped === rt.state.currentPreviewRows) return
  rt.state.currentPreviewRows = capped
  applySquareLayout(rt, rt.state.currentRows, rt.state.currentCols, rt.state.currentPreviewRows)
}

export function syncSquareLayout(rt: GameCanvasRuntime, nextRows: number, nextCols: number): void {
  if (!rt.state.squareLayout || rt.fixedGridRows !== undefined) return
  applySquareLayout(rt, nextRows, nextCols, rt.state.currentPreviewRows)
  if (!rt.fullscreen) {
    rt.state.width = rt.state.boardWidth
    rt.state.height = rt.state.boardHeight
    applyCanvasSize(rt.canvas, rt.ctx, rt.state.width, rt.state.height)
  }
}

export function syncBoardSizeFromLayout(rt: GameCanvasRuntime): void {
  if (rt.fullscreen && rt.fitViewport) syncViewportFitLayout(rt)
  rt.state.boardWidth = rt.state.squareLayout!.width
  rt.state.boardHeight = rt.state.squareLayout!.height
  if (rt.fullscreen) {
    const cellSize = rt.state.squareLayout?.grid.cellSize ?? rt.state.fittedCellSize
    const mobileFit =
      getEndlessLayoutProfile(rt.state.width) === 'mobile'
        ? computeEndlessMobileBoardFit(ENDLESS_COLS, rt.state.width, rt.state.height, {
            min: rt.fitViewport?.minCellSize ?? 18,
            max: rt.fitViewport?.maxCellSize ?? 48,
            previewRows: rt.state.currentPreviewRows,
          })
        : null
    rt.state.stageLayout = computeGameStageLayout(
      rt.state.width,
      rt.state.height,
      rt.state.boardWidth,
      rt.state.boardHeight,
      cellSize,
      rt.state.currentRows,
      mobileFit?.rowCenterNudge ?? 0
    )
    rt.state.boardOffsetX = Math.round(rt.state.stageLayout.boardX)
    rt.state.boardOffsetY = Math.round(rt.state.stageLayout.boardY)
  }
}

export function initialSquareLayout(rt: GameCanvasRuntime, rows: number, cols: number): LayoutMetrics {
  return withPreviewBand(rt, boardBaseLayout(rt, rows, cols), rt.state.currentPreviewRows)
}
