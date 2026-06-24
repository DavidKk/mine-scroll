import type { Board, CellView, ModeSession } from '../../types.ts';
import {
  ENDLESS_PREVIEW_ROWS,
  ENDLESS_PREVIEW_SOURCE_ROWS,
  ENDLESS_VISIBLE_ROWS,
} from './constants.ts';
import { visibleViewStart, worldCellKey } from './grid.ts';

function pushEndlessCellViewRow(
  views: CellView[],
  board: Board,
  localRow: number,
  screenRow: number,
  gameOver: boolean,
  preview: boolean,
): void {
  for (let col = 0; col < board.cols; col += 1) {
    const cell = board.cells[localRow]![col]!;
    const showMine = (cell.revealed && cell.isMine) || (gameOver && cell.isMine);

    views.push({
      row: screenRow,
      col,
      revealed: cell.revealed,
      flagged: cell.mark === 'flag',
      adjacentMines: cell.revealed && !cell.isMine ? cell.adjacentMines : null,
      isMine: showMine ? true : null,
      preview,
      fxKey: worldCellKey(board, localRow, col),
    });
  }
}

export function isEndlessPlayableScreenRow(screenRow: number): boolean {
  return screenRow >= 0 && screenRow < ENDLESS_VISIBLE_ROWS;
}

/** Screen row −1 is the top half-hidden preview row (interactive). */
export function isEndlessInteractiveScreenRow(screenRow: number): boolean {
  return screenRow === -1 || isEndlessPlayableScreenRow(screenRow);
}

export function isEndlessPlayableLocalRow(session: ModeSession, localRow: number): boolean {
  const viewStart = session.endlessViewStart ?? visibleViewStart(session.state.board);
  return localRow >= viewStart && localRow < viewStart + ENDLESS_VISIBLE_ROWS;
}

export function isEndlessActionableLocalRow(session: ModeSession, localRow: number): boolean {
  const viewStart = session.endlessViewStart ?? visibleViewStart(session.state.board);
  const previewStart = Math.max(0, viewStart - ENDLESS_PREVIEW_SOURCE_ROWS);
  if (viewStart > 0 && localRow >= previewStart && localRow < viewStart) return true;
  return isEndlessPlayableLocalRow(session, localRow);
}

export function getEndlessPreviewRows(session: ModeSession): number {
  const viewStart = session.endlessViewStart ?? visibleViewStart(session.state.board);
  return viewStart > 0 ? ENDLESS_PREVIEW_ROWS : 0;
}

export function toEndlessCellViews(session: ModeSession): CellView[] {
  const { state } = session;
  const gameOver = state.status === 'lost';
  const viewStart = session.endlessViewStart ?? visibleViewStart(state.board);
  const viewEnd = Math.min(viewStart + ENDLESS_VISIBLE_ROWS, state.board.rows);
  const views: CellView[] = [];

  if (viewStart > 0) {
    const previewStart = Math.max(0, viewStart - ENDLESS_PREVIEW_SOURCE_ROWS);
    for (let row = previewStart; row < viewStart; row += 1) {
      pushEndlessCellViewRow(views, state.board, row, row - viewStart, gameOver, true);
    }
  }

  for (let row = viewStart; row < viewEnd; row += 1) {
    pushEndlessCellViewRow(views, state.board, row, row - viewStart, gameOver, false);
  }

  return views;
}

/** Map screen row index to board local row. */
export function endlessScreenRowToLocal(session: ModeSession, screenRow: number): number {
  return (session.endlessViewStart ?? 0) + screenRow;
}

export function getEndlessDepth(session: ModeSession): number {
  return session.scrollRowCount ?? 0;
}
