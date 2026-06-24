import { cloneBoard, type Coord } from '../../board.ts';
import type { Board, Cell, ModeSession } from '../../types.ts';
import { cellKey } from '../../types.ts';
import {
  ENDLESS_COLS,
  ENDLESS_LIVES,
  ENDLESS_MAX_MINES_PER_ROW,
  ENDLESS_VISIBLE_ROWS,
  ENDLESS_WINDOW_ROWS,
  getEndlessMineRatio,
} from './constants.ts';

function isMineAt(worldRow: number, col: number, seed: number, scrollDepth: number): boolean {
  const ratio = getEndlessMineRatio(scrollDepth);
  const score = hash01(worldRow, col, seed);
  if (score >= ratio) return false;

  const candidates: Array<{ col: number; score: number }> = [];
  for (let c = 0; c < ENDLESS_COLS; c += 1) {
    const candidateScore = hash01(worldRow, c, seed);
    if (candidateScore < ratio) candidates.push({ col: c, score: candidateScore });
  }

  if (candidates.length <= ENDLESS_MAX_MINES_PER_ROW) return true;
  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, ENDLESS_MAX_MINES_PER_ROW).some((candidate) => candidate.col === col);
}

function worldRowOf(board: Board, localRow: number): number {
  return board.minRow! + localRow;
}

export function worldCellKey(board: Board, localRow: number, col: number): string {
  return `${worldRowOf(board, localRow)},${col}`;
}

export function parseWorldCellKey(value: string): { worldRow: number; col: number } | null {
  const [rowPart, colPart] = value.split(',');
  const worldRow = Number(rowPart);
  const col = Number(colPart);
  if (!Number.isInteger(worldRow) || !Number.isInteger(col)) return null;
  return { worldRow, col };
}

export function localRowFromWorld(board: Board, worldRow: number): number | null {
  if (board.minRow === undefined) return null;
  const row = worldRow - board.minRow;
  return row >= 0 && row < board.rows ? row : null;
}

export function inLocalBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols;
}

export function getLocalNeighbors(board: Board, row: number, col: number): Coord[] {
  const neighbors: Coord[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (inLocalBounds(board, nr, nc)) neighbors.push({ row: nr, col: nc });
    }
  }
  return neighbors;
}

export function buildFirstClickSafeZone(board: Board, row: number, col: number): Coord[] {
  return [{ row, col }, ...getLocalNeighbors(board, row, col)];
}

function createEmptyCell(): Cell {
  return {
    isMine: false,
    adjacentMines: 0,
    revealed: false,
    mark: 'none',
  };
}

function hash01(worldRow: number, col: number, seed: number): number {
  let t = (seed ^ Math.imul(worldRow, 374761393) ^ Math.imul(col, 668265263)) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

function createCellForWorld(
  worldRow: number,
  col: number,
  seed: number,
  scrollDepth: number,
): Cell {
  const cell = createEmptyCell();
  cell.isMine = isMineAt(worldRow, col, seed, scrollDepth);
  return cell;
}

function recomputeAdjacentInRange(board: Board, startRow: number, endRow: number): void {
  const from = Math.max(0, startRow);
  const to = Math.min(board.rows - 1, endRow);

  for (let row = from; row <= to; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!;
      if (cell.isMine) {
        cell.adjacentMines = 0;
        continue;
      }
      cell.adjacentMines = getLocalNeighbors(board, row, col).filter(
        ({ row: nr, col: nc }) => board.cells[nr]![nc]!.isMine,
      ).length;
    }
  }
}

function recomputeAfterPrepend(board: Board): void {
  if (board.rows === 0) return;
  recomputeAdjacentInRange(board, 0, Math.min(1, board.rows - 1));
}

function recomputeAfterBottomRemove(board: Board): void {
  if (board.rows === 0) return;
  recomputeAdjacentInRange(board, board.rows - 1, board.rows - 1);
}

export function recomputeAllAdjacent(board: Board): void {
  recomputeAdjacentInRange(board, 0, board.rows - 1);
}

export function applyMinesFromSeed(board: Board, forbidden: Coord[] = []): void {
  const forbiddenKeys = new Set(forbidden.map(({ row, col }) => cellKey(row, col)));
  const seed = board.worldSeed!;

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!;
      if (forbiddenKeys.has(cellKey(row, col))) {
        cell.isMine = false;
      } else {
        cell.isMine = isMineAt(worldRowOf(board, row), col, seed, 0);
      }
    }
  }

  recomputeAllAdjacent(board);
  board.minesPlaced = true;
}

function createInitialBoard(seed: number): Board {
  const minRow = 0;
  const rows = ENDLESS_WINDOW_ROWS;
  const cells: Cell[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: ENDLESS_COLS }, (__, col) => createCellForWorld(minRow + row, col, seed, 0)),
  );

  return {
    rows,
    cols: ENDLESS_COLS,
    mineCount: -1,
    cells,
    minesPlaced: false,
    topology: 'endless',
    minRow,
    maxRow: minRow + rows - 1,
    worldSeed: seed,
  };
}

export function visibleViewStart(board: Board): number {
  return Math.max(0, board.rows - ENDLESS_VISIBLE_ROWS);
}

export function createEndlessSession(): ModeSession {
  const seed = (Date.now() ^ (Math.random() * 0x1_0000_0000)) >>> 0;
  const board = createInitialBoard(seed);

  return {
    modeId: 'endless',
    state: {
      status: 'idle',
      board,
      modeId: 'endless',
    },
    lives: ENDLESS_LIVES,
    endlessOriginMinRow: board.minRow!,
    endlessViewStart: visibleViewStart(board),
    scrollRowCount: 0,
    revealedCount: 0,
    minesDefused: 0,
    score: 0,
    defuseCombo: 0,
    pendingRevealKeys: [],
    defusedMineKeys: [],
    exemptScrollPenaltyKeys: [],
  };
}

export function prependRow(board: Board, scrollDepth: number): Board {
  const newMinRow = board.minRow! - 1;
  const seed = board.worldSeed!;
  const newRow = Array.from({ length: board.cols }, (_, col) =>
    createCellForWorld(newMinRow, col, seed, scrollDepth),
  );

  const next = cloneBoard(board);
  next.cells = [newRow, ...next.cells.map((row) => row.map((cell) => ({ ...cell })))];
  next.minRow = newMinRow;
  next.rows = next.cells.length;
  next.maxRow = newMinRow + next.rows - 1;
  recomputeAfterPrepend(next);
  return next;
}

function isBlankCell(cell: Cell): boolean {
  return !cell.revealed && cell.mark === 'none';
}

export function isRowAllBlank(board: Board, localRow: number): boolean {
  for (let col = 0; col < board.cols; col += 1) {
    if (!isBlankCell(board.cells[localRow]![col]!)) return false;
  }
  return true;
}

export function removeBottomRow(board: Board): Board {
  const next = cloneBoard(board);
  next.cells = next.cells.slice(0, -1).map((row) => row.map((cell) => ({ ...cell })));
  next.rows = next.cells.length;
  next.maxRow = next.minRow! + next.rows - 1;
  recomputeAfterBottomRemove(next);
  return next;
}

export function compactTrailingBlankRows(board: Board): Board {
  let next = board;
  while (next.rows > ENDLESS_VISIBLE_ROWS && isRowAllBlank(next, next.rows - 1)) {
    next = removeBottomRow(next);
  }
  return next;
}

function ensureWindowRows(board: Board, scrollDepth: number): Board {
  let next = board;
  while (next.rows < ENDLESS_WINDOW_ROWS) {
    next = prependRow(next, scrollDepth);
  }
  return next;
}

export function compactAndBufferBoard(board: Board, scrollDepth: number): Board {
  return ensureWindowRows(compactTrailingBlankRows(board), scrollDepth);
}

/** Whether the bottom row is all hidden and unflagged (scroll life-loss exempt). */
export function isBottomRowBlank(board: Board): boolean {
  if (board.rows === 0) return false;
  return isRowAllBlank(board, board.rows - 1);
}
