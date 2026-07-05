import { computeEndlessBoardCellSize, getEndlessLayoutProfile, resolveViewportEndlessVisibleRows } from '../../game-stage-layout.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { applyCanvasSize } from '../types.ts'
import { applySquareLayout } from './board-layout.ts'

export function fitCellSizeForViewport(rt: GameCanvasRuntime, viewportW?: number, viewportH?: number): number {
  const gridRows = (rt.fitViewport?.rows ?? rt.state.currentRows) + rt.state.currentPreviewRows
  const gridCols = rt.fitViewport?.cols ?? rt.state.currentCols
  const host = rt.canvasOptions.viewportSize
  const vw = viewportW ?? host?.width ?? (rt.fullscreen ? Math.max(320, window.innerWidth) : rt.state.width)
  const vh = viewportH ?? host?.height ?? (rt.fullscreen ? Math.max(480, window.innerHeight) : rt.state.height)
  return computeEndlessBoardCellSize(gridCols, gridRows, vw, vh, {
    min: rt.fitViewport?.minCellSize ?? 18,
    max: rt.fitViewport?.maxCellSize ?? 48,
    previewRows: rt.state.currentPreviewRows,
  })
}

export function resolveInitialCellSize(rt: GameCanvasRuntime): number | undefined {
  if (rt.fixedCellSize !== undefined) return rt.fixedCellSize
  if (!rt.fitViewport || !rt.fullscreen) return undefined
  const host = rt.canvasOptions.viewportSize
  if (host) return fitCellSizeForViewport(rt, host.width, host.height)
  return fitCellSizeForViewport(rt, Math.max(320, window.innerWidth), Math.max(480, window.innerHeight))
}

export function syncFullscreenCanvasSize(rt: GameCanvasRuntime): void {
  if (!rt.fullscreen) return
  if (rt.canvasOptions.viewportSize) return
  const nextWidth = Math.max(320, window.innerWidth)
  const nextHeight = Math.max(480, window.innerHeight)
  if (nextWidth === rt.state.width && nextHeight === rt.state.height) return
  rt.state.width = nextWidth
  rt.state.height = nextHeight
  applyCanvasSize(rt.canvas, rt.ctx, rt.state.width, rt.state.height)
}

export function syncViewportFitLayout(rt: GameCanvasRuntime): void {
  if (!rt.fitViewport || !rt.state.squareLayout) return
  const vw = rt.state.width
  const vh = rt.state.height
  const nextRows = getEndlessLayoutProfile(vw) === 'mobile' ? resolveViewportEndlessVisibleRows(vw, vh, rt.state.currentPreviewRows) : rt.fitViewport.rows
  const nextCell = fitCellSizeForViewport(rt, vw, vh)
  const rowsChanged = nextRows !== rt.fitViewport.rows || nextRows !== rt.state.currentRows
  const cellChanged = nextCell !== rt.state.fittedCellSize
  if (!rowsChanged && !cellChanged) return
  rt.state.fittedCellSize = nextCell
  rt.fitViewport.rows = nextRows
  rt.state.currentRows = nextRows
  applySquareLayout(rt, nextRows, rt.fitViewport.cols, rt.state.currentPreviewRows)
}
