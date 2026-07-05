import { deduce } from '../../ai/deduction.ts'
import { pickLogicOnlyMove } from '../../ai/moves/tactical.ts'
import type { SolverBoard } from '../../ai/session-board.ts'
import type { AiMove } from '../../ai/types.ts'
import { getNeighbors, isCellActive } from '../../board.ts'
import type { Board } from '../../types.ts'
import { buildFirstClickSafeZone, createPuzzleBoard, isBoardCleared, placeMinesFromSeed, revealSingle } from './board.ts'

/** Attempts to derive a logic-solvable mine layout from a base seed. */
export const PUZZLE_SOLVABLE_SEED_ATTEMPTS = 128

export function mixSolvableAttemptSeed(baseSeed: number, attempt: number): number {
  return (baseSeed + Math.imul(attempt, 2654435761)) >>> 0
}

function buildSolverBoard(board: Board): SolverBoard {
  return {
    rows: board.rows,
    cols: board.cols,
    inConstraints(row, col) {
      return isCellActive(board, row, col)
    },
    canAct(row, col) {
      return isCellActive(board, row, col)
    },
    neighbors(row, col) {
      return getNeighbors(board, row, col)
    },
    cell(row, col) {
      if (!isCellActive(board, row, col)) return null
      const c = board.cells[row]![col]!
      return {
        revealed: c.revealed,
        flagged: c.mark === 'flag',
        adjacentMines: c.revealed && !c.isMine ? c.adjacentMines : null,
        knownMine: c.revealed && c.isMine,
      }
    },
    totalMines: board.mineCount,
  }
}

function cloneBoardCells(board: Board): Board {
  return {
    ...board,
    cells: board.cells.map((row) => row.map((cell) => ({ ...cell }))),
  }
}

function toggleFlag(board: Board, row: number, col: number): void {
  const cell = board.cells[row]![col]!
  if (cell.revealed) return
  cell.mark = cell.mark === 'flag' ? 'none' : 'flag'
}

function chordBoard(board: Board, row: number, col: number): boolean {
  const cell = board.cells[row]![col]
  if (!cell?.revealed || cell.isMine || cell.adjacentMines === 0) return true

  const neighbors = getNeighbors(board, row, col)
  const flaggedCount = neighbors.filter(({ row: nr, col: nc }) => board.cells[nr]![nc]!.mark === 'flag').length
  if (flaggedCount !== cell.adjacentMines) return true

  for (const { row: nr, col: nc } of neighbors) {
    const neighbor = board.cells[nr]![nc]!
    if (neighbor.mark !== 'none' || neighbor.revealed) continue
    if (revealSingle(board, nr, nc) === 'mine') return false
  }
  return true
}

function applyLogicMove(board: Board, move: AiMove): boolean {
  if (move.kind === 'reveal') {
    return revealSingle(board, move.row, move.col) !== 'mine'
  }
  if (move.kind === 'flag' || move.kind === 'unflag') {
    toggleFlag(board, move.row, move.col)
    return true
  }
  if (move.kind === 'chord') {
    return chordBoard(board, move.row, move.col)
  }
  return false
}

function pickLogicMove(board: Board): AiMove | null {
  const solverBoard = buildSolverBoard(board)
  const deduced = deduce(solverBoard)
  return pickLogicOnlyMove(solverBoard, deduced, undefined)
}

/** Whether a placed board can be cleared using only certain deductions (no guesses). */
export function isBoardLogicSolvable(board: Board): boolean {
  if (!board.minesPlaced) return false

  let sim = cloneBoardCells(board)
  let guard = 0
  const maxSteps = board.rows * board.cols * 4

  while (!isBoardCleared(sim)) {
    if (guard++ > maxSteps) return false

    const move = pickLogicMove(sim)
    if (!move) return false
    if (!applyLogicMove(sim, move)) return false
  }

  return true
}

export function isLogicSolvableFromFirstClick(seed: number, mineCount: number, startRow: number, startCol: number): boolean {
  const board = createPuzzleBoard(seed, mineCount)
  placeMinesFromSeed(board, buildFirstClickSafeZone(startRow, startCol, board))
  if (revealSingle(board, startRow, startCol) === 'mine') return false
  return isBoardLogicSolvable(board)
}

/** Whether any solvable seed exists within attempt budget. */
export function hasSolvableSeedForFirstClick(baseSeed: number, mineCount: number, startRow: number, startCol: number): boolean {
  const normalized = baseSeed >>> 0
  for (let attempt = 0; attempt < PUZZLE_SOLVABLE_SEED_ATTEMPTS; attempt += 1) {
    const candidate = mixSolvableAttemptSeed(normalized, attempt)
    if (isLogicSolvableFromFirstClick(candidate, mineCount, startRow, startCol)) {
      return true
    }
  }
  return false
}

/** Deterministic seed offset so ranked replay matches client mine placement. */
export function findSolvableSeed(baseSeed: number, mineCount: number, startRow: number, startCol: number): number {
  const normalized = baseSeed >>> 0
  for (let attempt = 0; attempt < PUZZLE_SOLVABLE_SEED_ATTEMPTS; attempt += 1) {
    const candidate = mixSolvableAttemptSeed(normalized, attempt)
    if (isLogicSolvableFromFirstClick(candidate, mineCount, startRow, startCol)) {
      return candidate
    }
  }
  return normalized
}

export function placeSolvableMines(board: Board, startRow: number, startCol: number): void {
  const baseSeed = board.worldSeed ?? 1
  board.worldSeed = findSolvableSeed(baseSeed, board.mineCount, startRow, startCol)
  placeMinesFromSeed(board, buildFirstClickSafeZone(startRow, startCol, board))
}

/** @internal Test helper — average attempts to find a solvable seed. */
export function countSolvableSeedAttempts(baseSeed: number, mineCount: number, startRow: number, startCol: number): number {
  const normalized = baseSeed >>> 0
  for (let attempt = 0; attempt < PUZZLE_SOLVABLE_SEED_ATTEMPTS; attempt += 1) {
    const candidate = mixSolvableAttemptSeed(normalized, attempt)
    if (isLogicSolvableFromFirstClick(candidate, mineCount, startRow, startCol)) {
      return attempt + 1
    }
  }
  return PUZZLE_SOLVABLE_SEED_ATTEMPTS
}
