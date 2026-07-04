import type { CellView, GameStatus } from '@shared/core/types.ts'

import { drawSimpleFlagMark, drawWavingFlagMark, resolveMineCutout } from '../cell-fx.ts'
import { drawGameMineCutout, GAME_ASSET_TUNING, getGameCutout } from '../game-assets.ts'
import { FONTS, type GridMetrics, THEME } from '../theme.ts'
import { drawHiddenCellSprite, drawSpriteInCell, getTileSprites } from '../tile-sprites.ts'
import { fillRoundRect, strokeRoundRect } from './primitives.ts'

function drawCellDigit(ctx: CanvasRenderingContext2D, digit: number, x: number, y: number, g: GridMetrics): void {
  const cx = Math.round(x + g.cellSize / 2)
  const cy = Math.round(y + g.cellSize / 2)
  const color = THEME.numbers[digit] ?? THEME.hudText
  const fontSize = Math.max(12, Math.round(g.cellSize * 0.5))
  ctx.save()
  ctx.font = `700 ${fontSize}px ${FONTS.mono}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  const blurRatio = GAME_ASSET_TUNING.tiles.digitShadowBlurRatio
  if (blurRatio > 0) {
    ctx.shadowColor = color
    ctx.shadowBlur = Math.max(1, fontSize * blurRatio)
  }
  ctx.fillText(String(digit), cx, cy)
  ctx.restore()
}

function drawRevealedCellFrame(ctx: CanvasRenderingContext2D, x: number, y: number, g: GridMetrics): void {
  strokeRoundRect(ctx, x + 0.5, y + 0.5, g.cellSize - 1, g.cellSize - 1, g.cellRadius, THEME.cellRevealedBorder, Math.max(1, g.cellSize >= 28 ? 1.25 : 1))
}

function drawRevealedCellSurface(ctx: CanvasRenderingContext2D, x: number, y: number, g: GridMetrics, sprites: NonNullable<ReturnType<typeof getTileSprites>>): void {
  drawSpriteInCell(ctx, sprites.revealed, x, y, g.cellSize)
  drawRevealedCellFrame(ctx, x, y, g)
}

function drawHiddenCell(ctx: CanvasRenderingContext2D, x: number, y: number, g: GridMetrics): void {
  fillRoundRect(ctx, x, y, g.cellSize, g.cellSize, g.cellRadius, THEME.cellHidden)
  strokeRoundRect(ctx, x + 0.5, y + 0.5, g.cellSize - 1, g.cellSize - 1, g.cellRadius, THEME.cellHiddenBorder)
  const hi = ctx.createLinearGradient(x, y, x, y + g.cellSize * 0.45)
  hi.addColorStop(0, 'rgba(255, 255, 255, 0.06)')
  hi.addColorStop(1, 'rgba(255, 255, 255, 0)')
  fillRoundRect(ctx, x + 1, y + 1, g.cellSize - 2, g.cellSize * 0.42, g.cellRadius, hi)
}

function drawRevealedCellBg(ctx: CanvasRenderingContext2D, x: number, y: number, g: GridMetrics): void {
  fillRoundRect(ctx, x, y, g.cellSize, g.cellSize, g.cellRadius, THEME.cellRevealed)
  const inset = ctx.createLinearGradient(x, y, x, y + g.cellSize)
  inset.addColorStop(0, 'rgba(0, 0, 0, 0.28)')
  inset.addColorStop(0.38, 'rgba(0, 0, 0, 0.08)')
  inset.addColorStop(1, 'rgba(255, 255, 255, 0.025)')
  fillRoundRect(ctx, x + 1, y + 1, g.cellSize - 2, g.cellSize - 2, Math.max(2, g.cellRadius - 1), inset)
  strokeRoundRect(ctx, x + 0.5, y + 0.5, g.cellSize - 1, g.cellSize - 1, g.cellRadius, THEME.cellRevealedBorder)
}

function drawMine(ctx: CanvasRenderingContext2D, cx: number, cy: number, cellSize: number, explosive: boolean): void {
  const scale = cellSize / 36
  const r = 9 * scale
  if (explosive) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 8 * scale)
    glow.addColorStop(0, 'rgba(255, 34, 102, 0.65)')
    glow.addColorStop(0.5, 'rgba(255, 0, 170, 0.25)')
    glow.addColorStop(1, 'rgba(255, 0, 170, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, r + 6 * scale, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = THEME.mineBody
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = THEME.mineCore
  ctx.beginPath()
  ctx.arc(cx, cy, 5 * scale, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = THEME.mineSpark
  ctx.lineWidth = 2 * scale
  ctx.lineCap = 'round'
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * (r + 2 * scale), cy + Math.sin(angle) * (r + 2 * scale))
    ctx.lineTo(cx + Math.cos(angle) * (r + 6 * scale), cy + Math.sin(angle) * (r + 6 * scale))
    ctx.stroke()
  }
}

export function drawStatusIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, status: GameStatus): void {
  ctx.strokeStyle = status === 'won' ? THEME.resetWon : status === 'lost' ? THEME.resetLost : THEME.resetIcon
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (status === 'won') {
    ctx.beginPath()
    ctx.moveTo(cx - 8, cy)
    ctx.lineTo(cx - 2, cy + 7)
    ctx.lineTo(cx + 9, cy - 6)
    ctx.stroke()
    return
  }

  if (status === 'lost') {
    ctx.beginPath()
    ctx.moveTo(cx - 7, cy - 7)
    ctx.lineTo(cx + 7, cy + 7)
    ctx.moveTo(cx + 7, cy - 7)
    ctx.lineTo(cx - 7, cy + 7)
    ctx.stroke()
    return
  }

  if (status === 'playing') {
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.arc(cx, cy, 9, 0.2 * Math.PI, 1.6 * Math.PI)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + 8, cy - 5)
  ctx.lineTo(cx + 11, cy - 1)
  ctx.lineTo(cx + 6, cy + 1)
  ctx.closePath()
  ctx.fill()
}

export function drawHudPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, align: 'left' | 'right' | 'center'): void {
  fillRoundRect(ctx, x, y, w, h, h / 2, THEME.hudPillBg)
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2, THEME.hudPillBorder)

  ctx.fillStyle = THEME.hudAccent
  ctx.font = `700 22px ${FONTS.mono}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  const tx = align === 'left' ? x + 14 : align === 'right' ? x + w - 14 : x + w / 2
  ctx.fillText(text, tx, y + h / 2)
}

export function hudPillWidth(text: string, min = 48, max = 88): number {
  return Math.min(max, Math.max(min, text.length * 13 + 22))
}

export function drawCellMarksOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, view: CellView, g: GridMetrics, nowMs = 0, animate = false): void {
  if (view.revealed || !view.flagged) return
  if (animate && nowMs > 0) {
    drawWavingFlagMark(ctx, x, y, g, nowMs)
  } else {
    drawSimpleFlagMark(ctx, x, y, g)
  }
}

export function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  view: CellView,
  g: GridMetrics,
  status: GameStatus = 'playing',
  options?: { skipHiddenUnderlay?: boolean }
): void {
  const sprites = getTileSprites()
  if (sprites) {
    if (!view.revealed) {
      if (options?.skipHiddenUnderlay) {
        drawSpriteInCell(ctx, sprites.hidden, x, y, g.cellSize)
      } else {
        drawHiddenCellSprite(ctx, sprites, x, y, g.cellSize)
      }
      return
    }

    drawRevealedCellSurface(ctx, x, y, g, sprites)

    if (view.isMine) {
      const mineName = resolveMineCutout(status, view.mineHit)
      const gameMine = getGameCutout(mineName) ?? getGameCutout('mine-standard')
      if (gameMine) {
        drawGameMineCutout(ctx, gameMine, x, y, g.cellSize)
      } else {
        drawSpriteInCell(ctx, sprites.mine, x, y, g.cellSize)
      }
      return
    }

    const n = view.adjacentMines ?? 0
    if (n > 0) {
      if (GAME_ASSET_TUNING.tiles.crispDigits) {
        drawCellDigit(ctx, n, x, y, g)
      } else {
        drawSpriteInCell(ctx, sprites.numbers[n - 1]!, x, y, g.cellSize)
        drawRevealedCellFrame(ctx, x, y, g)
      }
      return
    }

    return
  }

  const cx = x + g.cellSize / 2
  const cy = y + g.cellSize / 2

  if (!view.revealed) {
    drawHiddenCell(ctx, x, y, g)
    return
  }

  drawRevealedCellBg(ctx, x, y, g)

  if (view.isMine) {
    const mineName = resolveMineCutout(status, view.mineHit)
    const gameMine = getGameCutout(mineName) ?? getGameCutout('mine-standard')
    if (gameMine) {
      drawGameMineCutout(ctx, gameMine, x, y, g.cellSize)
    } else {
      drawMine(ctx, cx, cy, g.cellSize, true)
    }
    return
  }

  if (view.adjacentMines && view.adjacentMines > 0) {
    drawCellDigit(ctx, view.adjacentMines, x, y, g)
    return
  }
}
