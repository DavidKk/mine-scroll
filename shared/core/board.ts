import type { Board } from './types.ts'

export interface Coord {
  row: number
  col: number
}

export function isCellActive(board: Board, row: number, col: number): boolean {
  const cell = board.cells[row]?.[col]
  if (!cell) return false
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols
}

export function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols
}

export function getNeighbors(board: Board, row: number, col: number): Coord[] {
  const neighbors: Coord[] = []
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (inBounds(board, nr, nc)) {
        neighbors.push({ row: nr, col: nc })
      }
    }
  }
  return neighbors
}

export function cloneBoard(board: Board): Board {
  return {
    rows: board.rows,
    cols: board.cols,
    mineCount: board.mineCount,
    minesPlaced: board.minesPlaced,
    topology: board.topology,
    minRow: board.minRow,
    maxRow: board.maxRow,
    worldSeed: board.worldSeed,
    cells: board.cells.map((row) => row.map((cell) => ({ ...cell }))),
  }
}
