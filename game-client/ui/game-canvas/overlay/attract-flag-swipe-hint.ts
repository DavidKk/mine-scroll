import { cellPixelOrigin, FONTS } from '../../theme.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { FLAG_SWIPE_PREVIEW_MS } from '../runtime/flag-swipe-preview.ts'

const HINT_MS = FLAG_SWIPE_PREVIEW_MS

/** Shell-level swipe cue — visible even on scaled landing preview. */
export function drawAttractFlagSwipeHint(rt: GameCanvasRuntime, ctx: CanvasRenderingContext2D, now: number): void {
  const hint = rt.state.attractFlagSwipeHint
  const layout = rt.state.squareLayout
  if (!hint || !layout) return

  const age = now - hint.startedAt
  if (age > HINT_MS) return

  const { x, y } = cellPixelOrigin(hint.row, hint.col, layout.gridOriginX, layout.gridOriginY, layout.grid)
  const cellSize = layout.grid.cellSize
  const cx = rt.state.boardOffsetX + x + cellSize / 2
  const cy = rt.state.boardOffsetY + y + cellSize / 2
  const pulse = 0.55 + Math.sin(age / 120) * 0.2
  const travel = Math.min(1, Math.max(0, (age - 180) / 520))
  const fadeIn = Math.min(1, age / 180)
  const fadeOut = age > HINT_MS - 220 ? Math.max(0, (HINT_MS - age) / 220) : 1
  const alpha = pulse * fadeIn * fadeOut

  ctx.save()
  ctx.globalAlpha = alpha

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'
  ctx.fillStyle = 'rgba(251, 191, 36, 0.95)'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const startY = cy + cellSize * 0.22
  const endY = cy - cellSize * (0.55 + travel * 0.35)
  ctx.beginPath()
  ctx.moveTo(cx, startY)
  ctx.lineTo(cx, endY)
  ctx.stroke()

  const head = cellSize * 0.16
  ctx.beginPath()
  ctx.moveTo(cx, endY)
  ctx.lineTo(cx - head * 0.75, endY + head)
  ctx.lineTo(cx + head * 0.75, endY + head)
  ctx.closePath()
  ctx.fill()

  for (let i = 0; i < 2; i += 1) {
    const ghostT = Math.max(0, travel - i * 0.22)
    if (ghostT <= 0) continue
    ctx.globalAlpha = alpha * (0.35 - i * 0.12)
    const gy = cy + cellSize * 0.22 - ghostT * cellSize * 0.55
    ctx.beginPath()
    ctx.arc(cx, gy, cellSize * 0.11, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = alpha * 0.92
  const label = 'SWIPE UP TO FLAG'
  let fontSize = Math.max(10, Math.round(cellSize * 0.24))
  ctx.font = `700 ${fontSize}px ${FONTS.display}`
  const maxLabelW = cellSize * 3.2
  while (fontSize > 9 && ctx.measureText(label).width > maxLabelW) {
    fontSize -= 1
    ctx.font = `700 ${fontSize}px ${FONTS.display}`
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#fde68a'
  ctx.fillText(label, cx, rt.state.boardOffsetY + y - 6)

  ctx.restore()
}

export { FLAG_SWIPE_PREVIEW_MS as ATTRACT_FLAG_SWIPE_HINT_MS } from '../runtime/flag-swipe-preview.ts'
