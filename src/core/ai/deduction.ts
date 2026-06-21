import { cellKey } from '../types.ts';
import type { SolverBoard } from './session-board.ts';

export interface Constraint {
  cells: Set<string>;
  mines: number;
}

export interface Deduction {
  safe: Set<string>;
  mines: Set<string>;
}

export function key(row: number, col: number): string {
  return cellKey(row, col);
}

export function parseKey(k: string): { row: number; col: number } {
  const [row, col] = k.split(',').map(Number);
  return { row: row!, col: col! };
}

function trustedFlags(board: SolverBoard, row: number, col: number, mines: Set<string>): number {
  let n = 0;
  for (const nb of board.neighbors(row, col)) {
    if (mines.has(key(nb.row, nb.col))) n += 1;
  }
  return n;
}

function untrustedFlags(board: SolverBoard, row: number, col: number, mines: Set<string>): string[] {
  const out: string[] = [];
  for (const nb of board.neighbors(row, col)) {
    const c = board.cell(nb.row, nb.col);
    const k = key(nb.row, nb.col);
    if (c?.flagged && !mines.has(k)) out.push(k);
  }
  return out;
}

/** 线索约束变量：未翻开且非已推导安全/雷；未被证明的旗子仍按未知格参与约束 */
function clueVariables(
  board: SolverBoard,
  row: number,
  col: number,
  safe: Set<string>,
  mines: Set<string>,
): string[] {
  const out: string[] = [];
  for (const nb of board.neighbors(row, col)) {
    const c = board.cell(nb.row, nb.col);
    if (!c || c.revealed) continue;
    const k = key(nb.row, nb.col);
    if (safe.has(k) || mines.has(k)) continue;
    out.push(k);
  }
  return out;
}

function applyBasicRules(board: SolverBoard, safe: Set<string>, mines: Set<string>): boolean {
  let changed = false;

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.inConstraints(row, col)) continue;
      const cell = board.cell(row, col);
      if (!cell?.revealed || cell.adjacentMines === null) continue;

      const hidden = clueVariables(board, row, col, safe, mines);
      const need = cell.adjacentMines - trustedFlags(board, row, col, mines);
      if (need < 0 || hidden.length === 0) continue;

      if (need === 0) {
        for (const k of hidden) {
          if (!safe.has(k) && !mines.has(k)) {
            safe.add(k);
            changed = true;
          }
        }
      } else if (need === hidden.length) {
        for (const k of hidden) {
          if (!safe.has(k) && !mines.has(k)) {
            mines.add(k);
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}

function applyGlobalMineCountRule(board: SolverBoard, safe: Set<string>, mines: Set<string>): boolean {
  if (board.totalMines === undefined) return false;

  let changed = false;
  let knownMineCount = 0;
  const hiddenUnknown: string[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.inConstraints(row, col)) continue;
      const cell = board.cell(row, col);
      const k = key(row, col);
      if (mines.has(k)) {
        knownMineCount += 1;
        continue;
      }
      if (!cell || cell.revealed) continue;
      if (!safe.has(k)) hiddenUnknown.push(k);
    }
  }

  const remaining = board.totalMines - knownMineCount;

  if (remaining === 0) {
    for (const k of hiddenUnknown) {
      if (!safe.has(k)) {
        safe.add(k);
        changed = true;
      }
    }
  } else if (remaining === hiddenUnknown.length) {
    for (const k of hiddenUnknown) {
      if (!mines.has(k) && !safe.has(k)) {
        mines.add(k);
        changed = true;
      }
    }
  }

  return changed;
}

export function collectConstraints(
  board: SolverBoard,
  safe: Set<string>,
  mines: Set<string>,
): Constraint[] {
  const out: Constraint[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.inConstraints(row, col)) continue;
      const cell = board.cell(row, col);
      if (!cell?.revealed || cell.adjacentMines === null || cell.adjacentMines === 0) continue;

      const vars = clueVariables(board, row, col, safe, mines);
      if (vars.length === 0) continue;

      const need = cell.adjacentMines - trustedFlags(board, row, col, mines);
      if (need < 0 || need > vars.length) continue;

      out.push({ cells: new Set(vars), mines: need });
    }
  }

  return out;
}

function applySubsetRules(constraints: Constraint[], safe: Set<string>, mines: Set<string>): boolean {
  let changed = false;

  for (let i = 0; i < constraints.length; i += 1) {
    for (let j = 0; j < constraints.length; j += 1) {
      if (i === j) continue;
      const a = constraints[i]!;
      const b = constraints[j]!;

      const aOnly = [...a.cells].filter((k) => !b.cells.has(k));
      const bOnly = [...b.cells].filter((k) => !a.cells.has(k));
      if (aOnly.length !== 0 || bOnly.length === 0) continue;

      const diffM = b.mines - a.mines;
      if (diffM < 0 || diffM > bOnly.length) continue;

      if (diffM === 0) {
        for (const k of bOnly) {
          if (!safe.has(k) && !mines.has(k)) {
            safe.add(k);
            changed = true;
          }
        }
      } else if (diffM === bOnly.length) {
        for (const k of bOnly) {
          if (!safe.has(k) && !mines.has(k)) {
            mines.add(k);
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}

export function deduce(board: SolverBoard): Deduction {
  const safe = new Set<string>();
  const mines = new Set<string>();

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.inConstraints(row, col)) continue;
      if (board.cell(row, col)?.knownMine) mines.add(key(row, col));
    }
  }

  for (;;) {
    let changed = applyBasicRules(board, safe, mines);
    changed = applyGlobalMineCountRule(board, safe, mines) || changed;
    const constraints = collectConstraints(board, safe, mines);
    changed = applySubsetRules(constraints, safe, mines) || changed;
    if (!changed) break;
  }

  return { safe, mines };
}

export function flaggedNeighbors(board: SolverBoard, row: number, col: number): number {
  let n = 0;
  for (const nb of board.neighbors(row, col)) {
    if (board.cell(nb.row, nb.col)?.flagged) n += 1;
  }
  return n;
}

export function findExcessFlagMove(board: SolverBoard, mines: Set<string>): { row: number; col: number } | null {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.inConstraints(row, col)) continue;
      const cell = board.cell(row, col);
      if (!cell?.revealed || cell.adjacentMines === null) continue;
      if (flaggedNeighbors(board, row, col) <= cell.adjacentMines) continue;

      for (const nb of board.neighbors(row, col)) {
        const nc = board.cell(nb.row, nb.col);
        const k = key(nb.row, nb.col);
        if (nc?.flagged && !mines.has(k) && board.canAct(nb.row, nb.col)) {
          return nb;
        }
      }
    }
  }
  return null;
}

export function findContradictoryFlagMove(
  board: SolverBoard,
  mines: Set<string>,
): { row: number; col: number } | null {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.inConstraints(row, col)) continue;
      const cell = board.cell(row, col);
      if (!cell?.revealed || cell.adjacentMines === null) continue;

      const hidden = clueVariables(board, row, col, new Set(), mines).length;
      const need = cell.adjacentMines - trustedFlags(board, row, col, mines);
      const wrong = untrustedFlags(board, row, col, mines);

      if (need > hidden && wrong.length > 0) {
        for (const k of wrong) {
          const { row: r, col: c } = parseKey(k);
          if (board.canAct(r, c)) return { row: r, col: c };
        }
      }
    }
  }
  return null;
}

export function findMisflaggedSafeMove(
  board: SolverBoard,
  safe: Set<string>,
  mines: Set<string>,
): { row: number; col: number } | null {
  for (const k of safe) {
    const { row, col } = parseKey(k);
    const cell = board.cell(row, col);
    if (cell?.flagged && !mines.has(k) && board.canAct(row, col)) return { row, col };
  }
  return null;
}

/** 由邻线索 need===0 直接推出（非子集间接） */
export function isDirectSafe(
  board: SolverBoard,
  row: number,
  col: number,
  deduced: Deduction,
): boolean {
  const k = key(row, col);
  if (!deduced.safe.has(k)) return false;

  for (let r = 0; r < board.rows; r += 1) {
    for (let c = 0; c < board.cols; c += 1) {
      if (!board.inConstraints(r, c)) continue;
      const cell = board.cell(r, c);
      if (!cell?.revealed || cell.adjacentMines === null) continue;

      const hidden = clueVariables(board, r, c, new Set(), deduced.mines);
      const need = cell.adjacentMines - trustedFlags(board, r, c, deduced.mines);
      if (need !== 0) continue;
      if (hidden.some((hk) => hk === k)) return true;
    }
  }
  return false;
}

/** 由邻线索 need===hidden 直接推出（非子集间接） */
export function isDirectMine(
  board: SolverBoard,
  row: number,
  col: number,
  deduced: Deduction,
): boolean {
  const k = key(row, col);
  if (!deduced.mines.has(k)) return false;

  for (let r = 0; r < board.rows; r += 1) {
    for (let c = 0; c < board.cols; c += 1) {
      if (!board.inConstraints(r, c)) continue;
      const cell = board.cell(r, c);
      if (!cell?.revealed || cell.adjacentMines === null) continue;

      const hidden = clueVariables(board, r, c, deduced.safe, new Set()).filter(
        (hk) => !deduced.mines.has(hk) || hk === k,
      );
      const need = cell.adjacentMines - trustedFlags(board, r, c, deduced.mines);
      if (need !== hidden.length) continue;
      if (hidden.some((hk) => hk === k)) return true;
    }
  }
  return false;
}

/** 在此格插旗是否与邻线索数字矛盾 */
export function wouldViolateCluesIfFlagged(board: SolverBoard, row: number, col: number): boolean {
  const cell = board.cell(row, col);
  if (!cell || cell.revealed || cell.flagged) return true;

  for (const nb of board.neighbors(row, col)) {
    const clue = board.cell(nb.row, nb.col);
    if (!clue?.revealed || clue.adjacentMines === null) continue;

    let flags = 0;
    let hidden = 0;
    for (const n of board.neighbors(nb.row, nb.col)) {
      const nc = board.cell(n.row, n.col);
      if (!nc) continue;
      const isTarget = n.row === row && n.col === col;
      if (nc.flagged || nc.knownMine || isTarget) flags += 1;
      else if (!nc.revealed) hidden += 1;
    }

    if (flags > clue.adjacentMines) return true;
    if (flags + hidden < clue.adjacentMines) return true;
  }
  return false;
}
