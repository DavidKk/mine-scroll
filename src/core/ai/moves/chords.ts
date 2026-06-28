import { key, type Deduction } from '../deduction.ts';
import type { SolverBoard } from '../session-board.ts';
import type { AiCoord } from '../types.ts';

export function findSafeChords(board: SolverBoard, deduced: Deduction): AiCoord[] {
  const chords: AiCoord[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col)) continue;
      const cell = board.cell(row, col);
      if (!cell?.revealed || cell.adjacentMines === null || cell.adjacentMines === 0) continue;

      let flagCount = 0;
      let hasRevealTarget = false;
      let ok = true;

      for (const nb of board.neighbors(row, col)) {
        if (!board.canAct(nb.row, nb.col)) continue;
        const nc = board.cell(nb.row, nb.col);
        if (!nc) continue;
        if (nc.flagged) {
          flagCount += 1;
          if (!deduced.mines.has(key(nb.row, nb.col))) {
            ok = false;
            break;
          }
        } else if (!nc.revealed) {
          if (!deduced.safe.has(key(nb.row, nb.col))) {
            ok = false;
            break;
          }
          hasRevealTarget = true;
        }
      }

      if (ok && hasRevealTarget && flagCount === cell.adjacentMines) {
        chords.push({ row, col });
      }
    }
  }

  return chords;
}
