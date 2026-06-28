import type { AiBlockedSets } from '../ai-blocked.ts'
import { componentProbabilities } from '../csp.ts'
import { deduce, type Deduction, findContradictoryFlagMove, findExcessFlagMove, findMisflaggedSafeMove } from '../deduction.ts'
import type { SolverBoard } from '../session-board.ts'
import type { AiCoord, AiMove } from '../types.ts'
import { bottomRow } from './bottom-row.ts'
import { isFlagBlocked, makeMove, pickCertainChord, pickCertainFlags, pickCertainReveals } from './certain-moves.ts'
import { findSafeChords } from './chords.ts'
import { pickExpansion, pickLastResortBreakthrough } from './expansion.ts'
import { pickCspMove, pickFrontierEdge } from './guess.ts'

export function pickTacticalMove(board: SolverBoard, deduced: Deduction, lives: number, blocks: AiBlockedSets | undefined, batchRows = 1): AiMove | null {
  const endless = Boolean(board.endless)
  const bottom = bottomRow(board)
  const bottomEmergency = endless && batchRows > 1

  const excess = findExcessFlagMove(board, deduced.mines)
  if (excess && !isFlagBlocked(blocks, excess.row, excess.col)) {
    return makeMove('unflag', excess.row, excess.col, 'certain', endless && excess.row === bottom ? 'Bottom row wrong-flag fix' : 'Wrong-flag fix')
  }

  const contradictory = findContradictoryFlagMove(board, deduced.mines)
  if (contradictory && !isFlagBlocked(blocks, contradictory.row, contradictory.col)) {
    return makeMove('unflag', contradictory.row, contradictory.col, 'certain', 'Contradictory flag fix')
  }

  const misflagged = findMisflaggedSafeMove(board, deduced.safe, deduced.mines)
  if (misflagged) {
    return makeMove('unflag', misflagged.row, misflagged.col, 'certain', 'Wrong flag · actually safe')
  }

  const flag = pickCertainFlags(board, deduced, blocks, null)
  if (flag) return flag
  const reveal = pickCertainReveals(board, deduced, blocks, null)
  if (reveal) return reveal
  const chord = pickCertainChord(board, deduced, blocks, null)
  if (chord) return chord

  const edge = pickFrontierEdge(board, deduced, lives, blocks, bottomEmergency)
  if (edge) return edge

  const frontier = componentProbabilities(board, deduced)
  if (frontier && frontier.size > 0) {
    const vars = [...frontier.keys()]
    const csp = pickCspMove(board, deduced, lives, blocks, vars, bottomEmergency)
    if (csp) return csp
  }

  const expand = pickExpansion(board, lives, blocks, bottomEmergency)
  if (expand) return expand

  const lastResort = pickLastResortBreakthrough(board, deduced, blocks, bottomEmergency)
  if (lastResort) return lastResort

  return null
}

export function solveBoard(board: SolverBoard, lives: number, blocks: AiBlockedSets | undefined, batchRows = 1): { deduced: Deduction; chords: AiCoord[]; move: AiMove | null } {
  const deduced = deduce(board)
  const chords = findSafeChords(board, deduced)
  const move = pickTacticalMove(board, deduced, lives, blocks, batchRows)
  return { deduced, chords, move }
}
