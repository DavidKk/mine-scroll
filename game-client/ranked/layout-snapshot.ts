import type { GameCanvasRuntime } from '../ui/game-canvas/runtime/context.ts'
import type { LayoutSnapshot } from './types.ts'

export function layoutSnapshotFromRuntime(rt: GameCanvasRuntime): LayoutSnapshot | null {
  const layout = rt.state.squareLayout
  if (!layout) return null
  return {
    w: rt.state.width,
    h: rt.state.height,
    ox: rt.state.boardOffsetX,
    oy: rt.state.boardOffsetY,
    rows: rt.state.currentRows,
    cols: rt.state.currentCols,
    previewRows: rt.state.currentPreviewRows,
    gridOriginX: layout.gridOriginX,
    gridOriginY: layout.gridOriginY,
    cellSize: layout.grid.cellSize,
    cellStep: layout.grid.cellStep,
    cellGap: layout.grid.cellGap,
  }
}
