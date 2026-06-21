import { resolveAiBlockedSets } from './ai-blocked.ts';
import { parseKey } from './deduction.ts';
import { pickHealMove } from './heal-policy.ts';
import { bottomRowNeedsWork, solveBoard } from './moves.ts';
import { pickScrollMove } from './scroll-policy.ts';
import { buildSolverBoard, pickFirstClick } from './session-board.ts';
import type { AiAnalysis } from './types.ts';
import {
  ENDLESS_SCROLL_MS_MIN,
  getEndlessScrollIntervalMsFromElapsed,
  getEndlessScrollProfile,
} from '../modes/endless.ts';
import type { ModeSession } from '../types.ts';

export function getEndlessAiStepMs(session: ModeSession, elapsedMs = 0): number {
  if (session.state.status !== 'playing') return 400;

  const board = buildSolverBoard(session);
  if (bottomRowNeedsWork(board)) return 120;

  const interval = getEndlessScrollIntervalMsFromElapsed(elapsedMs);
  const profile = getEndlessScrollProfile(elapsedMs);
  if (interval <= ENDLESS_SCROLL_MS_MIN + 100) return Math.max(80, Math.round(150 / profile.batchRows));
  if (interval <= 2500) return Math.max(100, Math.round(250 / profile.batchRows));
  return Math.max(120, Math.round(400 / profile.batchRows));
}

export function analyzeSession(session: ModeSession, elapsedMs = 0): AiAnalysis {
  const board = buildSolverBoard(session);

  if (!session.state.board.minesPlaced || session.state.status === 'idle') {
    const start = pickFirstClick(board);
    return {
      safe: [start],
      mines: [],
      chords: [],
      move: {
        kind: 'reveal',
        row: start.row,
        col: start.col,
        confidence: 'certain',
        reason: '首击开局',
      },
    };
  }

  if (session.state.status !== 'playing') {
    return { safe: [], mines: [], chords: [], move: null };
  }

  const blocks = resolveAiBlockedSets(session);
  const lives = session.lives ?? 5;
  const batchRows = getEndlessScrollProfile(elapsedMs).batchRows;
  const { deduced, chords, move } = solveBoard(board, lives, blocks, batchRows);

  const safe = [...deduced.safe]
    .map(parseKey)
    .filter(({ row, col }) => board.canAct(row, col));
  const mines = [...deduced.mines]
    .map(parseKey)
    .filter(({ row, col }) => board.canAct(row, col));
  const actableChords = chords.filter(({ row, col }) => board.canAct(row, col));

  const analysis: AiAnalysis = {
    safe,
    mines,
    chords: actableChords,
    move,
  };

  const heal = pickHealMove(session, analysis.move);
  if (heal) return { ...analysis, move: heal };

  const safeKeys = new Set(deduced.safe);
  const mineKeys = new Set(deduced.mines);
  const scroll = pickScrollMove(session, analysis.move, board, safeKeys, mineKeys, batchRows);
  if (scroll) return { ...analysis, move: scroll };

  return analysis;
}

export function aiMoveToScreenRow(session: ModeSession, localRow: number): number {
  if (session.modeId !== 'endless') return localRow;
  return localRow - (session.endlessViewStart ?? 0);
}

export function aiMoveFromScreenRow(session: ModeSession, screenRow: number): number {
  if (session.modeId !== 'endless') return screenRow;
  return screenRow + (session.endlessViewStart ?? 0);
}
