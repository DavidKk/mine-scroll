import type { GameCanvasRuntime } from './context.ts'

export const FLAG_SWIPE_PRESS_MS = 240
export const FLAG_SWIPE_SWIPE_MS = 820
/** Hold swipe chrome after commit so flag-pop FX reads before cleanup. */
export const FLAG_SWIPE_COMMIT_HOLD_MS = 220
export const FLAG_SWIPE_PREVIEW_MS = FLAG_SWIPE_PRESS_MS + FLAG_SWIPE_SWIPE_MS + FLAG_SWIPE_COMMIT_HOLD_MS

export type FlagSwipePreviewOptions = {
  /** Fires at swipe release — same moment as mobile toggleFlag after swipe-up. */
  onSwipeCommit?: () => void
}

type ActiveFlagSwipe = {
  rt: GameCanvasRuntime
  finish: () => void
}

let active: ActiveFlagSwipe | null = null

function clearFlagSwipeVisual(rt: GameCanvasRuntime): void {
  rt.state.boardPointer = null
  rt.state.flagSwipePreview = null
  rt.state.attractFlagSwipeHint = null
}

/** Cancel in-flight attract / tutorial swipe preview (e.g. on unmount). */
export function cancelFlagSwipePreview(rt?: GameCanvasRuntime): void {
  if (!active) return
  if (rt && active.rt !== rt) return
  active.finish()
}

/** Attract / tutorial — mimic mobile swipe-up flag without real pointer input. */
export function playFlagSwipePreview(rt: GameCanvasRuntime, row: number, col: number, options: FlagSwipePreviewOptions = {}): Promise<void> {
  cancelFlagSwipePreview(rt)

  return new Promise((resolve) => {
    let pressTimer = 0
    let commitTimer = 0
    let finishTimer = 0
    let finished = false
    const startedAt = performance.now()

    const finish = (): void => {
      if (finished) return
      finished = true
      if (active?.finish === finish) active = null
      window.clearTimeout(pressTimer)
      window.clearTimeout(commitTimer)
      window.clearTimeout(finishTimer)
      clearFlagSwipeVisual(rt)
      rt.scheduleAnimationFrame()
      resolve()
    }

    active = { rt, finish }

    rt.state.boardPointer = { row, col, pressed: true }
    rt.state.flagSwipePreview = null
    rt.state.attractFlagSwipeHint = { row, col, startedAt }
    rt.scheduleContinuousRepaint()

    pressTimer = window.setTimeout(() => {
      rt.state.flagSwipePreview = { row, col, active: true }
      rt.scheduleContinuousRepaint()
      commitTimer = window.setTimeout(() => {
        options.onSwipeCommit?.()
        rt.scheduleContinuousRepaint()
        finishTimer = window.setTimeout(finish, FLAG_SWIPE_COMMIT_HOLD_MS)
      }, FLAG_SWIPE_SWIPE_MS)
    }, FLAG_SWIPE_PRESS_MS)
  })
}
