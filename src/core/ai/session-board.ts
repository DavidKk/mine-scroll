import { getNeighbors, isCellActive } from '../board.ts';
import { ENDLESS_VISIBLE_ROWS } from '../modes/endless/index.ts';
import type { Board, ModeSession } from '../types.ts';

export interface SolverCell {
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number | null;
  /** 无尽模式踩雷后继续游戏时，已翻开的雷也要参与后续线索约束 */
  knownMine?: boolean;
}

export interface EndlessSolverContext {
  /** 可见区最底行（本地行号） */
  bottomRow: number;
  viewStart: number;
}

export interface SolverBoard {
  rows: number;
  cols: number;
  /** 是否参与约束（全盘 active 格） */
  inConstraints(row: number, col: number): boolean;
  /** 是否允许 AI 操作（无尽模式限可见行） */
  canAct(row: number, col: number): boolean;
  neighbors(row: number, col: number): Array<{ row: number; col: number }>;
  cell(row: number, col: number): SolverCell | null;
  /** 经典/六边形：固定总雷数；无尽模式未知 */
  totalMines?: number;
  /** 无尽模式：底行优先策略 */
  endless?: EndlessSolverContext;
}

function readCell(board: Board, row: number, col: number): SolverCell | null {
  if (!isCellActive(board, row, col)) return null;
  const c = board.cells[row]![col]!;
  return {
    revealed: c.revealed,
    flagged: c.mark === 'flag',
    adjacentMines: c.revealed && !c.isMine ? c.adjacentMines : null,
    knownMine: c.revealed && c.isMine,
  };
}

export function buildSolverBoard(session: ModeSession): SolverBoard {
  const board = session.state.board;
  const isEndless = session.modeId === 'endless';
  const viewStart = isEndless ? (session.endlessViewStart ?? 0) : 0;
  const viewEnd = isEndless ? viewStart + ENDLESS_VISIBLE_ROWS : board.rows;

  return {
    rows: board.rows,
    cols: board.cols,
    inConstraints(row, col) {
      return isCellActive(board, row, col);
    },
    canAct(row, col) {
      if (!isCellActive(board, row, col)) return false;
      if (isEndless) return row >= viewStart && row < viewEnd;
      return true;
    },
    neighbors(row, col) {
      return getNeighbors(board, row, col).filter(({ row: nr, col: nc }) =>
        isCellActive(board, nr, nc),
      );
    },
    cell(row, col) {
      return readCell(board, row, col);
    },
    totalMines: isEndless || board.mineCount < 0 ? undefined : board.mineCount,
    endless: isEndless
      ? {
          bottomRow: viewEnd - 1,
          viewStart,
        }
      : undefined,
  };
}

export function pickFirstClick(board: SolverBoard): { row: number; col: number } {
  const midRow = Math.floor(board.rows / 2);
  const midCol = Math.floor(board.cols / 2);
  const candidates: Array<{ row: number; col: number; dist: number }> = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (board.canAct(row, col)) {
        candidates.push({
          row,
          col,
          dist: (row - midRow) ** 2 + (col - midCol) ** 2,
        });
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  if (candidates[0]) return { row: candidates[0].row, col: candidates[0].col };
  return { row: midRow, col: midCol };
}
