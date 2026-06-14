import {
  cloneBoard,
  createEmptyBoard,
  getNeighbors,
  placeMinesForFirstClick,
} from './board.ts';
import { getDefaultDifficulty } from './difficulty.ts';
import type {
  Board,
  CellView,
  Difficulty,
  GameState,
  GameStatus,
} from './types.ts';

export function createGame(diff: Difficulty = getDefaultDifficulty()): GameState {
  return {
    status: 'idle',
    board: createEmptyBoard(diff),
  };
}

export function getFlagCount(state: GameState): number {
  let count = 0;
  for (const row of state.board.cells) {
    for (const cell of row) {
      if (cell.flagged) count += 1;
    }
  }
  return count;
}

function checkWin(board: Board): boolean {
  for (const row of board.cells) {
    for (const cell of row) {
      if (!cell.isMine && !cell.revealed) {
        return false;
      }
    }
  }
  return true;
}

function revealAllMines(board: Board): void {
  for (const row of board.cells) {
    for (const cell of row) {
      if (cell.isMine) {
        cell.revealed = true;
      }
    }
  }
}

function floodReveal(board: Board, startRow: number, startCol: number): void {
  const queue: { row: number; col: number }[] = [{ row: startRow, col: startCol }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    const key = `${row},${col}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = board.cells[row]![col]!;
    if (cell.flagged || cell.revealed) continue;

    cell.revealed = true;

    if (cell.isMine) continue;

    if (cell.adjacentMines === 0) {
      for (const neighbor of getNeighbors(board, row, col)) {
        queue.push(neighbor);
      }
    }
  }
}

function revealSingle(board: Board, row: number, col: number): 'mine' | 'safe' {
  const cell = board.cells[row]![col]!;
  if (cell.revealed || cell.flagged) {
    return 'safe';
  }

  if (cell.isMine) {
    cell.revealed = true;
    return 'mine';
  }

  if (cell.adjacentMines === 0) {
    floodReveal(board, row, col);
  } else {
    cell.revealed = true;
  }

  return 'safe';
}

export function reveal(state: GameState, row: number, col: number): GameState {
  const cell = state.board.cells[row]?.[col];
  if (!cell || cell.flagged || cell.revealed) {
    return state;
  }

  if (state.status === 'won' || state.status === 'lost') {
    return state;
  }

  const board = cloneBoard(state.board);
  let status: GameStatus = state.status;
  const isFirstClick = !board.minesPlaced;

  if (isFirstClick) {
    // 延迟随机布雷：首击前无雷，布雷时排除首格+8邻格，第一步绝不可能踩雷
    const mined = placeMinesForFirstClick(board, row, col);
    board.cells = mined.cells;
    board.minesPlaced = mined.minesPlaced;
    status = 'playing';
  } else if (status === 'idle') {
    status = 'playing';
  }

  const outcome = revealSingle(board, row, col);

  //  invariant：首击永不判负（若触发说明布雷逻辑有 bug）
  if (isFirstClick && outcome === 'mine') {
    throw new Error('First click must not hit a mine');
  }

  if (outcome === 'mine') {
    revealAllMines(board);
    return { status: 'lost', board };
  }

  if (checkWin(board)) {
    return { status: 'won', board };
  }

  return { status, board };
}

/**
 * Chord（经典双线）：已翻开的数字格，当周围插旗数 === 数字时，
 * 自动翻开其余相邻未插旗格。插错旗也会开，翻到雷则失败。
 */
export function chordReveal(state: GameState, row: number, col: number): GameState {
  if (state.status !== 'playing' || !state.board.minesPlaced) {
    return state;
  }

  const cell = state.board.cells[row]?.[col];
  if (!cell?.revealed || cell.isMine || cell.adjacentMines === 0) {
    return state;
  }

  const neighbors = getNeighbors(state.board, row, col);
  const flaggedCount = neighbors.filter(
    ({ row: nr, col: nc }) => state.board.cells[nr]![nc]!.flagged,
  ).length;

  if (flaggedCount !== cell.adjacentMines) {
    return state;
  }

  const board = cloneBoard(state.board);
  let hitMine = false;

  for (const { row: nr, col: nc } of neighbors) {
    const neighbor = board.cells[nr]![nc]!;
    if (neighbor.flagged || neighbor.revealed) continue;
    if (revealSingle(board, nr, nc) === 'mine') {
      hitMine = true;
    }
  }

  if (hitMine) {
    revealAllMines(board);
    return { status: 'lost', board };
  }

  if (checkWin(board)) {
    return { status: 'won', board };
  }

  return { status: 'playing', board };
}

export function toggleFlag(state: GameState, row: number, col: number): GameState {
  if (state.status !== 'playing' && state.status !== 'idle') {
    return state;
  }

  const cell = state.board.cells[row]?.[col];
  if (!cell || cell.revealed) {
    return state;
  }

  const board = cloneBoard(state.board);
  board.cells[row]![col]!.flagged = !board.cells[row]![col]!.flagged;
  return { ...state, board };
}

export function toCellViews(state: GameState): CellView[] {
  const exposeMines = state.status === 'won' || state.status === 'lost';
  const views: CellView[] = [];

  for (let row = 0; row < state.board.rows; row += 1) {
    for (let col = 0; col < state.board.cols; col += 1) {
      const cell = state.board.cells[row]![col]!;
      views.push({
        row,
        col,
        revealed: cell.revealed,
        flagged: cell.flagged,
        adjacentMines: cell.revealed && !cell.isMine ? cell.adjacentMines : null,
        isMine: exposeMines ? cell.isMine : null,
      });
    }
  }

  return views;
}
