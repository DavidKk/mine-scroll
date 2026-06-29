import type { Board, CellView, ModeSession } from '../../types.ts'
import { ENDLESS_PREVIEW_ROWS, ENDLESS_PREVIEW_SOURCE_ROWS, ENDLESS_VISIBLE_ROWS } from './constants.ts'
import { visibleViewStart, worldCellKey } from './grid.ts'

export function sessionVisibleRows(session: ModeSession): number {
  return session.endlessVisibleRows ?? ENDLESS_VISIBLE_ROWS
}

export function viewStartForSession(session: ModeSession): number {
  return session.endlessViewStart ?? visibleViewStart(session.state.board, sessionVisibleRows(session))
}

function pushEndlessCellViewRow(views: CellView[], board: Board, localRow: number, screenRow: number, gameOver: boolean, preview: boolean, hitMineKeys: Set<string>): void {
  for (let col = 0; col < board.cols; col += 1) {
    const cell = board.cells[localRow]![col]!
    const showMine = (cell.revealed && cell.isMine) || (gameOver && cell.isMine)
    const key = worldCellKey(board, localRow, col)

    views.push({
      row: screenRow,
      col,
      revealed: cell.revealed,
      flagged: cell.mark === 'flag',
      adjacentMines: cell.revealed && !cell.isMine ? cell.adjacentMines : null,
      isMine: showMine ? true : null,
      mineHit: showMine && hitMineKeys.has(key),
      preview,
      fxKey: key,
    })
  }
}

export function isEndlessPlayableScreenRow(screenRow: number, visibleRows = ENDLESS_VISIBLE_ROWS): boolean {
  return screenRow >= 0 && screenRow < visibleRows
}

/** Screen row −1 is the top half-hidden preview row (interactive). */
export function isEndlessInteractiveScreenRow(screenRow: number, visibleRows = ENDLESS_VISIBLE_ROWS): boolean {
  return screenRow === -1 || isEndlessPlayableScreenRow(screenRow, visibleRows)
}

export function isEndlessInteractiveScreenRowForSession(session: ModeSession, screenRow: number): boolean {
  return isEndlessInteractiveScreenRow(screenRow, sessionVisibleRows(session))
}

export function isEndlessPlayableLocalRow(session: ModeSession, localRow: number): boolean {
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  return localRow >= viewStart && localRow < viewStart + visibleRows
}

export function isEndlessActionableLocalRow(session: ModeSession, localRow: number): boolean {
  const viewStart = viewStartForSession(session)
  const previewStart = Math.max(0, viewStart - ENDLESS_PREVIEW_SOURCE_ROWS)
  if (viewStart > 0 && localRow >= previewStart && localRow < viewStart) return true
  return isEndlessPlayableLocalRow(session, localRow)
}

export function getEndlessPreviewRows(session: ModeSession): number {
  const viewStart = viewStartForSession(session)
  return viewStart > 0 ? ENDLESS_PREVIEW_ROWS : 0
}

export function toEndlessCellViews(session: ModeSession): CellView[] {
  const { state } = session
  const gameOver = state.status === 'lost'
  const visibleRows = sessionVisibleRows(session)
  const viewStart = viewStartForSession(session)
  const viewEnd = Math.min(viewStart + visibleRows, state.board.rows)
  const views: CellView[] = []
  const hitMineKeys = new Set(session.hitMineKeys ?? [])

  if (viewStart > 0) {
    const previewStart = Math.max(0, viewStart - ENDLESS_PREVIEW_SOURCE_ROWS)
    for (let row = previewStart; row < viewStart; row += 1) {
      pushEndlessCellViewRow(views, state.board, row, row - viewStart, gameOver, true, hitMineKeys)
    }
  }

  for (let row = viewStart; row < viewEnd; row += 1) {
    pushEndlessCellViewRow(views, state.board, row, row - viewStart, gameOver, false, hitMineKeys)
  }

  return views
}

/** Map screen row index to board local row. */
export function endlessScreenRowToLocal(session: ModeSession, screenRow: number): number {
  return (session.endlessViewStart ?? 0) + screenRow
}

export function getEndlessDepth(session: ModeSession): number {
  return session.scrollRowCount ?? 0
}
