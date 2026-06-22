import type { Board, LifeLossCell, LifeLossCellKind, LifeLossReport, ModeSession } from '../../types.ts';
import {
  applyMineDefuseOnRowScrollOff,
  clearDefuseStreakOnMistake,
  isScrollPenaltyExempt,
} from '../../mines-defused.ts';
import { ENDLESS_SCROLL_BATCH_MAX } from './constants.ts';
import {
  compactAndBufferBoard,
  compactTrailingBlankRows,
  isRowAllBlank,
  prependRow,
  removeBottomRow,
  recomputeAllAdjacent,
  visibleViewStart,
} from './grid.ts';
import { applyLifeLoss, syncPendingReveals, toScreenRow } from './reveal-pipeline.ts';

function isBottomCellScrollExempt(
  session: ModeSession,
  board: Board,
  localRow: number,
  col: number,
): boolean {
  const cell = board.cells[localRow]![col]!;
  if (cell.revealed) return true;
  if (isScrollPenaltyExempt(session, board, localRow, col)) return true;
  return false;
}

function bottomRowCellPenalty(
  session: ModeSession,
  board: Board,
  localRow: number,
  col: number,
): number {
  if (isBottomCellScrollExempt(session, board, localRow, col)) return 0;
  const cell = board.cells[localRow]![col]!;
  if (cell.isMine) {
    return cell.mark === 'flag' ? 0 : 1;
  }
  if (cell.mark === 'flag') return 1;
  return 1;
}

function countBottomRowPenalty(session: ModeSession, board: Board, localRow: number): number {
  for (let col = 0; col < board.cols; col += 1) {
    if (bottomRowCellPenalty(session, board, localRow, col) > 0) return 1;
  }
  return 0;
}

/** 与 endlessScrollTick 一致的底行扣血预判（含空白底行免扣） */
export function computeBottomRowScrollDamage(
  session: ModeSession,
  board: Board,
  localRow = board.rows - 1,
): number {
  if (localRow < 0 || localRow >= board.rows) return 0;
  if (isRowAllBlank(board, localRow)) return 0;
  return countBottomRowPenalty(session, board, localRow);
}

/** 一次卷轴事件内 N 行离屏：任一行有漏格则扣 1 命（不叠成 −N） */
export function computeBatchScrollDamage(
  session: ModeSession,
  board: Board,
  batchRows: number,
): number {
  const n = Math.max(1, Math.min(batchRows, board.rows));
  for (let i = 0; i < n; i += 1) {
    const localRow = board.rows - 1 - i;
    if (computeBottomRowScrollDamage(session, board, localRow) > 0) return 1;
  }
  return 0;
}

/** 当前底行上移是否不会扣命 */
export function isBottomRowScrollSafe(session: ModeSession): boolean {
  if (session.modeId !== 'endless' || session.state.status !== 'playing') return false;
  return computeBottomRowScrollDamage(session, session.state.board) === 0;
}

/** 批量上移前：即将离屏的 N 行均不会扣命 */
export function isBatchScrollSafe(session: ModeSession, batchRows: number): boolean {
  if (session.modeId !== 'endless' || session.state.status !== 'playing') return false;
  return computeBatchScrollDamage(session, session.state.board, batchRows) === 0;
}

function penaltyCellKind(
  session: ModeSession,
  board: Board,
  localRow: number,
  col: number,
): LifeLossCellKind | null {
  if (isBottomCellScrollExempt(session, board, localRow, col)) return null;
  const cell = board.cells[localRow]![col]!;
  if (cell.isMine) {
    return cell.mark === 'flag' ? null : 'mine-unflagged';
  }
  if (cell.mark === 'flag') return 'wrong-flag';
  return 'unrevealed';
}

function cellKindLabel(kind: LifeLossCellKind): string {
  switch (kind) {
    case 'mine-hit':
      return '踩雷';
    case 'mine-unflagged':
      return '雷未插旗';
    case 'wrong-flag':
      return '错旗';
    case 'unrevealed':
      return '未翻开';
  }
}

function buildScrollLifeLoss(
  session: ModeSession,
  board: Board,
  localRow: number,
  viewStart: number,
): LifeLossReport {
  const cells: LifeLossCell[] = [];
  for (let col = 0; col < board.cols; col += 1) {
    const kind = penaltyCellKind(session, board, localRow, col);
    if (!kind) continue;
    cells.push({
      localRow,
      col,
      screenRow: toScreenRow(localRow, viewStart),
      kind,
    });
  }
  const cellDesc = cells
    .map((c) => `(${c.screenRow},${c.col})${cellKindLabel(c.kind)}`)
    .join(' ');
  return {
    cause: 'scroll-bottom',
    damage: 1,
    cells,
    boardChange: '底行离屏移除 · 顶行已补 1 行',
    reason: `卷轴底行扣血（每轮最多 −1 命）· 漏格：${cellDesc}`,
  };
}

/** 卷轴离屏底行：全空白则免扣血并一并剔除后续空白行 */
function scrollOffBottomRow(session: ModeSession, board: Board): { board: Board; damage: number } {
  const bottomRow = board.rows - 1;
  if (isRowAllBlank(board, bottomRow)) {
    return { board: compactTrailingBlankRows(removeBottomRow(board)), damage: 0 };
  }
  return {
    board: removeBottomRow(board),
    damage: countBottomRowPenalty(session, board, bottomRow),
  };
}

interface SingleRowScrollResult {
  session: ModeSession;
  damage: number;
  lifeLoss?: LifeLossReport;
  autoRevealed: number;
}

/** 单行卷轴（不扣命，由批量层统一结算） */
function performSingleRowScroll(session: ModeSession): SingleRowScrollResult {
  const scrollRowCount = (session.scrollRowCount ?? 0) + 1;
  let board = prependRow(session.state.board, scrollRowCount);
  const viewStart = visibleViewStart(board);
  const bottomLocal = board.rows - 1;
  const damage = computeBottomRowScrollDamage(session, board, bottomLocal);
  const banked = damage === 0 ? applyMineDefuseOnRowScrollOff(session, board, bottomLocal) : null;
  const sessionAfterBank = banked ? { ...session, ...banked } : session;
  const lifeLoss =
    damage > 0 ? buildScrollLifeLoss(sessionAfterBank, board, bottomLocal, viewStart) : undefined;

  const { board: afterScroll } = scrollOffBottomRow(sessionAfterBank, board);
  board = compactAndBufferBoard(afterScroll, scrollRowCount);
  recomputeAllAdjacent(board);
  const pending = syncPendingReveals(sessionAfterBank, board);

  const nextSession: ModeSession = {
    ...sessionAfterBank,
    state: { ...sessionAfterBank.state, board, status: 'playing' },
    endlessViewStart: visibleViewStart(board),
    scrollRowCount,
    revealedCount: (session.revealedCount ?? 0) + pending.revealed,
    pendingRevealKeys: pending.pendingRevealKeys,
  };

  return { session: nextSession, damage, lifeLoss, autoRevealed: pending.revealed };
}

/**
 * 传送带批量 tick：每次事件上移 batchRows 行；整事件最多 −1 命。
 */
export function endlessScrollBatch(session: ModeSession, batchRows = 1): ModeSession {
  if (session.state.status !== 'playing') return session;

  const rows = Math.max(
    1,
    Math.min(ENDLESS_SCROLL_BATCH_MAX, Math.floor(batchRows)),
  );
  let current = session;
  let eventDamage = 0;
  let eventLifeLoss: LifeLossReport | undefined;

  for (let i = 0; i < rows; i += 1) {
    const step = performSingleRowScroll(current);
    current = step.session;
    if (step.damage > 0) {
      eventDamage = 1;
      eventLifeLoss = step.lifeLoss ?? eventLifeLoss;
    }
  }

  if (eventDamage > 0 && eventLifeLoss) {
    const afterBreak = clearDefuseStreakOnMistake(current);
    return applyLifeLoss(afterBreak, afterBreak.state.board, 1, 'playing', eventLifeLoss);
  }
  return current;
}

/** @alias endlessScrollBatch(session, 1) */
export function endlessScrollTick(session: ModeSession, batchRows = 1): ModeSession {
  return endlessScrollBatch(session, batchRows);
}
