import type { AiBlockedSets } from './ai-blocked.ts';
import {
  deduce,
  findContradictoryFlagMove,
  findExcessFlagMove,
  findMisflaggedSafeMove,
  key,
  parseKey,
  wouldViolateCluesIfFlagged,
  type Deduction,
} from './deduction.ts';
import {
  componentProbabilities,
  pickLowestProb,
} from './csp.ts';
import type { SolverBoard } from './session-board.ts';
import type { AiCoord, AiMove } from './types.ts';

function isFlagBlocked(blocks: AiBlockedSets | undefined, row: number, col: number): boolean {
  return blocks?.flag?.has(key(row, col)) ?? false;
}

function isRevealBlocked(blocks: AiBlockedSets | undefined, row: number, col: number): boolean {
  return blocks?.reveal?.has(key(row, col)) ?? false;
}

function bottomRow(board: SolverBoard): number | null {
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

function pickBest(coords: AiCoord[], board: SolverBoard): AiCoord | null {
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

function isPristine(board: SolverBoard, row: number, col: number): boolean {
  const cell = board.cell(row, col);
  if (!cell || cell.revealed || cell.flagged) return false;
  for (const nb of board.neighbors(row, col)) {
    if (board.cell(nb.row, nb.col)?.revealed) return false;
  }
  return true;
}

function hasActableRevealedClue(board: SolverBoard): boolean {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col)) continue;
      const cell = board.cell(row, col);
      if (cell?.revealed && cell.adjacentMines !== null) return true;
    }
  }
  return false;
}

function findSafeChords(board: SolverBoard, deduced: Deduction): AiCoord[] {
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

function guessAllowed(
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

function makeMove(
  kind: AiMove['kind'],
  row: number,
  col: number,
  confidence: AiMove['confidence'],
  reason: string,
): AiMove {
  return { kind, row, col, confidence, reason };
}

function pickCertainFlags(
  board: SolverBoard,
  deduced: Deduction,
  blocks: AiBlockedSets | undefined,
  targetRows: Set<number> | null,
): AiMove | null {
  const candidates: AiCoord[] = [];

  for (const k of deduced.mines) {
    const { row, col } = parseKey(k);
    if (!board.canAct(row, col) || isFlagBlocked(blocks, row, col)) continue;
    const cell = board.cell(row, col);
    if (!cell || cell.revealed || cell.flagged) continue;
    if (wouldViolateCluesIfFlagged(board, row, col)) continue;
    if (targetRows && !targetRows.has(row)) continue;
    candidates.push({ row, col });
  }

  const pick = pickBest(candidates, board);
  if (!pick) return null;

  const onBottom = pick.row === bottomRow(board);
  return makeMove(
    'flag',
    pick.row,
    pick.col,
    'certain',
    board.endless ? (onBottom ? '底行必雷' : '必雷') : '必雷',
  );
}

function pickCertainReveals(
  board: SolverBoard,
  deduced: Deduction,
  blocks: AiBlockedSets | undefined,
  targetRows: Set<number> | null,
): AiMove | null {
  const candidates: AiCoord[] = [];

  for (const k of deduced.safe) {
    const { row, col } = parseKey(k);
    if (!board.canAct(row, col) || isRevealBlocked(blocks, row, col)) continue;
    const cell = board.cell(row, col);
    if (!cell || cell.revealed || cell.flagged) continue;
    if (targetRows && !targetRows.has(row)) continue;
    candidates.push({ row, col });
  }

  const pick = pickBest(candidates, board);
  if (!pick) return null;

  const onBottom = pick.row === bottomRow(board);
  return makeMove(
    'reveal',
    pick.row,
    pick.col,
    'certain',
    board.endless ? (onBottom ? '底行开格' : '必安全') : '必安全',
  );
}

function pickCertainChord(
  board: SolverBoard,
  deduced: Deduction,
  blocks: AiBlockedSets | undefined,
  targetRows: Set<number> | null,
): AiMove | null {
  let chords = findSafeChords(board, deduced).filter(
    (c) => !isRevealBlocked(blocks, c.row, c.col),
  );
  if (targetRows) chords = chords.filter((c) => targetRows.has(c.row));
  const pick = pickBest(chords, board);
  if (!pick) return null;

  return makeMove(
    'chord',
    pick.row,
    pick.col,
    'certain',
    board.endless ? '底行 Chord' : 'Chord 可展开',
  );
}

function pickCspMove(
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
      bottomEmergency ? '底行临期 · 必雷插旗' : '必雷插旗',
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
      bottomEmergency ? '底行临期开格' : '必安全',
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
      bottomEmergency ? '底行开格' : '必安全',
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
      ? `底行临期 · 概率 ${pct}%`
      : board.endless
        ? `概率猜雷 ${pct}%`
        : `猜雷 ${pct}%`,
  );
}

function pickFrontierEdge(
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
      board.endless && onBottom ? '底行开格' : '必安全',
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
      return makeMove('reveal', best.row, best.col, 'certain', '必安全');
    }
    if (best && guessAllowed(Boolean(board.endless), lives, best.prob, false)) {
      const pct = Math.round(best.prob * 1000) / 10;
      return makeMove('reveal', best.row, best.col, 'guess', `前沿探路 ${pct}%`);
    }
  }

  let fallback: { row: number; col: number; prob: number } | null = null;
  for (const c of candidates) {
    const prob = estimateLocalFrontierRisk(board, deduced, c.row, c.col);
    if (prob === null) continue;
    if (!fallback || prob < fallback.prob) fallback = { ...c, prob };
  }
  if (fallback && fallback.prob <= 1e-9) {
    return makeMove('reveal', fallback.row, fallback.col, 'certain', '必安全');
  }
  if (fallback && guessAllowed(Boolean(board.endless), lives, fallback.prob, bottomEmergency)) {
    const pct = Math.round(fallback.prob * 1000) / 10;
    return makeMove('reveal', fallback.row, fallback.col, 'guess', `线索探路 ${pct}%`);
  }

  return null;
}

function estimateLocalFrontierRisk(
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

function pickExpansion(
  board: SolverBoard,
  lives: number,
  blocks: AiBlockedSets | undefined,
  bottomEmergency: boolean,
): AiMove | null {
  if (!board.endless) return null;

  const forcedUnknown = !hasActableRevealedClue(board);
  if (!forcedUnknown && lives < 5) return null;

  const estimatedRisk = bottomEmergency ? 0.2 : 0.18;
  if (!forcedUnknown && !guessAllowed(true, lives, estimatedRisk, bottomEmergency)) return null;
  if (forcedUnknown && lives <= 1) return null;

  const candidates: AiCoord[] = [];
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col) || isRevealBlocked(blocks, row, col)) continue;
      if (isPristine(board, row, col)) candidates.push({ row, col });
    }
  }

  const e = board.endless;
  const pick = candidates.reduce<AiCoord | null>((best, c) => {
    const targetRow = e.viewStart + 1;
    const targetCol = Math.floor(board.cols / 2);
    const score = (c.row - targetRow) ** 2 + (c.col - targetCol) ** 2;
    if (!best) return c;
    const bestScore = (best.row - targetRow) ** 2 + (best.col - targetCol) ** 2;
    return score < bestScore ? c : best;
  }, null);

  if (!pick) return null;
  const pct = Math.round(estimatedRisk * 1000) / 10;
  const label = forcedUnknown ? '破局 · 全未知' : '开拓';
  return makeMove('reveal', pick.row, pick.col, 'guess', `${label} · 估算 ${pct}%`);
}

function pickLastResortBreakthrough(
  board: SolverBoard,
  deduced: Deduction,
  blocks: AiBlockedSets | undefined,
  bottomEmergency: boolean,
): AiMove | null {
  if (!board.endless) return null;

  const bottomStalled = bottomRowUnresolved(board).length > 0;
  if (!bottomEmergency && !bottomStalled) return null;

  let frontier: { row: number; col: number; prob: number } | null = null;
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col) || isRevealBlocked(blocks, row, col)) continue;
      const cell = board.cell(row, col);
      if (!cell || cell.revealed || cell.flagged) continue;
      if (deduced.mines.has(key(row, col))) continue;
      const prob = estimateLocalFrontierRisk(board, deduced, row, col);
      if (prob === null) continue;
      if (!frontier || prob < frontier.prob) frontier = { row, col, prob };
    }
  }

  if (frontier) {
    if (frontier.prob <= 1e-9) {
      return makeMove('reveal', frontier.row, frontier.col, 'certain', '必安全');
    }
    const pct = Math.round(frontier.prob * 1000) / 10;
    return makeMove(
      'reveal',
      frontier.row,
      frontier.col,
      'guess',
      `保命破局 · 估算 ${pct}%`,
    );
  }

  const candidates: AiCoord[] = [];
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.canAct(row, col) || isRevealBlocked(blocks, row, col)) continue;
      if (deduced.mines.has(key(row, col))) continue;
      if (isPristine(board, row, col)) candidates.push({ row, col });
    }
  }

  const pick = pickBest(candidates, board);
  if (!pick) return null;
  return makeMove('reveal', pick.row, pick.col, 'guess', '保命破局 · 无线索');
}

export function pickTacticalMove(
  board: SolverBoard,
  deduced: Deduction,
  lives: number,
  blocks: AiBlockedSets | undefined,
  batchRows = 1,
): AiMove | null {
  const endless = Boolean(board.endless);
  const bottom = bottomRow(board);
  const bottomEmergency = endless && batchRows > 1;

  const excess = findExcessFlagMove(board, deduced.mines);
  if (excess && !isFlagBlocked(blocks, excess.row, excess.col)) {
    return makeMove(
      'unflag',
      excess.row,
      excess.col,
      'certain',
      endless && excess.row === bottom ? '底行错旗纠正' : '错旗纠正',
    );
  }

  const contradictory = findContradictoryFlagMove(board, deduced.mines);
  if (contradictory && !isFlagBlocked(blocks, contradictory.row, contradictory.col)) {
    return makeMove('unflag', contradictory.row, contradictory.col, 'certain', '矛盾旗纠正');
  }

  const misflagged = findMisflaggedSafeMove(board, deduced.safe, deduced.mines);
  if (misflagged) {
    return makeMove('unflag', misflagged.row, misflagged.col, 'certain', '错旗·实为安全');
  }

  const flag = pickCertainFlags(board, deduced, blocks, null);
  if (flag) return flag;
  const reveal = pickCertainReveals(board, deduced, blocks, null);
  if (reveal) return reveal;
  const chord = pickCertainChord(board, deduced, blocks, null);
  if (chord) return chord;

  const edge = pickFrontierEdge(board, deduced, lives, blocks, bottomEmergency);
  if (edge) return edge;

  const frontier = componentProbabilities(board, deduced);
  if (frontier && frontier.size > 0) {
    const vars = [...frontier.keys()];
    const csp = pickCspMove(board, deduced, lives, blocks, vars, bottomEmergency);
    if (csp) return csp;
  }

  const expand = pickExpansion(board, lives, blocks, bottomEmergency);
  if (expand) return expand;

  const lastResort = pickLastResortBreakthrough(board, deduced, blocks, bottomEmergency);
  if (lastResort) return lastResort;

  return null;
}

export function solveBoard(
  board: SolverBoard,
  lives: number,
  blocks: AiBlockedSets | undefined,
  batchRows = 1,
): { deduced: Deduction; chords: AiCoord[]; move: AiMove | null } {
  const deduced = deduce(board);
  const chords = findSafeChords(board, deduced);
  const move = pickTacticalMove(board, deduced, lives, blocks, batchRows);
  return { deduced, chords, move };
}
