import { cloneBoard, type Coord,getNeighbors } from '../../board.ts'
import type { Board, Cell } from '../../types.ts'
import { cellKey } from '../../types.ts'
import { PUZZLE_COLS, PUZZLE_MINES, PUZZLE_ROWS } from './constants.ts'

function createEmptyCell(): Cell {
  return {
    isMine: false,
    adjacentMines: 0,
    revealed: false,
    mark: 'none',
  }
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function recomputeAdjacent(board: Board): void {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!
      if (cell.isMine) {
        cell.adjacentMines = 0
        continue
      }
      cell.adjacentMines = getNeighbors(board, row, col).filter(({ row: nr, col: nc }) => board.cells[nr]![nc]!.isMine).length
    }
  }
}

export function buildFirstClickSafeZone(row: number, col: number, board: Board): Coord[] {
  return [{ row, col }, ...getNeighbors(board, row, col)]
}

export function createPuzzleBoard(seed: number): Board {
  const normalizedSeed = seed >>> 0
  const cells: Cell[][] = Array.from({ length: PUZZLE_ROWS }, () => Array.from({ length: PUZZLE_COLS }, () => createEmptyCell()))

  return {
    rows: PUZZLE_ROWS,
    cols: PUZZLE_COLS,
    mineCount: PUZZLE_MINES,
    cells,
    minesPlaced: false,
    topology: 'fixed',
    minRow: 0,
    maxRow: PUZZLE_ROWS - 1,
    worldSeed: normalizedSeed,
  }
}

export function placeMinesFromSeed(board: Board, forbidden: Coord[] = []): void {
  const forbiddenKeys = new Set(forbidden.map(({ row, col }) => cellKey(row, col)))
  const candidates: Coord[] = []
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!forbiddenKeys.has(cellKey(row, col))) candidates.push({ row, col })
    }
  }

  const rand = mulberry32(board.worldSeed ?? 1)
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = candidates[i]!
    candidates[i] = candidates[j]!
    candidates[j] = tmp
  }

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      board.cells[row]![col]!.isMine = false
    }
  }

  for (let i = 0; i < board.mineCount && i < candidates.length; i += 1) {
    const { row, col } = candidates[i]!
    board.cells[row]![col]!.isMine = true
  }

  recomputeAdjacent(board)
  board.minesPlaced = true
}

export function isBoardCleared(board: Board): boolean {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!
      if (!cell.isMine && !cell.revealed) return false
    }
  }
  return true
}

export function revealAllMines(board: Board): void {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!
      if (cell.isMine) cell.revealed = true
    }
  }
}

function canAutoReveal(cell: Cell): boolean {
  return !cell.revealed && cell.mark === 'none' && !cell.isMine
}

export function floodReveal(board: Board, startRow: number, startCol: number): void {
  const queue: Coord[] = [{ row: startRow, col: startCol }]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { row, col } = queue.shift()!
    const key = cellKey(row, col)
    if (visited.has(key)) continue
    visited.add(key)

    const cell = board.cells[row]![col]!
    if (!canAutoReveal(cell)) continue

    cell.revealed = true

    if (cell.adjacentMines === 0) {
      for (const neighbor of getNeighbors(board, row, col)) {
        queue.push(neighbor)
      }
    }
  }
}

export function revealSingle(board: Board, row: number, col: number): 'mine' | 'safe' {
  const cell = board.cells[row]![col]!
  if (cell.revealed || cell.mark !== 'none') return 'safe'

  if (cell.isMine) {
    cell.revealed = true
    return 'mine'
  }

  if (cell.adjacentMines === 0) {
    floodReveal(board, row, col)
  } else {
    cell.revealed = true
  }

  return 'safe'
}

export function countNewlyRevealed(before: Board, after: Board): number {
  let count = 0
  for (let row = 0; row < after.rows; row += 1) {
    for (let col = 0; col < after.cols; col += 1) {
      if (after.cells[row]![col]!.revealed && !before.cells[row]![col]!.revealed) count += 1
    }
  }
  return count
}

export function clonePuzzleBoard(board: Board): Board {
  return cloneBoard(board)
}

export { canAutoReveal, recomputeAdjacent }
