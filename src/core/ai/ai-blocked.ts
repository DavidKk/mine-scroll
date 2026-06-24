import { mineDefuseKey } from '../mines-defused.ts';
import type { Board, ModeSession } from '../types.ts';
import { cellKey } from '../types.ts';

/** AI oscillation / contradiction blocked cell keys (stable across endless scroll). */
export function aiPersistCellKey(board: Board, localRow: number, col: number): string {
  return mineDefuseKey(board, localRow, col);
}

export interface AiBlockedSets {
  /** Block further flag / unflag (contradiction flags, oscillation cells). */
  flag: Set<string>;
  /** Block reveal / guess / chord (oscillation only; contradicted unflag may reveal to verify). */
  reveal: Set<string>;
}

function resolvePersistedToLocal(board: Board, persisted: string[]): Set<string> {
  const out = new Set<string>();
  if (persisted.length === 0) return out;
  const want = new Set(persisted);
  for (let r = 0; r < board.rows; r += 1) {
    for (let c = 0; c < board.cols; c += 1) {
      const local = cellKey(r, c);
      const world = aiPersistCellKey(board, r, c);
      if (want.has(world) || want.has(local)) out.add(local);
    }
  }
  return out;
}

export function resolveAiBlockedSets(session: ModeSession): AiBlockedSets {
  const board = session.state.board;
  const oscillation = resolvePersistedToLocal(board, session.aiOscillationBlocked ?? []);
  const contradicted = resolvePersistedToLocal(board, session.aiContradictedFlags ?? []);
  const flag = new Set([...oscillation, ...contradicted]);
  return { flag, reveal: oscillation };
}

/** @deprecated Use resolveAiBlockedSets */
export function resolveAiBlockedLocalKeys(session: ModeSession): Set<string> {
  return resolveAiBlockedSets(session).flag;
}

export function isAiPersistBlocked(
  session: ModeSession,
  localRow: number,
  col: number,
): boolean {
  const pk = aiPersistCellKey(session.state.board, localRow, col);
  return (
    session.aiOscillationBlocked?.includes(pk) === true ||
    session.aiContradictedFlags?.includes(pk) === true
  );
}
