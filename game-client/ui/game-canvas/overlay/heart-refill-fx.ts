import { drawImageContained, GAME_ASSET_TUNING, getGameCutout } from '../../game-assets.ts'
import type { LivesDisplay } from '../../hud-sprites.ts'
import { hudHeartRowMetrics } from '../hud/lives-hud.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'

export function heartCutoutVisualOffset(_rt: GameCanvasRuntime, iconSize: number, containerScale = 1): { x: number; y: number } {
  const drawW = iconSize * containerScale * 1.18 * (320 / 471)
  const drawH = iconSize * containerScale * 1.18
  return {
    x: (0.503125 - 0.5) * drawW,
    y: (0.382166 - 0.5) * drawH,
  }
}

export function drawHeartRefillFx(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D, _shellW: number, _shellH: number): void {
  if (rt.state.heartRefillFxStartedAt <= 0 || !rt.state.stageLayout) return
  const durationMs = GAME_ASSET_TUNING.fx.heartRefillHud.durationMs
  const t = Math.min(1, (performance.now() - rt.state.heartRefillFxStartedAt) / durationMs)
  if (t >= 1) {
    rt.state.heartRefillFxStartedAt = 0
    return
  }
  const stageScale = rt.state.stageLayout.scale
  const hudY = rt.state.stageLayout.hudY + (rt.state.stageLayout.profile === 'mobile' ? 3 : 7) * stageScale
  const lives: LivesDisplay = { current: rt.state.heartRefillTargetIndex + 1, max: rt.state.heartRefillMax }
  const metrics = hudHeartRowMetrics(rt, rt.state.stageLayout.livesAnchor.x, hudY, lives, stageScale)
  const slotCx = metrics.x + rt.state.heartRefillTargetIndex * (metrics.iconSize + metrics.gap) + metrics.iconSize / 2
  const slotCy = metrics.cy
  const burst = Math.max(0, Math.min(1, t / 0.68))
  const popIn = Math.max(0, Math.min(1, (t - 0.08) / 0.38))
  const settle = Math.max(0, Math.min(1, (t - 0.5) / 0.26))
  const popScale = settle > 0 ? 1.12 - 0.12 * (1 - (1 - settle) ** 3) : 0.72 + Math.sin(popIn * Math.PI * 0.5) * 0.4
  const iconSize = metrics.iconSize
  const drawScale = Math.max(0.72, popScale)
  const visualOffset = heartCutoutVisualOffset(rt, iconSize, drawScale)
  const cx = slotCx + visualOffset.x
  const cy = slotCy + visualOffset.y

  shellCtx.save()
  shellCtx.globalCompositeOperation = 'lighter'
  const ringAlpha = (1 - burst) * 0.72
  if (ringAlpha > 0) {
    shellCtx.strokeStyle = `rgba(255, 213, 92, ${ringAlpha})`
    shellCtx.lineWidth = Math.max(1.2, 2.5 * stageScale * (1 - burst * 0.55))
    shellCtx.beginPath()
    shellCtx.arc(cx, cy, iconSize * (0.42 + burst * 0.72), 0, Math.PI * 2)
    shellCtx.stroke()
    shellCtx.strokeStyle = `rgba(45, 236, 255, ${ringAlpha * 0.55})`
    shellCtx.lineWidth = Math.max(1, 1.7 * stageScale * (1 - burst * 0.4))
    shellCtx.beginPath()
    shellCtx.arc(cx, cy, iconSize * (0.28 + burst * 0.52), 0, Math.PI * 2)
    shellCtx.stroke()
  }

  for (let i = 0; i < 10; i += 1) {
    const angle = i * ((Math.PI * 2) / 10) - Math.PI / 2
    const dist = iconSize * (0.28 + burst * 0.82) * (i % 2 === 0 ? 1 : 0.72)
    const alpha = (1 - burst) * 0.72
    shellCtx.fillStyle = i % 3 === 0 ? `rgba(255, 213, 92, ${alpha})` : `rgba(45, 236, 255, ${alpha})`
    shellCtx.beginPath()
    shellCtx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.82, Math.max(1.1, iconSize * (0.065 - burst * 0.035)), 0, Math.PI * 2)
    shellCtx.fill()
  }

  shellCtx.globalCompositeOperation = 'source-over'
  const refillCutout = getGameCutout('heart-refill')
  if (refillCutout) {
    const drawSize = iconSize * drawScale
    shellCtx.globalAlpha = Math.min(1, 0.35 + popIn * 0.9)
    shellCtx.shadowColor = 'rgba(255, 213, 92, 0.5)'
    shellCtx.shadowBlur = iconSize * 0.34
    drawImageContained(shellCtx, refillCutout, slotCx - drawSize / 2, slotCy - drawSize / 2, drawSize, drawSize, 1.18)
  }
  shellCtx.restore()

  if (t < 1) rt.scheduleAnimationFrame()
}
