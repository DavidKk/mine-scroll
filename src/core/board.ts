import type { Board, Cell, Difficulty } from './types.ts';
import {
  getHexNeighbors,
  inHexBounds,
  isHexCellActive,
} from './topology/hex.ts';

export interface Coord {
  row: number;
  col: number;
}

export type RandomFn = () => number;

function createCell(): Cell {
  return {
    isMine: false,
    adjacentMines: 0,
    revealed: false,
    mark: 'none',
  };
}

export function isCellActive(board: Board, row: number, col: number): boolean {
  const cell = board.cells[row]?.[col];
  if (!cell || cell.inactive) return false;
  if (board.topology === 'hex') return isHexCellActive(board, row, col);
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols;
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
  if (board.topology === 'hex') return inHexBounds(board, row, col);
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols;
}

export function getNeighbors(board: Board, row: number, col: number): Coord[] {
  if (board.topology === 'hex') return getHexNeighbors(board, row, col);

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

export function recomputeAdjacentMines(board: Board): void {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!isCellActive(board, row, col)) continue;
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

export function placeMines(board: Board, forbidden: Coord[], random: RandomFn = Math.random): Board {
  const forbiddenKeys = new Set(forbidden.map(({ row, col }) => coordKey(row, col)));
  const candidates: Coord[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!isCellActive(board, row, col)) continue;
      if (!forbiddenKeys.has(coordKey(row, col))) {
        candidates.push({ row, col });
      }
    }
  }

  if (candidates.length < board.mineCount) {
    throw new Error('Not enough cells to place mines');
  }

  shuffle(candidates, random);
  const next = cloneBoard(board);

  for (let i = 0; i < board.mineCount; i += 1) {
    const { row, col } = candidates[i]!;
    next.cells[row]![col]!.isMine = true;
  }

  recomputeAdjacentMines(next);
  next.minesPlaced = true;
  return next;
}

export function buildFirstClickSafeZone(board: Board, row: number, col: number): Coord[] {
  return [{ row, col }, ...getNeighbors(board, row, col)];
}

function safeZoneHasNoMines(board: Board, zone: Coord[]): boolean {
  return zone.every(({ row, col }) => !board.cells[row]![col]!.isMine);
}

export function placeMinesForFirstClick(
  board: Board,
  row: number,
  col: number,
  random: RandomFn = Math.random,
): Board {
  const safeZone = buildFirstClickSafeZone(board, row, col);
  const maxAttempts = 32;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const next = placeMines(board, safeZone, random);
    if (safeZoneHasNoMines(next, safeZone)) {
      return next;
    }
  }

  throw new Error('Failed to randomly place mines while keeping first click safe');
}

function shuffle<T>(items: T[], random: RandomFn): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}

export function cloneBoard(board: Board): Board {
  return {
    rows: board.rows,
    cols: board.cols,
    mineCount: board.mineCount,
    minesPlaced: board.minesPlaced,
    topology: board.topology,
    hexRadius: board.hexRadius,
    minRow: board.minRow,
    maxRow: board.maxRow,
    worldSeed: board.worldSeed,
    cells: board.cells.map((row) => row.map((cell) => ({ ...cell }))),
  };
}

/** 可复现随机（Mulberry32）— 保留供日后每日挑战等使用 */
export function createSeededRandom(seed: number): RandomFn {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
