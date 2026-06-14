import type { Board, Cell, Difficulty } from './types.ts';

export interface Coord {
  row: number;
  col: number;
}

function createCell(): Cell {
  return {
    isMine: false,
    adjacentMines: 0,
    revealed: false,
    flagged: false,
  };
}

export function createEmptyBoard(diff: Difficulty): Board {
  const cells: Cell[][] = Array.from({ length: diff.rows }, () =>
    Array.from({ length: diff.cols }, createCell),
  );

  return {
    rows: diff.rows,
    cols: diff.cols,
    mineCount: diff.mines,
    cells,
    minesPlaced: false,
  };
}

export function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols;
}

export function getNeighbors(board: Board, row: number, col: number): Coord[] {
  const neighbors: Coord[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (inBounds(board, nr, nc)) {
        neighbors.push({ row: nr, col: nc });
      }
    }
  }
  return neighbors;
}

function coordKey(row: number, col: number): string {
  return `${row},${col}`;
}

function computeAdjacentMines(board: Board): void {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!;
      if (cell.isMine) {
        cell.adjacentMines = 0;
        continue;
      }
      cell.adjacentMines = getNeighbors(board, row, col).filter(
        ({ row: nr, col: nc }) => board.cells[nr]![nc]!.isMine,
      ).length;
    }
  }
}

export function placeMines(board: Board, forbidden: Coord[]): Board {
  const forbiddenKeys = new Set(forbidden.map(({ row, col }) => coordKey(row, col)));
  const candidates: Coord[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!forbiddenKeys.has(coordKey(row, col))) {
        candidates.push({ row, col });
      }
    }
  }

  if (candidates.length < board.mineCount) {
    throw new Error('Not enough cells to place mines');
  }

  shuffle(candidates);
  const next = cloneBoard(board);

  for (let i = 0; i < board.mineCount; i += 1) {
    const { row, col } = candidates[i]!;
    next.cells[row]![col]!.isMine = true;
  }

  computeAdjacentMines(next);
  next.minesPlaced = true;
  return next;
}

/** 首击格 + 8 邻格，经典扫雷安全区 */
export function buildFirstClickSafeZone(board: Board, row: number, col: number): Coord[] {
  return [{ row, col }, ...getNeighbors(board, row, col)];
}

function safeZoneHasNoMines(board: Board, zone: Coord[]): boolean {
  return zone.every(({ row, col }) => !board.cells[row]![col]!.isMine);
}

/**
 * 首次开格时调用：在除安全区外的格子里 **随机** 布雷。
 * 保证首击格及其 8 邻格绝无雷，玩家第一步不可能出局。
 */
export function placeMinesForFirstClick(board: Board, row: number, col: number): Board {
  const safeZone = buildFirstClickSafeZone(board, row, col);
  const maxAttempts = 32;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const next = placeMines(board, safeZone);
    if (safeZoneHasNoMines(next, safeZone)) {
      return next;
    }
  }

  throw new Error('Failed to randomly place mines while keeping first click safe');
}

function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}

export function cloneBoard(board: Board): Board {
  return {
    rows: board.rows,
    cols: board.cols,
    mineCount: board.mineCount,
    minesPlaced: board.minesPlaced,
    cells: board.cells.map((row) => row.map((cell) => ({ ...cell }))),
  };
}
