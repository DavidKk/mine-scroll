import type { SolverBoard } from '../session-board.ts';
import type { AiCoord } from '../types.ts';

export function bottomRow(board: SolverBoard): number | null {
  return board.endless?.bottomRow ?? null;
}

function rowScore(board: SolverBoard, row: number): number {
  const bottom = bottomRow(board);
  if (bottom === null) return row;
  const d = bottom - row;
  if (d < 0) return -1000;
  if (d === 0) return 1000;
  if (d === 1) return 600;
  if (d === 2) return 350;
  return Math.max(0, 200 - d * 40);
}

export function pickBest(coords: AiCoord[], board: SolverBoard): AiCoord | null {
  if (coords.length === 0) return null;
  return coords.reduce((best, c) => (rowScore(board, c.row) > rowScore(board, best.row) ? c : best));
}

export function bottomRowUnresolved(board: SolverBoard): AiCoord[] {
  const bottom = bottomRow(board);
  if (bottom === null) return [];

  const out: AiCoord[] = [];
  for (let col = 0; col < board.cols; col += 1) {
    const c = board.cell(bottom, col);
    if (c && !c.revealed && !c.flagged) out.push({ row: bottom, col });
  }
  return out;
}

export function bottomRowNeedsWork(board: SolverBoard): boolean {
  return bottomRowUnresolved(board).length > 0;
}
