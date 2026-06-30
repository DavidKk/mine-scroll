import { applyMineDefuseOnRowScrollOff, clearDefuseStreakOnMistake, isScrollPenaltyExempt } from '../../mines-defused.ts'
import type { Board, LifeLossCell, LifeLossCellKind, LifeLossReport, ModeSession } from '../../types.ts'
import { ENDLESS_SCROLL_BATCH_MAX } from './constants.ts'
import { compactAndBufferBoard, compactTrailingBlankRows, isRowAllBlank, prependRow, recomputeAllAdjacent, removeBottomRow, visibleViewStart } from './grid.ts'
import { applyLifeLoss, syncPendingReveals, toScreenRow } from './reveal-pipeline.ts'
import { sessionVisibleRows, viewStartForSession } from './views.ts'

function isBottomCellScrollExempt(session: ModeSession, board: Board, localRow: number, col: number): boolean {
  const cell = board.cells[localRow]![col]!
  if (cell.revealed) return true
  if (isScrollPenaltyExempt(session, board, localRow, col)) return true
  return false
}

function countRowLeavingPenalty(session: ModeSession, board: Board, localRow: number): number {
  let count = 0
  for (let col = 0; col < board.cols; col += 1) {
    if (penaltyCellKind(session, board, localRow, col)) count += 1
  }
  return count
}

/** Bottom-row scroll damage: one life per undisposed cell leaving the row (unflagged mine, wrong flag, unrevealed). */
export function computeBottomRowScrollDamage(session: ModeSession, board: Board, localRow = board.rows - 1): number {
  if (localRow < 0 || localRow >= board.rows) return 0
  if (board.minesPlaced) {
    return countRowLeavingPenalty(session, board, localRow)
  }
  if (isRowAllBlank(board, localRow)) return 0
  return countRowLeavingPenalty(session, board, localRow)
}

/** One scroll event with N leaving rows: −1 life per undisposed cell across those rows. */
export function computeBatchScrollDamage(session: ModeSession, board: Board, batchRows: number): number {
  const n = Math.max(1, Math.min(batchRows, board.rows))
  let total = 0
  for (let i = 0; i < n; i += 1) {
    const localRow = board.rows - 1 - i
    total += computeBottomRowScrollDamage(session, board, localRow)
  }
  return total
}

/** Whether the current bottom-row scroll would cost a life. */
export function isBottomRowScrollSafe(session: ModeSession): boolean {
  if (session.modeId !== 'endless' || session.state.status !== 'playing') return false
  return computeBottomRowScrollDamage(session, session.state.board) === 0
}

/** Screen cells that would cost a life when rows scroll off. */
export interface ScrollLeavingMineCell {
  screenRow: number
  col: number
}

export function collectScrollLeavingMineCells(session: ModeSession, batchRows: number): ScrollLeavingMineCell[] {
  if (session.modeId !== 'endless' || session.state.status !== 'playing') return []

  const board = session.state.board
  const rows = Math.max(1, Math.min(batchRows, board.rows))
  const viewStart = viewStartForSession(session)
  const out: ScrollLeavingMineCell[] = []

  for (let i = 0; i < rows; i += 1) {
    const localRow = board.rows - 1 - i
    if (localRow < 0 || isRowAllBlank(board, localRow)) continue
    for (let col = 0; col < board.cols; col += 1) {
      if (!penaltyCellKind(session, board, localRow, col)) continue
      out.push({ screenRow: toScreenRow(localRow, viewStart), col })
    }
  }

  return out
}

/** Before batch scroll: all N leaving rows are safe. */
export function isBatchScrollSafe(session: ModeSession, batchRows: number): boolean {
  if (session.modeId !== 'endless' || session.state.status !== 'playing') return false
  return computeBatchScrollDamage(session, session.state.board, batchRows) === 0
}

function penaltyCellKind(session: ModeSession, board: Board, localRow: number, col: number): LifeLossCellKind | null {
  if (isBottomCellScrollExempt(session, board, localRow, col)) return null
  const cell = board.cells[localRow]![col]!
  if (cell.isMine) {
    return cell.mark === 'flag' ? null : 'mine-unflagged'
  }
  if (cell.mark === 'flag') return null
  return 'unrevealed'
}

function cellKindLabel(kind: LifeLossCellKind): string {
  switch (kind) {
    case 'mine-hit':
      return 'mine hit'
    case 'mine-unflagged':
      return 'unflagged mine'
    case 'wrong-flag':
      return 'wrong flag'
    case 'unrevealed':
      return 'unrevealed'
  }
}

function buildScrollLifeLoss(session: ModeSession, board: Board, localRow: number, viewStart: number): LifeLossReport {
  const cells: LifeLossCell[] = []
  for (let col = 0; col < board.cols; col += 1) {
    const kind = penaltyCellKind(session, board, localRow, col)
    if (!kind) continue
    cells.push({
      localRow,
      col,
      screenRow: toScreenRow(localRow, viewStart),
      kind,
    })
  }
  const damage = cells.length
  const cellDesc = cells.map((c) => `(${c.screenRow},${c.col})${cellKindLabel(c.kind)}`).join(' ')
  return {
    cause: 'scroll-bottom',
    damage,
    cells,
    boardChange: 'Bottom row scrolled off · top row added',
    reason: `Scroll bottom life loss (−${damage} undisposed cell${damage === 1 ? '' : 's'}) · leaks: ${cellDesc}`,
  }
}

function mergeScrollLifeLossReports(reports: LifeLossReport[], totalDamage: number): LifeLossReport {
  const cells = reports.flatMap((report) => report.cells)
  const cellDesc = cells.map((c) => `(${c.screenRow},${c.col})${cellKindLabel(c.kind)}`).join(' ')
  return {
    cause: 'scroll-bottom',
    damage: totalDamage,
    cells,
    boardChange: reports.length > 1 ? `${reports.length} bottom rows scrolled off · top rows added` : reports[0]!.boardChange,
    reason: `Scroll bottom life loss (−${totalDamage} undisposed cell${totalDamage === 1 ? '' : 's'}) · leaks: ${cellDesc}`,
  }
}

/** Scroll off bottom row: all-blank row is free and trailing blank rows are trimmed. */
function scrollOffBottomRow(session: ModeSession, board: Board): { board: Board; damage: number } {
  const bottomRow = board.rows - 1
  if (isRowAllBlank(board, bottomRow)) {
    return { board: compactTrailingBlankRows(removeBottomRow(board)), damage: 0 }
  }
  return {
    board: removeBottomRow(board),
    damage: countRowLeavingPenalty(session, board, bottomRow),
  }
}

interface SingleRowScrollResult {
  session: ModeSession
  damage: number
  lifeLoss?: LifeLossReport
  autoRevealed: number
}

/** Single-row scroll (no life charge here — batch layer settles damage). */
function performSingleRowScroll(session: ModeSession): SingleRowScrollResult {
  const scrollRowCount = (session.scrollRowCount ?? 0) + 1
  const visibleRows = sessionVisibleRows(session)
  let board = prependRow(session.state.board, scrollRowCount)
  const viewStart = visibleViewStart(board, visibleRows)
  const bottomLocal = board.rows - 1
  const damage = computeBottomRowScrollDamage(session, board, bottomLocal)
  const banked = damage === 0 ? applyMineDefuseOnRowScrollOff(session, board, bottomLocal) : null
  const sessionAfterBank = banked ? { ...session, ...banked } : session
  const lifeLoss = damage > 0 ? buildScrollLifeLoss(sessionAfterBank, board, bottomLocal, viewStart) : undefined

  const { board: afterScroll } = scrollOffBottomRow(sessionAfterBank, board)
  board = compactAndBufferBoard(afterScroll, scrollRowCount, visibleRows)
  recomputeAllAdjacent(board)
  const pending = syncPendingReveals(sessionAfterBank, board)

  const nextSession: ModeSession = {
    ...sessionAfterBank,
    state: { ...sessionAfterBank.state, board, status: 'playing' },
    endlessViewStart: visibleViewStart(board, visibleRows),
    scrollRowCount,
    revealedCount: (session.revealedCount ?? 0) + pending.revealed,
    pendingRevealKeys: pending.pendingRevealKeys,
  }

  return { session: nextSession, damage, lifeLoss, autoRevealed: pending.revealed }
}

/**
 * Conveyor batch tick: each event scrolls batchRows; −1 life per undisposed cell leaving.
 */
export function endlessScrollBatch(session: ModeSession, batchRows = 1): ModeSession {
  if (session.state.status !== 'playing') return session

  const rows = Math.max(1, Math.min(ENDLESS_SCROLL_BATCH_MAX, Math.floor(batchRows)))
  let current = session
  let eventDamage = 0
  const lossReports: LifeLossReport[] = []

  for (let i = 0; i < rows; i += 1) {
    const step = performSingleRowScroll(current)
    current = step.session
    if (step.damage > 0) {
      eventDamage += step.damage
      if (step.lifeLoss) lossReports.push(step.lifeLoss)
    }
  }

  if (eventDamage > 0 && lossReports.length > 0) {
    const eventLifeLoss = mergeScrollLifeLossReports(lossReports, eventDamage)
    const afterBreak = clearDefuseStreakOnMistake(current)
    return applyLifeLoss(afterBreak, afterBreak.state.board, eventDamage, 'playing', eventLifeLoss)
  }
  return current
}

/** @alias endlessScrollBatch(session, 1) */
export function endlessScrollTick(session: ModeSession, batchRows = 1): ModeSession {
  return endlessScrollBatch(session, batchRows)
}
