import type { ModeSession } from '../types.ts';
import { cellKey } from '../types.ts';
import { isRiskyMove, isUrgentBottomRowCertain } from './heal-policy.ts';
import type { SolverBoard } from './session-board.ts';
import type { AiMove } from './types.ts';

export function createScrollMove(reason: string, batchRows: number): AiMove {
  return {
    kind: 'scroll',
    row: -1,
    col: -1,
    confidence: 'certain',
    reason,
    batchRows,
  };
}

function isRowAiConfirmed(
  board: SolverBoard,
  safe: Set<string>,
  mines: Set<string>,
  row: number,
): boolean {
  for (let col = 0; col < board.cols; col += 1) {
    if (!board.canAct(row, col)) continue;
    const cell = board.cell(row, col);
    if (!cell) continue;
    const k = cellKey(row, col);
    if (cell.revealed) continue;
    if (cell.flagged) {
      if (safe.has(k) || !mines.has(k)) return false;
      continue;
    }
    if (safe.has(k) || mines.has(k)) return false;
    return false;
  }
  return true;
}

/** All N rows about to leave the screen are AI-confirmed with no leaks. */
export function isBottomRowsAiConfirmed(
  board: SolverBoard,
  safe: Set<string>,
  mines: Set<string>,
  batchRows: number,
): boolean {
  const e = board.endless;
  if (!e) return false;
  const n = Math.max(1, batchRows);
  for (let i = 0; i < n; i += 1) {
    const row = e.bottomRow - i;
    if (row < 0) return false;
    if (!isRowAiConfirmed(board, safe, mines, row)) return false;
  }
  return true;
}

/**
 * Endless AI manual scroll: N leaving rows are zero-damage and 100% confirmed.
 * Do not scroll when low on lives, certain moves remain, or bottom row has hidden cells.
 */
export function pickScrollMove(
  session: ModeSession,
  tactical: AiMove | null,
  board: SolverBoard,
  safe: Set<string>,
  mines: Set<string>,
  batchRows: number,
): AiMove | null {
  if (session.modeId !== 'endless' || session.state.status !== 'playing') return null;

  const lives = session.lives ?? 5;
  if (lives <= 3 && tactical !== null) return null;

  const rows = Math.max(1, batchRows);
  if (tactical !== null && isUrgentBottomRowCertain(tactical)) return null;
  if (tactical !== null && tactical.confidence === 'certain') return null;

  const batchNote = rows > 1 ? ` ×${rows} rows` : '';

  if (!isBottomRowsAiConfirmed(board, safe, mines, rows)) return null;

  if (tactical !== null && isRiskyMove(tactical)) return null;

  if (tactical === null) {
    return createScrollMove(`Bottom rows clear · manual scroll${batchNote}`, rows);
  }

  return createScrollMove(`Bottom rows clear · manual scroll rush${batchNote}`, rows);
}
