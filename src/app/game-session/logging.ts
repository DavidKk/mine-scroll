import { MINES_PER_LIFE } from '../../core/modes/engine.ts';
import { ENDLESS_VISIBLE_ROWS, getEndlessScrollProfile } from '../../core/modes/endless/index.ts';
import type { LifeLossReport, ModeSession } from '../../core/types.ts';
import type { AiMove } from '../../core/ai/types.ts';
import type {
  CanvasLogController,
  GameSessionRuntime,
  SessionApplyContext,
  SessionApplyDeps,
} from './types.ts';

export function formatCell(row: number, col: number): string {
  return `(${row},${col})`;
}

export function createGameLog(
  runtime: GameSessionRuntime,
  repaint: () => void,
): CanvasLogController {
  return {
    append(text, kind = 'system') {
      runtime.recentLogLines.push({
        time: new Date().toLocaleTimeString('zh-CN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        text,
        kind,
      });
      while (runtime.recentLogLines.length > 80) {
        runtime.recentLogLines.shift();
      }
      repaint();
    },
    clear() {
      runtime.recentLogLines.length = 0;
      repaint();
    },
  };
}

function logLifeLoss(
  gameLog: CanvasLogController,
  before: number,
  after: number,
  report?: LifeLossReport,
  context?: SessionApplyContext,
): void {
  const delta = before - after;
  const positions =
    report && report.cells.length > 0
      ? report.cells.map((c) => formatCell(c.screenRow, c.col)).join(' ')
      : '—';
  gameLog.append(`−${delta} 命 · 剩余 ${after} · ${positions}`, 'danger');
  if (context?.trigger) {
    gameLog.append(`触发：${context.trigger}`, 'danger');
  }
  if (report?.reason) {
    gameLog.append(`原因：${report.reason}`, 'danger');
  }
  if (report?.boardChange) {
    gameLog.append(`盘面：${report.boardChange}`, 'danger');
  }
}

export function logLifeChange(
  gameLog: CanvasLogController,
  before: number | undefined,
  after: number | undefined,
  report?: LifeLossReport,
  context?: SessionApplyContext,
): void {
  if (before === undefined || after === undefined || after >= before) return;
  logLifeLoss(gameLog, before, after, report, context);
}

function debugCellSymbol(
  next: ModeSession,
  row: number,
  col: number,
  report?: LifeLossReport,
): string {
  const hit = report?.cells.some((c) => c.localRow === row && c.col === col) === true;
  const cell = next.state.board.cells[row]?.[col];
  if (!cell) return ' ';
  if (hit && cell.isMine) return 'X';
  if (hit) return '!';
  if (cell.mark === 'flag') return cell.isMine ? 'F' : 'f';
  if (cell.isMine) return '*';
  if (!cell.revealed) return '?';
  return cell.adjacentMines === 0 ? '.' : String(cell.adjacentMines);
}

function appendDeathDebug(
  gameLog: CanvasLogController,
  next: ModeSession,
  getScrollElapsedMs: () => number,
  beforeLives?: number,
  report?: LifeLossReport,
  context?: SessionApplyContext,
): void {
  const elapsed = getScrollElapsedMs();
  const profile = getEndlessScrollProfile(elapsed);
  const depth = next.scrollRowCount ?? 0;
  const seed = next.state.board.worldSeed ?? 'n/a';
  const interval = profile ? `${(profile.intervalMs / 1000).toFixed(1)}s` : 'n/a';
  const batch = profile ? `×${profile.batchRows}` : 'n/a';
  const before = beforeLives ?? 'n/a';
  const after = next.lives ?? 'n/a';

  gameLog.append(
    `死亡复盘：mode=${next.modeId} seed=${seed} ↑${depth} 命 ${before}→${after} interval=${interval} batch=${batch} elapsed=${Math.round(elapsed / 1000)}s`,
    'danger',
  );
  if (context?.trigger) {
    gameLog.append(`复盘触发：${context.trigger}`, 'danger');
  }
  if (report && report.cells.length > 0) {
    const cells = report.cells
      .map((c) => `screen(${c.screenRow},${c.col}) local(${c.localRow},${c.col}) ${c.kind}`)
      .join(' | ');
    gameLog.append(`复盘扣命格：${cells}`, 'danger');
  }

  const board = next.state.board;
  const start = next.endlessViewStart ?? Math.max(0, board.rows - ENDLESS_VISIBLE_ROWS);
  const end = Math.min(board.rows, start + ENDLESS_VISIBLE_ROWS);
  gameLog.append('复盘盘面：X=触发雷 !=触发非雷 *=雷 F=正确旗 f=错旗 ?=未开 .=0', 'danger');
  for (let row = start; row < end; row += 1) {
    const screenRow = row - start;
    const cells = Array.from({ length: board.cols }, (_, col) =>
      debugCellSymbol(next, row, col, report),
    ).join(' ');
    gameLog.append(`r${String(screenRow).padStart(2, '0')} ${cells}`, 'danger');
  }
}

export function logAiMove(
  gameLog: CanvasLogController,
  move: AiMove,
  screenRow: number,
  col: number,
): void {
  if (move.kind === 'heal') {
    gameLog.append(`AI 回血 · ${move.reason}`, 'ai');
    return;
  }
  if (move.kind === 'scroll') {
    gameLog.append(`AI 上移 · ${move.reason}`, 'ai');
    return;
  }
  const prefix = move.confidence === 'guess' ? '猜' : '';
  const kind =
    move.kind === 'chord'
      ? 'Chord'
      : move.kind === 'flag'
        ? '插旗'
        : move.kind === 'unflag'
          ? '撤旗'
          : '开格';
  gameLog.append(`AI ${prefix}${kind} ${formatCell(screenRow, col)} · ${move.reason}`, 'ai');
}

export function logPlayerAction(
  gameLog: CanvasLogController,
  kind: '开格' | '插旗' | 'Chord',
  screenRow: number,
  col: number,
): void {
  gameLog.append(`玩家 ${kind} ${formatCell(screenRow, col)}`, 'player');
}

function logMinesDefusedChange(
  gameLog: CanvasLogController,
  before: number | undefined,
  after: number | undefined,
): void {
  const prev = before ?? 0;
  const next = after ?? 0;
  if (next <= prev) return;
  gameLog.append(`消雷入账 +${next - prev} · 累计 ${next}（${MINES_PER_LIFE}→1 命）`, 'system');
}

function logAutoHeal(runtime: GameSessionRuntime, gameLog: CanvasLogController, next: ModeSession): boolean {
  const report = next.lastAutoHeal;
  if (!report) return false;

  if (report.scoreAdded > 0) {
    runtime.presentation.eventId += 1;
    runtime.presentation.scoreEvent = {
      id: runtime.presentation.eventId,
      scoreAdded: report.scoreAdded,
      comboAfter: report.comboAfter,
    };
  }

  gameLog.append(
    `消雷连击 +${report.defusedAdded} · ×${report.comboAfter} · +${report.scoreAdded} 分 · 总分 ${next.score ?? 0}`,
    'system',
  );
  gameLog.append(`消雷进度 ${report.minesAfter}/${MINES_PER_LIFE}`, 'system');
  const spent = report.groupsSpent * MINES_PER_LIFE;
  if (report.livesGained > 0) {
    gameLog.append(
      `自动回血 +${report.livesGained} 命 · −${spent} 消雷 · 当前 ${report.livesAfter} 命`,
      'system',
    );
  } else {
    gameLog.append(`满命自动结算 · −${spent} 消雷 · 不储存整组回血`, 'system');
  }
  return true;
}

function logDefuseScore(runtime: GameSessionRuntime, gameLog: CanvasLogController, next: ModeSession): boolean {
  const report = next.lastDefuseScore;
  if (!report) return false;
  if (report.scoreAdded > 0) {
    runtime.presentation.eventId += 1;
    runtime.presentation.scoreEvent = {
      id: runtime.presentation.eventId,
      scoreAdded: report.scoreAdded,
      comboAfter: report.comboAfter,
    };
  }
  gameLog.append(
    `消雷连击 +${report.defusedAdded} · ×${report.comboAfter} · +${report.scoreAdded} 分 · 总分 ${report.scoreAfter}`,
    'system',
  );
  gameLog.append(`消雷进度 ${next.minesDefused ?? 0}/${MINES_PER_LIFE}`, 'system');
  return true;
}

function logDefuseBreak(runtime: GameSessionRuntime, gameLog: CanvasLogController, next: ModeSession): void {
  const report = next.lastDefuseBreak;
  if (!report) return;
  runtime.presentation.eventId += 1;
  runtime.presentation.breakEvent = {
    id: runtime.presentation.eventId,
    comboCleared: report.comboCleared,
    minesCleared: report.minesCleared,
  };
  gameLog.append(
    `失误断连 · 消雷 ${report.minesCleared}→0 · 连击 ×${report.comboCleared}→0`,
    'danger',
  );
}

export function applySessionUpdate(deps: SessionApplyDeps, next: ModeSession, beforeLives?: number, context?: SessionApplyContext): void {
  const { runtime, gameLog, getScrollElapsedMs } = deps;
  const prev = runtime.session;

  if (!logAutoHeal(runtime, gameLog, next) && !logDefuseScore(runtime, gameLog, next)) {
    logMinesDefusedChange(gameLog, prev.minesDefused, next.minesDefused);
  }
  logDefuseBreak(runtime, gameLog, next);
  logLifeChange(gameLog, beforeLives, next.lives, next.lastLifeLoss, context);
  if (prev.state.status !== 'lost' && next.state.status === 'lost') {
    appendDeathDebug(gameLog, next, getScrollElapsedMs, beforeLives, next.lastLifeLoss, context);
  }

  runtime.session = {
    ...next,
    lastLifeLoss: undefined,
    lastAutoHeal: undefined,
    lastDefuseScore: undefined,
    lastDefuseBreak: undefined,
  };
}
