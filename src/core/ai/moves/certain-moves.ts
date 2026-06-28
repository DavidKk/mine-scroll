import type { AiBlockedSets } from '../ai-blocked.ts';
import { key, parseKey, wouldViolateCluesIfFlagged, type Deduction } from '../deduction.ts';
import type { SolverBoard } from '../session-board.ts';
import type { AiCoord, AiMove } from '../types.ts';
import { bottomRow, pickBest } from './bottom-row.ts';
import { findSafeChords } from './chords.ts';

export function isFlagBlocked(blocks: AiBlockedSets | undefined, row: number, col: number): boolean {
  return blocks?.flag?.has(key(row, col)) ?? false;
}

export function isRevealBlocked(blocks: AiBlockedSets | undefined, row: number, col: number): boolean {
  return blocks?.reveal?.has(key(row, col)) ?? false;
}

export function makeMove(
  kind: AiMove['kind'],
  row: number,
  col: number,
  confidence: AiMove['confidence'],
  reason: string,
): AiMove {
  return { kind, row, col, confidence, reason };
}

export function pickCertainFlags(
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
    board.endless ? (onBottom ? 'Bottom row certain mine' : 'Certain mine') : 'Certain mine',
  );
}

export function pickCertainReveals(
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
    board.endless ? (onBottom ? 'Bottom row reveal' : 'Safe reveal') : 'Safe reveal',
  );
}

export function pickCertainChord(
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
    board.endless ? 'Bottom row chord' : 'Chord expandable',
  );
}
