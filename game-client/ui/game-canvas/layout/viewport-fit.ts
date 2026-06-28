import { computeEndlessBoardCellSize } from '../../game-stage-layout.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { applyCanvasSize } from '../types.ts'
import { applySquareLayout } from './board-layout.ts'

export function fitCellSizeForViewport(rt: GameCanvasRuntime, viewportW?: number, viewportH?: number): number {
  const gridRows = (rt.fitViewport?.rows ?? rt.state.currentRows) + rt.state.currentPreviewRows
  const gridCols = rt.fitViewport?.cols ?? rt.state.currentCols
  const vw = viewportW ?? (rt.fullscreen ? Math.max(320, window.innerWidth) : rt.state.width)
  const vh = viewportH ?? (rt.fullscreen ? Math.max(480, window.innerHeight) : rt.state.height)
  return computeEndlessBoardCellSize(gridCols, gridRows, vw, vh, {
    min: rt.fitViewport?.minCellSize ?? 18,
    max: rt.fitViewport?.maxCellSize ?? 36,
  })
}

export function resolveInitialCellSize(rt: GameCanvasRuntime): number | undefined {
  if (rt.fixedCellSize !== undefined) return rt.fixedCellSize
  if (!rt.fitViewport || !rt.fullscreen) return undefined
  return fitCellSizeForViewport(rt, Math.max(320, window.innerWidth), Math.max(480, window.innerHeight))
}

export function syncFullscreenCanvasSize(rt: GameCanvasRuntime): void {
  if (!rt.fullscreen) return
  const nextWidth = Math.max(320, window.innerWidth)
  const nextHeight = Math.max(480, window.innerHeight)
  if (nextWidth === rt.state.width && nextHeight === rt.state.height) return
  rt.state.width = nextWidth
  rt.state.height = nextHeight
  applyCanvasSize(rt.canvas, rt.ctx, rt.state.width, rt.state.height)
}

export function syncViewportFitLayout(rt: GameCanvasRuntime): void {
  if (!rt.fitViewport || !rt.state.squareLayout) return
  const nextCell = fitCellSizeForViewport(rt, rt.state.width, rt.state.height)
  if (nextCell === rt.state.fittedCellSize) return
  rt.state.fittedCellSize = nextCell
  applySquareLayout(rt, rt.fitViewport.rows, rt.fitViewport.cols, rt.state.currentPreviewRows)
}
