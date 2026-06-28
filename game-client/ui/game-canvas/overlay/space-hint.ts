import { clamp01, easeOutCubic, fillRounded, roundedRectPath, strokeRounded } from '../../primitives/index.ts'
import type { ScrollPressureState } from '../../renderer/index.ts'
import { FONTS } from '../../theme.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { RUNTIME_CONSTANTS } from '../runtime/state.ts'

export interface ScrollButtonRevealState {
  widthScale: number
  heightScale: number
  contentAlpha: number
  animating: boolean
  interactable: boolean
}

export function updateScrollButtonReveal(rt: GameCanvasRuntime, enabled: boolean): ScrollButtonRevealState {
  if (!enabled) {
    rt.state.scrollButtonRevealStartedAt = 0
    return { widthScale: 0, heightScale: 0, contentAlpha: 0, animating: false, interactable: false }
  }

  if (rt.state.scrollButtonRevealStartedAt <= 0) {
    rt.state.scrollButtonRevealStartedAt = performance.now()
  }

  const elapsed = performance.now() - rt.state.scrollButtonRevealStartedAt
  const {
    SCROLL_BUTTON_REVEAL_WIDTH_MS,
    SCROLL_BUTTON_REVEAL_HEIGHT_MS,
    SCROLL_BUTTON_REVEAL_HEIGHT_DELAY_MS,
    SCROLL_BUTTON_REVEAL_CONTENT_DELAY_MS,
    SCROLL_BUTTON_REVEAL_CONTENT_MS,
  } = RUNTIME_CONSTANTS

  const widthScale = easeOutCubic(elapsed / SCROLL_BUTTON_REVEAL_WIDTH_MS)
  const heightElapsed = elapsed - SCROLL_BUTTON_REVEAL_HEIGHT_DELAY_MS
  const lineHeightScale = 0.1
  const heightScale = heightElapsed <= 0 ? lineHeightScale : lineHeightScale + easeOutCubic(heightElapsed / SCROLL_BUTTON_REVEAL_HEIGHT_MS) * (1 - lineHeightScale)
  const contentElapsed = elapsed - SCROLL_BUTTON_REVEAL_CONTENT_DELAY_MS
  const contentAlpha = contentElapsed <= 0 ? 0 : easeOutCubic(contentElapsed / SCROLL_BUTTON_REVEAL_CONTENT_MS)
  const animating = elapsed < SCROLL_BUTTON_REVEAL_CONTENT_DELAY_MS + SCROLL_BUTTON_REVEAL_CONTENT_MS
  const interactable = widthScale >= 0.98 && heightScale >= 0.98 && contentAlpha >= 0.95

  return { widthScale, heightScale, contentAlpha, animating, interactable }
}

/** Center anchor: expand along the bottom energy line, then grow height. */
export function applyScrollButtonRevealRect(
  rect: { x: number; y: number; w: number; h: number },
  widthScale: number,
  heightScale: number
): { x: number; y: number; w: number; h: number } {
  if (widthScale <= 0 || heightScale <= 0) {
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    return { x: cx, y: cy, w: 0, h: 0 }
  }
  const w = Math.max(1, rect.w * clamp01(widthScale))
  const h = Math.max(1, rect.h * clamp01(heightScale))
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

function drawScrollArrowIcon(shellCtx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  const half = size * 0.34
  const headY = cy - size * 0.3
  const tailY = cy + size * 0.3

  shellCtx.save()
  shellCtx.strokeStyle = color
  shellCtx.lineWidth = Math.max(2, size * 0.14)
  shellCtx.lineCap = 'round'
  shellCtx.lineJoin = 'round'
  shellCtx.beginPath()
  shellCtx.moveTo(cx, headY)
  shellCtx.lineTo(cx - half, cy + size * 0.02)
  shellCtx.moveTo(cx, headY)
  shellCtx.lineTo(cx + half, cy + size * 0.02)
  shellCtx.moveTo(cx, headY + size * 0.02)
  shellCtx.lineTo(cx, tailY)
  shellCtx.stroke()
  shellCtx.restore()
}

function layoutScrollButtonContent(
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  scale: number,
  fullHeight: number
): {
  iconCx: number
  iconCy: number
  iconSize: number
  labelX: number
  fontSize: number
} {
  const fontSize = Math.max(10, 11 * scale)
  shellCtx.font = `900 ${fontSize}px ${FONTS.mono}`
  const textW = shellCtx.measureText('SCROLL').width
  const iconSize = Math.max(18, Math.min(24 * scale, fullHeight * 0.52))
  const iconSpan = iconSize * 0.76
  const gap = Math.max(7, 9 * scale)
  const contentW = iconSpan + gap + textW
  const padX = Math.max(12 * scale, (rect.w - contentW) / 2)
  const startX = rect.x + padX

  return {
    iconCx: startX + iconSpan * 0.5,
    iconCy: rect.y + rect.h * 0.5,
    iconSize,
    labelX: startX + iconSpan + gap,
    fontSize,
  }
}

function drawScrollButton(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  fullRect: { x: number; y: number; w: number; h: number },
  pressure: ScrollPressureState | undefined,
  scale: number,
  contentAlpha: number
): void {
  if (rect.w <= 0.5 || rect.h <= 0.5) return

  const progress = clamp01(pressure?.progress ?? 0)
  const urgent = Boolean(pressure?.urgent)
  const active = rt.state.uiHoverTarget === 'space'
  const pulse = 0.5 + Math.sin(Date.now() / (urgent ? 210 : 520)) * 0.5
  const glowColor = urgent ? `rgba(251, 191, 36, ${0.48 + pulse * 0.22})` : `rgba(45, 236, 255, ${0.28 + progress * 0.22 + (active ? 0.16 : 0)})`
  const borderA = urgent ? 'rgba(251, 191, 36, 0.92)' : 'rgba(45, 236, 255, 0.72)'
  const borderB = urgent ? 'rgba(239, 68, 68, 0.8)' : 'rgba(168, 85, 247, 0.62)'
  const labelColor = urgent ? '#fef08a' : '#dbeafe'
  const iconColor = urgent ? '#fff7ad' : '#cffafe'
  const radius = Math.min(12 * scale, Math.max(2, rect.h * 0.28))

  shellCtx.save()
  shellCtx.shadowColor = glowColor
  shellCtx.shadowBlur = (urgent ? 18 : 12) * scale

  const bg = shellCtx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h)
  bg.addColorStop(0, urgent ? 'rgba(69, 52, 8, 0.96)' : 'rgba(15, 23, 42, 0.94)')
  bg.addColorStop(0.52, urgent ? 'rgba(41, 18, 8, 0.92)' : 'rgba(3, 7, 18, 0.92)')
  bg.addColorStop(1, urgent ? 'rgba(127, 29, 29, 0.82)' : 'rgba(17, 24, 39, 0.86)')
  fillRounded(shellCtx, rect.x, rect.y, rect.w, rect.h, radius, bg)

  const border = shellCtx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y)
  border.addColorStop(0, borderB)
  border.addColorStop(0.5, borderA)
  border.addColorStop(1, borderB)
  strokeRounded(shellCtx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, radius, border, Math.max(1.2, 1.5 * scale))

  shellCtx.globalCompositeOperation = 'lighter'
  const sheen = shellCtx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0)')
  sheen.addColorStop(0.48, urgent ? 'rgba(251, 191, 36, 0.18)' : 'rgba(45, 236, 255, 0.13)')
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)')
  shellCtx.fillStyle = sheen
  shellCtx.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)

  shellCtx.shadowBlur = 0
  if (contentAlpha > 0) {
    const chargeH = Math.max(3, 4 * scale)
    const chargeW = Math.max(10 * scale, rect.w * (1 - progress))
    const chargeX = rect.x + (rect.w - chargeW) / 2
    const chargeY = rect.y + rect.h - chargeH
    const chargeFill = urgent ? 'rgba(254, 240, 138, 0.8)' : 'rgba(125, 211, 252, 0.62)'
    shellCtx.save()
    roundedRectPath(shellCtx, rect.x, rect.y, rect.w, rect.h, radius)
    shellCtx.clip()
    shellCtx.globalAlpha = contentAlpha
    fillRounded(shellCtx, chargeX, chargeY, chargeW, chargeH, chargeH / 2, chargeFill)
    shellCtx.restore()
  }
  shellCtx.globalCompositeOperation = 'source-over'

  if (contentAlpha > 0.01) {
    const { iconCx, iconCy, iconSize, labelX, fontSize } = layoutScrollButtonContent(shellCtx, rect, scale, fullRect.h)
    shellCtx.save()
    shellCtx.globalAlpha = contentAlpha
    const iconBg = shellCtx.createRadialGradient(iconCx, iconCy, 0, iconCx, iconCy, iconSize * 0.86)
    iconBg.addColorStop(0, urgent ? 'rgba(251, 191, 36, 0.34)' : 'rgba(45, 236, 255, 0.24)')
    iconBg.addColorStop(1, 'rgba(15, 23, 42, 0)')
    shellCtx.fillStyle = iconBg
    shellCtx.beginPath()
    shellCtx.arc(iconCx, iconCy, iconSize * 0.66, 0, Math.PI * 2)
    shellCtx.fill()
    drawScrollArrowIcon(shellCtx, iconCx, iconCy, iconSize * 0.72, iconColor)

    shellCtx.textAlign = 'left'
    shellCtx.textBaseline = 'middle'
    shellCtx.fillStyle = labelColor
    shellCtx.font = `900 ${fontSize}px ${FONTS.mono}`
    shellCtx.fillText('SCROLL', labelX, iconCy + 0.5 * scale)
    shellCtx.restore()
  }

  shellCtx.restore()
}

export function drawSpaceHint(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  pressure: ScrollPressureState | undefined,
  scale: number,
  reveal: ScrollButtonRevealState
): void {
  const drawRect = applyScrollButtonRevealRect(rect, reveal.widthScale, reveal.heightScale)
  drawScrollButton(rt, shellCtx, drawRect, rect, pressure, scale, reveal.contentAlpha)
  rt.scheduleContinuousRepaint()
}

export function getSpaceHintRect(rt: GameCanvasRuntime, _pressure: ScrollPressureState | undefined): { x: number; y: number; w: number; h: number } | null {
  return rt.state.stageLayout?.spaceButtonRect ?? null
}
