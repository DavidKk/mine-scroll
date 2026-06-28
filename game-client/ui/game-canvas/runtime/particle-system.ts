import { GAME_ASSET_TUNING } from '../../game-assets.ts'
import { getBottomFeedbackSlots as resolveBottomFeedbackSlots } from '../../game-stage-layout.ts'
import { HUD_FEEDBACK_ASSETS } from '../assets/hud-feedback-assets.ts'
import { comboColor } from '../hud/canvas-primitives.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'

export function getComboFeedbackAnchor(rt: GameCanvasRuntime): { x: number; y: number } {
  return getBottomFeedbackSlots(rt).comboBurst
}

export function getBottomFeedbackSlots(rt: GameCanvasRuntime): {
  comboBurst: { x: number; y: number }
  scorePop: { x: number; y: number }
} {
  const layout =
    rt.state.stageLayout && rt.state.squareLayout
      ? {
          scale: rt.state.stageLayout.scale,
          boardOffsetY: rt.state.boardOffsetY,
          gridOriginY: rt.state.squareLayout.gridOriginY,
          cellStep: rt.state.squareLayout.grid.cellStep,
          cellSize: rt.state.squareLayout.grid.cellSize,
          visibleRows: rt.state.currentRows,
          bottomRailY: rt.state.stageLayout.bottomRailRect.y,
        }
      : null
  return resolveBottomFeedbackSlots(rt.state.width, rt.state.height, layout)
}

export function spawnComboParticles(rt: GameCanvasRuntime, combo: number): void {
  const now = performance.now()
  const palette = comboColor(rt, combo)
  const heavy = rt.state.scoreFxStartedAt > 0 && now - rt.state.scoreFxStartedAt < GAME_ASSET_TUNING.fx.scorePop.durationMs
  const particleScale = heavy ? 0.55 : 1
  const count = Math.max(heavy ? 4 : 6, Math.round(Math.min(42, 14 + Math.floor(combo / 2)) * GAME_ASSET_TUNING.fx.comboBurst.particleScale * particleScale))
  const { x: originX, y: originY } = getComboFeedbackAnchor(rt)

  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.45
    const speed = 1.4 + Math.random() * 3.1 + Math.min(3, combo / 24)
    rt.state.particles.push({
      x: originX + (Math.random() - 0.5) * 80,
      y: originY + (Math.random() - 0.5) * 16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2.6,
      size: (2.2 + Math.random() * 3.8) * GAME_ASSET_TUNING.fx.comboBurst.particleScale,
      color: palette.stroke,
      startedAt: now,
      durationMs: GAME_ASSET_TUNING.fx.comboBurst.durationMs + Math.random() * 260,
    })
  }
  while (rt.state.particles.length > 120) {
    rt.state.particles.shift()
  }
  rt.scheduleAnimationFrame()
}

export function spawnScoreHudParticles(rt: GameCanvasRuntime): void {
  if (!rt.state.stageLayout) return
  const now = performance.now()
  const scale = rt.state.stageLayout.scale
  const hudY = rt.state.stageLayout.hudY + 7 * scale
  const panelCx = rt.state.stageLayout.scoreAnchor.x + 118 * scale
  const panelCy = hudY + 27 * scale
  const maxW = 248 * scale
  const maxH = 80 * scale
  const fit =
    HUD_FEEDBACK_ASSETS.scorePanelV6.complete && HUD_FEEDBACK_ASSETS.scorePanelV6.naturalWidth > 0
      ? Math.min(maxW / HUD_FEEDBACK_ASSETS.scorePanelV6.naturalWidth, maxH / HUD_FEEDBACK_ASSETS.scorePanelV6.naturalHeight)
      : 1
  const panelW = HUD_FEEDBACK_ASSETS.scorePanelV6.complete ? HUD_FEEDBACK_ASSETS.scorePanelV6.naturalWidth * fit : maxW
  const panelH = HUD_FEEDBACK_ASSETS.scorePanelV6.complete ? HUD_FEEDBACK_ASSETS.scorePanelV6.naturalHeight * fit : maxH
  const left = panelCx - panelW / 2 + panelW * 0.34
  const right = left + panelW * 0.52
  const cy = panelCy - panelH / 2 + panelH * 0.475
  const count = Math.max(8, Math.round(12 * scale))

  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI * (0.18 + Math.random() * 0.64)
    const speed = 0.8 + Math.random() * 1.8
    rt.state.particles.push({
      x: left + Math.random() * Math.max(8, right - left),
      y: cy + (Math.random() - 0.5) * 10 * scale,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.3,
      size: (1.2 + Math.random() * 2.1) * scale,
      color: Math.random() > 0.78 ? 'rgba(255, 190, 55, 0.95)' : 'rgba(76, 232, 255, 0.95)',
      startedAt: now,
      durationMs: 360 + Math.random() * 180,
    })
  }
  while (rt.state.particles.length > 140) rt.state.particles.shift()
  rt.scheduleAnimationFrame()
}

export function drawParticles(rt: GameCanvasRuntime, particleCtx: CanvasRenderingContext2D, now: number): void {
  if (rt.state.particles.length === 0) return
  particleCtx.save()
  for (const fx of rt.state.particles) {
    const t = Math.max(0, Math.min(1, (now - fx.startedAt) / fx.durationMs))
    const alpha = 1 - t
    const gravity = 2.2 * t * t
    const x = fx.x + fx.vx * t * 42
    const y = fx.y + fx.vy * t * 42 + gravity * 16
    particleCtx.globalAlpha = alpha
    particleCtx.fillStyle = fx.color
    particleCtx.beginPath()
    particleCtx.arc(x, y, fx.size * (1 - t * 0.35), 0, Math.PI * 2)
    particleCtx.fill()
  }
  particleCtx.restore()
  if (rt.state.particles.length > 0) rt.scheduleAnimationFrame()
}
