import { getModeEntry } from '@shared/core/modes/catalog.ts'
import { visibleViewStart } from '@shared/core/modes/endless/grid.ts'
import {
  ENDLESS_PREVIEW_ROWS,
  endlessBeginRun,
  endlessScreenRowToLocal,
  getEndlessPreviewRows,
  getEndlessScrollProfile,
  isEndlessInteractiveScreenRowForSession,
  sessionVisibleRows,
} from '@shared/core/modes/endless/index.ts'
import { chordAt, createSession, getFlagCount, revealAt, toCellViews, toggleMarkAt } from '@shared/core/modes/engine.ts'
import type { ModeSession } from '@shared/core/types.ts'

import { loadLocalSettings, patchLocalSettings } from '../../config/local-settings.ts'
import { isDev } from '../../env.ts'
import { createRankedInputRecorder } from '../../ranked/input-recorder.ts'
import { createRankedInputUploader } from '../../ranked/input-uploader.ts'
import { isRankedMode } from '../../ranked/is-ranked-mode.ts'
import { createRankedRunOnServer, createRankedSession, finishRankedRunOnServer } from '../../ranked/ranked-run-client.ts'
import { isRankedStorageUnavailableMessage } from '../../ranked/ranked-storage.ts'
import type { RunInputEvent } from '../../ranked/types.ts'
import {
  appendLocalScoreRecord,
  appendRunTraceEvents,
  clearAllRankedAntiCheatData,
  clearLeaderboardUnseenUpdate,
  createRunTrace,
  ensureDisplayName,
  ensurePlayerId,
  ensureRankedLocalStore,
  finalizeRunTrace,
  getCachedDisplayName,
  getCachedLeaderboardUnseenUpdate,
  getCachedPlayerId,
  isLeaderboardScoreBreakthrough,
  markLeaderboardUnseenUpdate,
  persistRunTraceEvents,
  saveDisplayName,
  syncLeaderboardSelfFromHistory,
} from '../../storage/ranked-local-store.ts'
import { createGameAudio, hadMineLifeLoss, playFlagToggleAudio, playHealRewardAudio, playLifeLossAudio, playRevealAudio } from '../../ui/game-audio.ts'
import { createGameCanvas, type GameCanvasController, type GameCanvasHudStats } from '../../ui/game-canvas/index.ts'
import { resolveViewportEndlessVisibleRows } from '../../ui/game-stage-layout.ts'
import { createGameNotificationStack } from '../../ui/notification.ts'
import { createAiController } from './ai-loop.ts'
import { devLog, devWarn } from './dev-log.ts'
import { createGameLogPanel } from './game-log-panel.ts'
import { createLeaderboardPanel } from './leaderboard-panel.ts'
import { applySessionUpdate, createGameLog, formatCell, logPlayerAction } from './logging.ts'
import { createScrollController } from './scroll.ts'
import type { GameSessionCallbacks, GameSessionRuntime } from './types.ts'

function applyViewportEndlessVisibleRows(session: ModeSession, options: { preserveViewStart?: boolean } = {}): ModeSession {
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 390
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 844
  const previewRows = getEndlessPreviewRows(session)
  let visibleRows = resolveViewportEndlessVisibleRows(viewportW, viewportH, previewRows)
  let next: ModeSession = {
    ...session,
    endlessVisibleRows: visibleRows,
    endlessViewStart: options.preserveViewStart
      ? (session.endlessViewStart ?? visibleViewStart(session.state.board, visibleRows))
      : visibleViewStart(session.state.board, visibleRows),
  }
  const refinedPreview = getEndlessPreviewRows(next)
  if (refinedPreview !== previewRows) {
    const refinedRows = resolveViewportEndlessVisibleRows(viewportW, viewportH, refinedPreview)
    if (refinedRows !== visibleRows) {
      visibleRows = refinedRows
      next = {
        ...next,
        endlessVisibleRows: refinedRows,
        endlessViewStart: options.preserveViewStart
          ? (session.endlessViewStart ?? visibleViewStart(next.state.board, refinedRows))
          : visibleViewStart(next.state.board, refinedRows),
      }
    }
  }
  return next
}

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
    leaderboardOpen: false,
    rankedRunId: null,
    rankedFinishStatus: null,
    startOverlayOpen: true,
    view: null,
  }
}

export function mountGameSession(root: HTMLElement, _callbacks: GameSessionCallbacks = { onBack: () => undefined }): () => void {
  const modeMeta = getModeEntry()
  const rankedMode = isRankedMode()
  const rankedStoreReady = ensureRankedLocalStore().then(async () => {
    const name = await ensureDisplayName()
    await saveDisplayName(name)
    await ensurePlayerId()
  })
  const runtime = createInitialRuntime(applyViewportEndlessVisibleRows(createSession()))
  const gameAudio = createGameAudio({ bgmMuted: loadLocalSettings().bgmMuted })
  let tracePersistTimer: number | null = null

  function scheduleRunTracePersist(): void {
    const runId = runtime.rankedRunId
    if (!runId) return
    if (tracePersistTimer !== null) return
    tracePersistTimer = window.setTimeout(() => {
      tracePersistTimer = null
      const activeRunId = runtime.rankedRunId
      if (!activeRunId) return
      void persistRunTraceEvents(activeRunId, rankedRecorder.peek())
    }, 1500)
  }

  const rankedRecorder = createRankedInputRecorder({
    onEvent: () => scheduleRunTracePersist(),
  })
  let rankedUploader = createRankedInputUploader()
  let sessionGeneration = 0

  function syncIdleBgm(): void {
    gameAudio.setIdleBgm(true)
  }

  root.className = rankedMode ? 'app app--ranked' : 'app'
  root.replaceChildren()

  const notify = createGameNotificationStack(root)

  const canvasContainer = document.createElement('div')
  canvasContainer.className = 'app__canvas app__canvas--endless'
  root.append(canvasContainer)

  function render(): void {
    const flagCount = getFlagCount(runtime.session.state)
    const { cols } = runtime.session.state.board
    runtime.view?.render(toCellViews(runtime.session), runtime.session.state.status, flagCount, {
      rows: sessionVisibleRows(runtime.session),
      cols,
      aiHint: runtime.aiHint,
      previewRows: getEndlessPreviewRows(runtime.session),
    })
    logPanel?.sync(runtime.recentLogLines)
  }

  const gameLog = createGameLog(runtime, render)

  let logPanel: ReturnType<typeof createGameLogPanel> | null = null
  if (isDev) {
    logPanel = createGameLogPanel(root, {
      onClear: () => {
        gameLog.clear()
      },
      onClose: () => {
        runtime.logOpen = false
        logPanel?.setOpen(false)
      },
      notify,
    })
  }

  const leaderboardPanel = createLeaderboardPanel(root, {
    isRankedMode: () => rankedMode,
    onClose: () => closeLeaderboard(),
    notify,
  })

  function closeLeaderboard(): void {
    runtime.leaderboardOpen = false
    leaderboardPanel.setOpen(false)
    render()
  }

  async function syncRankedUpload(batch: RunInputEvent[]): Promise<void> {
    if (batch.length === 0) return
    if (runtime.rankedRunId) {
      await appendRunTraceEvents(runtime.rankedRunId, batch)
    }
    rankedUploader.queue(batch)
    await rankedUploader.flush()
  }

  async function autoFinishRankedRun(): Promise<void> {
    if (!rankedMode || !runtime.rankedRunId) return

    const finishGeneration = sessionGeneration
    const runId = runtime.rankedRunId
    const claimedScore = runtime.session.score ?? 0
    const claimedDepth = runtime.session.scrollRowCount ?? 0

    rankedRecorder.stop()
    const capturedEvents = rankedRecorder.drain()
    await syncRankedUpload(capturedEvents)

    if (finishGeneration !== sessionGeneration || runtime.rankedRunId !== runId) return

    await rankedStoreReady
    const name = getCachedDisplayName() || (await ensureDisplayName())
    const playerId = getCachedPlayerId() || (await ensurePlayerId())
    await saveDisplayName(name)

    try {
      runtime.rankedFinishStatus = 'pending'
      const result = await finishRankedRunOnServer(runId, playerId, name, claimedScore, claimedDepth, capturedEvents)
      if (finishGeneration !== sessionGeneration) return

      await finalizeRunTrace(runId, {
        events: capturedEvents,
        finishStatus: result.status === 'accepted' || result.status === 'pending' || result.status === 'rejected' ? result.status : 'rejected',
        claimedScore,
        claimedDepth,
        cheating: result.cheating === true,
      })

      if (result.cheating) {
        await clearAllRankedAntiCheatData()
        notify.error('Verification failed — local scores cleared')
      } else {
        const finalScore = result.score ?? claimedScore
        const finalDepth = result.depth ?? claimedDepth
        const scoreBreakthrough = result.status === 'accepted' && isLeaderboardScoreBreakthrough(finalScore, finalDepth)

        await appendLocalScoreRecord({
          runId,
          score: finalScore,
          depth: finalDepth,
          submittedAt: Date.now(),
          status: result.status === 'accepted' || result.status === 'pending' || result.status === 'rejected' ? result.status : 'rejected',
          ranked: result.ranked === true,
          rank: result.rank,
        })
        await syncLeaderboardSelfFromHistory(playerId, name)
        if (scoreBreakthrough && !runtime.leaderboardOpen) {
          await markLeaderboardUnseenUpdate()
        }
      }

      runtime.rankedFinishStatus = result.status
      if (runtime.leaderboardOpen) {
        void leaderboardPanel.refresh()
      }
    } catch (error) {
      if (finishGeneration !== sessionGeneration) return
      runtime.rankedFinishStatus = 'rejected'
      if (runtime.leaderboardOpen) {
        void leaderboardPanel.refresh()
      }
      devWarn(error instanceof Error ? error.message : 'Ranked verification failed')
    }
    render()
  }

  function handleTerminalGameStatus(status: 'won' | 'lost'): void {
    runtime.view?.stopTimer()
    scroll.stopScrollTimer()
    ai.stopAiAuto()
    runtime.aiHint = null
    gameLog.append(status === 'won' ? 'Victory' : 'Defeat', 'system')
    if (!rankedMode || !runtime.rankedRunId) return
    void autoFinishRankedRun()
  }

  const sessionDeps = {
    runtime,
    gameLog,
    getScrollElapsedMs: () => scroll.getElapsedMs(),
  }

  function applySession(next: ModeSession, beforeLives?: number, context?: Parameters<typeof applySessionUpdate>[3]): void {
    playLifeLossAudio(gameAudio, beforeLives, next)
    playHealRewardAudio(gameAudio, beforeLives, runtime.session, next)
    applySessionUpdate(sessionDeps, next, beforeLives, context)
    syncIdleBgm()
  }

  let scroll!: ReturnType<typeof createScrollController>
  let ai!: ReturnType<typeof createAiController>

  function afterSessionChange(wasIdle = false): void {
    if (wasIdle && runtime.session.state.status === 'playing') {
      scroll.markGameClockStarted()
      scroll.startScrollTimer()
    }
    if (runtime.session.state.status === 'won' || runtime.session.state.status === 'lost') {
      runtime.view?.stopTimer()
      scroll.stopScrollTimer()
      ai.stopAiAuto()
      runtime.aiHint = null
    } else {
      if (!rankedMode) ai.refreshAiHint()
    }
    render()
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
    onTerminalGameStatus: handleTerminalGameStatus,
  })

  ai = createAiController({
    runtime,
    gameLog,
    scroll,
    gameAudio,
    applySession,
    afterSessionChange,
    render,
  })

  function getCanvasHudStats(): GameCanvasHudStats {
    const lives = runtime.session.lives ?? 0
    const maxLives = 5
    const scrollElapsed = runtime.scrollGameStartedAt > 0 ? Date.now() - runtime.scrollGameStartedAt : 0
    const scrollProfile = getEndlessScrollProfile(scrollElapsed)
    const playing = runtime.session.state.status === 'playing'
    return {
      score: runtime.session.score ?? 0,
      combo: runtime.session.defuseCombo ?? 0,
      scoreEvent: runtime.presentation.scoreEvent,
      breakEvent: runtime.presentation.breakEvent,
      lifeLossEvent: runtime.presentation.lifeLossEvent,
      lives: `${'♥'.repeat(lives)}${'♡'.repeat(Math.max(0, maxLives - lives))}`,
      spaceEnabled: playing,
      devAutoVisible: isDev,
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
    }
  }

  function toBoardRow(screenRow: number): number {
    return endlessScreenRowToLocal(runtime.session, screenRow)
  }

  function startArcadeRun(): void {
    void startArcadeRunAsync()
  }

  async function startArcadeRunAsync(): Promise<void> {
    if (runtime.session.state.status !== 'idle') return
    const runGeneration = sessionGeneration
    runtime.startOverlayOpen = false

    if (rankedMode) {
      try {
        const run = await createRankedRunOnServer()
        if (runGeneration !== sessionGeneration) return
        rankedUploader.dispose()
        rankedUploader = createRankedInputUploader(run.uploadIntervalMs)
        runtime.rankedRunId = run.runId
        runtime.rankedFinishStatus = null
        rankedUploader.bindRun(run.runId)
        runtime.session = applyViewportEndlessVisibleRows(createRankedSession(run.seed))
        rankedRecorder.start()
        rankedRecorder.markBegin()
        await createRunTrace(run.runId, run.seed)
        devLog(`Ranked run ${run.runId.slice(0, 8)}…`)
      } catch (error) {
        if (runGeneration !== sessionGeneration) return
        const message = error instanceof Error ? error.message : 'Failed to start ranked run'
        devWarn(message)
        if (!isRankedStorageUnavailableMessage(message)) {
          runtime.startOverlayOpen = true
          notify.error(message)
          render()
          return
        }
        notify.warn('Ranked storage offline — starting local endless run')
      }
    }

    if (runGeneration !== sessionGeneration) return
    const next = endlessBeginRun(runtime.session)
    applySession(next, undefined, { trigger: 'Game run started' })
    scroll.markGameClockStarted()
    scroll.startScrollTimer()
    gameLog.clear()
    gameLog.append(rankedMode ? 'Ranked game started' : 'Game started', 'system')
    if (!rankedMode) ai.refreshAiHint()
    render()
  }

  function restartGame(): void {
    sessionGeneration += 1
    scroll.stopScrollTimer()
    ai.stopAiAuto()
    rankedRecorder.stop()
    rankedUploader.dispose()
    rankedUploader = createRankedInputUploader()
    runtime.view?.destroy()
    runtime.session = applyViewportEndlessVisibleRows(createSession())
    runtime.rankedRunId = null
    runtime.rankedFinishStatus = null
    runtime.scrollGameStartedAt = 0
    runtime.backdropScrollDepth = 0
    runtime.timerStarted = false
    runtime.aiHint = null
    runtime.aiWaitLogged = false
    runtime.aiOscillationCell = null
    runtime.aiOscillationCount = 0
    runtime.presentation = { eventId: 0, scoreEvent: undefined, breakEvent: undefined, lifeLossEvent: undefined }
    runtime.startOverlayOpen = true
    mountCanvas()
    runtime.view?.resetTimer()
    gameLog.clear()
    if (!rankedMode) ai.refreshAiHint()
    syncIdleBgm()
    render()
  }

  function mountCanvas(): GameCanvasController {
    canvasContainer.replaceChildren()
    const { cols } = runtime.session.state.board
    const gridRows = sessionVisibleRows(runtime.session)
    const fullscreenShell = {
      getStats: () => getCanvasHudStats(),
      isLogOpen: () => isDev && runtime.logOpen,
      isLeaderboardOpen: () => runtime.leaderboardOpen,
      hasLeaderboardUnseenUpdate: () => getCachedLeaderboardUnseenUpdate(),
      showStartOverlay: () => runtime.startOverlayOpen && runtime.session.state.status === 'idle',
      onStart: () => startArcadeRun(),
      onRestart: () => restartGame(),
      onDevAuto: () => ai.toggleAiAuto(startArcadeRun),
      onDevSpeedUp: () => {
        if (!scroll.bumpScrollDifficultyForDebug()) return
        devLog('Debug · scroll tier +1')
      },
      onManualScroll: () => {
        if (runtime.session.state.status !== 'playing') return
        gameAudio.unlock()
        if (rankedMode) rankedRecorder.recordSpace()
        scroll.performScrollTick(true)
      },
      onDifficultyAlert: (kind: 'speed-up' | 'danger-rise') => {
        gameAudio.unlock()
        gameAudio.play(kind === 'danger-rise' ? 'lifeWarning' : 'scrollUp')
      },
      onUiHover: (target: string) => {
        if (target === 'start') gameAudio.play('startHover')
        else if (target === 'retry') gameAudio.play('retryHover')
        else gameAudio.play('uiHover')
      },
      onUiClick: () => gameAudio.play('uiClick'),
      onPointerDown: () => gameAudio.unlock(),
      getBgmMuted: () => gameAudio.isIdleBgmMuted(),
      onToggleBgmMute: () => {
        const muted = gameAudio.toggleIdleBgmMuted()
        patchLocalSettings({ bgmMuted: muted })
        syncIdleBgm()
        render()
      },
      onOpenLeaderboard: () => {
        if (runtime.leaderboardOpen) return
        void clearLeaderboardUnseenUpdate().then(() => render())
        runtime.leaderboardOpen = true
        leaderboardPanel.setOpen(true)
        render()
      },
      rankedInput: rankedMode
        ? {
            onLayout(): void {
              if (!rankedRecorder.isActive()) return
              const snapshot = runtime.view?.getRankedLayoutSnapshot?.()
              if (snapshot) rankedRecorder.recordLayout(snapshot)
            },
            onMove(x: number, y: number): void {
              rankedRecorder.recordMove(x, y)
            },
            onDown(btn: 0 | 2, x: number, y: number, buttons?: number): void {
              rankedRecorder.recordDown(btn, x, y, buttons)
            },
            onUp(btn: 0 | 2, x: number, y: number): void {
              rankedRecorder.recordUp(btn, x, y)
            },
            onDoubleClick(x: number, y: number): void {
              rankedRecorder.recordDoubleClick(x, y)
            },
            onContextMenu(x: number, y: number): void {
              rankedRecorder.recordContextMenu(x, y)
            },
          }
        : undefined,
    }
    const controller = createGameCanvas(
      canvasContainer,
      gridRows,
      cols,
      0,
      {
        onReset: () => restartGame(),
        onReveal(row, col) {
          if (runtime.session.state.status !== 'idle' && runtime.session.state.status !== 'playing') return
          if (!isEndlessInteractiveScreenRowForSession(runtime.session, row)) return
          const beforeLives = runtime.session.lives
          const beforeBoard = runtime.session.state.board
          logPlayerAction(gameLog, 'reveal', row, col)
          const next = revealAt(runtime.session, toBoardRow(row), col)
          if (next !== runtime.session && !hadMineLifeLoss(beforeLives, next)) {
            playRevealAudio(gameAudio, beforeBoard, next.state.board)
          }
          applySession(next, beforeLives, { trigger: `Player reveal ${formatCell(row, col)}` })
          if (next.state.status === 'won' || next.state.status === 'lost') {
            handleTerminalGameStatus(next.state.status)
          } else if (!rankedMode) {
            ai.refreshAiHint()
          }
          render()
        },
        onToggleFlag(row, col) {
          if (runtime.session.state.status !== 'idle' && runtime.session.state.status !== 'playing') return
          if (!isEndlessInteractiveScreenRowForSession(runtime.session, row)) return
          const localRow = toBoardRow(row)
          const cell = runtime.session.state.board.cells[localRow]?.[col]
          if (!cell || cell.revealed) return
          const wasFlagged = cell.mark === 'flag'
          logPlayerAction(gameLog, 'flag', row, col)
          const next = toggleMarkAt(runtime.session, localRow, col)
          if (next !== runtime.session) {
            playFlagToggleAudio(gameAudio, !wasFlagged)
          }
          applySession(next)
          if (!rankedMode) ai.refreshAiHint()
          render()
        },
        onChord(row, col) {
          if (runtime.session.state.status !== 'playing') return
          if (!isEndlessInteractiveScreenRowForSession(runtime.session, row)) return
          const beforeLives = runtime.session.lives
          logPlayerAction(gameLog, 'Chord', row, col)
          const next = chordAt(runtime.session, toBoardRow(row), col)
          if (next !== runtime.session && !hadMineLifeLoss(beforeLives, next)) {
            gameAudio.play('chordAction')
          }
          applySession(next, beforeLives, { trigger: `Player Chord ${formatCell(row, col)}` })
          if (next.state.status === 'won' || next.state.status === 'lost') {
            handleTerminalGameStatus(next.state.status)
          } else if (!rankedMode) {
            ai.refreshAiHint()
          }
          render()
        },
      },
      {
        endlessPreviewRows: ENDLESS_PREVIEW_ROWS,
        fitViewport: {
          cols: runtime.session.state.board.cols,
          rows: gridRows,
          maxCellSize: 48,
          minCellSize: 18,
        },
        getScrollPressure: () => scroll.getScrollPressureState(),
        fullscreen: fullscreenShell,
      }
    )
    runtime.view = controller
    return controller
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
      return
    }

    if (event.code === 'Backquote' || event.key === '`') {
      if (!isDev || !logPanel) return
      event.preventDefault()
      runtime.logOpen = !runtime.logOpen
      logPanel.setOpen(runtime.logOpen)
      if (runtime.logOpen) {
        logPanel.sync(runtime.recentLogLines)
      }
      render()
      return
    }

    if (event.key === 'Escape' && runtime.leaderboardOpen) {
      event.preventDefault()
      if (leaderboardPanel.dismissOverlay()) return
      closeLeaderboard()
      return
    }

    if (event.key === 'Escape' && runtime.logOpen && logPanel) {
      event.preventDefault()
      runtime.logOpen = false
      logPanel.setOpen(false)
      render()
      return
    }

    if (event.code === 'Space') {
      if (runtime.logOpen || runtime.leaderboardOpen) return
      if (runtime.session.state.status !== 'playing') return
      event.preventDefault()
      gameAudio.unlock()
      if (rankedMode) rankedRecorder.recordSpace()
      scroll.performScrollTick(true)
      return
    }

    if (event.key.toLowerCase() !== 'a') return
    if (!isDev) return
    event.preventDefault()
    if (event.shiftKey) {
      ai.toggleAiAuto(startArcadeRun)
    } else if (event.metaKey || event.ctrlKey) {
      ai.stopAiAuto()
      ai.runAiStep()
    }
  }

  window.addEventListener('keydown', onKeyDown)

  const onViewportResize = () => {
    const preserveViewStart = runtime.session.state.status === 'playing'
    const next = applyViewportEndlessVisibleRows(runtime.session, { preserveViewStart })
    if (next.endlessVisibleRows === runtime.session.endlessVisibleRows && (preserveViewStart || next.endlessViewStart === runtime.session.endlessViewStart)) {
      return
    }
    runtime.session = next
    render()
  }
  window.addEventListener('resize', onViewportResize)

  function cleanup(): void {
    sessionGeneration += 1
    if (tracePersistTimer !== null) {
      window.clearTimeout(tracePersistTimer)
      tracePersistTimer = null
    }
    scroll.stopScrollTimer()
    ai.stopAiAuto()
    rankedRecorder.stop()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', onViewportResize)
    runtime.view?.destroy()
    gameAudio.destroy()
    logPanel?.dispose()
    leaderboardPanel.dispose()
    notify.dispose()
    rankedUploader.dispose()
  }

  mountCanvas()
  if (!rankedMode) ai.refreshAiHint()
  devLog(`${modeMeta.name}${rankedMode ? ' · ranked' : ''} · ready`)
  syncIdleBgm()
  render()

  return cleanup
}
