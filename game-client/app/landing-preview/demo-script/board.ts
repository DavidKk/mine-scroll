import type { AiHintDisplay, AiMove } from '@shared/core/ai/types.ts'
import { countBankedMinesOnRow } from '@shared/core/mines-defused.ts'
import { isBatchScrollSafe, resolveScrollBatchRowsForSession, sessionVisibleRows, viewStartForSession } from '@shared/core/modes/endless/index.ts'
import { MINES_PER_LIFE, revealAt, toggleMarkAt } from '@shared/core/modes/engine.ts'
import type { ModeSession } from '@shared/core/types.ts'

export const TOP_HEADROOM_ROWS = 4

export function cheatRevealBottomHalfOpen(session: ModeSession): ModeSession {
  let next = session
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const bottomHalfStart = Math.floor(visibleRows / 2)
  const board = next.state.board

  for (let pass = 0; pass < 16; pass += 1) {
    let changed = false
    for (let screenRow = visibleRows - 1; screenRow >= bottomHalfStart; screenRow -= 1) {
      const localRow = viewStart + screenRow
      if (localRow < 0 || localRow >= board.rows) continue
      for (let col = 0; col < board.cols; col += 1) {
        const cell = board.cells[localRow]![col]!
        if (cell.isMine || cell.revealed || cell.mark === 'flag') continue
        const updated = revealAt(next, localRow, col)
        if (updated !== next) {
          next = updated
          changed = true
        }
      }
    }
    if (!changed) break
  }

  return next
}

export function findVisibleMine(
  session: ModeSession,
  preferMiddle = false,
  exclude?: { localRow: number; col: number }
): { localRow: number; screenRow: number; col: number } | null {
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const board = session.state.board
  let picks: Array<{ localRow: number; screenRow: number; col: number }> = []

  for (let screenRow = 0; screenRow < visibleRows; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= board.rows) continue
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (cell.isMine && !cell.revealed && cell.mark !== 'flag') {
        if (exclude && exclude.localRow === localRow && exclude.col === col) continue
        picks.push({ localRow, screenRow, col })
      }
    }
  }

  if (picks.length === 0) return null
  if (!preferMiddle) return picks[picks.length - 1]!

  const mid = Math.floor(visibleRows / 2)
  picks.sort((a, b) => Math.abs(a.screenRow - mid) - Math.abs(b.screenRow - mid))
  return picks[0]!
}

export function countUnflaggedVisibleMines(session: ModeSession, exclude?: { localRow: number; col: number }): number {
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const board = session.state.board
  let count = 0

  for (let screenRow = 0; screenRow < visibleRows; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= board.rows) continue
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (!cell.isMine || cell.revealed || cell.mark === 'flag') continue
      if (exclude && exclude.localRow === localRow && exclude.col === col) continue
      count += 1
    }
  }

  return count
}

export function countRevealedNeighbors(session: ModeSession, localRow: number, col: number): number {
  const board = session.state.board
  let count = 0
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue
      const cell = board.cells[localRow + dr]?.[col + dc]
      if (cell?.revealed) count += 1
    }
  }
  return count
}

export function findVisibleSafeCell(session: ModeSession, exclude?: { localRow: number; col: number }): { localRow: number; screenRow: number; col: number } | null {
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const board = session.state.board
  let best: { localRow: number; screenRow: number; col: number; score: number } | null = null

  for (let screenRow = 0; screenRow < visibleRows; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= board.rows) continue
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (cell.isMine || cell.revealed || cell.mark === 'flag') continue
      if (exclude && exclude.localRow === localRow && exclude.col === col) continue

      const neighborRevealed = countRevealedNeighbors(session, localRow, col)
      const score = neighborRevealed * 12 - Math.abs(screenRow - Math.floor(visibleRows / 3))
      if (!best || score > best.score) {
        best = { localRow, screenRow, col, score }
      }
    }
  }

  if (!best) return null
  return { localRow: best.localRow, screenRow: best.screenRow, col: best.col }
}

export function findTopVisibleMine(session: ModeSession, maxScreenRow = TOP_HEADROOM_ROWS - 1): { localRow: number; screenRow: number; col: number } | null {
  const viewStart = viewStartForSession(session)
  const board = session.state.board
  for (let screenRow = 0; screenRow <= maxScreenRow; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= board.rows) continue
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (cell.isMine && !cell.revealed && cell.mark !== 'flag') {
        return { localRow, screenRow, col }
      }
    }
  }
  return null
}

export function findDemoSwipeFlagTarget(session: ModeSession): { localRow: number; screenRow: number; col: number } | null {
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const upperEnd = Math.floor(visibleRows / 2)
  const cols = session.state.board.cols
  const centerCol = Math.floor(cols / 2)
  const centerRow = Math.floor(upperEnd / 2)
  let best: { localRow: number; screenRow: number; col: number; score: number } | null = null

  for (let screenRow = 0; screenRow < upperEnd; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= session.state.board.rows) continue
    for (let col = 0; col < cols; col += 1) {
      const cell = session.state.board.cells[localRow]![col]!
      if (!cell.isMine || cell.revealed || cell.mark === 'flag') continue
      const score = Math.abs(screenRow - centerRow) + Math.abs(col - centerCol) * 0.55
      if (!best || score < best.score) best = { localRow, screenRow, col, score }
    }
  }

  if (!best) return null
  return { localRow: best.localRow, screenRow: best.screenRow, col: best.col }
}

export function collectBottomMinesToFlag(session: ModeSession, max = MINES_PER_LIFE): Array<{ localRow: number; screenRow: number; col: number }> {
  const batchRows = resolveScrollBatchRowsForSession(session)
  const board = session.state.board
  const viewStart = viewStartForSession(session)
  const picks: Array<{ localRow: number; screenRow: number; col: number }> = []

  for (let offset = 0; offset < batchRows + 1 && picks.length < max; offset += 1) {
    const localRow = board.rows - 1 - offset
    if (localRow < 0) break
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (cell.isMine && cell.mark !== 'flag') {
        picks.push({ localRow, screenRow: localRow - viewStart, col })
        if (picks.length >= max) break
      }
    }
  }

  return picks
}

export function prepareHealScrollReveals(session: ModeSession): ModeSession {
  let next = session
  const batchRows = resolveScrollBatchRowsForSession(next)
  const board = next.state.board

  for (let offset = 0; offset < batchRows; offset += 1) {
    const localRow = board.rows - 1 - offset
    if (localRow < 0) break
    for (let col = 0; col < board.cols; col += 1) {
      const cell = next.state.board.cells[localRow]![col]!
      if (!cell.isMine && !cell.revealed && cell.mark !== 'flag') {
        next = revealAt(next, localRow, col)
      }
    }
  }

  return next
}

export function applyBottomMineFlags(session: ModeSession, mines: Array<{ localRow: number; col: number }>, flaggedTotal: number): ModeSession {
  let next = session
  for (const mine of mines) {
    next = toggleMarkAt(next, mine.localRow, mine.col)
  }
  // Script bookkeeping: 4 bottom flags → minesDefused 0 (ready to bank on scroll-off).
  return { ...next, minesDefused: Math.max(0, MINES_PER_LIFE - flaggedTotal), defuseCombo: next.defuseCombo ?? 0 }
}

export function scrubWrongFlagsOnLeavingRows(session: ModeSession): ModeSession {
  let next = session
  const batchRows = resolveScrollBatchRowsForSession(next)
  const board = next.state.board

  for (let offset = 0; offset < batchRows + 1; offset += 1) {
    const localRow = board.rows - 1 - offset
    if (localRow < 0) break
    for (let col = 0; col < board.cols; col += 1) {
      const cell = next.state.board.cells[localRow]![col]!
      if (!cell.isMine && cell.mark === 'flag') {
        next = toggleMarkAt(next, localRow, col)
      }
    }
  }

  return next
}

export function prepareHealScrollBoard(session: ModeSession): ModeSession {
  let next = scrubWrongFlagsOnLeavingRows(session)
  next = prepareHealScrollReveals(next)
  const mines = collectBottomMinesToFlag(next)
  return applyBottomMineFlags(next, mines, mines.length)
}

/** True when an upward scroll would bank enough flagged mines to trigger heal. */
export function isScrollHealRisky(session: ModeSession): boolean {
  const batchRows = resolveScrollBatchRowsForSession(session)
  const board = session.state.board
  let flaggedOnExitRows = 0

  for (let offset = 0; offset < batchRows + 1; offset += 1) {
    const localRow = board.rows - 1 - offset
    if (localRow < 0) break
    flaggedOnExitRows += countBankedMinesOnRow(board, localRow)
  }

  return (session.minesDefused ?? 0) + flaggedOnExitRows >= MINES_PER_LIFE
}

export function isEndgameScrollSafe(session: ModeSession): boolean {
  if (session.state.status !== 'playing') return false
  if (isScrollHealRisky(session)) return false
  const batchRows = resolveScrollBatchRowsForSession(session)
  return isBatchScrollSafe(session, batchRows)
}

export function buildFatalGuessPlan(session: ModeSession): { move: AiMove; hint: AiHintDisplay; mine: { localRow: number; screenRow: number; col: number } } | null {
  const mine = findTopVisibleMine(session, TOP_HEADROOM_ROWS - 1) ?? findVisibleMine(session)
  if (!mine) return null

  const move: AiMove = {
    kind: 'reveal',
    row: mine.localRow,
    col: mine.col,
    confidence: 'guess',
    reason: 'Demo oracle · top-row trap read as safe',
  }
  const hint: AiHintDisplay = {
    row: mine.screenRow,
    col: mine.col,
    kind: 'reveal',
    confidence: 'guess',
  }
  return { move, hint, mine }
}
