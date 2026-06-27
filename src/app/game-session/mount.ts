import {
  chordAt,
  createSession,
  getFlagCount,
  revealAt,
  toggleMarkAt,
  toCellViews,
} from '../../core/modes/engine.ts';
import {
  ENDLESS_PREVIEW_ROWS,
  ENDLESS_VISIBLE_ROWS,
  endlessBeginRun,
  endlessScreenRowToLocal,
  getEndlessPreviewRows,
  getEndlessScrollProfile,
  isEndlessInteractiveScreenRow,
} from '../../core/modes/endless/index.ts';
import { getModeEntry } from '../../core/modes/catalog.ts';
import type { ModeSession } from '../../core/types.ts';
import { createGameCanvas, type GameCanvasController, type GameCanvasHudStats } from '../../ui/game-canvas/index.ts';
import { createGameAudio, hadMineLifeLoss, playFlagToggleAudio, playHealRewardAudio, playLifeLossAudio, playRevealAudio } from '../../ui/game-audio.ts';
import { createAiController } from './ai-loop.ts';
import { applySessionUpdate, createGameLog, formatCell, logPlayerAction } from './logging.ts';
import { createScrollController } from './scroll.ts';
import type { GameSessionCallbacks, GameSessionRuntime } from './types.ts';

function createInitialRuntime(session: ModeSession): GameSessionRuntime {
  return {
    session,
    timerStarted: false,
    scrollGameStartedAt: 0,
    backdropScrollDepth: 0,
    scrollTimeoutId: null,
    scrollDeadlineAt: 0,
    scrollIntervalMs: 0,
    scrollDetonateTimeoutId: null,
    scrollPendingTick: null,
    aiHint: null,
    aiAutoId: null,
    aiAutoActive: false,
    aiWaitLogged: false,
    aiOscillationCell: null,
    aiOscillationCount: 0,
    presentation: {
      eventId: 0,
      scoreEvent: undefined,
      breakEvent: undefined,
      lifeLossEvent: undefined,
    },
    recentLogLines: [],
    logOpen: false,
    startOverlayOpen: true,
    view: null,
  };
}

export function mountGameSession(
  root: HTMLElement,
  _callbacks: GameSessionCallbacks = { onBack: () => undefined },
): () => void {
  const modeMeta = getModeEntry();
  const runtime = createInitialRuntime(createSession());
  const gameAudio = createGameAudio();

  function syncIdleBgm(): void {
    gameAudio.setIdleBgm(runtime.session.state.status === 'idle');
  }

  root.className = 'app';
  root.replaceChildren();

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'app__canvas app__canvas--endless';
  root.append(canvasContainer);

  function render(): void {
    const flagCount = getFlagCount(runtime.session.state);
    const { cols } = runtime.session.state.board;
    runtime.view?.render(toCellViews(runtime.session), runtime.session.state.status, flagCount, {
      rows: ENDLESS_VISIBLE_ROWS,
      cols,
      aiHint: runtime.aiHint,
      previewRows: getEndlessPreviewRows(runtime.session),
    });
  }

  const gameLog = createGameLog(runtime, render);

  const sessionDeps = {
    runtime,
    gameLog,
    getScrollElapsedMs: () => scroll.getElapsedMs(),
  };

  function applySession(
    next: ModeSession,
    beforeLives?: number,
    context?: Parameters<typeof applySessionUpdate>[3],
  ): void {
    playLifeLossAudio(gameAudio, beforeLives, next);
    playHealRewardAudio(gameAudio, beforeLives, runtime.session, next);
    applySessionUpdate(sessionDeps, next, beforeLives, context);
    syncIdleBgm();
  }

  let scroll!: ReturnType<typeof createScrollController>;
  let ai!: ReturnType<typeof createAiController>;

  function afterSessionChange(wasIdle = false): void {
    if (wasIdle && runtime.session.state.status === 'playing') {
      scroll.markGameClockStarted();
      scroll.startScrollTimer();
    }
    if (runtime.session.state.status === 'won' || runtime.session.state.status === 'lost') {
      runtime.view?.stopTimer();
      scroll.stopScrollTimer();
      ai.stopAiAuto();
      runtime.aiHint = null;
    } else {
      ai.refreshAiHint();
    }
    render();
  }

  scroll = createScrollController({
    runtime,
    gameLog,
    applySession,
    render,
    refreshAiHint: () => ai.refreshAiHint(),
    stopAiAuto: () => ai.stopAiAuto(),
    onScrollTick: () => gameAudio.play('scrollUp'),
    queueMineExplosions: (cells) => runtime.view?.queueScrollMineGhosts(cells),
    onScrollMineDetonate: () => gameAudio.play('mineHit'),
  });

  ai = createAiController({
    runtime,
    gameLog,
    scroll,
    gameAudio,
    applySession,
    afterSessionChange,
    render,
  });

  function getCanvasHudStats(): GameCanvasHudStats {
    const lives = runtime.session.lives ?? 0;
    const maxLives = 5;
    const scrollElapsed =
      runtime.scrollGameStartedAt > 0 ? Date.now() - runtime.scrollGameStartedAt : 0;
    const scrollProfile = getEndlessScrollProfile(scrollElapsed);
    const playing = runtime.session.state.status === 'playing';
    return {
      score: runtime.session.score ?? 0,
      combo: runtime.session.defuseCombo ?? 0,
      scoreEvent: runtime.presentation.scoreEvent,
      breakEvent: runtime.presentation.breakEvent,
      lifeLossEvent: runtime.presentation.lifeLossEvent,
      lives: `${'♥'.repeat(lives)}${'♡'.repeat(Math.max(0, maxLives - lives))}`,
      spaceEnabled: playing,
      devAutoVisible: import.meta.env.DEV,
      devAutoActive: runtime.aiAutoActive,
      backdrop: {
        scrollElapsedMs: scrollElapsed,
        scrollDepth: runtime.backdropScrollDepth,
        livesCurrent: lives,
        livesMax: maxLives,
      },
      difficulty: {
        speedTier: scrollProfile.speedTier,
        batchTier: scrollProfile.batchTier,
      },
    };
  }

  function toBoardRow(screenRow: number): number {
    return endlessScreenRowToLocal(runtime.session, screenRow);
  }

  function startArcadeRun(): void {
    if (runtime.session.state.status !== 'idle') return;
    runtime.startOverlayOpen = false;
    const next = endlessBeginRun(runtime.session);
    applySession(next, undefined, { trigger: 'Game run started' });
    scroll.markGameClockStarted();
    scroll.startScrollTimer();
    gameLog.append('Game started', 'system');
    ai.refreshAiHint();
    render();
  }

  function restartGame(): void {
    scroll.stopScrollTimer();
    ai.stopAiAuto();
    runtime.view?.destroy();
    runtime.session = createSession();
    runtime.scrollGameStartedAt = 0;
    runtime.backdropScrollDepth = 0;
    runtime.timerStarted = false;
    runtime.aiHint = null;
    runtime.aiWaitLogged = false;
    runtime.aiOscillationCell = null;
    runtime.aiOscillationCount = 0;
    runtime.presentation = { eventId: 0, scoreEvent: undefined, breakEvent: undefined, lifeLossEvent: undefined };
    runtime.startOverlayOpen = true;
    mountCanvas();
    runtime.view?.resetTimer();
    gameLog.clear();
    gameLog.append('New game', 'system');
    ai.refreshAiHint();
    syncIdleBgm();
    render();
  }

  function mountCanvas(): GameCanvasController {
    canvasContainer.replaceChildren();
    const { cols } = runtime.session.state.board;
    const gridRows = ENDLESS_VISIBLE_ROWS;
    const fullscreenShell = {
      getStats: () => getCanvasHudStats(),
      getRecentLogs: () => runtime.recentLogLines,
      isLogOpen: () => runtime.logOpen,
      showStartOverlay: () => runtime.startOverlayOpen && runtime.session.state.status === 'idle',
      onStart: () => startArcadeRun(),
      onRestart: () => restartGame(),
      onDevAuto: () => ai.toggleAiAuto(startArcadeRun),
      onDevSpeedUp: () => {
        if (!scroll.bumpScrollDifficultyForDebug()) return;
        gameLog.append('Debug · scroll tier +1', 'system');
      },
      onManualScroll: () => {
        if (runtime.session.state.status !== 'playing') return;
        gameAudio.unlock();
        scroll.performScrollTick(true);
      },
      onDifficultyAlert: (kind: 'speed-up' | 'danger-rise') => {
        gameAudio.unlock();
        gameAudio.play(kind === 'danger-rise' ? 'lifeWarning' : 'scrollUp');
      },
      onUiHover: (target: string) => {
        if (target === 'start') gameAudio.play('startHover');
        else if (target === 'retry') gameAudio.play('retryHover');
        else gameAudio.play('uiHover');
      },
      onUiClick: () => gameAudio.play('uiClick'),
      onPointerDown: () => gameAudio.unlock(),
      getBgmMuted: () => gameAudio.isIdleBgmMuted(),
      onToggleBgmMute: () => {
        gameAudio.toggleIdleBgmMuted();
        syncIdleBgm();
        render();
      },
    };
    const controller = createGameCanvas(
      canvasContainer,
      gridRows,
      cols,
      0,
      {
        onReset: () => restartGame(),
        onReveal(row, col) {
          if (runtime.session.state.status !== 'idle' && runtime.session.state.status !== 'playing') return;
          if (!isEndlessInteractiveScreenRow(row)) return;
          const beforeLives = runtime.session.lives;
          const beforeBoard = runtime.session.state.board;
          logPlayerAction(gameLog, 'reveal', row, col);
          const next = revealAt(runtime.session, toBoardRow(row), col);
          if (next !== runtime.session && !hadMineLifeLoss(beforeLives, next)) {
            playRevealAudio(gameAudio, beforeBoard, next.state.board);
          }
          applySession(next, beforeLives, { trigger: `Player reveal ${formatCell(row, col)}` });
          if (next.state.status === 'won' || next.state.status === 'lost') {
            runtime.view?.stopTimer();
            scroll.stopScrollTimer();
            gameLog.append(next.state.status === 'won' ? 'Victory' : 'Defeat', 'system');
          } else {
            ai.refreshAiHint();
          }
          render();
        },
        onToggleFlag(row, col) {
          if (runtime.session.state.status !== 'idle' && runtime.session.state.status !== 'playing') return;
          if (!isEndlessInteractiveScreenRow(row)) return;
          const localRow = toBoardRow(row);
          const cell = runtime.session.state.board.cells[localRow]?.[col];
          if (!cell || cell.revealed) return;
          const wasFlagged = cell.mark === 'flag';
          logPlayerAction(gameLog, 'flag', row, col);
          const next = toggleMarkAt(runtime.session, localRow, col);
          if (next !== runtime.session) {
            playFlagToggleAudio(gameAudio, !wasFlagged);
          }
          applySession(next);
          ai.refreshAiHint();
          render();
        },
        onChord(row, col) {
          if (runtime.session.state.status !== 'playing') return;
          if (!isEndlessInteractiveScreenRow(row)) return;
          const beforeLives = runtime.session.lives;
          logPlayerAction(gameLog, 'Chord', row, col);
          const next = chordAt(runtime.session, toBoardRow(row), col);
          if (next !== runtime.session && !hadMineLifeLoss(beforeLives, next)) {
            gameAudio.play('chordAction');
          }
          applySession(next, beforeLives, { trigger: `Player Chord ${formatCell(row, col)}` });
          if (next.state.status === 'won' || next.state.status === 'lost') {
            runtime.view?.stopTimer();
            scroll.stopScrollTimer();
            gameLog.append(next.state.status === 'won' ? 'Victory' : 'Defeat', 'system');
          } else {
            ai.refreshAiHint();
          }
          render();
        },
      },
      {
        fixedGridRows: ENDLESS_VISIBLE_ROWS,
        endlessPreviewRows: ENDLESS_PREVIEW_ROWS,
        fitViewport: {
          cols: runtime.session.state.board.cols,
          rows: ENDLESS_VISIBLE_ROWS,
          maxCellSize: 40,
          minCellSize: 18,
        },
        getScrollPressure: () => scroll.getScrollPressureState(),
        fullscreen: fullscreenShell,
      },
    );
    runtime.view = controller;
    return controller;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    if (event.code === 'Backquote' || event.key === '`') {
      event.preventDefault();
      runtime.logOpen = !runtime.logOpen;
      render();
      return;
    }

    if (event.key === 'Escape' && runtime.logOpen) {
      event.preventDefault();
      runtime.logOpen = false;
      render();
      return;
    }

    if (event.code === 'Space') {
      if (runtime.logOpen) return;
      if (runtime.session.state.status !== 'playing') return;
      event.preventDefault();
      gameAudio.unlock();
      scroll.performScrollTick(true);
      return;
    }

    if (event.key.toLowerCase() !== 'a') return;
    if (!import.meta.env.DEV) return;
    event.preventDefault();
    if (event.shiftKey) {
      ai.toggleAiAuto(startArcadeRun);
    } else if (event.metaKey || event.ctrlKey) {
      ai.stopAiAuto();
      ai.runAiStep();
    }
  }

  window.addEventListener('keydown', onKeyDown);

  function cleanup(): void {
    scroll.stopScrollTimer();
    ai.stopAiAuto();
    window.removeEventListener('keydown', onKeyDown);
    runtime.view?.destroy();
    gameAudio.destroy();
  }

  mountCanvas();
  ai.refreshAiHint();
  gameLog.append(`${modeMeta.name} · ready`, 'system');
  syncIdleBgm();
  render();

  return cleanup;
}
