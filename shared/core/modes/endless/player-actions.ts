import { cloneBoard } from '../../board.ts'
import { clearDefuseStreakOnMistake, recordMineHitScrollExempt } from '../../mines-defused.ts'
import type { GameStatus, LifeLossCell, LifeLossReport, ModeSession } from '../../types.ts'
import { isCellBlocked } from '../../types.ts'
import { applyMinesFromSeed, getLocalNeighbors, inLocalBounds, visibleViewStart } from './grid.ts'
import { actionableBounds, applyLifeLoss, countNewlyRevealed, finalizeBoard, inRevealBounds, revealSingle, toScreenRow } from './reveal-pipeline.ts'
import { isEndlessActionableLocalRow } from './views.ts'

/** Start endless run from the title screen without waiting for first reveal. Mines are fixed at session create. */
export function endlessBeginRun(session: ModeSession): ModeSession {
  if (session.modeId !== 'endless' || session.state.status !== 'idle') return session

  return {
    ...session,
    state: { ...session.state, status: 'playing' },
  }
}

export function endlessRevealAt(session: ModeSession, row: number, col: number): ModeSession {
  const { state } = session
  if (!inLocalBounds(state.board, row, col)) return session
  if (!isEndlessActionableLocalRow(session, row)) return session
  const cell = state.board.cells[row]?.[col]
  if (!cell) return session
  if (state.status === 'lost') return session
  if (isCellBlocked(cell) || cell.revealed) return session

  const before = state.board
  const board = cloneBoard(state.board)
  let status: GameStatus = state.status

  if (!board.minesPlaced) {
    applyMinesFromSeed(board)
  }
  if (status === 'idle') {
    status = 'playing'
  }

  const bounds = actionableBounds(board)
  const outcome = revealSingle(board, row, col, bounds)

  if (outcome === 'mine') {
    const revealedDelta = countNewlyRevealed(before, board)
    const viewStart = session.endlessViewStart ?? visibleViewStart(before)
    const screenRow = toScreenRow(row, viewStart)
    const lifeLoss: LifeLossReport = {
      cause: 'mine-reveal',
      damage: 1,
      cells: [{ localRow: row, col, screenRow, kind: 'mine-hit' }],
      boardChange: `(${screenRow},${col}) hidden → revealed (mine)`,
      reason: 'Reveal hit mine · cell was a mine and not flagged',
    }
    const afterBreak = clearDefuseStreakOnMistake(recordMineHitScrollExempt(session, board, [{ row, col }]))
    const afterHit = applyLifeLoss(afterBreak, board, 1, status, lifeLoss)
    return {
      ...afterHit,
      revealedCount: (session.revealedCount ?? 0) + revealedDelta,
    }
  }

  const revealedDelta = countNewlyRevealed(before, board)

  const finalized = finalizeBoard(session, board, status)
  return {
    ...finalized.session,
    revealedCount: (session.revealedCount ?? 0) + revealedDelta + finalized.autoRevealed,
  }
}

export function endlessChordAt(session: ModeSession, row: number, col: number): ModeSession {
  const { state } = session
  if (state.status !== 'playing' || !state.board.minesPlaced) return session
  if (!isEndlessActionableLocalRow(session, row)) return session

  const cell = state.board.cells[row]?.[col]
  if (!cell?.revealed || cell.isMine || cell.adjacentMines === 0) return session

  const neighbors = getLocalNeighbors(state.board, row, col)
  const flaggedCount = neighbors.filter(({ row: nr, col: nc }) => state.board.cells[nr]![nc]!.mark === 'flag').length

  if (flaggedCount !== cell.adjacentMines) return session

  const before = state.board
  const board = cloneBoard(state.board)
  const viewStart = session.endlessViewStart ?? visibleViewStart(before)
  const bounds = actionableBounds(board)
  let mineHits = 0
  const mineCells: LifeLossCell[] = []

  for (const { row: nr, col: nc } of neighbors) {
    if (!inRevealBounds(nr, bounds)) continue
    const neighbor = board.cells[nr]![nc]!
    if (neighbor.mark !== 'none' || neighbor.revealed) continue
    if (revealSingle(board, nr, nc, bounds) === 'mine') {
      mineHits += 1
      mineCells.push({
        localRow: nr,
        col: nc,
        screenRow: toScreenRow(nr, viewStart),
        kind: 'mine-hit',
      })
    }
  }

  const revealedDelta = countNewlyRevealed(before, board)

  if (mineHits > 0) {
    const chordScreen = toScreenRow(row, viewStart)
    const opened = mineCells.map((c) => `(${c.screenRow},${c.col})`).join(' ')
    const lifeLoss: LifeLossReport = {
      cause: 'chord-mine',
      damage: mineHits,
      cells: mineCells,
      boardChange: `Chord (${chordScreen},${col}) expand · mines opened: ${opened}`,
      reason:
        mineHits === 1 ? `Chord hit 1 mine · flag count matched digit but an unmarked mine remained` : `Chord hit ${mineHits} mines · neighbors had ${mineHits} unmarked mines`,
    }
    const afterBreak = clearDefuseStreakOnMistake(
      recordMineHitScrollExempt(
        session,
        board,
        mineCells.map((c) => ({ row: c.localRow, col: c.col }))
      )
    )
    const afterHit = applyLifeLoss(afterBreak, board, mineHits, 'playing', lifeLoss)
    return {
      ...afterHit,
      revealedCount: (session.revealedCount ?? 0) + revealedDelta,
    }
  }

  const finalized = finalizeBoard(session, board, 'playing')
  return {
    ...finalized.session,
    revealedCount: (session.revealedCount ?? 0) + revealedDelta + finalized.autoRevealed,
  }
}

export function endlessToggleMarkAt(session: ModeSession, row: number, col: number): ModeSession {
  const { state } = session
  if (state.status !== 'playing' && state.status !== 'idle') return session
  if (!inLocalBounds(state.board, row, col)) return session
  if (!isEndlessActionableLocalRow(session, row)) return session

  const cell = state.board.cells[row]?.[col]
  if (!cell || cell.revealed) return session

  const board = cloneBoard(state.board)
  const current = board.cells[row]![col]!
  current.mark = current.mark === 'flag' ? 'none' : 'flag'

  return finalizeBoard(session, board).session
}
