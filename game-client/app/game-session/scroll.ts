import {
  collectScrollLeavingMineCells,
  endlessScrollTick,
  getEndlessPresetForSession,
  getEndlessScrollPressure,
  getEndlessScrollProfileForSession,
} from '@shared/core/modes/endless/index.ts'
import type { ModeSession } from '@shared/core/types.ts'

import { GAME_ASSET_TUNING } from '../../ui/game-assets.ts'
import type { CanvasLogController, GameSessionRuntime, SessionApplyContext } from './types.ts'

export interface ScrollControllerDeps {
  runtime: GameSessionRuntime
  gameLog: CanvasLogController
  applySession(next: ModeSession, beforeLives?: number, context?: SessionApplyContext): void
  render(): void
  refreshAiHint(): void
  stopAiAuto(): void
  onScrollTick?: () => void
  queueMineExplosions?: (cells: { row: number; col: number }[]) => void
  onScrollMineDetonate?: () => void
  onTerminalGameStatus?: (status: 'won' | 'lost') => void
}

const SCROLL_MINE_GHOST_MS = GAME_ASSET_TUNING.fx.mineExplosion.durationMs
/** Scroll after mine is shown and blast starts — ghost keeps pinned while board moves. */
const SCROLL_COMMIT_AT = 0.55

export interface ScrollController {
  getElapsedMs(): number
  markGameClockStarted(): void
  stopScrollTimer(): void
  performScrollTick(manual: boolean, aiReason?: string): void
  /** DEV: bump scroll elapsed by one tier step to test speed / batch escalation. Returns false if not playing. */
  bumpScrollDifficultyForDebug(): boolean
  startScrollTimer(): void
  getScrollPressureState(): ReturnType<typeof buildScrollPressure> | undefined
}

function buildScrollPressure(runtime: GameSessionRuntime, scrollDeadlineAt: number, scrollIntervalMs: number) {
  const pressure = getEndlessScrollPressure(scrollDeadlineAt, scrollIntervalMs)
  if (!pressure) return undefined
  return {
    ...pressure,
    batchRows: getEndlessScrollProfileForSession(runtime.session, getScrollElapsedMsFromRuntime(runtime)).batchRows,
  }
}

function getScrollElapsedMsFromRuntime(runtime: GameSessionRuntime): number {
  if (runtime.scrollGameStartedAt <= 0) return 0
  return Date.now() - runtime.scrollGameStartedAt
}

function clearScrollDetonation(runtime: GameSessionRuntime): void {
  if (runtime.scrollDetonateTimeoutId !== null) {
    window.clearTimeout(runtime.scrollDetonateTimeoutId)
    runtime.scrollDetonateTimeoutId = null
  }
  runtime.scrollPendingTick = null
}

export function createScrollController(deps: ScrollControllerDeps): ScrollController {
  const { runtime, gameLog, applySession, render, refreshAiHint, onScrollTick, queueMineExplosions, onScrollMineDetonate, onTerminalGameStatus } = deps

  function getElapsedMs(): number {
    return getScrollElapsedMsFromRuntime(runtime)
  }

  function markGameClockStarted(): void {
    if (runtime.scrollGameStartedAt <= 0) {
      runtime.scrollGameStartedAt = Date.now()
    }
    if (!runtime.timerStarted) {
      runtime.view?.startTimer()
      runtime.timerStarted = true
    }
  }

  function stopScrollTimer(): void {
    if (runtime.scrollTimeoutId !== null) {
      window.clearTimeout(runtime.scrollTimeoutId)
      runtime.scrollTimeoutId = null
    }
    runtime.scrollDeadlineAt = 0
    runtime.scrollIntervalMs = 0
    clearScrollDetonation(runtime)
  }

  function scheduleNextScroll(): void {
    if (runtime.session.state.status !== 'playing') return

    const profile = getEndlessScrollProfileForSession(runtime.session, getElapsedMs())
    runtime.scrollIntervalMs = profile.intervalMs
    runtime.scrollDeadlineAt = Date.now() + profile.intervalMs
    render()

    runtime.scrollTimeoutId = window.setTimeout(() => {
      runtime.scrollTimeoutId = null
      if (runtime.session.state.status !== 'playing') return
      performScrollTick(false)
    }, profile.intervalMs)
  }

  function commitScrollTick(manual: boolean, aiReason: string | undefined, batchRows: number): void {
    const beforeLives = runtime.session.lives
    const next = endlessScrollTick(runtime.session, batchRows)
    if (!manual) {
      runtime.backdropScrollDepth += batchRows
    }
    onScrollTick?.()
    const depthAfter = next.scrollRowCount ?? 0
    const batchNote = batchRows > 1 ? ` · ×${batchRows} rows` : ''
    const trigger = manual
      ? aiReason
        ? `AI manual scroll ↑${depthAfter}${batchNote} · ${aiReason}`
        : `Player manual scroll ↑${depthAfter}${batchNote}`
      : `Scroll ↑${depthAfter}${batchNote}`
    applySession(next, beforeLives, { trigger })
    if (manual) {
      gameLog.append(aiReason ? `AI scroll ↑${depthAfter}${batchNote} · ${aiReason}` : `Manual scroll ↑${depthAfter}${batchNote}`, 'scroll')
    } else {
      gameLog.append(`Scroll ↑${depthAfter}${batchNote}`, 'scroll')
    }

    if (next.state.status === 'lost') {
      onTerminalGameStatus?.('lost')
      render()
      return
    }

    refreshAiHint()
    scheduleNextScroll()
    render()
  }

  function performScrollTick(manual: boolean, aiReason?: string): void {
    if (runtime.session.state.status !== 'playing') return
    if (runtime.scrollDetonateTimeoutId !== null) return

    if (runtime.scrollTimeoutId !== null) {
      window.clearTimeout(runtime.scrollTimeoutId)
      runtime.scrollTimeoutId = null
    }

    const profile = getEndlessScrollProfileForSession(runtime.session, getElapsedMs())
    const batchRows = profile.batchRows
    const leavingMines = collectScrollLeavingMineCells(runtime.session, batchRows)

    if (leavingMines.length > 0 && queueMineExplosions) {
      queueMineExplosions(leavingMines.map((cell) => ({ row: cell.screenRow, col: cell.col })))
      onScrollMineDetonate?.()
      runtime.scrollPendingTick = { manual, aiReason, batchRows }
      render()
      runtime.scrollDetonateTimeoutId = window.setTimeout(
        () => {
          runtime.scrollDetonateTimeoutId = null
          const pending = runtime.scrollPendingTick
          runtime.scrollPendingTick = null
          if (!pending || runtime.session.state.status !== 'playing') return
          commitScrollTick(pending.manual, pending.aiReason, pending.batchRows)
        },
        Math.round(SCROLL_MINE_GHOST_MS * SCROLL_COMMIT_AT)
      )
      return
    }

    commitScrollTick(manual, aiReason, batchRows)
  }

  function bumpScrollDifficultyForDebug(): boolean {
    if (runtime.session.state.status !== 'playing') return false
    markGameClockStarted()
    runtime.scrollGameStartedAt = Math.max(0, runtime.scrollGameStartedAt - getEndlessPresetForSession(runtime.session).scrollStepMs)
    if (runtime.scrollTimeoutId !== null) {
      window.clearTimeout(runtime.scrollTimeoutId)
      runtime.scrollTimeoutId = null
    }
    scheduleNextScroll()
    render()
    return true
  }

  function startScrollTimer(): void {
    if (runtime.scrollTimeoutId !== null) return
    scheduleNextScroll()
  }

  function getScrollPressureState() {
    if (runtime.session.state.status !== 'playing') return undefined
    return buildScrollPressure(runtime, runtime.scrollDeadlineAt, runtime.scrollIntervalMs)
  }

  return {
    getElapsedMs,
    markGameClockStarted,
    stopScrollTimer,
    performScrollTick,
    bumpScrollDifficultyForDebug,
    startScrollTimer,
    getScrollPressureState,
  }
}
