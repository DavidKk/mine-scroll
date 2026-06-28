import type { LayoutSnapshot } from './types.ts'

function toLayoutMetrics(layout: LayoutSnapshot) {
  return {
    width: layout.w,
    height: layout.h,
    gridOriginX: layout.gridOriginX,
    gridOriginY: layout.gridOriginY,
    gridWidth: layout.cols * layout.cellStep - layout.cellGap + 16,
    gridHeight: layout.rows * layout.cellStep - layout.cellGap + 16,
    resetButton: { x: -9999, y: -9999, size: 0 },
    grid: {
      cellSize: layout.cellSize,
      cellStep: layout.cellStep,
      cellGap: layout.cellGap,
    },
  }
}

export function hitTestCellWithLayout(layout: LayoutSnapshot, x: number, y: number): { row: number; col: number } | null {
  const localX = x - layout.ox - layout.gridOriginX
  const localY = y - layout.oy - layout.gridOriginY
  if (localX < 0) return null

  const { cellSize, cellStep } = layout
  const previewRows = layout.previewRows
  const rows = layout.rows
  const cols = layout.cols

  const previewBandTop = -previewRows * cellStep
  if (localY < previewBandTop) return null

  const col = Math.floor(localX / cellStep)
  if (col < 0 || col >= cols) return null

  const inCellX = localX - col * cellStep
  if (inCellX > cellSize) return null

  const row = Math.floor(localY / cellStep)

  if (row === -1 && previewRows > 0) {
    const inCellY = localY - row * cellStep
    if (inCellY > cellSize) return null
    const visibleFromTop = cellSize - previewRows * cellStep
    if (inCellY < visibleFromTop) return null
    return { row: -1, col }
  }

  if (row < 0 || row >= rows) return null

  const inCellY = localY - row * cellStep
  if (inCellY > cellSize) return null

  return { row, col }
}

export { toLayoutMetrics }
