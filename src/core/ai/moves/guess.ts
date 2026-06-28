import type { AiBlockedSets } from '../ai-blocked.ts';
import { componentProbabilities, pickLowestProb } from '../csp.ts';
import { key, parseKey, wouldViolateCluesIfFlagged, type Deduction } from '../deduction.ts';
import type { SolverBoard } from '../session-board.ts';
import type { AiCoord, AiMove } from '../types.ts';
import { bottomRow, pickBest } from './bottom-row.ts';
import { isFlagBlocked, isRevealBlocked, makeMove } from './certain-moves.ts';

export function guessAllowed(
  endless: boolean,
  lives: number,
  prob: number,
  bottomEmergency: boolean,
): boolean {
  if (!endless) return true;
  if (bottomEmergency) {
    if (lives <= 1) return false;
    if (lives === 2) return prob <= 0.08;
    if (lives === 3) return prob <= 0.16;
    return prob <= 0.24;
  }
  if (lives <= 1) return false;
  if (lives === 2) return prob <= 0.06;
  if (lives === 3) return prob <= 0.1;
  return prob <= 0.18;
}

export function pickCspMove(
  board: SolverBoard,
  deduced: Deduction,
  lives: number,
  blocks: AiBlockedSets | undefined,
  vars: string[],
  bottomEmergency: boolean,
): AiMove | null {
  const filtered = vars.filter((k) => {
    const { row, col } = parseKey(k);
    return board.canAct(row, col) && !isRevealBlocked(blocks, row, col);
  });
  if (filtered.length === 0) return null;

  const probs = componentProbabilities(board, deduced, filtered);
  if (!probs) return null;

  for (const [k, p] of [...probs.entries()].sort((a, b) => b[1] - a[1])) {
    if (p < 1 - 1e-9) break;
    const { row, col } = parseKey(k);
    if (!board.canAct(row, col) || isFlagBlocked(blocks, row, col)) continue;
    const cell = board.cell(row, col);
    if (!cell || cell.revealed || cell.flagged) continue;
    if (wouldViolateCluesIfFlagged(board, row, col)) continue;
    return makeMove(
      'flag',
      row,
      col,
      'certain',
      bottomEmergency ? 'Bottom row urgent · flag mine' : 'Flag certain mine',
    );
  }

  for (const [k, p] of [...probs.entries()].sort((a, b) => a[1] - b[1])) {
    if (p > 1e-9) break;
    const { row, col } = parseKey(k);
    if (!board.canAct(row, col) || isRevealBlocked(blocks, row, col)) continue;
    const cell = board.cell(row, col);
    if (!cell || cell.revealed || cell.flagged) continue;
    return makeMove(
      'reveal',
      row,
      col,
      'certain',
      bottomEmergency ? 'Bottom row urgent reveal' : 'Safe reveal',
    );
  }

  const bottom = bottomRow(board);
  const pick = pickLowestProb(probs, board, bottomEmergency ? bottom ?? undefined : undefined);
  if (!pick) return null;

  if (
    pick.prob <= 1e-9
  ) {
    return makeMove(
      'reveal',
      pick.row,
      pick.col,
      'certain',
      bottomEmergency ? 'Bottom row urgent reveal' : 'Safe reveal',
    );
  }

  if (!guessAllowed(Boolean(board.endless), lives, pick.prob, bottomEmergency)) return null;

  const pct = Math.round(pick.prob * 1000) / 10;
  return makeMove(
    'reveal',
    pick.row,
    pick.col,
    'guess',
    bottomEmergency
      ? `Bottom row urgent · prob ${pct}%`
      : board.endless
        ? `Probabilistic mine guess ${pct}%`
        : `Guess mine ${pct}%`,
  );
}

export function pickFrontierEdge(
  board: SolverBoard,
  deduced: Deduction,
  lives: number,
  blocks: AiBlockedSets | undefined,
  bottomEmergency: boolean,
): AiMove | null {
  const candidates: AiCoord[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col) || isRevealBlocked(blocks, row, col)) continue;
      const cell = board.cell(row, col);
      if (!cell || cell.revealed || cell.flagged) continue;

      let touchesRevealed = false;
      for (const nb of board.neighbors(row, col)) {
        if (board.cell(nb.row, nb.col)?.revealed) {
          touchesRevealed = true;
          break;
        }
      }
      if (!touchesRevealed) continue;
      candidates.push({ row, col });
    }
  }

  if (candidates.length === 0) return null;

  const safeFirst = candidates.filter((c) => deduced.safe.has(key(c.row, c.col)));
  const pick = pickBest(safeFirst.length > 0 ? safeFirst : candidates, board);
  if (!pick) return null;

  if (deduced.safe.has(key(pick.row, pick.col))) {
    const onBottom = pick.row === bottomRow(board);
    return makeMove(
      'reveal',
      pick.row,
      pick.col,
      'certain',
      board.endless && onBottom ? 'Bottom row reveal' : 'Safe reveal',
    );
  }

  const probs = componentProbabilities(board, deduced);
  if (probs) {
    let best: { row: number; col: number; prob: number } | null = null;
    for (const c of candidates) {
      const p = probs.get(key(c.row, c.col));
      if (p === undefined) continue;
      if (!best || p < best.prob) best = { ...c, prob: p };
    }
    if (best && best.prob <= 1e-9) {
      return makeMove('reveal', best.row, best.col, 'certain', 'Safe reveal');
    }
    if (best && guessAllowed(Boolean(board.endless), lives, best.prob, false)) {
      const pct = Math.round(best.prob * 1000) / 10;
      return makeMove('reveal', best.row, best.col, 'guess', `Frontier probe ${pct}%`);
    }
  }

  let fallback: { row: number; col: number; prob: number } | null = null;
  for (const c of candidates) {
    const prob = estimateLocalFrontierRisk(board, deduced, c.row, c.col);
    if (prob === null) continue;
    if (!fallback || prob < fallback.prob) fallback = { ...c, prob };
  }
  if (fallback && fallback.prob <= 1e-9) {
    return makeMove('reveal', fallback.row, fallback.col, 'certain', 'Safe reveal');
  }
  if (fallback && guessAllowed(Boolean(board.endless), lives, fallback.prob, bottomEmergency)) {
    const pct = Math.round(fallback.prob * 1000) / 10;
    return makeMove('reveal', fallback.row, fallback.col, 'guess', `Clue probe ${pct}%`);
  }

  return null;
}

export function estimateLocalFrontierRisk(
  board: SolverBoard,
  deduced: Deduction,
  row: number,
  col: number,
): number | null {
  const target = key(row, col);
  const risks: number[] = [];

  for (const nb of board.neighbors(row, col)) {
    const clue = board.cell(nb.row, nb.col);
    if (!clue?.revealed || clue.adjacentMines === null) continue;

    let hidden = 0;
    let knownMines = 0;
    let includesTarget = false;

    for (const around of board.neighbors(nb.row, nb.col)) {
      const c = board.cell(around.row, around.col);
      if (!c) continue;
      const k = key(around.row, around.col);
      if (deduced.mines.has(k)) {
        knownMines += 1;
        continue;
      }
      if (c.revealed) continue;
      if (deduced.safe.has(k)) continue;
      hidden += 1;
      if (k === target) includesTarget = true;
    }

    if (!includesTarget || hidden === 0) continue;
    const need = clue.adjacentMines - knownMines;
    if (need < 0) continue;
    risks.push(Math.min(1, Math.max(0, need / hidden)));
  }

  if (risks.length === 0) return null;
  return Math.max(...risks);
}
