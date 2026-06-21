import {
  cloneBoard,
  createEmptyBoard,
  getNeighbors,
  isCellActive,
  placeMinesForFirstClick,
} from '../board.ts';
import { getDefaultDifficulty } from '../difficulty.ts';
import {
  createHexBoard,
  HEX_MINE_DEFAULT,
  HEX_RADIUS_DEFAULT,
} from '../topology/hex.ts';
import {
  createEndlessSession,
  endlessChordAt,
  endlessRevealAt,
  endlessToggleMarkAt,
  getEndlessHudExtra,
  getEndlessHudDefusedDisplay,
  getEndlessHudLeft,
  toEndlessCellViews,
} from './endless.ts';
import { analyzeSession } from '../ai/solver.ts';
import { aiPersistCellKey } from '../ai/ai-blocked.ts';
import { exchangeMinesForLife } from '../mines-defused.ts';
import {
  endlessScrollTick,
  isBatchScrollSafe,
} from './endless.ts';
import type { AiAnalysis, AiHintDisplay, AiMove } from '../ai/types.ts';
import type {
  Board,
  CellView,
  Difficulty,
  GameModeId,
  GameStatus,
  ModeSession,
} from '../types.ts';
import { cellKey, isCellBlocked } from '../types.ts';

export function createSession(
  modeId: GameModeId,
  diff: Difficulty = getDefaultDifficulty(),
): ModeSession {
  if (modeId === 'endless') return createEndlessSession();

  const board =
    modeId === 'hex'
      ? createHexBoard(HEX_RADIUS_DEFAULT, HEX_MINE_DEFAULT)
      : createEmptyBoard(diff);

  return {
    modeId,
    state: {
      status: 'idle',
      board,
      modeId,
    },
  };
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

function checkWin(board: Board): boolean {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!isCellActive(board, row, col)) continue;
      const cell = board.cells[row]![col]!;
      if (!cell.isMine && !cell.revealed) return false;
    }
  }
  return true;
}

function revealAllMines(board: Board): void {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!isCellActive(board, row, col)) continue;
      const cell = board.cells[row]![col]!;
      if (cell.isMine) cell.revealed = true;
    }
  }
}

function floodReveal(board: Board, startRow: number, startCol: number): void {
  const queue: { row: number; col: number }[] = [{ row: startRow, col: startCol }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    const key = cellKey(row, col);
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = board.cells[row]![col]!;
    if (isCellBlocked(cell) || cell.revealed) continue;

    cell.revealed = true;
    if (cell.isMine) continue;

    if (cell.adjacentMines === 0) {
      for (const neighbor of getNeighbors(board, row, col)) {
        queue.push(neighbor);
      }
    }
  }
}

function revealSingle(board: Board, row: number, col: number): 'mine' | 'safe' {
  const cell = board.cells[row]![col]!;
  if (cell.revealed || isCellBlocked(cell)) return 'safe';

  if (cell.isMine) {
    cell.revealed = true;
    return 'mine';
  }

  if (cell.adjacentMines === 0) {
    floodReveal(board, row, col);
  } else {
    cell.revealed = true;
  }

  return 'safe';
}

function handleMineHit(session: ModeSession, board: Board): ModeSession {
  revealAllMines(board);
  return {
    ...session,
    state: { ...session.state, board, status: 'lost' },
  };
}

export function revealAt(session: ModeSession, row: number, col: number): ModeSession {
  if (session.modeId === 'endless') return endlessRevealAt(session, row, col);

  const { state } = session;
  if (!isCellActive(state.board, row, col)) return session;
  const cell = state.board.cells[row]?.[col];
  if (!cell) return session;
  if (state.status === 'won' || state.status === 'lost') return session;
  if (isCellBlocked(cell) || cell.revealed) return session;

  const board = cloneBoard(state.board);
  let status: GameStatus = state.status;
  const isFirstClick = !board.minesPlaced;

  if (isFirstClick) {
    const mined = placeMinesForFirstClick(board, row, col);
    board.cells = mined.cells;
    board.minesPlaced = mined.minesPlaced;
    status = 'playing';
  } else if (status === 'idle') {
    status = 'playing';
  }

  const outcome = revealSingle(board, row, col);
  if (isFirstClick && outcome === 'mine') {
    throw new Error('First click must not hit a mine');
  }

  if (outcome === 'mine') {
    return handleMineHit(session, board);
  }

  if (checkWin(board)) {
    return { ...session, state: { ...session.state, board, status: 'won' } };
  }

  return { ...session, state: { ...session.state, board, status } };
}

export function chordAt(session: ModeSession, row: number, col: number): ModeSession {
  if (session.modeId === 'endless') return endlessChordAt(session, row, col);

  const { state } = session;
  if (state.status !== 'playing' || !state.board.minesPlaced) return session;

  const cell = state.board.cells[row]?.[col];
  if (!cell?.revealed || cell.isMine || cell.adjacentMines === 0) return session;

  const neighbors = getNeighbors(state.board, row, col);
  const flaggedCount = neighbors.filter(
    ({ row: nr, col: nc }) => state.board.cells[nr]![nc]!.mark === 'flag',
  ).length;

  if (flaggedCount !== cell.adjacentMines) return session;

  const board = cloneBoard(state.board);
  let hitMine = false;

  for (const { row: nr, col: nc } of neighbors) {
    const neighbor = board.cells[nr]![nc]!;
    if (neighbor.mark !== 'none' || neighbor.revealed) continue;
    if (revealSingle(board, nr, nc) === 'mine') {
      hitMine = true;
    }
  }

  if (hitMine) {
    return handleMineHit(session, board);
  }

  if (checkWin(board)) {
    return { ...session, state: { ...session.state, board, status: 'won' } };
  }

  return { ...session, state: { ...session.state, board, status: 'playing' } };
}

export function toggleMarkAt(session: ModeSession, row: number, col: number): ModeSession {
  if (session.modeId === 'endless') return endlessToggleMarkAt(session, row, col);

  const { state } = session;
  if (state.status !== 'playing' && state.status !== 'idle') return session;
  if (!isCellActive(state.board, row, col)) return session;

  const cell = state.board.cells[row]?.[col];
  if (!cell || cell.revealed) return session;

  const board = cloneBoard(state.board);
  const current = board.cells[row]![col]!;
  current.mark = current.mark === 'flag' ? 'none' : 'flag';

  return { ...session, state: { ...session.state, board } };
}

export function toCellViews(session: ModeSession): CellView[] {
  if (session.modeId === 'endless') return toEndlessCellViews(session);

  const { state } = session;
  const gameOver = state.status === 'won' || state.status === 'lost';
  const views: CellView[] = [];

  for (let row = 0; row < state.board.rows; row += 1) {
    for (let col = 0; col < state.board.cols; col += 1) {
      if (!isCellActive(state.board, row, col)) continue;
      const cell = state.board.cells[row]![col]!;

      views.push({
        row,
        col,
        revealed: cell.revealed,
        flagged: cell.mark === 'flag',
        adjacentMines: cell.revealed && !cell.isMine ? cell.adjacentMines : null,
        isMine: gameOver ? cell.isMine : null,
      });
    }
  }

  return views;
}

export function getSessionHudExtra(session: ModeSession): string {
  if (session.modeId === 'endless') return getEndlessHudExtra(session);
  if (session.modeId === 'hex') {
    return '六边形 · ⬡ 6 邻格 · 91 格 / 10 雷';
  }
  return '经典';
}

export function getHudLeftDisplay(session: ModeSession, flagCount: number): string | undefined {
  if (session.modeId === 'endless') return getEndlessHudLeft(session);
  return String(session.state.board.mineCount - flagCount).padStart(3, '0');
}

export function getHudDefusedDisplay(session: ModeSession): string | undefined {
  if (session.modeId === 'endless') return getEndlessHudDefusedDisplay(session);
  return undefined;
}

export function getAiAnalysis(session: ModeSession, elapsedMs = 0): AiAnalysis {
  return analyzeSession(session, elapsedMs);
}

export function toAiHintDisplay(session: ModeSession, analysis: AiAnalysis): AiHintDisplay | null {
  const move = analysis.move;
  if (!move || move.kind === 'heal' || move.kind === 'scroll') return null;
  return {
    row: session.modeId === 'endless' ? move.row - (session.endlessViewStart ?? 0) : move.row,
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
    if (session.modeId !== 'endless' || session.state.status !== 'playing') return session;
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
