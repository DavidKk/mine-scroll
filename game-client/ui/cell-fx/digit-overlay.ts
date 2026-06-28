import { drawFxSpriteFrame, GAME_ASSET_TUNING } from '../game-assets.ts'
import type { GridMetrics } from '../theme.ts'
import { drawProceduralOrbitParticles } from './particles.ts'

const DIGIT_COLORS = ['#60a5fa', '#34d399', '#f87171', '#fbbf24', '#c084fc', '#22d3ee', '#ec4899', '#fb923c']

function drawProceduralDigitParticles(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, tMs: number, seed: number): void {
  const cycle = GAME_ASSET_TUNING.fx.digitParticles.cycleMs
  const phase = (tMs % cycle) / cycle
  const drawSize = Math.max(size * 1.45, 52)
  drawProceduralOrbitParticles(ctx, cx, cy, drawSize, color, phase, seed, 14, {
    radiusBase: 0.34,
    radiusStep: 0.044,
    dotBase: 0.024,
    dotStep: 0.009,
    alphaBase: 0.26,
    alphaPulse: 0.74,
    driftScale: 0.045,
    shadow: true,
  })
}

export function drawDigitAmbientOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, g: GridMetrics, digit: number, nowMs: number): void {
  if (digit < 1 || digit > 8) return
  const cx = x + g.cellSize / 2
  const cy = y + g.cellSize / 2
  const color = DIGIT_COLORS[digit - 1] ?? '#dbeafe'
  const tuning = GAME_ASSET_TUNING.fx.digitParticles
  const progress = (nowMs % tuning.cycleMs) / tuning.cycleMs
  const fxSize = Math.max(g.cellSize, 34)
  const usedSprite = drawFxSpriteFrame(ctx, 'digit-particles', progress, cx, cy, fxSize * tuning.spriteW, fxSize * tuning.spriteH, tuning.spriteAlpha, { loop: true })
  if (!usedSprite) {
    drawProceduralDigitParticles(ctx, cx, cy, g.cellSize, color, nowMs, digit)
  }
}
