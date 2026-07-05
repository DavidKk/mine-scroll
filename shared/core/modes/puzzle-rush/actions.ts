import { getNeighbors } from '../../board.ts'
import type { Board, CellView, LifeLossReport } from '../../types.ts'
import { cellKey, isCellBlocked } from '../../types.ts'
import { clonePuzzleBoard, createPuzzleBoard, isBoardCleared, revealAllMines, revealSingle } from './board.ts'
import { placePuzzleBoardMines } from './board-profile.ts'
import { CLEAN_BOARDS_HEAL_EVERY, PUZZLE_LIVES } from './constants.ts'
import { boardClearScore, nextBoardSeed } from './score.ts'
import { getPuzzleRushTierForBoardIndex } from './tier.ts'
import type { PuzzleRushSession, StreakBreakReport } from './types.ts'

function mineKey(row: number, col: number): string {
  return cellKey(row, col)
}

function clearStreakOnMistake(session: PuzzleRushSession): PuzzleRushSession {
  const streakCleared = session.streak
  if (streakCleared === 0) return session
  const lastStreakBreak: StreakBreakReport = { streakCleared }
  return { ...session, streak: 0, lastStreakBreak }
}

function applyLifeLoss(session: PuzzleRushSession, board: Board, damage: number, lifeLoss?: LifeLossReport): PuzzleRushSession {
  const lives = session.lives - damage
  const hitMineKeys = new Set(session.hitMineKeys)
  if (lifeLoss) {
    for (const cell of lifeLoss.cells) {
      if (cell.kind === 'mine-hit') hitMineKeys.add(mineKey(cell.localRow, cell.col))
    }
  }

  if (lives <= 0) {
    revealAllMines(board)
    return {
      ...session,
      state: { ...session.state, board, status: 'lost' },
      lives: 0,
      hitMineKeys: [...hitMineKeys],
      lastLifeLoss: lifeLoss,
      cleanBoards: 0,
    }
  }

  return {
    ...session,
    state: { ...session.state, board, status: 'playing' },
    lives,
    hitMineKeys: [...hitMineKeys],
    lastLifeLoss: lifeLoss,
    cleanBoards: 0,
  }
}

function advanceAfterBoardClear(session: PuzzleRushSession, elapsedMs: number): PuzzleRushSession {
  const streakAfter = session.streak + 1
  const tier = getPuzzleRushTierForBoardIndex(session.boardIndex)
  const { scoreAdded, timeBonus } = boardClearScore(elapsedMs, session.boardIndex)
  const nextIndex = session.boardIndex + 1
  const nextSeed = nextBoardSeed(session.state.board.worldSeed ?? 1, nextIndex, streakAfter)

  const boardWasClean = session.lives >= session.livesAtBoardStart
  let cleanBoards = boardWasClean ? session.cleanBoards + 1 : 0

  let lives = session.lives
  let livesGained = 0
  if (cleanBoards >= CLEAN_BOARDS_HEAL_EVERY) {
    cleanBoards = 0
    if (lives < PUZZLE_LIVES) {
      livesGained = 1
      lives = Math.min(PUZZLE_LIVES, lives + livesGained)
    }
  }

  return {
    ...session,
    streak: streakAfter,
    cleanBoards,
    boardIndex: nextIndex,
    score: session.score + scoreAdded,
    lives,
    pendingNextSeed: nextSeed,
    lastBoardClear: {
      scoreAdded,
      streakAfter,
      timeBonus,
      boardIndex: nextIndex,
      tier: tier.tier,
      elapsedMs,
      ...(livesGained > 0 ? { livesGained, livesAfter: lives } : {}),
    },
  }
}

export function puzzleRushCommitNextBoard(session: PuzzleRushSession, nowMs = Date.now()): PuzzleRushSession {
  if (session.pendingNextSeed === undefined) return session
  const seed = session.pendingNextSeed
  const { mines } = getPuzzleRushTierForBoardIndex(session.boardIndex)
  return {
    ...session,
    pendingNextSeed: undefined,
    boardStartedAtMs: nowMs,
    hitMineKeys: [],
    livesAtBoardStart: session.lives,
    state: {
      ...session.state,
      status: 'playing',
      board: createPuzzleBoard(seed, mines),
    },
  }
}

export function createPuzzleRushSession(seed?: number): PuzzleRushSession {
  const normalizedSeed = (seed ?? (Date.now() ^ (Math.random() * 0x1_0000_0000)) >>> 0) >>> 0
  const { mines } = getPuzzleRushTierForBoardIndex(0)
  return {
    modeId: 'puzzle-rush',
    state: {
      status: 'idle',
      board: createPuzzleBoard(normalizedSeed, mines),
      modeId: 'puzzle-rush',
    },
    lives: PUZZLE_LIVES,
    score: 0,
    streak: 0,
    cleanBoards: 0,
    livesAtBoardStart: PUZZLE_LIVES,
    boardIndex: 0,
    boardStartedAtMs: 0,
    runStartedAtMs: 0,
    hitMineKeys: [],
  }
}

export function puzzleRushBeginRun(session: PuzzleRushSession, nowMs = Date.now()): PuzzleRushSession {
  if (session.state.status !== 'idle') return session
  return {
    ...session,
    boardStartedAtMs: nowMs,
    runStartedAtMs: session.runStartedAtMs > 0 ? session.runStartedAtMs : nowMs,
    livesAtBoardStart: session.lives,
    state: { ...session.state, status: 'playing' },
  }
}

export function puzzleRushRevealAt(session: PuzzleRushSession, row: number, col: number, nowMs = Date.now()): PuzzleRushSession {
  const { state } = session
  if (state.status === 'lost') return session
  const cell = state.board.cells[row]?.[col]
  if (!cell || isCellBlocked(cell) || cell.revealed) return session

  const board = clonePuzzleBoard(state.board)
  let next: PuzzleRushSession = session

  if (!board.minesPlaced) {
    placePuzzleBoardMines(board, row, col, next, nowMs)
  }

  if (state.status === 'idle') {
    next = {
      ...next,
      boardStartedAtMs: nowMs,
      runStartedAtMs: next.runStartedAtMs > 0 ? next.runStartedAtMs : nowMs,
      livesAtBoardStart: session.lives,
      state: { ...next.state, status: 'playing' },
    }
  }

  const outcome = revealSingle(board, row, col)

  if (outcome === 'mine') {
    const lifeLoss = {
      cause: 'mine-reveal' as const,
      damage: 1,
      cells: [{ localRow: row, col, screenRow: row, kind: 'mine-hit' as const }],
      boardChange: `(${row},${col}) hidden → revealed (mine)`,
      reason: 'Reveal hit mine',
    }
    const afterBreak = clearStreakOnMistake(next)
    return applyLifeLoss(afterBreak, board, 1, lifeLoss)
  }

  if (isBoardCleared(board)) {
    const elapsedMs = next.boardStartedAtMs > 0 ? nowMs - next.boardStartedAtMs : 0
    const cleared = advanceAfterBoardClear({ ...next, state: { ...next.state, board } }, elapsedMs)
    return { ...cleared, boardStartedAtMs: nowMs }
  }

  return { ...next, state: { ...next.state, board } }
}

export function puzzleRushChordAt(session: PuzzleRushSession, row: number, col: number, nowMs = Date.now()): PuzzleRushSession {
  const { state } = session
  if (state.status !== 'playing' || !state.board.minesPlaced) return session

  const cell = state.board.cells[row]?.[col]
  if (!cell?.revealed || cell.isMine || cell.adjacentMines === 0) return session

  const neighbors = getNeighbors(state.board, row, col)
  const flaggedCount = neighbors.filter(({ row: nr, col: nc }) => state.board.cells[nr]![nc]!.mark === 'flag').length
  if (flaggedCount !== cell.adjacentMines) return session

  const board = clonePuzzleBoard(state.board)
  let mineHits = 0
  const mineCells: Array<{ localRow: number; col: number; screenRow: number; kind: 'mine-hit' }> = []

  for (const { row: nr, col: nc } of neighbors) {
    const neighbor = board.cells[nr]![nc]!
    if (neighbor.mark !== 'none' || neighbor.revealed) continue
    if (revealSingle(board, nr, nc) === 'mine') {
      mineHits += 1
      mineCells.push({ localRow: nr, col: nc, screenRow: nr, kind: 'mine-hit' })
    }
  }

  if (mineHits > 0) {
    const lifeLoss = {
      cause: 'chord-mine' as const,
      damage: mineHits,
      cells: mineCells,
      boardChange: `Chord (${row},${col}) · mines opened: ${mineCells.map((c) => `(${c.screenRow},${c.col})`).join(' ')}`,
      reason: mineHits === 1 ? 'Chord hit 1 mine' : `Chord hit ${mineHits} mines`,
    }
    const afterBreak = clearStreakOnMistake(session)
    return applyLifeLoss(afterBreak, board, mineHits, lifeLoss)
  }

  if (isBoardCleared(board)) {
    const elapsedMs = session.boardStartedAtMs > 0 ? nowMs - session.boardStartedAtMs : 0
    const cleared = advanceAfterBoardClear({ ...session, state: { ...session.state, board } }, elapsedMs)
    return { ...cleared, boardStartedAtMs: nowMs }
  }

  return { ...session, state: { ...session.state, board } }
}

export function puzzleRushToggleMarkAt(session: PuzzleRushSession, row: number, col: number): PuzzleRushSession {
  const { state } = session
  if (state.status !== 'playing' && state.status !== 'idle') return session

  const cell = state.board.cells[row]?.[col]
  if (!cell || cell.revealed) return session

  const board = clonePuzzleBoard(state.board)
  const current = board.cells[row]![col]!
  current.mark = current.mark === 'flag' ? 'none' : 'flag'

  return { ...session, state: { ...session.state, board } }
}

export function getPuzzleRushFlagCount(session: PuzzleRushSession): number {
  let count = 0
  for (let row = 0; row < session.state.board.rows; row += 1) {
    for (let col = 0; col < session.state.board.cols; col += 1) {
      if (session.state.board.cells[row]![col]!.mark === 'flag') count += 1
    }
  }
  return count
}

export function toPuzzleRushCellViews(session: PuzzleRushSession): CellView[] {
  return toPuzzleBoardCellViews(session.state.board, session.hitMineKeys, session.state.status === 'lost')
}

export function toPuzzleBoardCellViews(board: Board, hitMineKeys: string[] = [], gameOver = false): CellView[] {
  const hitKeys = new Set(hitMineKeys)
  const views: CellView[] = []

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!
      const showMine = (cell.revealed && cell.isMine) || (gameOver && cell.isMine)
      const key = mineKey(row, col)
      views.push({
        row,
        col,
        revealed: cell.revealed,
        flagged: cell.mark === 'flag',
        adjacentMines: cell.revealed && !cell.isMine ? cell.adjacentMines : null,
        isMine: showMine ? true : null,
        mineHit: showMine && hitKeys.has(key),
        fxKey: key,
      })
    }
  }

  return views
}
