import type { CellView } from '@shared/core/types.ts'

import { clamp01, easeOutCubic } from '../../primitives/index.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'

/** Old board fade-out — brief cue that the board was cleared. */
const OUTGOING_FADE_MS = 200
/** New board appears (at min alpha) before outgoing fully gone. */
const INCOMING_START_MS = 60
/** Ripple wave speed — same pacing as before; board advance starts at INCOMING_MIN_ALPHA instead of 0. */
const BOARD_ADVANCE_RIPPLE_MS = 620
/** Incoming board is never fully invisible — 0.5→1 feels snappier without speeding the ripple. */
export const BOARD_ADVANCE_MIN_ALPHA = 0.5

export const BOARD_ADVANCE_MS = Math.max(OUTGOING_FADE_MS, INCOMING_START_MS + BOARD_ADVANCE_RIPPLE_MS)

export interface BoardAdvanceProgress {
  progress: number
  outgoingAlpha: number
  incomingReveal: number
  incomingVisible: boolean
  incomingMinAlpha: number
  complete: boolean
  animating: boolean
}

export function isBoardAdvanceActive(rt: GameCanvasRuntime): boolean {
  return rt.state.boardAdvanceStartedAt > 0
}

export function beginBoardAdvance(rt: GameCanvasRuntime, outgoingViews: CellView[], incomingViews: CellView[], onComplete: () => void): void {
  rt.state.boardAdvanceStartedAt = performance.now()
  rt.state.boardAdvanceOutgoingViews = outgoingViews
  rt.state.boardAdvanceIncomingViews = incomingViews
  rt.state.boardAdvanceOnComplete = onComplete
  rt.state.boardLayerCacheKey = ''
  rt.scheduleAnimationFrame()
}

export function isBoardAdvanceBlockingInput(rt: GameCanvasRuntime, now: number): boolean {
  if (!isBoardAdvanceActive(rt)) return false
  const progress = updateBoardAdvance(rt, now)
  return progress.animating
}

export function updateBoardAdvance(rt: GameCanvasRuntime, now: number): BoardAdvanceProgress {
  if (rt.state.boardAdvanceStartedAt <= 0) {
    return {
      progress: 1,
      outgoingAlpha: 0,
      incomingReveal: 1,
      incomingVisible: false,
      incomingMinAlpha: 0,
      complete: true,
      animating: false,
    }
  }

  const elapsed = now - rt.state.boardAdvanceStartedAt
  const raw = clamp01(elapsed / BOARD_ADVANCE_MS)

  let outgoingAlpha = 0
  let incomingReveal = 0
  const incomingVisible = elapsed >= INCOMING_START_MS

  if (elapsed < OUTGOING_FADE_MS) {
    outgoingAlpha = 1 - easeOutCubic(elapsed / OUTGOING_FADE_MS)
  }

  if (incomingVisible) {
    incomingReveal = clamp01((elapsed - INCOMING_START_MS) / BOARD_ADVANCE_RIPPLE_MS)
  }

  if (raw >= 1) {
    const onComplete = rt.state.boardAdvanceOnComplete
    rt.state.boardAdvanceStartedAt = 0
    rt.state.boardAdvanceOutgoingViews = null
    rt.state.boardAdvanceIncomingViews = null
    rt.state.boardAdvanceOnComplete = null
    rt.state.boardLayerCacheKey = ''
    onComplete?.()
    return {
      progress: 1,
      outgoingAlpha: 0,
      incomingReveal: 1,
      incomingVisible: false,
      incomingMinAlpha: 0,
      complete: true,
      animating: false,
    }
  }

  rt.scheduleAnimationFrame()

  return {
    progress: raw,
    outgoingAlpha,
    incomingReveal,
    incomingVisible,
    incomingMinAlpha: BOARD_ADVANCE_MIN_ALPHA,
    complete: false,
    animating: true,
  }
}
