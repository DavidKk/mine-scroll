import { drawFxSpriteFrame, GAME_ASSET_TUNING } from '../game-assets.ts'
import { roundedRectPath } from '../primitives/path.ts'
import type { GridMetrics } from '../theme.ts'
import { drawHiddenCellUnderlay, drawSpriteInCell, getTileSprites } from '../tile-sprites.ts'

function breathPhase(tMs: number): number {
  const cycle = GAME_ASSET_TUNING.fx.cellBreath.cycleMs
  return Math.sin(((tMs % cycle) / cycle) * Math.PI * 2)
}

export function drawCellBreathOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, g: GridMetrics, nowMs: number): void {
  const cx = x + g.cellSize / 2
  const cy = y + g.cellSize / 2
  const wave = breathPhase(nowMs)
  const tuning = GAME_ASSET_TUNING.fx.cellBreath
  const usedSprite = drawFxSpriteFrame(
    ctx,
    'cell-breath',
    (nowMs % tuning.cycleMs) / tuning.cycleMs,
    cx,
    cy,
    g.cellSize * tuning.spriteW,
    g.cellSize * tuning.spriteH,
    tuning.spriteAlpha * (0.72 + (wave + 1) * 0.14),
    { loop: true }
  )
  if (usedSprite) return

  ctx.save()
  ctx.globalAlpha = 0.1 + (wave + 1) * 0.08
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.cellSize * 0.62)
  glow.addColorStop(0, 'rgba(129, 140, 248, 0.55)')
  glow.addColorStop(1, 'rgba(99, 102, 241, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, g.cellSize * 0.58, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawCellHoverOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, g: GridMetrics, pressed: boolean): void {
  const cx = x + g.cellSize / 2
  const cy = y + g.cellSize / 2
  const tuning = GAME_ASSET_TUNING.fx.cellHover
  const usedSprite = drawFxSpriteFrame(ctx, 'cell-hover', pressed ? 0.92 : 0.42, cx, cy, g.cellSize * tuning.spriteW, g.cellSize * tuning.spriteH, tuning.spriteAlpha)

  const lift = pressed ? 1.5 : -1.5
  const scale = pressed ? 0.97 : 1.04
  const ringAlpha = pressed ? 0.3 : 0.5
  const drawSize = g.cellSize * scale
  const drawX = cx - drawSize / 2
  const drawY = cy - drawSize / 2 + lift

  const sprites = getTileSprites()
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = pressed ? 0.28 : 0.38
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.cellSize * (pressed ? 0.58 : 0.74))
  glow.addColorStop(0, pressed ? 'rgba(255, 211, 90, 0.58)' : 'rgba(45, 236, 255, 0.58)')
  glow.addColorStop(1, 'rgba(45, 236, 255, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, g.cellSize * 0.8, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = ringAlpha
  ctx.strokeStyle = pressed ? '#fbbf24' : '#2decff'
  ctx.lineWidth = Math.max(1.5, g.cellSize * 0.045)
  roundedRectPath(ctx, drawX - 2, drawY - 2, drawSize + 4, drawSize + 4, g.cellRadius + 2)
  ctx.stroke()
  ctx.restore()

  if (!sprites) return
  ctx.save()
  ctx.globalAlpha = pressed ? 0.98 : 0.96
  drawHiddenCellUnderlay(ctx, drawX, drawY, drawSize)
  drawSpriteInCell(ctx, pressed ? sprites.pressed : sprites.hover, drawX, drawY, drawSize)
  ctx.restore()
  if (!usedSprite) return
}
