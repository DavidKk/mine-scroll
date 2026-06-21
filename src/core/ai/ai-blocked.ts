import { mineDefuseKey } from '../mines-defused.ts';
import type { Board, ModeSession } from '../types.ts';
import { cellKey } from '../types.ts';

/** AI 震荡/矛盾禁入格键（无尽用世界行号，卷轴后仍稳定） */
export function aiPersistCellKey(board: Board, localRow: number, col: number): string {
  return mineDefuseKey(board, localRow, col);
}

export interface AiBlockedSets {
  /** 禁止再插/撤旗（矛盾旗、震荡格） */
  flag: Set<string>;
  /** 禁止再开/猜/Chord（仅震荡格；矛盾撤旗后允许开格验证） */
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

/** @deprecated 使用 resolveAiBlockedSets */
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
