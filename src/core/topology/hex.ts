import type { Board, Cell } from '../types.ts';
import type { Coord } from '../board.ts';

/** 正六边形盘半径（含中心到最外圈） */
export const HEX_RADIUS_DEFAULT = 5;
export const HEX_MINE_DEFAULT = 10;

function createInactiveCell(): Cell {
  return {
    isMine: false,
    adjacentMines: 0,
    revealed: false,
    mark: 'none',
    inactive: true,
  };
}

function createActiveCell(): Cell {
  return {
    isMine: false,
    adjacentMines: 0,
    revealed: false,
    mark: 'none',
    inactive: false,
  };
}

export function hexCellCount(radius: number): number {
  if (radius <= 0) return 1;
  return 1 + 3 * radius * (radius + 1);
}

function offsetToCube(col: number, row: number): { x: number; y: number; z: number } {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

function hexDistance(colA: number, rowA: number, colB: number, rowB: number): number {
  const a = offsetToCube(colA, rowA);
  const b = offsetToCube(colB, rowB);
  return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
}

export function isHexCellActive(board: Board, row: number, col: number): boolean {
  if (board.topology !== 'hex' || board.hexRadius === undefined) return false;
  if (row < 0 || row >= board.rows || col < 0 || col >= board.cols) return false;
  const center = board.hexRadius;
  return hexDistance(col, row, center, center) <= board.hexRadius;
}

const EVEN_ROW_DIRS: readonly { dc: number; dr: number }[] = [
  { dc: 1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: -1, dr: -1 },
  { dc: 0, dr: -1 },
];

const ODD_ROW_DIRS: readonly { dc: number; dr: number }[] = [
  { dc: 1, dr: 0 },
  { dc: 1, dr: 1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: -1 },
  { dc: 1, dr: -1 },
];

export function getHexNeighbors(board: Board, row: number, col: number): Coord[] {
  const dirs = (row & 1) === 0 ? EVEN_ROW_DIRS : ODD_ROW_DIRS;
  const neighbors: Coord[] = [];
  for (const { dc, dr } of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (isHexCellActive(board, nr, nc)) {
      neighbors.push({ row: nr, col: nc });
    }
  }
  return neighbors;
}

export function inHexBounds(board: Board, row: number, col: number): boolean {
  return isHexCellActive(board, row, col);
}

export function createHexBoard(radius: number, mineCount: number): Board {
  const size = radius * 2 + 1;
  const cells: Cell[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const boardStub: Board = {
        rows: size,
        cols: size,
        mineCount,
        cells: [],
        minesPlaced: false,
        topology: 'hex',
        hexRadius: radius,
      };
      return isHexCellActive(boardStub, row, col) ? createActiveCell() : createInactiveCell();
    }),
  );

  return {
    rows: size,
    cols: size,
    mineCount,
    cells,
    minesPlaced: false,
    topology: 'hex',
    hexRadius: radius,
  };
}

export function forEachActiveCell(
  board: Board,
  fn: (row: number, col: number, cell: Cell) => void,
): void {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]?.[col];
      if (!cell || cell.inactive) continue;
      fn(row, col, cell);
    }
  }
}
