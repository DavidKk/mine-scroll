import {
  endlessScrollTick,
  getEndlessScrollPressure,
  getEndlessScrollProfile,
} from '../../core/modes/endless/index.ts';
import type { ModeSession } from '../../core/types.ts';
import type { CanvasLogController, GameSessionRuntime, SessionApplyContext } from './types.ts';

export interface ScrollControllerDeps {
  runtime: GameSessionRuntime;
  gameLog: CanvasLogController;
  applySession(next: ModeSession, beforeLives?: number, context?: SessionApplyContext): void;
  render(): void;
  refreshAiHint(): void;
  stopAiAuto(): void;
}

export interface ScrollController {
  getElapsedMs(): number;
  markGameClockStarted(): void;
  stopScrollTimer(): void;
  performScrollTick(manual: boolean, aiReason?: string): void;
  startScrollTimer(): void;
  getScrollPressureState(): ReturnType<typeof buildScrollPressure> | undefined;
}

function buildScrollPressure(
  runtime: GameSessionRuntime,
  scrollDeadlineAt: number,
  scrollIntervalMs: number,
) {
  const pressure = getEndlessScrollPressure(scrollDeadlineAt, scrollIntervalMs);
  if (!pressure) return undefined;
  return {
    ...pressure,
    batchRows: getEndlessScrollProfile(getScrollElapsedMsFromRuntime(runtime)).batchRows,
  };
}

function getScrollElapsedMsFromRuntime(runtime: GameSessionRuntime): number {
  if (runtime.scrollGameStartedAt <= 0) return 0;
  return Date.now() - runtime.scrollGameStartedAt;
}

export function createScrollController(deps: ScrollControllerDeps): ScrollController {
  const { runtime, gameLog, applySession, render, refreshAiHint, stopAiAuto } = deps;

  function getElapsedMs(): number {
    return getScrollElapsedMsFromRuntime(runtime);
  }

  function markGameClockStarted(): void {
    if (runtime.scrollGameStartedAt <= 0) {
      runtime.scrollGameStartedAt = Date.now();
    }
    if (!runtime.timerStarted) {
      runtime.view?.startTimer();
      runtime.timerStarted = true;
    }
  }

  function stopScrollTimer(): void {
    if (runtime.scrollTimeoutId !== null) {
      window.clearTimeout(runtime.scrollTimeoutId);
      runtime.scrollTimeoutId = null;
    }
    runtime.scrollDeadlineAt = 0;
    runtime.scrollIntervalMs = 0;
  }

  function scheduleNextScroll(): void {
    if (runtime.session.state.status !== 'playing') return;

    const profile = getEndlessScrollProfile(getElapsedMs());
    runtime.scrollIntervalMs = profile.intervalMs;
    runtime.scrollDeadlineAt = Date.now() + profile.intervalMs;
    render();

    runtime.scrollTimeoutId = window.setTimeout(() => {
      runtime.scrollTimeoutId = null;
      if (runtime.session.state.status !== 'playing') return;
      performScrollTick(false);
    }, profile.intervalMs);
  }

  function performScrollTick(manual: boolean, aiReason?: string): void {
    if (runtime.session.state.status !== 'playing') return;

    if (runtime.scrollTimeoutId !== null) {
      window.clearTimeout(runtime.scrollTimeoutId);
      runtime.scrollTimeoutId = null;
    }

    const profile = getEndlessScrollProfile(getElapsedMs());
    const batchRows = profile.batchRows;
    const beforeLives = runtime.session.lives;
    const next = endlessScrollTick(runtime.session, batchRows);
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
      runtime.view?.stopTimer();
      stopScrollTimer();
      stopAiAuto();
      runtime.aiHint = null;
      gameLog.append('失败', 'system');
      render();
      return;
    }

    refreshAiHint();
    scheduleNextScroll();
    render();
  }

  function startScrollTimer(): void {
    if (runtime.scrollTimeoutId !== null) return;
    scheduleNextScroll();
  }

  function getScrollPressureState() {
    if (runtime.session.state.status !== 'playing') return undefined;
    return buildScrollPressure(runtime, runtime.scrollDeadlineAt, runtime.scrollIntervalMs);
  }

  return {
    getElapsedMs,
    markGameClockStarted,
    stopScrollTimer,
    performScrollTick,
    startScrollTimer,
    getScrollPressureState,
  };
}
