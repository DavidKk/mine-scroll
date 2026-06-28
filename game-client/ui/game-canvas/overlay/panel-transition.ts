import { clamp01 } from '../../primitives/index.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'

export function panelTransitionProgress(rt: GameCanvasRuntime, kind: 'start' | 'retry', now: number): number {
  if (!rt.state.pendingPanelTransition || rt.state.pendingPanelTransition.kind !== kind) return 0
  return clamp01((now - rt.state.pendingPanelTransition.startedAt) / rt.state.pendingPanelTransition.durationMs)
}

export function clearPendingPanelTransition(rt: GameCanvasRuntime): void {
  if (!rt.state.pendingPanelTransition) return
  window.clearTimeout(rt.state.pendingPanelTransition.timerId)
  rt.state.pendingPanelTransition = null
}

export function beginPanelTransition(rt: GameCanvasRuntime, kind: 'start' | 'retry', action: () => void): void {
  if (rt.state.pendingPanelTransition) return
  const durationMs = 420
  const startedAt = performance.now()
  const timerId = window.setTimeout(() => {
    if (!rt.state.pendingPanelTransition || rt.state.pendingPanelTransition.startedAt !== startedAt) return
    rt.state.pendingPanelTransition = null
    action()
    rt.scheduleAnimationFrame()
  }, durationMs)
  rt.state.pendingPanelTransition = { kind, startedAt, durationMs, timerId }
  rt.scheduleAnimationFrame()
}
