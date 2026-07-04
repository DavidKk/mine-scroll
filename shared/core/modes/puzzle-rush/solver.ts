import type { AiBlockedSets } from '../../ai/ai-blocked.ts'
import { aiPersistCellKey } from '../../ai/ai-blocked.ts'
import { parseKey } from '../../ai/deduction.ts'
import { solveBoard } from '../../ai/moves.ts'
import { pickFirstClick, type SolverBoard, type SolverCell } from '../../ai/session-board.ts'
import type { AiAnalysis, AiHintDisplay, AiMove } from '../../ai/types.ts'
import { getNeighbors, isCellActive } from '../../board.ts'
import type { Board } from '../../types.ts'
import { cellKey } from '../../types.ts'
import { puzzleRushChordAt, puzzleRushRevealAt, puzzleRushToggleMarkAt } from './actions.ts'
import type { PuzzleRushSession } from './types.ts'

function readCell(board: Board, row: number, col: number): SolverCell | null {
  if (!isCellActive(board, row, col)) return null
  const c = board.cells[row]![col]!
  return {
    revealed: c.revealed,
    flagged: c.mark === 'flag',
    adjacentMines: c.revealed && !c.isMine ? c.adjacentMines : null,
    knownMine: c.revealed && c.isMine,
  }
}

export function buildPuzzleSolverBoard(session: PuzzleRushSession): SolverBoard {
  const board = session.state.board
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
      return readCell(board, row, col)
    },
    totalMines: board.mineCount,
  }
}

function resolvePersistedToLocal(board: Board, persisted: string[]): Set<string> {
  const out = new Set<string>()
  if (persisted.length === 0) return out
  const want = new Set(persisted)
  for (let r = 0; r < board.rows; r += 1) {
    for (let c = 0; c < board.cols; c += 1) {
      const local = cellKey(r, c)
      const world = aiPersistCellKey(board, r, c)
      if (want.has(world) || want.has(local)) out.add(local)
    }
  }
  return out
}

export function resolvePuzzleAiBlockedSets(session: PuzzleRushSession): AiBlockedSets {
  const board = session.state.board
  const oscillation = resolvePersistedToLocal(board, session.aiOscillationBlocked ?? [])
  const contradicted = resolvePersistedToLocal(board, session.aiContradictedFlags ?? [])
  const flag = new Set([...oscillation, ...contradicted])
  return { flag, reveal: oscillation }
}

export function isPuzzleAiPersistBlocked(session: PuzzleRushSession, localRow: number, col: number): boolean {
  const pk = aiPersistCellKey(session.state.board, localRow, col)
  return session.aiOscillationBlocked?.includes(pk) === true || session.aiContradictedFlags?.includes(pk) === true
}

export function getPuzzleRushAiStepMs(session: PuzzleRushSession): number {
  if (session.state.status !== 'playing') return 400
  return 180
}

export function analyzePuzzleRushSession(session: PuzzleRushSession): AiAnalysis {
  const board = buildPuzzleSolverBoard(session)

  if (!session.state.board.minesPlaced || session.state.status === 'idle') {
    const start = pickFirstClick(board)
    return {
      safe: [start],
      mines: [],
      chords: [],
      move: {
        kind: 'reveal',
        row: start.row,
        col: start.col,
        confidence: 'certain',
        reason: 'First click start',
      },
    }
  }

  if (session.state.status !== 'playing') {
    return { safe: [], mines: [], chords: [], move: null }
  }

  const blocks = resolvePuzzleAiBlockedSets(session)
  const lives = session.lives
  const { deduced, chords, move } = solveBoard(board, lives, blocks, 1)

  return {
    safe: [...deduced.safe].map(parseKey).filter(({ row, col }) => board.canAct(row, col)),
    mines: [...deduced.mines].map(parseKey).filter(({ row, col }) => board.canAct(row, col)),
    chords: chords.filter(({ row, col }) => board.canAct(row, col)),
    move,
  }
}

export function toPuzzleAiHintDisplay(analysis: AiAnalysis): AiHintDisplay | null {
  const move = analysis.move
  if (!move || move.kind === 'heal' || move.kind === 'scroll') return null
  return {
    row: move.row,
    col: move.col,
    kind: move.kind,
    confidence: move.confidence,
  }
}

export function applyPuzzleRushAiMove(session: PuzzleRushSession, move: AiMove): PuzzleRushSession {
  if (move.kind === 'reveal') return puzzleRushRevealAt(session, move.row, move.col)
  if (move.kind === 'chord') return puzzleRushChordAt(session, move.row, move.col)
  if (move.kind === 'flag' || move.kind === 'unflag') {
    const cell = session.state.board.cells[move.row]?.[move.col]
    if (!cell || cell.revealed) return session
    if (move.kind === 'unflag' && cell.mark !== 'flag') return session
    if (move.kind === 'flag' && cell.mark === 'flag') return session
    return puzzleRushToggleMarkAt(session, move.row, move.col)
  }
  return session
}
