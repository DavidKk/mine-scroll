import { getBoardTopEventAnchor } from '../../game-stage-layout.ts'
import { clamp01, easeOutCubic } from '../../primitives/index.ts'
import { HUD_FEEDBACK_ASSETS, LIFE_LOSS_POPUP_V3_MS } from '../assets/hud-feedback-assets.ts'
import { drawSheetFrameContained, setFittedMonoFont } from '../hud/canvas-primitives.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import type { GameCanvasHudStats } from '../types.ts'

export function drawLifeLossSlash(
  _rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  progress: number,
  alpha: number,
  scale: number
): void {
  if (progress <= 0 || progress >= 1 || alpha <= 0) return
  const slashT = easeOutCubic(progress)
  const head = -length * 0.48 + length * 0.96 * slashT
  const tail = Math.max(-length * 0.48, head - length * (0.18 + slashT * 0.22))
  const fade = Math.sin(progress * Math.PI)

  shellCtx.save()
  shellCtx.translate(cx, cy)
  shellCtx.rotate(Math.PI * 0.18)
  shellCtx.globalCompositeOperation = 'lighter'
  shellCtx.lineCap = 'round'

  const trail = shellCtx.createLinearGradient(tail, 0, head, 0)
  trail.addColorStop(0, 'rgba(255, 38, 63, 0)')
  trail.addColorStop(0.45, `rgba(255, 38, 63, ${alpha * fade * 0.78})`)
  trail.addColorStop(0.72, `rgba(255, 218, 170, ${alpha * fade * 0.86})`)
  trail.addColorStop(1, `rgba(255, 255, 255, ${alpha * fade})`)

  shellCtx.shadowColor = 'rgba(255, 38, 63, 0.92)'
  shellCtx.shadowBlur = 12 * scale
  shellCtx.strokeStyle = trail
  shellCtx.lineWidth = Math.max(3.5 * scale, length * 0.018)
  shellCtx.beginPath()
  shellCtx.moveTo(tail, 0)
  shellCtx.lineTo(head, 0)
  shellCtx.stroke()

  shellCtx.shadowColor = 'rgba(255, 245, 220, 0.96)'
  shellCtx.shadowBlur = 5 * scale
  shellCtx.strokeStyle = `rgba(255, 250, 232, ${alpha * fade})`
  shellCtx.lineWidth = Math.max(1.4 * scale, length * 0.006)
  shellCtx.beginPath()
  shellCtx.moveTo(tail + length * 0.04, 0)
  shellCtx.lineTo(head, 0)
  shellCtx.stroke()

  for (let i = 0; i < 6; i += 1) {
    const sparkT = (i + 1) / 7
    const sx = head - length * 0.05 * sparkT
    const sy = (i - 2.5) * 4.5 * scale
    shellCtx.fillStyle = i % 2 === 0 ? `rgba(255, 222, 132, ${alpha * fade})` : `rgba(255, 64, 82, ${alpha * fade})`
    shellCtx.fillRect(sx, sy, Math.max(1, 5 * scale * (1 - sparkT)), Math.max(1, 1.6 * scale))
  }
  shellCtx.restore()
}

export function drawLifeLossEvent(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  event: GameCanvasHudStats['lifeLossEvent'] | null,
  startedAt: number,
  shellW: number,
  shellH: number
): void {
  if (!event || startedAt <= 0) return
  const elapsedMs = performance.now() - startedAt
  const progress = clamp01(elapsedMs / LIFE_LOSS_POPUP_V3_MS)
  if (progress >= 1) {
    rt.state.activeLifeLossEvent = null
    rt.state.lifeLossFxStartedAt = 0
    return
  }

  const stageScale = rt.state.stageLayout?.scale ?? 1
  const popupProgress = clamp01((progress - 0.1) / 0.16)
  const enter = easeOutCubic(popupProgress)
  const exit = progress > 0.78 ? easeOutCubic((progress - 0.78) / 0.22) : 0
  const alpha = enter * (1 - exit)
  const impact = progress < 0.34 ? 1 - easeOutCubic(progress / 0.34) : 0
  const frameIndex = Math.min(3, Math.floor(progress * 4))
  const eventAnchor = getBoardTopEventAnchor(rt.state.stageLayout)
  const cx = shellW / 2 + Math.sin(progress * Math.PI * 30) * impact * Math.min(shellW, shellH) * 0.005
  const fallbackY = Math.max(88 * stageScale, rt.state.boardOffsetY - 12 * stageScale)
  const cy = (eventAnchor?.y ?? fallbackY) - Math.sin(progress * Math.PI) * 8 * stageScale

  const flash = progress < 0.2 ? 1 - progress / 0.2 : 0
  if (flash > 0) {
    shellCtx.save()
    shellCtx.globalCompositeOperation = 'source-over'
    shellCtx.globalAlpha = flash * (0.2 + impact * 0.1)
    shellCtx.fillStyle = '#ff263f'
    shellCtx.fillRect(0, 0, shellW, shellH)
    shellCtx.globalCompositeOperation = 'lighter'
    shellCtx.globalAlpha = flash * (0.28 + impact * 0.12)
    const flashGlow = shellCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(shellW, shellH) * 0.5)
    flashGlow.addColorStop(0, 'rgba(255, 240, 220, 0.58)')
    flashGlow.addColorStop(0.32, 'rgba(255, 54, 72, 0.38)')
    flashGlow.addColorStop(1, 'rgba(255, 54, 72, 0)')
    shellCtx.fillStyle = flashGlow
    shellCtx.fillRect(0, 0, shellW, shellH)
    shellCtx.restore()
  }

  const slashProgress = clamp01(progress / 0.36)
  drawLifeLossSlash(rt, shellCtx, cx, cy, Math.min(140 * stageScale, shellW * 0.2), slashProgress, 0.78, stageScale * 0.82)

  const assetW = Math.min(260 * stageScale, shellW * 0.42)
  const assetH = Math.min(86 * stageScale, shellH * 0.13)
  const asset = drawSheetFrameContained(rt, shellCtx, HUD_FEEDBACK_ASSETS.lifeLossPopupSheet, frameIndex, 4, cx, cy, assetW, assetH, 0.94 + enter * 0.04 + impact * 0.12, alpha)

  const bounds = asset ?? {
    x: cx - assetW * 0.5,
    y: cy - assetH * 0.5,
    w: assetW,
    h: assetH,
  }

  if (!asset) {
    shellCtx.save()
    shellCtx.globalAlpha = alpha
    shellCtx.shadowColor = 'rgba(255, 58, 74, 0.7)'
    shellCtx.shadowBlur = 16 * stageScale
    shellCtx.beginPath()
    shellCtx.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, Math.min(14 * stageScale, bounds.h * 0.28))
    shellCtx.fillStyle = 'rgba(30, 8, 14, 0.9)'
    shellCtx.fill()
    shellCtx.strokeStyle = 'rgba(255, 68, 86, 0.82)'
    shellCtx.lineWidth = Math.max(1.2, 1.5 * stageScale)
    shellCtx.stroke()
    shellCtx.restore()
  }

  shellCtx.save()
  shellCtx.globalAlpha = alpha
  shellCtx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 12; i += 1) {
    const seed = i * 1.913
    const t = (progress * 1.25 + i * 0.071) % 1
    const side = i % 2 === 0 ? -1 : 1
    const px = cx + side * (bounds.w * (0.2 + t * 0.42)) + Math.sin(seed) * bounds.w * 0.04
    const py = cy + Math.sin(seed * 2.1 + progress * 7) * bounds.h * 0.34
    const sparkAlpha = alpha * Math.sin(t * Math.PI) * 0.72
    shellCtx.fillStyle = i % 3 === 0 ? `rgba(255, 196, 86, ${sparkAlpha})` : `rgba(255, 64, 82, ${sparkAlpha})`
    shellCtx.beginPath()
    shellCtx.arc(px, py, Math.max(1, 1.2 * stageScale), 0, Math.PI * 2)
    shellCtx.fill()
  }
  shellCtx.restore()

  const text = `LIFE -${Math.max(1, event.damage)}`
  shellCtx.save()
  shellCtx.globalAlpha = alpha
  shellCtx.textAlign = 'center'
  shellCtx.textBaseline = 'middle'
  setFittedMonoFont(rt, shellCtx, text, bounds.w * 0.58, Math.min(26 * stageScale, bounds.h * 0.34), 13 * stageScale, 1000)
  shellCtx.lineWidth = Math.max(2, bounds.h * 0.05)
  shellCtx.strokeStyle = 'rgba(3, 7, 18, 0.94)'
  shellCtx.shadowColor = 'rgba(255, 58, 74, 0.92)'
  shellCtx.shadowBlur = 10 * stageScale + impact * 8 * stageScale
  shellCtx.strokeText(text, bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.52)
  shellCtx.fillStyle = '#ffe6e0'
  shellCtx.fillText(text, bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.52)
  shellCtx.restore()

  rt.scheduleAnimationFrame()
}
