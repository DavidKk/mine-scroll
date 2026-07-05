import { getEndlessAiStepMs } from '@shared/core/ai/solver.ts'
import type { AiMove } from '@shared/core/ai/types.ts'
import { visibleViewStart } from '@shared/core/modes/endless/grid.ts'
import { getEndlessPreviewRows, getEndlessScrollProfileForSession, resolveScrollBatchRowsForSession, sessionVisibleRows } from '@shared/core/modes/endless/index.ts'
import { getFlagCount, toCellViews } from '@shared/core/modes/engine.ts'
import type { ModeSession } from '@shared/core/types.ts'

import { LANDING_AUDIO_UNLOCK_EVENT, loadLocalSettings, LOCAL_SETTINGS_CHANGE_EVENT, type LocalSettings } from '../../config/local-settings.ts'
import { createRankedSession } from '../../ranked/ranked-run-client.ts'
import { preloadLandingAudio } from '../../ui/boot/preload-audio.ts'
import type { GameAudioController } from '../../ui/game-audio.ts'
import { createGameAudio, playFlagToggleAudio, playHealRewardAudio, playLifeLossAudio } from '../../ui/game-audio.ts'
import { createGameCanvas, type GameCanvasController, type GameCanvasHudStats } from '../../ui/game-canvas/index.ts'
import { ATTRACT_PREVIEW_MAX_DPR } from '../../ui/game-canvas/runtime/mobile-perf.ts'
import { resolveViewportEndlessVisibleRows } from '../../ui/game-stage-layout.ts'
import { createAiController } from '../game-session/ai-loop.ts'
import { applySessionUpdate, createGameLog } from '../game-session/logging.ts'
import { createScrollController } from '../game-session/scroll.ts'
import type { GameSessionRuntime } from '../game-session/types.ts'
import {
  createDemoScript,
  createScriptedOpeningSession,
  DEMO_SCRIPT_SEED,
  DEMO_START_STEP,
  type DemoPhase,
  elapsedForScrollStep,
  profileForDemoStep,
  setDemoElapsed,
} from './demo-script.ts'
import { mountLeaderboardAttract } from './leaderboard-attract.ts'
import { LANDING_PREVIEW_VIEWPORT } from './viewport.ts'

const PREVIEW_VIEWPORT = LANDING_PREVIEW_VIEWPORT

const DEMO_AI_DELAY = {
  normalMultiplier: 2.0,
  normalMinMs: 340,
  urgentMultiplier: 1.25,
  urgentMinMs: 200,
} as const

function noop(): void {
  /* landing preview — input disabled */
}

function attachDemoAudioUnlock(audio: GameAudioController): () => void {
  const unlockOnce = (): void => {
    audio.unlock()
    if (!loadLocalSettings().soundMuted) {
      audio.setIdleBgm(true)
    }
    window.removeEventListener(LANDING_AUDIO_UNLOCK_EVENT, unlockOnce)
    window.removeEventListener('pointerdown', unlockOnce, true)
    window.removeEventListener('keydown', unlockOnce, true)
    window.removeEventListener('wheel', unlockOnce, true)
  }
  window.addEventListener(LANDING_AUDIO_UNLOCK_EVENT, unlockOnce)
  window.addEventListener('pointerdown', unlockOnce, { capture: true, passive: true })
  window.addEventListener('keydown', unlockOnce, { capture: true, passive: true })
  window.addEventListener('wheel', unlockOnce, { capture: true, passive: true })
  return () => {
    window.removeEventListener(LANDING_AUDIO_UNLOCK_EVENT, unlockOnce)
    window.removeEventListener('pointerdown', unlockOnce, true)
    window.removeEventListener('keydown', unlockOnce, true)
    window.removeEventListener('wheel', unlockOnce, true)
  }
}

function applyLandingAudioPrefs(soundMuted: boolean, opts?: { unlock?: boolean; audio?: GameAudioController }): void {
  const audio = opts?.audio
  if (!audio) return
  audio.setSfxMuted(soundMuted)
  audio.setIdleBgmMuted(soundMuted)
  if (soundMuted) {
    audio.setIdleBgm(false)
    return
  }
  if (opts?.unlock) audio.unlock()
  audio.setIdleBgm(true)
}

function applyViewportForPreview(session: ModeSession): ModeSession {
  const previewRows = getEndlessPreviewRows(session)
  const visibleRows = resolveViewportEndlessVisibleRows(PREVIEW_VIEWPORT.width, PREVIEW_VIEWPORT.height, previewRows)
  let next: ModeSession = {
    ...session,
    endlessVisibleRows: visibleRows,
    endlessViewStart: visibleViewStart(session.state.board, visibleRows),
  }
  const refinedPreview = getEndlessPreviewRows(next)
  if (refinedPreview !== previewRows) {
    const refinedRows = resolveViewportEndlessVisibleRows(PREVIEW_VIEWPORT.width, PREVIEW_VIEWPORT.height, refinedPreview)
    if (refinedRows !== visibleRows) {
      next = {
        ...next,
        endlessVisibleRows: refinedRows,
        endlessViewStart: visibleViewStart(next.state.board, refinedRows),
      }
    }
  }
  return next
}

function createPreviewRuntime(session: ModeSession): GameSessionRuntime {
  return {
    session,
    timerStarted: false,
    scrollGameStartedAt: Date.now(),
    backdropScrollDepth: session.scrollRowCount ?? 0,
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
    startOverlayOpen: false,
    view: null,
  }
}

function resolveDemoAiStepDelay(session: ModeSession, elapsedMs: number, urgent: boolean, endgameFast: boolean): number {
  const base = getEndlessAiStepMs(session, elapsedMs)
  if (endgameFast) {
    return Math.max(140, Math.round(base * 0.48))
  }
  if (urgent) {
    return Math.max(DEMO_AI_DELAY.urgentMinMs, Math.round(base * DEMO_AI_DELAY.urgentMultiplier))
  }
  return Math.max(DEMO_AI_DELAY.normalMinMs, Math.round(base * DEMO_AI_DELAY.normalMultiplier))
}

export function mountLandingPreview(container: HTMLElement): () => void {
  container.replaceChildren()
  container.className = 'landing-preview-host'

  preloadLandingAudio()

  const initialSoundMuted = loadLocalSettings().soundMuted
  const gameAudio = createGameAudio({
    bgmMuted: initialSoundMuted,
    sfxMuted: initialSoundMuted,
  })
  applyLandingAudioPrefs(initialSoundMuted, { audio: gameAudio })
  const disposeAudioUnlock = attachDemoAudioUnlock(gameAudio)

  const onLocalSettingsChange = (event: Event): void => {
    const detail = (event as CustomEvent<LocalSettings>).detail
    if (!detail) return
    applyLandingAudioPrefs(detail.soundMuted, { unlock: !detail.soundMuted, audio: gameAudio })
  }
  window.addEventListener(LOCAL_SETTINGS_CHANGE_EVENT, onLocalSettingsChange)

  const leaderboardAttract = mountLeaderboardAttract(container)
  let demoPhase: DemoPhase = 'idle'
  let scroll!: ReturnType<typeof createScrollController>
  let ai!: ReturnType<typeof createAiController>
  let demo!: ReturnType<typeof createDemoScript>
  let demoAiMoveOverride: AiMove | null = null
  let demoEndgameFastAi = false

  const runtime = createPreviewRuntime(createScriptedOpeningSession(applyViewportForPreview(createRankedSession(DEMO_SCRIPT_SEED))))

  function getScrollElapsedMs(): number {
    if (runtime.scrollGameStartedAt <= 0) return 0
    return Date.now() - runtime.scrollGameStartedAt
  }

  function getPreviewHudStats(): GameCanvasHudStats {
    const lives = runtime.session.lives ?? 0
    const maxLives = 5
    const scrollElapsed = getScrollElapsedMs()
    const scrollProfile = getEndlessScrollProfileForSession(runtime.session, scrollElapsed)
    const playing = demoPhase === 'playing' && runtime.session.state.status === 'playing'
    return {
      score: runtime.session.score ?? 0,
      combo: runtime.session.defuseCombo ?? 0,
      scoreEvent: runtime.presentation.scoreEvent,
      breakEvent: runtime.presentation.breakEvent,
      lifeLossEvent: runtime.presentation.lifeLossEvent,
      lives: `${'♥'.repeat(lives)}${'♡'.repeat(Math.max(0, maxLives - lives))}`,
      spaceEnabled: playing,
      backdrop: {
        scrollElapsedMs: scrollElapsed,
        scrollDepth: runtime.backdropScrollDepth,
        livesCurrent: lives,
        livesMax: maxLives,
        presetId: runtime.session.endlessPresetId,
      },
      difficulty: {
        speedTier: scrollProfile.speedTier,
        batchTier: scrollProfile.batchTier,
      },
    }
  }

  function render(): void {
    const flagCount = getFlagCount(runtime.session.state)
    const { cols } = runtime.session.state.board
    runtime.view?.render(toCellViews(runtime.session), runtime.session.state.status, flagCount, {
      rows: sessionVisibleRows(runtime.session),
      cols,
      aiHint: demoPhase === 'playing' ? runtime.aiHint : null,
      previewRows: getEndlessPreviewRows(runtime.session),
    })
  }

  const gameLog = createGameLog(runtime, render)
  const sessionDeps = {
    runtime,
    gameLog,
    getScrollElapsedMs,
  }

  function applySession(next: ModeSession, beforeLives?: number, context?: Parameters<typeof applySessionUpdate>[3]): void {
    const prevFlags = getFlagCount(runtime.session.state)
    playLifeLossAudio(gameAudio, beforeLives, next)
    playHealRewardAudio(gameAudio, beforeLives, runtime.session, next)
    applySessionUpdate(sessionDeps, next, beforeLives, context)
    const nextFlags = getFlagCount(next.state)
    const demoScripted = context?.trigger?.startsWith('Demo') === true
    if (demoScripted || !runtime.aiAutoActive) {
      if (nextFlags > prevFlags) playFlagToggleAudio(gameAudio, true)
      else if (nextFlags < prevFlags) playFlagToggleAudio(gameAudio, false)
    }
    if (next.state.status === 'lost') {
      scroll.stopScrollTimer()
      runtime.view?.stopTimer()
      ai.stopAiAuto()
      runtime.aiHint = null
    }
  }

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
    }
    render()
  }

  function syncDifficultyStep(step: number): void {
    setDemoElapsed(runtime, elapsedForScrollStep(step))
    const profile = profileForDemoStep(runtime.session, step)
    runtime.session = { ...runtime.session, scrollBatchRows: profile.batchRows }
    runtime.scrollIntervalMs = profile.intervalMs
  }

  function resyncScrollTimer(): void {
    scroll.stopScrollTimer()
    if (runtime.session.state.status === 'playing') {
      scroll.markGameClockStarted()
      scroll.startScrollTimer()
    }
  }

  function startAiOnly(): void {
    runtime.aiAutoActive = true
    runtime.aiWaitLogged = false
    ai.scheduleAiStep()
    render()
  }

  function startScrollAndAi(): void {
    runtime.aiAutoActive = true
    runtime.aiWaitLogged = false
    scroll.markGameClockStarted()
    scroll.startScrollTimer()
    ai.scheduleAiStep()
    render()
  }

  function stopScrollAndAi(): void {
    ai.stopAiAuto()
    scroll.stopScrollTimer()
    runtime.aiHint = null
    demoAiMoveOverride = null
  }

  function stopAiOnly(): void {
    ai.stopAiAuto()
    runtime.aiHint = null
    demoAiMoveOverride = null
  }

  function postponeNextScroll(delayMs: number): void {
    if (runtime.session.state.status !== 'playing') return
    if (runtime.scrollTimeoutId !== null) {
      window.clearTimeout(runtime.scrollTimeoutId)
      runtime.scrollTimeoutId = null
    }
    const profile = getEndlessScrollProfileForSession(runtime.session, getScrollElapsedMs())
    runtime.scrollIntervalMs = profile.intervalMs
    runtime.scrollDeadlineAt = Date.now() + delayMs
    runtime.scrollTimeoutId = window.setTimeout(() => {
      runtime.scrollTimeoutId = null
      if (runtime.session.state.status !== 'playing') return
      scroll.performScrollTick(false)
    }, delayMs)
    render()
  }

  function resetRuntimeForScript(session: ModeSession): void {
    runtime.session = session
    runtime.backdropScrollDepth = session.scrollRowCount ?? 0
    runtime.scrollDeadlineAt = 0
    runtime.scrollIntervalMs = 0
    runtime.aiHint = null
    runtime.presentation = { eventId: 0, scoreEvent: undefined, breakEvent: undefined, lifeLossEvent: undefined }
    runtime.timerStarted = false
    runtime.aiAutoActive = false
    syncDifficultyStep(DEMO_START_STEP)
  }

  function startPreviewRun(): void {
    stopScrollAndAi()
    runtime.view?.cancelFlagSwipePreview()
    runtime.view?.stopTimer()
    runtime.view?.resetTimer()

    const baseSession = applyViewportForPreview(createRankedSession(DEMO_SCRIPT_SEED))
    runtime.view?.render(toCellViews(baseSession), 'idle', 0, {
      rows: sessionVisibleRows(baseSession),
      cols: baseSession.state.board.cols,
      previewRows: getEndlessPreviewRows(baseSession),
    })

    resetRuntimeForScript(createScriptedOpeningSession(baseSession))
    applySession({ ...runtime.session }, undefined, { trigger: 'Landing attract demo' })
    render()
    demo.start()
  }

  scroll = createScrollController({
    runtime,
    gameLog,
    applySession,
    render,
    refreshAiHint: () => ai.refreshAiHint(),
    stopAiAuto: () => ai.stopAiAuto(),
    onScrollTick: () => gameAudio.play('scrollUp'),
    onScrollMineDetonate: () => gameAudio.play('mineHit'),
    onScrollWrongFlagBreak: () => gameAudio.play('lifeWarning'),
    queueMineExplosions: (cells) => runtime.view?.queueScrollMineGhosts(cells),
    queueWrongFlagBreaks: (cells) => runtime.view?.queueScrollWrongFlagGhosts(cells),
  })

  ai = createAiController({
    runtime,
    gameLog,
    scroll,
    gameAudio,
    applySession,
    afterSessionChange,
    render,
    resolveStepDelayMs: (session, elapsedMs, urgent) => resolveDemoAiStepDelay(session, elapsedMs, urgent, demoEndgameFastAi),
    resolveDemoMove: () => demoAiMoveOverride,
    consumeDemoMove: () => {
      demoAiMoveOverride = null
    },
  })

  const controller: GameCanvasController = createGameCanvas(
    container,
    sessionVisibleRows(runtime.session),
    runtime.session.state.board.cols,
    0,
    {
      onReveal: noop,
      onToggleFlag: noop,
      onChord: noop,
      onReset: noop,
    },
    {
      viewportSize: PREVIEW_VIEWPORT,
      fitViewport: {
        cols: runtime.session.state.board.cols,
        rows: sessionVisibleRows(runtime.session),
        minCellSize: 18,
        maxCellSize: 48,
      },
      endlessPreviewRows: getEndlessPreviewRows(runtime.session),
      previewMode: { skipIntro: true, lowPower: true, maxDpr: ATTRACT_PREVIEW_MAX_DPR },
      getScrollPressure: () => (demoPhase === 'playing' ? scroll.getScrollPressureState() : undefined),
      fullscreen: {
        getStats: () => getPreviewHudStats(),
        showStartOverlay: () => false,
        getBgmMuted: () => true,
        isLeaderboardOpen: () => demoPhase === 'leaderboard',
      },
    }
  )

  runtime.view = controller

  demo = createDemoScript(
    {
      onPhaseChange(phase) {
        demoPhase = phase
        if (phase === 'leaderboard') {
          runtime.leaderboardOpen = true
          leaderboardAttract.show({
            score: runtime.session.score ?? 0,
            depth: runtime.session.scrollRowCount ?? 0,
          })
        } else {
          runtime.leaderboardOpen = false
          leaderboardAttract.hide()
        }
        if (phase === 'lost' || phase === 'leaderboard' || phase === 'idle') {
          stopScrollAndAi()
        }
        render()
      },
      onRestart() {
        startPreviewRun()
      },
    },
    {
      runtime,
      applySession,
      render,
      syncDifficultyStep,
      resyncScrollTimer,
      startScrollAndAi,
      startAiOnly,
      stopScrollAndAi,
      stopAiOnly,
      postponeNextScroll,
      setDemoEndgameFastAi(fast) {
        demoEndgameFastAi = fast
      },
      performScrollTick(reason) {
        scroll.markGameClockStarted()
        scroll.performScrollTick(true, reason)
        const batchRows = resolveScrollBatchRowsForSession(runtime.session)
        runtime.backdropScrollDepth += batchRows
      },
      setDemoAiMove(move) {
        demoAiMoveOverride = move
      },
      playMobileFlagSwipe(screenRow, col, onSwipeCommit) {
        return runtime.view?.playFlagSwipePreview(screenRow, col, { onSwipeCommit }) ?? Promise.resolve()
      },
      cancelFlagSwipePreview() {
        runtime.view?.cancelFlagSwipePreview()
      },
    }
  )

  startPreviewRun()

  let suspended = false
  let tabVisible = document.visibilityState === 'visible'
  let inViewport = true

  function suspendPreview(): void {
    if (suspended) return
    suspended = true
    demo.stop()
    scroll.stopScrollTimer()
    controller.suspendRendering()
  }

  function resumePreview(): void {
    if (!suspended) return
    suspended = false
    startPreviewRun()
    controller.resumeRendering()
  }

  function syncPreviewRunState(): void {
    if (tabVisible && inViewport) resumePreview()
    else suspendPreview()
  }

  const onVisibilityChange = (): void => {
    tabVisible = document.visibilityState === 'visible'
    syncPreviewRunState()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  const intersection = new IntersectionObserver(
    (entries) => {
      inViewport = entries.some((entry) => entry.isIntersecting)
      syncPreviewRunState()
    },
    { root: null, rootMargin: '48px 0px', threshold: 0.06 }
  )
  intersection.observe(container)

  return () => {
    intersection.disconnect()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener(LOCAL_SETTINGS_CHANGE_EVENT, onLocalSettingsChange)
    demo.stop()
    scroll.stopScrollTimer()
    leaderboardAttract.dispose()
    controller.destroy()
    disposeAudioUnlock()
    gameAudio.destroy()
    if (container.isConnected) {
      container.replaceChildren()
    }
  }
}
