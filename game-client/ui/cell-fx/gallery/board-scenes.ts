import { drawImageContained } from '../../game-assets.ts'
import { clamp01, easeOutBack, easeOutCubic, lerp, roundedRectPath } from '../../primitives/index.ts'
import type { TileSprites } from '../../tile-sprites.ts'
import { drawDigitParticles, drawHiddenCellWithEffect } from './cell-scenes.ts'
import type { BoardV3TileKey } from './types.ts'
import { BOARD_INTERACTION_V3_ACTION_MS, BOARD_INTERACTION_V3_MS, DIGIT_COLORS, V3_BOARD_TILE_BASE } from './types.ts'
import { createAssetImage, hoverStateOpts, layoutCell, paintStageBg } from './utils.ts'

const v3BoardTileImages: Record<BoardV3TileKey, HTMLImageElement> = {
  'cell-hidden': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-hidden.png`),
  'cell-revealed': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-revealed.png`),
  'cell-hover': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-hover.png`),
  'cell-pressed': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-pressed.png`),
  'cell-safe': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-safe.png`),
  'num-1': createAssetImage(`${V3_BOARD_TILE_BASE}/num-1.png`),
  'num-2': createAssetImage(`${V3_BOARD_TILE_BASE}/num-2.png`),
  'num-3': createAssetImage(`${V3_BOARD_TILE_BASE}/num-3.png`),
  'num-4': createAssetImage(`${V3_BOARD_TILE_BASE}/num-4.png`),
  'num-5': createAssetImage(`${V3_BOARD_TILE_BASE}/num-5.png`),
  'num-6': createAssetImage(`${V3_BOARD_TILE_BASE}/num-6.png`),
  'num-7': createAssetImage(`${V3_BOARD_TILE_BASE}/num-7.png`),
  'num-8': createAssetImage(`${V3_BOARD_TILE_BASE}/num-8.png`),
}

function getV3BoardTileImage(key: BoardV3TileKey): HTMLImageElement | null {
  const image = v3BoardTileImages[key]
  return image.complete && image.naturalWidth > 0 ? image : null
}

function drawV3BoardTile(ctx: CanvasRenderingContext2D, key: BoardV3TileKey, cx: number, cy: number, boxW: number, boxH: number, alpha = 1, scale = 1, filter = ''): boolean {
  const image = getV3BoardTileImage(key)
  if (!image || alpha <= 0.01) return false

  const drawW = boxW * scale
  const drawH = boxH * scale
  ctx.save()
  ctx.globalAlpha = alpha
  if (filter) ctx.filter = filter
  drawImageContained(ctx, image, cx - drawW / 2, cy - drawH / 2, drawW, drawH, 1)
  ctx.restore()
  return true
}

function drawBoardV3RevealFx(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, progress: number): void {
  const reveal = clamp01((progress - 0.31) / 0.27)
  if (reveal > 0 && reveal < 1) {
    const fade = Math.sin(reveal * Math.PI)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * lerp(0.18, 0.68, reveal))
    bloom.addColorStop(0, `rgba(235, 255, 255, ${0.62 * fade})`)
    bloom.addColorStop(0.28, `rgba(45, 236, 255, ${0.46 * fade})`)
    bloom.addColorStop(1, 'rgba(45, 236, 255, 0)')
    ctx.fillStyle = bloom
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = `rgba(45, 236, 255, ${0.74 * (1 - reveal)})`
    ctx.lineWidth = lerp(4, 1, reveal)
    roundedRectPath(
      ctx,
      cx - size * lerp(0.22, 0.74, easeOutCubic(reveal)),
      cy - size * lerp(0.14, 0.42, easeOutCubic(reveal)),
      size * lerp(0.44, 1.48, easeOutCubic(reveal)),
      size * lerp(0.28, 0.84, easeOutCubic(reveal)),
      size * 0.08
    )
    ctx.stroke()
    ctx.restore()
  }

  const sparks = clamp01((progress - 0.39) / 0.34)
  if (sparks <= 0 || sparks >= 1) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 10; i += 1) {
    const angle = i * ((Math.PI * 2) / 10) - Math.PI * 0.08
    const dist = lerp(size * 0.12, size * 0.54, easeOutCubic(sparks)) * (i % 2 === 0 ? 1 : 0.72)
    const x = cx + Math.cos(angle) * dist
    const y = cy + Math.sin(angle) * dist * 0.58
    const alpha = (1 - sparks) * 0.72
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 211, 90, ${alpha})` : `rgba(45, 236, 255, ${alpha})`
    ctx.beginPath()
    ctx.arc(x, y, lerp(2.3, 0.7, sparks), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawBoardV3HoverSweep(ctx: CanvasRenderingContext2D, cx: number, cy: number, boxW: number, boxH: number, progress: number): void {
  const hover = clamp01(progress / 0.3)
  if (hover <= 0) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = hover * 0.46
  const sweepX = lerp(cx - boxW * 0.62, cx + boxW * 0.62, clamp01((progress - 0.06) / 0.32))
  const gradient = ctx.createLinearGradient(sweepX - boxW * 0.18, cy - boxH * 0.5, sweepX + boxW * 0.18, cy + boxH * 0.5)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.62)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  roundedRectPath(ctx, cx - boxW * 0.44, cy - boxH * 0.34, boxW * 0.88, boxH * 0.68, boxH * 0.08)
  ctx.fill()

  ctx.globalAlpha = hover * 0.38
  ctx.strokeStyle = '#2decff'
  ctx.lineWidth = 2
  roundedRectPath(ctx, cx - boxW * 0.47, cy - boxH * 0.37, boxW * 0.94, boxH * 0.74, boxH * 0.08)
  ctx.stroke()
  ctx.restore()
}

function drawBoardV3CanvasDigit(ctx: CanvasRenderingContext2D, digit: number, cx: number, cy: number, size: number, color: string, alpha: number, scale: number): void {
  const text = String(digit)

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  ctx.shadowColor = color
  ctx.shadowBlur = size * 0.18
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)'
  ctx.lineWidth = size * 0.16
  ctx.strokeText(text, 0, size * 0.03)

  ctx.shadowBlur = size * 0.08
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = size * 0.055
  ctx.strokeText(text, 0, size * 0.01)

  const fill = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.58)
  fill.addColorStop(0, '#ffffff')
  fill.addColorStop(0.2, color)
  fill.addColorStop(0.68, color)
  fill.addColorStop(1, 'rgba(3, 7, 18, 0.98)')
  ctx.fillStyle = fill
  ctx.fillText(text, 0, 0)

  ctx.globalAlpha = alpha * 0.52
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.font = `900 ${size * 0.94}px Arial, Helvetica, sans-serif`
  ctx.fillText(text, -size * 0.035, -size * 0.08)
  ctx.restore()
}

export function drawBoardV3InteractionScene(ctx: CanvasRenderingContext2D, w: number, h: number, sprites: TileSprites, tMs: number, digit = 3): void {
  paintStageBg(ctx, w, h)
  const cx = w / 2
  const cy = h / 2
  const size = Math.min(w, h)
  const boxSize = size * 0.68
  const boxW = boxSize
  const boxH = boxSize
  const actionTime = tMs % BOARD_INTERACTION_V3_MS
  const progress = clamp01(actionTime / BOARD_INTERACTION_V3_ACTION_MS)
  const hover = clamp01((progress - 0.04) / 0.23)
  const press = clamp01((progress - 0.24) / 0.16)
  const reveal = clamp01((progress - 0.34) / 0.24)
  const digitIn = clamp01((progress - 0.52) / 0.2)
  const digitSettle = clamp01((progress - 0.72) / 0.18)
  const hiddenAlpha = 1 - reveal
  const hoverAlpha = Math.min(1 - reveal, hover)
  const pressedAlpha = press > 0 && press < 1 ? Math.sin(press * Math.PI) * (1 - reveal) : 0
  const safeAlpha = reveal > 0 && reveal < 1 ? Math.sin(reveal * Math.PI) * 0.75 : 0
  const revealedAlpha = easeOutCubic(reveal)
  const pressScale = press > 0 && press < 1 ? lerp(1, 0.955, Math.sin(press * Math.PI)) : 1

  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.72)'
  ctx.shadowBlur = size * 0.08
  if (!drawV3BoardTile(ctx, 'cell-hidden', cx, cy, boxW, boxH, hiddenAlpha, pressScale)) {
    const fallback = layoutCell(w, h, 0.55)
    drawHiddenCellWithEffect(ctx, sprites, fallback.x, fallback.y, fallback.size, hoverStateOpts(hover))
    ctx.restore()
    return
  }
  drawV3BoardTile(ctx, 'cell-hover', cx, cy, boxW, boxH, hoverAlpha * (1 - pressedAlpha), lerp(1, 1.035, hover))
  drawV3BoardTile(ctx, 'cell-pressed', cx, cy, boxW, boxH, pressedAlpha, 0.965)
  drawV3BoardTile(ctx, 'cell-revealed', cx, cy, boxW, boxH, revealedAlpha, lerp(0.92, 1, easeOutBack(reveal)))
  drawV3BoardTile(ctx, 'cell-safe', cx, cy, boxW, boxH, safeAlpha, lerp(0.96, 1.02, safeAlpha))
  ctx.restore()

  drawBoardV3HoverSweep(ctx, cx, cy, boxW, boxH, progress)
  drawBoardV3RevealFx(ctx, cx, cy, size, progress)

  if (digitIn > 0) {
    const pop = digitSettle > 0 ? lerp(1.08, 1, easeOutCubic(digitSettle)) : lerp(0.82, 1.08, easeOutBack(digitIn))
    const alpha = clamp01(digitIn / 0.72)
    const color = DIGIT_COLORS[(digit - 1) % DIGIT_COLORS.length]
    drawV3BoardTile(ctx, `num-${Math.max(1, Math.min(8, digit))}` as BoardV3TileKey, cx, cy, size * 0.5, size * 0.5, alpha, pop)
    drawBoardV3CanvasDigit(ctx, digit, cx, cy + size * 0.005, size * 0.42, color, alpha, pop)
    drawDigitParticles(ctx, cx, cy, size * 0.64, color, tMs, digit, BOARD_INTERACTION_V3_MS)
  }
}
