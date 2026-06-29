import { GAME_ASSET_TUNING } from '../../game-assets.ts'
import { LIFE_LOSS_POPUP_V3_MS } from '../assets/hud-feedback-assets.ts'
import type { GameCanvasRuntime } from './context.ts'
import { ambientFrameMs, shouldForceFullscreenAmbient } from './mobile-perf.ts'
import { RUNTIME_CONSTANTS } from './state.ts'

export function stopPressureRepaint(rt: GameCanvasRuntime): void {
  if (rt.state.pressureRepaintId !== null) {
    window.clearInterval(rt.state.pressureRepaintId)
    rt.state.pressureRepaintId = null
  }
  if (rt.state.ambientDelayId !== null) {
    window.clearTimeout(rt.state.ambientDelayId)
    rt.state.ambientDelayId = null
  }
}

export function cancelScheduledPaint(rt: GameCanvasRuntime): void {
  stopPressureRepaint(rt)
  if (rt.state.animationFrameId !== null) {
    window.cancelAnimationFrame(rt.state.animationFrameId)
    rt.state.animationFrameId = null
  }
}

export function needsContinuousRepaint(rt: GameCanvasRuntime, now: number): 'full' | 'ambient' | false {
  if (rt.state.cellEffects.length > 0 || rt.state.particles.length > 0) return 'full'
  if (rt.state.heartRefillFxStartedAt > 0 && now - rt.state.heartRefillFxStartedAt < GAME_ASSET_TUNING.fx.heartRefillHud.durationMs) {
    return 'full'
  }
  if (rt.state.levelUpFxStartedAt > 0 && now - rt.state.levelUpFxStartedAt < GAME_ASSET_TUNING.fx.levelUp.durationMs) {
    return 'full'
  }
  if (rt.state.pendingPanelTransition) return 'full'
  if (rt.state.activeDifficultyAlert && now - rt.state.activeDifficultyAlert.startedAt < RUNTIME_CONSTANTS.DIFFICULTY_ALERT_MS) {
    return 'full'
  }
  if (rt.state.scoreFxStartedAt > 0 && now - rt.state.scoreFxStartedAt < RUNTIME_CONSTANTS.SCORE_HUD_PULSE_MS) {
    return 'full'
  }
  if (rt.state.scoreCountUpStartedAt > 0 && now - rt.state.scoreCountUpStartedAt < RUNTIME_CONSTANTS.SCORE_COUNT_UP_MS && rt.state.scoreCountUpTo > rt.state.scoreCountUpFrom) {
    return 'full'
  }
  if (rt.state.activeBreakEvent && rt.state.breakFxStartedAt > 0) return 'full'
  if (rt.state.activeLifeLossEvent && rt.state.lifeLossFxStartedAt > 0 && now - rt.state.lifeLossFxStartedAt < LIFE_LOSS_POPUP_V3_MS) {
    return 'full'
  }
  if (rt.state.lastCombo > 1 && rt.state.comboFxStartedAt > 0) {
    const comboAge = now - rt.state.comboFxStartedAt
    if (comboAge < GAME_ASSET_TUNING.fx.comboBurst.durationMs) return 'full'
  }
  if (rt.state.lastCombo > 1 && rt.state.currentStatus === 'playing') return 'ambient'
  if (rt.fullscreen && shouldForceFullscreenAmbient(rt.state.width, rt.state.currentStatus)) return 'ambient'
  if (rt.state.currentStatus === 'idle') return 'ambient'
  if (rt.state.currentStatus !== 'playing') return false
  if (rt.state.boardPointer !== null) return 'ambient'
  if (rt.state.flagSwipePreview?.active) return 'ambient'
  if (rt.getScrollPressureFn?.()) return 'ambient'
  return false
}

export function startAmbientLoop(rt: GameCanvasRuntime): void {
  if (!rt.fullscreen) return
  rt.state.lastBackdropSampleAt = 0
  rt.scheduleContinuousRepaint()
}

const HEAVY_FULL_FRAME_MS = 1000 / 30
const HEAVY_CELL_FX_COUNT = 16
const HEAVY_PARTICLE_COUNT = 60

function repaintDelayMs(rt: GameCanvasRuntime, mode: 'full' | 'ambient'): number {
  const ambientGap = ambientFrameMs(rt.state.width)
  const minGap =
    mode === 'full' && (rt.state.cellEffects.length > HEAVY_CELL_FX_COUNT || rt.state.particles.length > HEAVY_PARTICLE_COUNT)
      ? HEAVY_FULL_FRAME_MS
      : mode === 'full'
        ? 0
        : ambientGap
  return Math.max(0, minGap - (performance.now() - rt.state.lastPaintAt))
}

export function scheduleContinuousRepaint(rt: GameCanvasRuntime): void {
  if (typeof window === 'undefined') return
  const mode = needsContinuousRepaint(rt, performance.now())
  if (!mode) return
  if (rt.state.animationFrameId !== null) return
  if (mode === 'full' && rt.state.ambientDelayId !== null) {
    window.clearTimeout(rt.state.ambientDelayId)
    rt.state.ambientDelayId = null
  }
  if (mode === 'ambient' && rt.state.ambientDelayId !== null) return

  const delay = repaintDelayMs(rt, mode)
  if (delay <= 1) {
    rt.scheduleAnimationFrame()
    return
  }
  rt.state.ambientDelayId = window.setTimeout(() => {
    rt.state.ambientDelayId = null
    rt.scheduleAnimationFrame()
  }, delay)
}

/** Coalesce state updates into the rAF paint loop; one-shot when not in continuous mode. */
export function requestRepaint(rt: GameCanvasRuntime): void {
  scheduleContinuousRepaint(rt)
  if (!needsContinuousRepaint(rt, performance.now())) {
    scheduleAnimationFrameImpl(rt)
  }
}

export function syncPressureRepaint(rt: GameCanvasRuntime): void {
  if (!rt.getScrollPressureFn?.()) {
    stopPressureRepaint(rt)
    return
  }
  rt.scheduleContinuousRepaint()
}

export function scheduleAnimationFrameImpl(rt: GameCanvasRuntime): void {
  if (typeof window === 'undefined') return
  if (rt.state.animationFrameId !== null) return
  rt.state.animationFrameId = window.requestAnimationFrame(() => {
    rt.state.animationFrameId = null
    rt.paint()
  })
}

export function bindPaintScheduler(rt: GameCanvasRuntime): void {
  rt.scheduleAnimationFrame = () => scheduleAnimationFrameImpl(rt)
  rt.scheduleContinuousRepaint = () => scheduleContinuousRepaint(rt)
}
