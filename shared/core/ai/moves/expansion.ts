import type { AiBlockedSets } from '../ai-blocked.ts'
import { type Deduction, key } from '../deduction.ts'
import type { SolverBoard } from '../session-board.ts'
import type { AiCoord, AiMove } from '../types.ts'
import { bottomRowUnresolved, pickBest } from './bottom-row.ts'
import { isRevealBlocked, makeMove } from './certain-moves.ts'
import { estimateLocalFrontierRisk, guessAllowed } from './guess.ts'

function isPristine(board: SolverBoard, row: number, col: number): boolean {
  const cell = board.cell(row, col)
  if (!cell || cell.revealed || cell.flagged) return false
  for (const nb of board.neighbors(row, col)) {
    if (board.cell(nb.row, nb.col)?.revealed) return false
  }
  return true
}

function hasActableRevealedClue(board: SolverBoard): boolean {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col)) continue
      const cell = board.cell(row, col)
      if (cell?.revealed && cell.adjacentMines !== null) return true
    }
  }
  return false
}

export function pickExpansion(board: SolverBoard, lives: number, blocks: AiBlockedSets | undefined, bottomEmergency: boolean): AiMove | null {
  if (!board.endless) return null

  const forcedUnknown = !hasActableRevealedClue(board)
  if (!forcedUnknown && lives < 5) return null

  const estimatedRisk = bottomEmergency ? 0.2 : 0.18
  if (!forcedUnknown && !guessAllowed(true, lives, estimatedRisk, bottomEmergency)) return null
  if (forcedUnknown && lives <= 1) return null

  const candidates: AiCoord[] = []
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col) || isRevealBlocked(blocks, row, col)) continue
      if (isPristine(board, row, col)) candidates.push({ row, col })
    }
  }

  const e = board.endless
  const pick = candidates.reduce<AiCoord | null>((best, c) => {
    const targetRow = e.viewStart + 1
    const targetCol = Math.floor(board.cols / 2)
    const score = (c.row - targetRow) ** 2 + (c.col - targetCol) ** 2
    if (!best) return c
    const bestScore = (best.row - targetRow) ** 2 + (best.col - targetCol) ** 2
    return score < bestScore ? c : best
  }, null)

  if (!pick) return null
  const pct = Math.round(estimatedRisk * 1000) / 10
  const label = forcedUnknown ? 'Breakthrough · all unknown' : 'Expansion'
  return makeMove('reveal', pick.row, pick.col, 'guess', `${label} · est. ${pct}%`)
}

export function pickLastResortBreakthrough(board: SolverBoard, deduced: Deduction, blocks: AiBlockedSets | undefined, bottomEmergency: boolean): AiMove | null {
  if (!board.endless) return null

  const bottomStalled = bottomRowUnresolved(board).length > 0
  if (!bottomEmergency && !bottomStalled) return null

  let frontier: { row: number; col: number; prob: number } | null = null
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col) || isRevealBlocked(blocks, row, col)) continue
      const cell = board.cell(row, col)
      if (!cell || cell.revealed || cell.flagged) continue
      if (deduced.mines.has(key(row, col))) continue
      const prob = estimateLocalFrontierRisk(board, deduced, row, col)
      if (prob === null) continue
      if (!frontier || prob < frontier.prob) frontier = { row, col, prob }
    }
  }

  if (frontier) {
    if (frontier.prob <= 1e-9) {
      return makeMove('reveal', frontier.row, frontier.col, 'certain', 'Safe reveal')
    }
    const pct = Math.round(frontier.prob * 1000) / 10
    return makeMove('reveal', frontier.row, frontier.col, 'guess', `Emergency salvage · est. ${pct}%`)
  }

  const candidates: AiCoord[] = []
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col) || isRevealBlocked(blocks, row, col)) continue
      if (deduced.mines.has(key(row, col))) continue
      if (isPristine(board, row, col)) candidates.push({ row, col })
    }
  }

  const pick = pickBest(candidates, board)
  if (!pick) return null
  return makeMove('reveal', pick.row, pick.col, 'guess', 'Emergency salvage · no clues')
}
