import { isCellActive } from '../board.ts';
import { analyzeSession } from '../ai/solver.ts';
import { aiPersistCellKey } from '../ai/ai-blocked.ts';
import { exchangeMinesForLife } from '../mines-defused.ts';
import type { AiAnalysis, AiHintDisplay, AiMove } from '../ai/types.ts';
import type { CellView, ModeSession } from '../types.ts';
import {
  createEndlessSession,
  endlessChordAt,
  endlessRevealAt,
  endlessScrollTick,
  endlessToggleMarkAt,
  isBatchScrollSafe,
  toEndlessCellViews,
} from './endless/index.ts';

export function createSession(): ModeSession {
  return createEndlessSession();
}

export function getFlagCount(state: ModeSession['state']): number {
  let count = 0;
  for (let row = 0; row < state.board.rows; row += 1) {
    for (let col = 0; col < state.board.cols; col += 1) {
      if (!isCellActive(state.board, row, col)) continue;
      if (state.board.cells[row]![col]!.mark === 'flag') count += 1;
    }
  }
  return count;
}

export function revealAt(session: ModeSession, row: number, col: number): ModeSession {
  return endlessRevealAt(session, row, col);
}

export function chordAt(session: ModeSession, row: number, col: number): ModeSession {
  return endlessChordAt(session, row, col);
}

export function toggleMarkAt(session: ModeSession, row: number, col: number): ModeSession {
  return endlessToggleMarkAt(session, row, col);
}

export function toCellViews(session: ModeSession): CellView[] {
  return toEndlessCellViews(session);
}

export function getAiAnalysis(session: ModeSession, elapsedMs = 0): AiAnalysis {
  return analyzeSession(session, elapsedMs);
}

export function toAiHintDisplay(session: ModeSession, analysis: AiAnalysis): AiHintDisplay | null {
  const move = analysis.move;
  if (!move || move.kind === 'heal' || move.kind === 'scroll') return null;
  return {
    row: move.row - (session.endlessViewStart ?? 0),
    col: move.col,
    kind: move.kind,
    confidence: move.confidence,
  };
}

export function applyAiMove(session: ModeSession, move: AiMove): ModeSession {
  if (move.kind === 'heal') {
    return exchangeMinesForLife(session);
  }
  if (move.kind === 'scroll') {
    if (session.state.status !== 'playing') return session;
    const batchRows = move.batchRows ?? 1;
    if (!isBatchScrollSafe(session, batchRows)) return session;
    return endlessScrollTick(session, batchRows);
  }
  if (move.kind === 'reveal') {
    return revealAt(session, move.row, move.col);
  }
  if (move.kind === 'chord') {
    return chordAt(session, move.row, move.col);
  }

  if (move.kind === 'unflag') {
    const cell = session.state.board.cells[move.row]?.[move.col];
    if (!cell || cell.revealed || cell.mark !== 'flag') return session;
    let next = toggleMarkAt(session, move.row, move.col);
    if (move.reason.includes('矛盾') || move.reason.includes('错旗')) {
      const pk = aiPersistCellKey(next.state.board, move.row, move.col);
      const contradicted = new Set(next.aiContradictedFlags ?? []);
      contradicted.add(pk);
      next = { ...next, aiContradictedFlags: [...contradicted] };
    }
    return next;
  }

  const cell = session.state.board.cells[move.row]?.[move.col];
  if (cell && !cell.revealed && cell.mark !== 'flag') {
    return toggleMarkAt(session, move.row, move.col);
  }
  return session;
}

export { canExchangeHeal, exchangeMinesForLife, getMinesDefused, MINES_PER_LIFE } from '../mines-defused.ts';
