import { loadGameConfig, saveGameConfig } from '../config/game-config.ts';
import { aiPersistCellKey, isAiPersistBlocked } from '../core/ai/ai-blocked.ts';
import {
  applyAiMove,
  canExchangeHeal,
  chordAt,
  createSession,
  exchangeMinesForLife,
  getAiAnalysis,
  getFlagCount,
  getHudDefusedDisplay,
  getHudLeftDisplay,
  getSessionHudExtra,
  MINES_PER_LIFE,
  revealAt,
  toAiHintDisplay,
  toCellViews,
  toggleMarkAt,
} from '../core/modes/engine.ts';
import {
  ENDLESS_VISIBLE_ROWS,
  endlessScreenRowToLocal,
  endlessScrollTick,
  formatEndlessScrollBadge,
  getEndlessScrollProfile,
  getEndlessScrollPressure,
} from '../core/modes/endless.ts';
import { getModeEntry } from '../core/modes/catalog.ts';
import type { GameModeId, LifeLossReport, ModeSession } from '../core/types.ts';
import type { AiHintDisplay, AiMove } from '../core/ai/types.ts';
import { getEndlessAiStepMs } from '../core/ai/solver.ts';
import { createGameCanvas, type GameCanvasController } from '../ui/game-canvas.ts';
import { createGameLog, type GameLogController } from '../ui/game-log.ts';
import { DEFAULT_CELL_SIZE } from '../ui/theme.ts';
import { createSettingsPanel, type SettingsPanelController } from '../ui/settings-panel.ts';

export interface GameSessionCallbacks {
  onBack(): void;
}

export function mountGameSession(
  root: HTMLElement,
  modeId: GameModeId,
  callbacks: GameSessionCallbacks,
): () => void {
  const modeMeta = getModeEntry(modeId);
  const isEndless = modeId === 'endless';
  let difficulty = loadGameConfig();
  let session: ModeSession = createSession(modeId, difficulty);
  let timerStarted = false;
  let scrollTimeoutId: number | null = null;
  let scrollDeadlineAt = 0;
  let scrollIntervalMs = 0;
  let scrollGameStartedAt = 0;
  let aiHint: AiHintDisplay | null = null;
  let aiAutoId: number | null = null;
  let aiAutoActive = false;
  let aiStatusText = '';
  let aiWaitLogged = false;
  let aiOscillationCell: string | null = null;
  let aiOscillationCount = 0;

  root.className = 'app';
  root.replaceChildren();

  const topBar = document.createElement('div');
  topBar.className = 'app__top';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'app__back';
  backBtn.textContent = '← 模式选择';
  backBtn.addEventListener('click', () => {
    cleanup();
    callbacks.onBack();
  });

  const title = document.createElement('h1');
  title.className = 'app__title';
  title.textContent = modeMeta.name;

  const badge = document.createElement('p');
  badge.className = 'app__badge';

  const aiBar = document.createElement('div');
  aiBar.className = 'app__ai-bar';

  const hintBtn = document.createElement('button');
  hintBtn.type = 'button';
  hintBtn.className = 'app__ai-btn';
  hintBtn.textContent = '提示';
  hintBtn.title = '显示 AI 建议（快捷键 A）';

  const stepBtn = document.createElement('button');
  stepBtn.type = 'button';
  stepBtn.className = 'app__ai-btn app__ai-btn--primary';
  stepBtn.textContent = '走一步';
  stepBtn.title = 'AI 执行一步';

  const autoBtn = document.createElement('button');
  autoBtn.type = 'button';
  autoBtn.className = 'app__ai-btn';
  autoBtn.textContent = '自动';
  autoBtn.title = 'AI 连续自动下棋';

  const scrollBtn = document.createElement('button');
  scrollBtn.type = 'button';
  scrollBtn.className = 'app__ai-btn app__ai-btn--scroll';
  scrollBtn.textContent = '空格上移';
  scrollBtn.title = '按空格或点击按钮：立即消费底部行数（跟当前批量档 ×N）并重置倒数';
  scrollBtn.hidden = !isEndless;

  const healBtn = document.createElement('button');
  healBtn.type = 'button';
  healBtn.className = 'app__ai-btn app__ai-btn--heal';
  healBtn.textContent = '自动回血';
  healBtn.title = `每 ${MINES_PER_LIFE} 个消雷自动恢复 1 命；满命时不储存整组回血`;
  healBtn.hidden = true;

  const aiStatus = document.createElement('span');
  aiStatus.className = 'app__ai-status';

  aiBar.append(hintBtn, stepBtn, autoBtn, scrollBtn, healBtn, aiStatus);

  topBar.append(backBtn, title, badge);

  const settingsContainer = document.createElement('div');

  const canvasContainer = document.createElement('div');
  canvasContainer.className = isEndless ? 'app__canvas app__canvas--endless' : 'app__canvas';

  const logContainer = document.createElement('div');
  logContainer.className = 'app__log';

  root.append(topBar, aiBar, settingsContainer, canvasContainer, logContainer);

  const gameLog: GameLogController = createGameLog(logContainer);

  let view: GameCanvasController = mountCanvas();
  let settings: SettingsPanelController | null = null;

  if (!modeMeta.hideSettings) {
    settings = createSettingsPanel(settingsContainer, difficulty, {
      onApply(next) {
        difficulty = next;
        saveGameConfig(difficulty);
        settings?.setDifficulty(difficulty);
        restartGame();
      },
    });
  } else {
    settingsContainer.hidden = true;
  }

  function formatCell(row: number, col: number): string {
    return `(${row},${col})`;
  }

  interface SessionApplyContext {
    trigger?: string;
  }

  function logLifeLoss(
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

  function logLifeChange(
    before: number | undefined,
    after: number | undefined,
    report?: LifeLossReport,
    context?: SessionApplyContext,
  ): void {
    if (before === undefined || after === undefined || after >= before) return;
    logLifeLoss(before, after, report, context);
  }

  function debugCellSymbol(next: ModeSession, row: number, col: number, report?: LifeLossReport): string {
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
    next: ModeSession,
    beforeLives?: number,
    report?: LifeLossReport,
    context?: SessionApplyContext,
  ): void {
    const elapsed = getScrollElapsedMs();
    const profile = isEndless ? getEndlessScrollProfile(elapsed) : null;
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
    const start = isEndless ? (next.endlessViewStart ?? Math.max(0, board.rows - ENDLESS_VISIBLE_ROWS)) : 0;
    const end = isEndless ? Math.min(board.rows, start + ENDLESS_VISIBLE_ROWS) : board.rows;
    gameLog.append('复盘盘面：X=触发雷 !=触发非雷 *=雷 F=正确旗 f=错旗 ?=未开 .=0', 'danger');
    for (let row = start; row < end; row += 1) {
      const screenRow = isEndless ? row - start : row;
      const cells = Array.from({ length: board.cols }, (_, col) =>
        debugCellSymbol(next, row, col, report),
      ).join(' ');
      gameLog.append(`r${String(screenRow).padStart(2, '0')} ${cells}`, 'danger');
    }
  }

  function logAiMove(move: AiMove, screenRow: number, col: number): void {
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

  function logPlayerAction(kind: '开格' | '插旗' | 'Chord', screenRow: number, col: number): void {
    gameLog.append(`玩家 ${kind} ${formatCell(screenRow, col)}`, 'player');
  }

  function logMinesDefusedChange(before: number | undefined, after: number | undefined): void {
    const prev = before ?? 0;
    const next = after ?? 0;
    if (next <= prev) return;
    gameLog.append(`消雷入账 +${next - prev} · 累计 ${next}（${MINES_PER_LIFE}→1 命）`, 'system');
  }

  function logAutoHeal(next: ModeSession): boolean {
    const report = next.lastAutoHeal;
    if (!report) return false;

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
      gameLog.append(
        `满命自动结算 · −${spent} 消雷 · 不储存整组回血`,
        'system',
      );
    }
    return true;
  }

  function logDefuseScore(next: ModeSession): boolean {
    const report = next.lastDefuseScore;
    if (!report) return false;
    gameLog.append(
      `消雷连击 +${report.defusedAdded} · ×${report.comboAfter} · +${report.scoreAdded} 分 · 总分 ${report.scoreAfter}`,
      'system',
    );
    gameLog.append(`消雷进度 ${next.minesDefused ?? 0}/${MINES_PER_LIFE}`, 'system');
    return true;
  }

  function logDefuseBreak(next: ModeSession): void {
    const report = next.lastDefuseBreak;
    if (!report) return;
    gameLog.append(
      `失误断连 · 消雷 ${report.minesCleared}→0 · 连击 ×${report.comboCleared}→0`,
      'danger',
    );
  }

  function applySession(
    next: ModeSession,
    beforeLives?: number,
    context?: SessionApplyContext,
  ): void {
    if (!logAutoHeal(next) && !logDefuseScore(next)) {
      logMinesDefusedChange(session.minesDefused, next.minesDefused);
    }
    logDefuseBreak(next);
    logLifeChange(beforeLives, next.lives, next.lastLifeLoss, context);
    if (session.state.status !== 'lost' && next.state.status === 'lost') {
      appendDeathDebug(next, beforeLives, next.lastLifeLoss, context);
    }
    session = {
      ...next,
      lastLifeLoss: undefined,
      lastAutoHeal: undefined,
      lastDefuseScore: undefined,
      lastDefuseBreak: undefined,
    };
  }

  function stopAiAuto(): void {
    aiAutoActive = false;
    if (aiAutoId !== null) {
      window.clearTimeout(aiAutoId);
      aiAutoId = null;
    }
    autoBtn.classList.remove('app__ai-btn--active');
  }

  function getScrollElapsedMs(): number {
    if (scrollGameStartedAt <= 0) return 0;
    return Date.now() - scrollGameStartedAt;
  }

  function markGameClockStarted(): void {
    if (scrollGameStartedAt <= 0) {
      scrollGameStartedAt = Date.now();
    }
    if (!timerStarted) {
      view.startTimer();
      timerStarted = true;
    }
  }

  function scheduleAiStep(): void {
    if (!aiAutoActive) return;
    let delay = isEndless ? getEndlessAiStepMs(session, getScrollElapsedMs()) : 550;
    if (isEndless && getScrollPressureState()?.urgent) delay = 0;
    aiAutoId = window.setTimeout(() => {
      aiAutoId = null;
      if (!aiAutoActive) return;
      if (!runAiStep()) {
        stopAiAuto();
        return;
      }
      scheduleAiStep();
    }, delay);
  }

  function refreshAiHint(): void {
    const analysis = getAiAnalysis(session, getScrollElapsedMs());
    aiHint = toAiHintDisplay(session, analysis);
    if (analysis.move) {
      const prefix = analysis.move.confidence === 'guess' ? '猜' : '';
      const kindLabel =
        analysis.move.kind === 'heal'
          ? '回血'
          : analysis.move.kind === 'scroll'
            ? '上移'
            : analysis.move.kind === 'chord'
            ? 'Chord'
            : analysis.move.kind === 'flag'
              ? '插旗'
              : analysis.move.kind === 'unflag'
                ? '撤旗'
                : '开格';
      aiStatusText = `${prefix}${kindLabel} · ${analysis.move.reason}`;
    } else {
      aiStatusText =
        aiAutoActive
          ? '等待中…'
          : session.state.status === 'won'
            ? '已胜利'
            : '无可用步';
    }
    aiStatus.textContent = aiStatusText;
  }

  function afterSessionChange(wasIdle = false): void {
    if (wasIdle && session.state.status === 'playing') {
      markGameClockStarted();
      startScrollTimer();
    }
    if (session.state.status === 'won' || session.state.status === 'lost') {
      view.stopTimer();
      stopScrollTimer();
      stopAiAuto();
      aiHint = null;
    } else {
      refreshAiHint();
    }
    render();
  }

  function runAiStep(): boolean {
    if (session.state.status === 'won' || session.state.status === 'lost') return false;
    const beforeLives = session.lives;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const analysis = getAiAnalysis(session, getScrollElapsedMs());
      if (!analysis.move) {
        if (!aiWaitLogged && attempt === 0) {
          gameLog.append('AI 等待：暂无可用步', 'ai');
          aiWaitLogged = true;
        }
        refreshAiHint();
        render();
        return true;
      }

      const move = analysis.move;

      if (move.kind === 'heal') {
        aiWaitLogged = false;
        const beforeMines = session.minesDefused ?? 0;
        logAiMove(move, 0, 0);
        const next = applyAiMove(session, move);
        applySession(next, beforeLives);
        const afterMines = next.minesDefused ?? 0;
        if (afterMines < beforeMines) {
          gameLog.append(
            `−${MINES_PER_LIFE} 消雷 · 累计 ${afterMines}（${MINES_PER_LIFE}→1 命）`,
            'system',
          );
        }
        if ((next.lives ?? 0) > (beforeLives ?? 0)) {
          gameLog.append(`+1 命 · 当前 ${next.lives ?? 0} 命`, 'system');
        }
        afterSessionChange(false);
        return session.state.status === 'playing';
      }

      if (move.kind === 'scroll') {
        aiWaitLogged = false;
        logAiMove(move, 0, 0);
        performScrollTick(true, move.reason);
        return session.state.status === 'playing';
      }

      const cellKeyStr = aiPersistCellKey(session.state.board, move.row, move.col);

      if (move.kind === 'flag' || move.kind === 'unflag') {
        if (isAiPersistBlocked(session, move.row, move.col)) {
          continue;
        }
        if (aiOscillationCell === cellKeyStr) {
          aiOscillationCount += 1;
        } else {
          aiOscillationCell = cellKeyStr;
          aiOscillationCount = 1;
        }
        if (aiOscillationCount >= 3) {
          const blocked = new Set(session.aiOscillationBlocked ?? []);
          if (!blocked.has(cellKeyStr)) {
            blocked.add(cellKeyStr);
            session = { ...session, aiOscillationBlocked: [...blocked] };
            const screenRow =
              session.modeId === 'endless'
                ? move.row - (session.endlessViewStart ?? 0)
                : move.row;
            gameLog.append(
              `AI 跳过震荡格 ${formatCell(screenRow, move.col)} · 改走其他步`,
              'ai',
            );
          }
          aiOscillationCell = null;
          aiOscillationCount = 0;
          continue;
        }
      } else {
        aiOscillationCell = null;
        aiOscillationCount = 0;
      }

      aiWaitLogged = false;
      const wasIdle = session.state.status === 'idle';
      const screenRow =
        session.modeId === 'endless'
          ? move.row - (session.endlessViewStart ?? 0)
          : move.row;
      logAiMove(move, screenRow, move.col);
      const triggerPrefix = move.confidence === 'guess' ? '猜' : '';
      const triggerKind =
        move.kind === 'chord'
          ? 'Chord'
          : move.kind === 'flag'
            ? '插旗'
            : move.kind === 'unflag'
              ? '撤旗'
              : '开格';
      const trigger = `AI ${triggerPrefix}${triggerKind} ${formatCell(screenRow, move.col)} · ${move.reason}`;
      let next = applyAiMove(session, move);
      if (
        move.kind === 'unflag' &&
        (move.reason.includes('矛盾') || move.reason.includes('错旗'))
      ) {
        const k = aiPersistCellKey(next.state.board, move.row, move.col);
        const contradicted = new Set(next.aiContradictedFlags ?? []);
        contradicted.add(k);
        next = { ...next, aiContradictedFlags: [...contradicted] };
      }
      applySession(next, beforeLives, { trigger });
      afterSessionChange(wasIdle);
      return session.state.status === 'playing' || session.state.status === 'idle';
    }

    refreshAiHint();
    render();
    return true;
  }

  hintBtn.addEventListener('click', () => {
    refreshAiHint();
    render();
  });

  stepBtn.addEventListener('click', () => {
    stopAiAuto();
    runAiStep();
  });

  autoBtn.addEventListener('click', () => {
    if (aiAutoActive) {
      stopAiAuto();
      gameLog.append('AI 自动停止', 'ai');
      return;
    }
    aiAutoActive = true;
    autoBtn.classList.add('app__ai-btn--active');
    aiWaitLogged = false;
    gameLog.append('AI 自动开始', 'ai');
    scheduleAiStep();
  });

  function onKeyDown(event: KeyboardEvent): void {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    if (isEndless && (event.code === 'Space' || event.key === ' ') && !event.repeat) {
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      performScrollTick(true);
      return;
    }

    if (event.key.toLowerCase() !== 'a') return;
    event.preventDefault();
    if (event.shiftKey) {
      autoBtn.click();
    } else if (event.metaKey || event.ctrlKey) {
      stopAiAuto();
      runAiStep();
    } else {
      refreshAiHint();
      render();
    }
  }

  window.addEventListener('keydown', onKeyDown);

  function stopScrollTimer(): void {
    if (scrollTimeoutId !== null) {
      window.clearTimeout(scrollTimeoutId);
      scrollTimeoutId = null;
    }
    scrollDeadlineAt = 0;
    scrollIntervalMs = 0;
  }

  function performScrollTick(manual: boolean, aiReason?: string): void {
    if (!isEndless || session.state.status !== 'playing') return;

    if (scrollTimeoutId !== null) {
      window.clearTimeout(scrollTimeoutId);
      scrollTimeoutId = null;
    }

    const profile = getEndlessScrollProfile(getScrollElapsedMs());
    const batchRows = profile.batchRows;
    const beforeLives = session.lives;
    const next = endlessScrollTick(session, batchRows);
    const depthAfter = next.scrollRowCount ?? 0;
    const batchNote = batchRows > 1 ? ` · ×${batchRows} 行` : '';
    const trigger = manual
      ? aiReason
        ? `AI 手动上移 ↑${depthAfter}${batchNote} · ${aiReason}`
        : `玩家 手动上移 ↑${depthAfter}${batchNote}`
      : `卷轴上移 ↑${depthAfter}${batchNote}`;
    applySession(next, beforeLives, { trigger });
    if (manual) {
      gameLog.append(
        aiReason
          ? `AI 上移 ↑${depthAfter}${batchNote} · ${aiReason}`
          : `手动上移 ↑${depthAfter}${batchNote}`,
        'scroll',
      );
    } else {
      gameLog.append(`卷轴上移 ↑${depthAfter}${batchNote}`, 'scroll');
    }

    if (next.state.status === 'lost') {
      view.stopTimer();
      stopScrollTimer();
      stopAiAuto();
      aiHint = null;
      gameLog.append('失败', 'system');
      render();
      return;
    }

    refreshAiHint();
    scheduleNextScroll();
    render();
  }

  function scheduleNextScroll(): void {
    if (!isEndless || session.state.status !== 'playing') return;

    const profile = getEndlessScrollProfile(getScrollElapsedMs());
    scrollIntervalMs = profile.intervalMs;
    scrollDeadlineAt = Date.now() + profile.intervalMs;
    render();

    scrollTimeoutId = window.setTimeout(() => {
      scrollTimeoutId = null;
      if (session.state.status !== 'playing') return;
      performScrollTick(false);
    }, profile.intervalMs);
  }

  scrollBtn.addEventListener('click', () => {
    if (session.state.status !== 'playing') return;
    performScrollTick(true);
  });

  healBtn.addEventListener('click', () => {
    if (!canExchangeHeal(session)) return;
    const beforeLives = session.lives;
    const next = exchangeMinesForLife(session);
    session = next;
    gameLog.append(
      `回血 · −${MINES_PER_LIFE} 消雷 · 剩余 ${next.lives ?? 0} 命 · 消雷 ${next.minesDefused ?? 0}`,
      'system',
    );
    if (beforeLives !== next.lives) {
      gameLog.append(`+1 命 · 当前 ${next.lives ?? 0} 命`, 'system');
    }
    refreshAiHint();
    render();
  });

  function startScrollTimer(): void {
    if (!isEndless || scrollTimeoutId !== null) return;
    scheduleNextScroll();
  }

  function getScrollCountdownDisplay(): string | undefined {
    if (!isEndless || session.state.status !== 'playing' || scrollDeadlineAt <= 0) {
      return undefined;
    }
    const pressure = getEndlessScrollPressure(scrollDeadlineAt, scrollIntervalMs);
    if (!pressure) return undefined;
    const batchRows = getEndlessScrollProfile(getScrollElapsedMs()).batchRows;
    const batchNote = batchRows > 1 ? `×${batchRows}` : '';
    return `↑${String(pressure.seconds).padStart(2, '0')}${batchNote}`;
  }

  function getScrollPressureState() {
    if (!isEndless || session.state.status !== 'playing') return undefined;
    const pressure = getEndlessScrollPressure(scrollDeadlineAt, scrollIntervalMs);
    if (!pressure) return undefined;
    return {
      ...pressure,
      batchRows: getEndlessScrollProfile(getScrollElapsedMs()).batchRows,
    };
  }

  function toBoardRow(screenRow: number): number {
    return isEndless ? endlessScreenRowToLocal(session, screenRow) : screenRow;
  }

  function mountCanvas(): GameCanvasController {
    canvasContainer.replaceChildren();
    const { cols, mineCount, hexRadius } = session.state.board;
    const gridRows = isEndless ? ENDLESS_VISIBLE_ROWS : session.state.board.rows;
    return createGameCanvas(
      canvasContainer,
      gridRows,
      cols,
      isEndless ? 0 : mineCount,
      {
        onReset: () => restartGame(),
        onReveal(row, col) {
          if (session.state.status !== 'idle' && session.state.status !== 'playing') return;
          const wasIdle = session.state.status === 'idle';
          const beforeLives = session.lives;
          logPlayerAction('开格', row, col);
          const next = revealAt(session, toBoardRow(row), col);
          applySession(next, beforeLives, { trigger: `玩家 开格 ${formatCell(row, col)}` });
          if (wasIdle && next.state.status === 'playing') {
            gameLog.append('对局开始', 'system');
            markGameClockStarted();
            startScrollTimer();
          }
          if (next.state.status === 'won' || next.state.status === 'lost') {
            view.stopTimer();
            stopScrollTimer();
            gameLog.append(next.state.status === 'won' ? '胜利' : '失败', 'system');
          } else {
            refreshAiHint();
          }
          render();
        },
        onToggleFlag(row, col) {
          if (session.state.status !== 'idle' && session.state.status !== 'playing') return;
          logPlayerAction('插旗', row, col);
          applySession(toggleMarkAt(session, toBoardRow(row), col));
          refreshAiHint();
          render();
        },
        onChord(row, col) {
          if (session.state.status !== 'playing') return;
          const beforeLives = session.lives;
          logPlayerAction('Chord', row, col);
          const next = chordAt(session, toBoardRow(row), col);
          applySession(next, beforeLives, { trigger: `玩家 Chord ${formatCell(row, col)}` });
          if (next.state.status === 'won' || next.state.status === 'lost') {
            view.stopTimer();
            stopScrollTimer();
            gameLog.append(next.state.status === 'won' ? '胜利' : '失败', 'system');
          } else {
            refreshAiHint();
          }
          render();
        },
      },
      modeId === 'hex'
        ? { hexRadius: hexRadius ?? session.state.board.hexRadius }
        : isEndless
          ? {
              fixedCellSize: DEFAULT_CELL_SIZE,
              fixedGridRows: ENDLESS_VISIBLE_ROWS,
              getHudRightDisplay: () => getScrollCountdownDisplay(),
              getScrollPressure: () => getScrollPressureState(),
            }
          : {},
    );
  }

  function restartGame(): void {
    stopScrollTimer();
    stopAiAuto();
    view.destroy();
    session = createSession(modeId, difficulty);
    scrollGameStartedAt = 0;
    timerStarted = false;
    aiHint = null;
    aiWaitLogged = false;
    aiOscillationCell = null;
    aiOscillationCount = 0;
    view = mountCanvas();
    view.resetTimer();
    gameLog.clear();
    gameLog.append('新局', 'system');
    refreshAiHint();
    render();
  }

  function render(): void {
    const hudExtra = getSessionHudExtra(session);
    if (isEndless && session.state.status === 'playing' && scrollGameStartedAt > 0) {
      badge.textContent = `${hudExtra} · ${formatEndlessScrollBadge(getEndlessScrollProfile(getScrollElapsedMs()))}`;
    } else {
      badge.textContent = hudExtra;
    }
    if (isEndless) {
      scrollBtn.disabled = session.state.status !== 'playing';
      healBtn.disabled = !canExchangeHeal(session);
      const banked = session.minesDefused ?? 0;
      healBtn.textContent =
        banked >= MINES_PER_LIFE ? `回血(${MINES_PER_LIFE})` : `回血(${banked}/${MINES_PER_LIFE})`;
    }
    const flagCount = getFlagCount(session.state);
    const { cols } = session.state.board;
    view.render(toCellViews(session), session.state.status, flagCount, {
      hudLeftDisplay: getHudLeftDisplay(session, flagCount),
      hudDefusedDisplay: getHudDefusedDisplay(session),
      hudRightDisplay: getScrollCountdownDisplay(),
      rows: isEndless ? ENDLESS_VISIBLE_ROWS : session.state.board.rows,
      cols,
      aiHint,
    });
  }

  function cleanup(): void {
    stopScrollTimer();
    stopAiAuto();
    window.removeEventListener('keydown', onKeyDown);
    view.destroy();
  }

  refreshAiHint();
  gameLog.append(`${modeMeta.name} · 就绪`, 'system');
  render();

  return cleanup;
}
