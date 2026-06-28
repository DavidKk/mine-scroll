import type { CellView } from '@shared/core/types.ts'

import { clamp01 } from '../primitives/index.ts'
import { roundedRectPath } from '../primitives/path.ts'
import { getCellIntroRippleDist, getMaxCellIntroRippleDist } from '../renderer/intro-ripple-math.ts'
import type { LayoutMetrics } from '../renderer/layout.ts'
import type { GridMetrics } from '../theme.ts'
import { cellPixelOrigin } from '../theme.ts'

export const IDLE_RIPPLE_CYCLE_MS = 3400
const IDLE_RIPPLE_BAND_RATIO = 0.4
const IDLE_RIPPLE_WAVE_OFFSETS = [0, 0.46] as const

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Ripple front strength at a cell — bell curve on the wave band, not a fade-in. */
export function getIdleRippleWaveStrength(nowMs: number, dist: number, maxDist: number, cycleMs = IDLE_RIPPLE_CYCLE_MS, phaseOffset = 0): number {
  if (maxDist <= 0) return 0
  const band = Math.max(2, maxDist * IDLE_RIPPLE_BAND_RATIO)
  const phase = ((nowMs + phaseOffset * cycleMs) % cycleMs) / cycleMs
  const front = phase * (maxDist + band)
  const delta = front - dist
  if (delta < 0 || delta > band) return 0
  const t = delta / band
  return Math.sin(t * Math.PI) * (1 - t * 0.18)
}

function combinedRippleStrength(nowMs: number, dist: number, maxDist: number): number {
  let sum = 0
  for (const offset of IDLE_RIPPLE_WAVE_OFFSETS) {
    sum += getIdleRippleWaveStrength(nowMs, dist, maxDist, IDLE_RIPPLE_CYCLE_MS, offset)
  }
  return clamp01(sum)
}

function drawIdleCellRippleOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, g: GridMetrics, strength: number, dist: number, maxDist: number, nowMs: number): void {
  if (strength <= 0.03) return

  const s = g.cellSize
  const lift = strength * Math.max(0.6, s * 0.022)
  const phase = (nowMs % IDLE_RIPPLE_CYCLE_MS) / IDLE_RIPPLE_CYCLE_MS
  const band = Math.max(2, maxDist * IDLE_RIPPLE_BAND_RATIO)
  const front = phase * (maxDist + band)
  const lead = clamp01((front - dist) / Math.max(0.5, band * 0.42))
  const tone = strength * 0.52

  ctx.save()

  // Leading-edge water sheen (top-left sweep).
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = tone * 0.62
  const sheenX = x - lift * 0.35 + lead * s * 0.07
  const sheenY = y - lift + lead * s * 0.045
  const sheen = ctx.createLinearGradient(sheenX, sheenY, sheenX + s * 1.1, sheenY + s * 1.1)
  sheen.addColorStop(0, 'rgba(191, 219, 254, 0.48)')
  sheen.addColorStop(0.35, 'rgba(96, 165, 250, 0.24)')
  sheen.addColorStop(0.72, 'rgba(59, 130, 246, 0.09)')
  sheen.addColorStop(1, 'rgba(59, 130, 246, 0)')
  ctx.fillStyle = sheen
  roundedRectPath(ctx, x + 1, y + 1, s - 2, s - 2, g.cellRadius)
  ctx.fill()

  // Specular glint on the wave front.
  const glintX = x + s * (0.22 + lead * 0.16)
  const glintY = y + s * (0.16 + lead * 0.09) - lift * 0.4
  ctx.globalAlpha = tone * (0.16 + lead * 0.18)
  const glint = ctx.createRadialGradient(glintX, glintY, 0, glintX, glintY, s * 0.3)
  glint.addColorStop(0, 'rgba(236, 254, 255, 0.55)')
  glint.addColorStop(0.5, 'rgba(147, 197, 253, 0.16)')
  glint.addColorStop(1, 'rgba(147, 197, 253, 0)')
  ctx.fillStyle = glint
  ctx.beginPath()
  ctx.arc(glintX, glintY, s * 0.28, 0, Math.PI * 2)
  ctx.fill()

  // Trailing shadow.
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = tone * 0.18
  const shadow = ctx.createLinearGradient(x, y, x + s, y + s)
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0)')
  shadow.addColorStop(0.55, 'rgba(0, 0, 0, 0)')
  shadow.addColorStop(1, 'rgba(8, 18, 38, 0.42)')
  ctx.fillStyle = shadow
  roundedRectPath(ctx, x + 1, y + 1, s - 2, s - 2, g.cellRadius)
  ctx.fill()

  // Rim on the wave crest.
  ctx.globalAlpha = tone * (0.22 + lead * 0.15)
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.52)'
  ctx.lineWidth = Math.max(0.85, s * 0.035)
  roundedRectPath(ctx, x + 1.5, y + 1.5 - lift * 0.2, s - 3, s - 3, g.cellRadius)
  ctx.stroke()

  ctx.restore()
}

function drawIdleBoardRippleRings(ctx: CanvasRenderingContext2D, layout: LayoutMetrics, rows: number, cols: number, nowMs: number): void {
  const { gridOriginX, gridOriginY, grid, gridWidth, gridHeight } = layout
  const centerX = gridOriginX + ((cols - 1) * grid.cellStep + grid.cellSize) / 2
  const centerY = gridOriginY + ((rows - 1) * grid.cellStep + grid.cellSize) / 2
  const maxRadius = Math.hypot(gridWidth, gridHeight) * 0.58

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  for (const offset of IDLE_RIPPLE_WAVE_OFFSETS) {
    const phase = ((nowMs + offset * IDLE_RIPPLE_CYCLE_MS) % IDLE_RIPPLE_CYCLE_MS) / IDLE_RIPPLE_CYCLE_MS
    const radius = phase * maxRadius
    const ringAlpha = (1 - phase) * 0.13
    if (ringAlpha <= 0.018) continue

    ctx.globalAlpha = ringAlpha
    ctx.lineWidth = Math.max(1, grid.cellSize * 0.052)
    const ring = ctx.createRadialGradient(centerX, centerY, radius * 0.94, centerX, centerY, radius)
    ring.addColorStop(0, 'rgba(96, 165, 250, 0)')
    ring.addColorStop(0.55, 'rgba(125, 211, 252, 0.48)')
    ring.addColorStop(1, 'rgba(96, 165, 250, 0)')
    ctx.strokeStyle = ring
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

function drawIdleRippleForViews(ctx: CanvasRenderingContext2D, layout: LayoutMetrics, views: CellView[], rows: number, cols: number, nowMs: number): void {
  const { gridOriginX, gridOriginY, grid } = layout
  const maxDist = getMaxCellIntroRippleDist(rows, cols)

  for (const view of views) {
    if (view.revealed || view.flagged) continue
    const dist = getCellIntroRippleDist(view.row, view.col, rows, cols)
    const strength = combinedRippleStrength(nowMs, dist, maxDist)
    if (strength <= 0.03) continue
    const { x, y } = cellPixelOrigin(view.row, view.col, gridOriginX, gridOriginY, grid)
    drawIdleCellRippleOverlay(ctx, x, y, grid, strength, dist, maxDist, nowMs)
  }
}

/** Idle board ambient: water-drop ripples from center with light/shadow (not fade-in). */
export function drawIdleBoardRippleFx(
  ctx: CanvasRenderingContext2D,
  layout: LayoutMetrics,
  views: CellView[],
  rows: number,
  cols: number,
  nowMs: number,
  options?: { rings?: boolean }
): void {
  if (prefersReducedMotion()) return

  if (options?.rings !== false) {
    drawIdleBoardRippleRings(ctx, layout, rows, cols, nowMs)
  }
  drawIdleRippleForViews(ctx, layout, views, rows, cols, nowMs)
}
