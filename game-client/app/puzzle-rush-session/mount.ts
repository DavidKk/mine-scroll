import type { AiHintDisplay } from '@shared/core/ai/types.ts'
import { countNewlyRevealed } from '@shared/core/modes/puzzle-rush/board.ts'
import type { PuzzleRushSession } from '@shared/core/modes/puzzle-rush/index.ts'
import {
  createPuzzleBoard,
  createPuzzleRushSession,
  getPuzzleRushFlagCount,
  PUZZLE_LIVES,
  puzzleRushBeginRun,
  puzzleRushChordAt,
  puzzleRushCommitNextBoard,
  puzzleRushRevealAt,
  puzzleRushToggleMarkAt,
  toPuzzleBoardCellViews,
  toPuzzleRushCellViews,
} from '@shared/core/modes/puzzle-rush/index.ts'

import { loadLocalSettings, patchLocalSettings } from '../../config/local-settings.ts'
import { isDev } from '../../env.ts'
import { createRankedInputRecorder } from '../../ranked/input-recorder.ts'
import { createRankedInputUploader } from '../../ranked/input-uploader.ts'
import { createPuzzleRushRankedSession, createRankedRunOnServer, finishRankedRunOnServer } from '../../ranked/ranked-run-client.ts'
import { isRankedStorageUnavailableMessage } from '../../ranked/ranked-storage.ts'
import type { RankedRunStatus,RunInputEvent } from '../../ranked/types.ts'
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
  saveLeaderboardSelfSnapshot,
  syncLeaderboardSelfFromHistory,
} from '../../storage/ranked-local-store.ts'
import { createGameAudio, type GameAudioController, playFlagToggleAudio } from '../../ui/game-audio.ts'
import { createGameCanvas, type GameCanvasController, type GameCanvasHudStats } from '../../ui/game-canvas/index.ts'
import { createGameNotificationStack } from '../../ui/notification.ts'
import { devLog, devWarn } from '../game-session/dev-log.ts'
import { createLeaderboardPanel } from '../game-session/leaderboard-panel.ts'
import { createPuzzleAiController, type PuzzleAiController } from './ai-loop.ts'

interface PuzzleRushPresentation {
  eventId: number
  scoreEvent?: GameCanvasHudStats['scoreEvent']
  breakEvent?: GameCanvasHudStats['breakEvent']
  lifeLossEvent?: GameCanvasHudStats['lifeLossEvent']
}

interface PuzzleRushRuntime {
  session: PuzzleRushSession
  startOverlayOpen: boolean
  boardAdvancePending: boolean
  leaderboardOpen: boolean
  rankedRunId: string | null
  rankedFinishStatus: RankedRunStatus | null
  view: GameCanvasController | null
  presentation: PuzzleRushPresentation
  aiAutoId: number | null
  aiAutoActive: boolean
  aiHint: AiHintDisplay | null
  aiWaitLogged: boolean
  aiOscillationCell: string | null
  aiOscillationCount: number
}

function createInitialRuntime(): PuzzleRushRuntime {
  return {
    session: createPuzzleRushSession(),
    startOverlayOpen: true,
    boardAdvancePending: false,
    leaderboardOpen: false,
    rankedRunId: null,
    rankedFinishStatus: null,
    view: null,
    presentation: { eventId: 0 },
    aiAutoId: null,
    aiAutoActive: false,
    aiHint: null,
    aiWaitLogged: false,
    aiOscillationCell: null,
    aiOscillationCount: 0,
  }
}

function hadPuzzleMineLifeLoss(beforeLives: number, next: PuzzleRushSession): boolean {
  if (next.lives >= beforeLives) return false
  const cause = next.lastLifeLoss?.cause
  return cause === 'mine-reveal' || cause === 'chord-mine'
}

function playPuzzleLifeLossAudio(audio: GameAudioController, beforeLives: number, next: PuzzleRushSession): void {
  if (next.lives >= beforeLives) return
  const cause = next.lastLifeLoss?.cause
  if (cause === 'mine-reveal' || cause === 'chord-mine') {
    audio.play('mineHit')
  }
}

function playPuzzleRevealAudio(audio: GameAudioController, before: PuzzleRushSession['state']['board'], after: PuzzleRushSession['state']['board']): void {
  const revealedDelta = countNewlyRevealed(before, after)
  if (revealedDelta > 1) audio.play('cellFlood')
  else if (revealedDelta === 1) audio.play('cellReveal')
}

function applyPuzzleSession(runtime: PuzzleRushRuntime, next: PuzzleRushSession, beforeLives?: number, audio?: GameAudioController): void {
  if (next.lastBoardClear) {
    runtime.presentation.eventId += 1
    runtime.presentation.scoreEvent = {
      id: runtime.presentation.eventId,
      scoreAdded: next.lastBoardClear.scoreAdded,
      scoreAfter: next.score,
      comboAfter: next.lastBoardClear.streakAfter,
    }
  }

  if (next.lastStreakBreak) {
    runtime.presentation.eventId += 1
    runtime.presentation.breakEvent = {
      id: runtime.presentation.eventId,
      comboCleared: next.lastStreakBreak.streakCleared,
      minesCleared: 0,
    }
  }

  if (next.lastLifeLoss) {
    runtime.presentation.eventId += 1
    runtime.presentation.lifeLossEvent = {
      id: runtime.presentation.eventId,
      damage: next.lastLifeLoss.damage,
      cause: next.lastLifeLoss.cause,
      comboCleared: next.lastStreakBreak?.streakCleared,
    }
  }

  runtime.session = {
    ...next,
    lastBoardClear: undefined,
    lastStreakBreak: undefined,
    lastLifeLoss: undefined,
  }

  if (beforeLives !== undefined && audio) {
    playPuzzleLifeLossAudio(audio, beforeLives, next)
    if (next.lives > beforeLives) {
      audio.play('healReward')
    }
  }
}

export function mountPuzzleRushSession(root: HTMLElement): () => void {
  const rankedStoreReady = ensureRankedLocalStore().then(async () => {
    const name = await ensureDisplayName()
    await saveDisplayName(name)
    await ensurePlayerId()
  })
  const runtime = createInitialRuntime()
  const gameAudio = createGameAudio({ bgmMuted: loadLocalSettings().bgmMuted })
  let ai!: PuzzleAiController
  let tracePersistTimer: number | null = null
  let sessionGeneration = 0

  const rankedRecorder = createRankedInputRecorder({
    onEvent: () => scheduleRunTracePersist(),
  })
  let rankedUploader = createRankedInputUploader()

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

  root.className = 'app app--puzzle-rush app--ranked'
  root.replaceChildren()

  const notify = createGameNotificationStack(root)

  const leaderboardPanel = createLeaderboardPanel(root, {
    modeId: 'puzzle-rush',
    depthColumnLabel: 'Boards',
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
    if (!runtime.rankedRunId) return

    const finishGeneration = sessionGeneration
    const runId = runtime.rankedRunId
    const claimedScore = runtime.session.score ?? 0
    const claimedDepth = runtime.session.boardIndex ?? 0

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
        const scoreBreakthrough = result.status === 'accepted' && isLeaderboardScoreBreakthrough(finalScore, finalDepth, 'puzzle-rush')

        await appendLocalScoreRecord({
          runId,
          score: finalScore,
          depth: finalDepth,
          submittedAt: Date.now(),
          status: result.status === 'accepted' || result.status === 'pending' || result.status === 'rejected' ? result.status : 'rejected',
          ranked: result.ranked === true,
          rank: result.rank,
          modeId: 'puzzle-rush',
        })
        if (result.status === 'accepted' || result.status === 'pending') {
          await saveLeaderboardSelfSnapshot(
            {
              id: playerId,
              name,
              score: finalScore,
              depth: finalDepth,
              rank: result.rank,
              submittedAt: Date.now(),
            },
            'puzzle-rush'
          )
        }
        await syncLeaderboardSelfFromHistory(playerId, name, 'puzzle-rush')
        if (scoreBreakthrough && !runtime.leaderboardOpen) {
          await markLeaderboardUnseenUpdate('puzzle-rush')
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
  const canvasContainer = document.createElement('div')
  canvasContainer.className = 'app__canvas app__canvas--puzzle-rush'
  root.append(canvasContainer)

  function syncIdleBgm(): void {
    gameAudio.setIdleBgm(true)
  }

  function render(): void {
    if (runtime.boardAdvancePending || runtime.view?.isBoardAdvanceActive()) {
      runtime.view?.repaint()
      return
    }
    const { rows, cols } = runtime.session.state.board
    runtime.view?.render(toPuzzleRushCellViews(runtime.session), runtime.session.state.status, getPuzzleRushFlagCount(runtime.session), {
      rows,
      cols,
      aiHint: runtime.aiHint,
    })
  }

  function getCanvasHudStats(): GameCanvasHudStats {
    const lives = runtime.session.lives
    return {
      score: runtime.session.score,
      combo: runtime.session.streak,
      scoreEvent: runtime.presentation.scoreEvent,
      breakEvent: runtime.presentation.breakEvent,
      lifeLossEvent: runtime.presentation.lifeLossEvent,
      lives: `${'♥'.repeat(lives)}${'♡'.repeat(Math.max(0, PUZZLE_LIVES - lives))}`,
      spaceEnabled: false,
      devAutoVisible: isDev,
      devAutoActive: runtime.aiAutoActive,
      devSpeedVisible: false,
      backdrop: {
        scrollElapsedMs: 0,
        scrollDepth: runtime.session.boardIndex,
        livesCurrent: lives,
        livesMax: PUZZLE_LIVES,
      },
    }
  }

  function handleTerminalStatus(): void {
    runtime.view?.stopTimer()
    ai.stopAiAuto()
    gameAudio.play('mineHit')
    if (!runtime.rankedRunId) return
    void autoFinishRankedRun()
  }

  function startBoardAdvanceTransition(next: PuzzleRushSession): void {
    const pendingSeed = next.pendingNextSeed
    if (pendingSeed === undefined || !runtime.view) return

    runtime.boardAdvancePending = true
    applyPuzzleSession(runtime, next)

    const outgoingViews = toPuzzleRushCellViews(runtime.session)
    const incomingViews = toPuzzleBoardCellViews(createPuzzleBoard(pendingSeed))

    runtime.view.beginBoardAdvance(outgoingViews, incomingViews, () => {
      runtime.session = puzzleRushCommitNextBoard(runtime.session)
      runtime.boardAdvancePending = false
      render()
      ai.scheduleAiStep()
    })
    runtime.view.repaint()
  }

  function onSessionChange(next: PuzzleRushSession, beforeLives?: number, beforeBoard?: PuzzleRushSession['state']['board']): void {
    if (next.lastBoardClear && next.pendingNextSeed !== undefined) {
      startBoardAdvanceTransition(next)
      return
    }

    if (beforeBoard && next !== runtime.session && !hadPuzzleMineLifeLoss(beforeLives ?? runtime.session.lives, next)) {
      playPuzzleRevealAudio(gameAudio, beforeBoard, next.state.board)
    }
    applyPuzzleSession(runtime, next, beforeLives, gameAudio)
    if (next.state.status === 'lost') handleTerminalStatus()
    else ai.refreshAiHint()
    render()
  }

  function startRun(): void {
    void startRunAsync()
  }

  async function startRunAsync(): Promise<void> {
    if (runtime.session.state.status !== 'idle') return
    const runGeneration = sessionGeneration
    runtime.startOverlayOpen = false
    let rankedRunLinked = false

    try {
      const run = await createRankedRunOnServer('puzzle-rush')
      if (runGeneration !== sessionGeneration) return
      rankedUploader.dispose()
      rankedUploader = createRankedInputUploader(run.uploadIntervalMs)
      runtime.rankedRunId = run.runId
      runtime.rankedFinishStatus = null
      rankedUploader.bindRun(run.runId)
      runtime.session = createPuzzleRushRankedSession(run.seed)
      rankedRecorder.start()
      rankedRecorder.markBegin()
      await createRunTrace(run.runId, run.seed)
      rankedRunLinked = true
      devLog(`Puzzle Rush ranked run ${run.runId.slice(0, 8)}…`)
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
      notify.warning('Leaderboard storage unavailable — playing locally. Scores will not be submitted.')
    }

    if (runGeneration !== sessionGeneration) return
    const next = puzzleRushBeginRun(runtime.session)
    applyPuzzleSession(runtime, next, undefined, gameAudio)
    runtime.view?.resetTimer()
    runtime.view?.startTimer()
    ai.refreshAiHint()
    if (isDev) {
      devLog(rankedRunLinked ? 'Puzzle Rush ranked game started' : 'Puzzle Rush local game started (scores not submitted)')
    }
    render()
  }

  function restartGame(): void {
    sessionGeneration += 1
    ai.stopAiAuto()
    rankedRecorder.stop()
    rankedUploader.dispose()
    rankedUploader = createRankedInputUploader()
    runtime.view?.destroy()
    runtime.session = createPuzzleRushSession()
    runtime.rankedRunId = null
    runtime.rankedFinishStatus = null
    runtime.startOverlayOpen = true
    runtime.boardAdvancePending = false
    runtime.leaderboardOpen = false
    leaderboardPanel.setOpen(false)
    runtime.presentation = { eventId: 0 }
    runtime.aiWaitLogged = false
    runtime.aiOscillationCell = null
    runtime.aiOscillationCount = 0
    mountCanvas()
    runtime.view?.resetTimer()
    syncIdleBgm()
    render()
  }

  function mountCanvas(): GameCanvasController {
    canvasContainer.replaceChildren()
    const { rows, cols } = runtime.session.state.board
    const controller = createGameCanvas(
      canvasContainer,
      rows,
      cols,
      runtime.session.state.board.mineCount,
      {
        onReset: () => restartGame(),
        onReveal(screenRow, col) {
          if (runtime.boardAdvancePending || runtime.view?.isBoardAdvanceActive()) return
          if (runtime.session.state.status !== 'idle' && runtime.session.state.status !== 'playing') return
          const beforeLives = runtime.session.lives
          const beforeBoard = runtime.session.state.board
          if (rankedRecorder.isActive()) rankedRecorder.recordAction('reveal', screenRow, col)
          const next = puzzleRushRevealAt(runtime.session, screenRow, col)
          if (next === runtime.session) return
          onSessionChange(next, beforeLives, beforeBoard)
        },
        onToggleFlag(screenRow, col) {
          if (runtime.boardAdvancePending || runtime.view?.isBoardAdvanceActive()) return
          if (runtime.session.state.status !== 'idle' && runtime.session.state.status !== 'playing') return
          const cell = runtime.session.state.board.cells[screenRow]?.[col]
          if (!cell || cell.revealed) return
          const wasFlagged = cell.mark === 'flag'
          const beforeLives = runtime.session.lives
          if (rankedRecorder.isActive()) rankedRecorder.recordAction('flag', screenRow, col)
          const next = puzzleRushToggleMarkAt(runtime.session, screenRow, col)
          if (next !== runtime.session) playFlagToggleAudio(gameAudio, !wasFlagged)
          applyPuzzleSession(runtime, next, beforeLives, gameAudio)
          ai.refreshAiHint()
          render()
        },
        onChord(screenRow, col) {
          if (runtime.boardAdvancePending || runtime.view?.isBoardAdvanceActive()) return
          if (runtime.session.state.status !== 'playing') return
          const beforeLives = runtime.session.lives
          const beforeBoard = runtime.session.state.board
          if (rankedRecorder.isActive()) rankedRecorder.recordAction('chord', screenRow, col)
          const next = puzzleRushChordAt(runtime.session, screenRow, col)
          if (next === runtime.session) return
          if (!hadPuzzleMineLifeLoss(beforeLives, next) && countNewlyRevealed(beforeBoard, next.state.board) > 0) {
            gameAudio.play('chordAction')
          }
          onSessionChange(next, beforeLives, beforeBoard)
        },
      },
      {
        fitViewport: {
          cols,
          rows,
          maxCellSize: 56,
          minCellSize: 28,
        },
        transparentBoardUnderlay: true,
        fullscreen: {
          getStats: () => getCanvasHudStats(),
          isLeaderboardOpen: () => runtime.leaderboardOpen,
          hasLeaderboardUnseenUpdate: () => getCachedLeaderboardUnseenUpdate('puzzle-rush'),
          showStartOverlay: () => runtime.startOverlayOpen && runtime.session.state.status === 'idle',
          onStart: () => startRun(),
          onRestart: () => restartGame(),
          onDevAuto: () => ai.toggleAiAuto(startRun),
          onUiHover: (target) => {
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
            void clearLeaderboardUnseenUpdate('puzzle-rush').then(() => render())
            runtime.leaderboardOpen = true
            leaderboardPanel.setOpen(true)
            render()
          },
          rankedInput: {
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
          },
        },
      }
    )
    runtime.view = controller
    return controller
  }

  ai = createPuzzleAiController({
    runtime,
    isBoardAdvanceActive: () => runtime.view?.isBoardAdvanceActive() ?? false,
    onSessionChange,
    render,
  })

  function onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
      return
    }
    if (event.key.toLowerCase() !== 'a') return
    if (!isDev) return
    event.preventDefault()
    if (event.shiftKey) {
      ai.toggleAiAuto(startRun)
    } else if (event.metaKey || event.ctrlKey) {
      ai.stopAiAuto()
      ai.runAiStep()
    }
  }

  window.addEventListener('keydown', onKeyDown)

  mountCanvas()
  syncIdleBgm()
  render()
  if (isDev) devLog('Puzzle Rush · dev AUTO ready (Shift+A)')

  return () => {
    ai.stopAiAuto()
    rankedRecorder.stop()
    rankedUploader.dispose()
    leaderboardPanel.dispose()
    window.removeEventListener('keydown', onKeyDown)
    runtime.view?.destroy()
    gameAudio.destroy()
    notify.dispose()
  }
}
