import { clamp01, seededUnit } from '../primitives/index.ts'
import { COMBO_HUD_TIER_THRESHOLDS, getComboHudTier } from './combo-palette.ts'
import type { ComboBurstFxProgress, ComboFeedbackPalette, HudFxBudget } from './types.ts'

interface FxPoint {
  x: number
  y: number
}

function buildLightningPath(x1: number, y1: number, x2: number, y2: number, depth: number, displacement: number, seed: number): FxPoint[] {
  if (depth <= 0 || displacement < 0.35) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ]
  }
  const mx = (x1 + x2) * 0.5
  const my = (y1 + y2) * 0.5
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const jitter = (seededUnit(seed + depth * 17.3) - 0.5) * 2 * displacement
  const midX = mx + nx * jitter
  const midY = my + ny * jitter
  const left = buildLightningPath(x1, y1, midX, midY, depth - 1, displacement * 0.56, seed + 2.1)
  const right = buildLightningPath(midX, midY, x2, y2, depth - 1, displacement * 0.56, seed + 5.7)
  return left.slice(0, -1).concat(right)
}

function strokeLightningPath(ctx: CanvasRenderingContext2D, points: FxPoint[], palette: ComboFeedbackPalette, alpha: number, lineWidth: number, hot = false): void {
  if (points.length < 2 || alpha <= 0.012) return

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.strokeStyle = hot ? `rgba(255, 245, 190, ${alpha * 0.28})` : `rgba(${palette.main}, ${alpha * 0.32})`
  ctx.lineWidth = lineWidth * 2.8
  ctx.stroke()

  ctx.strokeStyle = hot ? `rgba(255, 221, 100, ${alpha * 0.72})` : `rgba(${palette.soft}, ${alpha * 0.58})`
  ctx.lineWidth = lineWidth * 1.35
  ctx.stroke()

  ctx.strokeStyle = hot ? `rgba(255, 255, 255, ${alpha * 0.82})` : `rgba(255, 255, 255, ${alpha * 0.46})`
  ctx.lineWidth = Math.max(0.75, lineWidth * 0.55)
  ctx.stroke()
}

export function drawElectricBolt(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  palette: ComboFeedbackPalette,
  alpha: number,
  stageScale: number,
  seed: number,
  depth: number,
  branch: boolean
): void {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 2 || alpha <= 0.012) return

  const displacement = len * (0.16 + seededUnit(seed + 11.2) * 0.1)
  const points = buildLightningPath(x1, y1, x2, y2, depth, displacement, seed)
  const hot = seededUnit(seed + 19.4) > 0.68
  strokeLightningPath(ctx, points, palette, alpha, Math.max(1, 1.25 * stageScale), hot)

  if (!branch || len < stageScale * 10 || depth <= 2) return

  const branchIndex = Math.min(points.length - 2, Math.max(1, Math.floor(points.length * (0.34 + seededUnit(seed + 23.6) * 0.22))))
  const origin = points[branchIndex]
  const baseAngle = Math.atan2(dy, dx)
  const branchAngle = baseAngle + (seededUnit(seed + 29.1) - 0.5) * 1.35
  const branchLen = len * (0.24 + seededUnit(seed + 31.8) * 0.2)
  drawElectricBolt(
    ctx,
    origin.x,
    origin.y,
    origin.x + Math.cos(branchAngle) * branchLen,
    origin.y + Math.sin(branchAngle) * branchLen,
    palette,
    alpha * 0.62,
    stageScale,
    seed + 37.5,
    depth - 1,
    false
  )
}

/** Top COMBO rail arc strength ramps with tier and in-tier combo progress. */
function getComboRailArcProfile(combo: number): {
  tier: 0 | 1 | 2 | 3
  intensity: number
  fade: number
  maxBolts: number
  depth: number
  branches: boolean
  lineScale: number
} {
  const tier = getComboHudTier(combo)
  const tierFloor = tier === 0 ? 2 : COMBO_HUD_TIER_THRESHOLDS[tier - 1]
  const tierCeil = tier >= 3 ? COMBO_HUD_TIER_THRESHOLDS[2] + 48 : COMBO_HUD_TIER_THRESHOLDS[tier as 0 | 1 | 2]
  const progress = tierCeil > tierFloor ? clamp01((combo - tierFloor) / (tierCeil - tierFloor)) : 0

  const intensityStart = [0.08, 0.3, 0.58, 0.84][tier]
  const intensityEnd = [0.2, 0.52, 0.8, 1][tier]
  const intensity = intensityStart + (intensityEnd - intensityStart) * progress

  const boltsStart = [2, 3, 5, 6][tier]
  const boltsEnd = [3, 5, 7, 8][tier]
  const maxBolts = Math.round(boltsStart + (boltsEnd - boltsStart) * progress)

  const depth = [2, 3, 3, 4][tier] + (tier >= 2 && progress > 0.55 ? 1 : 0)

  return {
    tier,
    intensity,
    fade: 0.48 + tier * 0.14 + progress * 0.1,
    maxBolts,
    depth,
    branches: tier >= 2 || (tier >= 1 && progress > 0.42),
    lineScale: 0.68 + intensity * 0.52,
  }
}

export function drawLocalizedElectricField(
  ctx: CanvasRenderingContext2D,
  fieldW: number,
  fieldH: number,
  combo: number,
  t: number,
  fade: number,
  palette: ComboFeedbackPalette,
  stageScale: number,
  options: {
    budget?: HudFxBudget
    intensity?: number
    maxBolts?: number
    depth?: number
    branches?: boolean
  } = {}
): void {
  const budget = options.budget ?? 'normal'
  const tier = getComboHudTier(combo)
  const flicker = 0.68 + Math.abs(Math.sin((t + combo * 0.011) * Math.PI * 9)) * 0.32
  const alpha = fade * flicker * (options.intensity ?? 1)
  const defaultBolts = budget === 'lite' ? (tier >= 3 ? 8 : tier >= 2 ? 6 : 5) : tier >= 3 ? 14 : tier >= 2 ? 11 : 9
  const boltCount = options.maxBolts ?? defaultBolts
  const depth = options.depth ?? (budget === 'lite' ? 3 : tier >= 2 ? 5 : 4)
  const branchMode = options.branches
  const timeSeed = t * 96 + combo * 0.17

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < boltCount; i += 1) {
    const p = (t * 1.18 + i * 0.083) % 1
    if (p > 0.86) continue
    const lifeAlpha = Math.sin(p * Math.PI) * alpha
    const seed = combo + i * 3.41 + timeSeed

    if (i % 3 !== 2) {
      const side = i % 2 === 0 ? -1 : 1
      const baseX = side * fieldW * (0.14 + p * 0.3)
      const baseY = (seededUnit(combo + i * 1.7 + timeSeed) - 0.5) * fieldH * 0.48
      const reach = fieldW * (0.1 + seededUnit(combo + i * 3.4 + timeSeed) * 0.12) * (1 - p * 0.28)
      const endY = baseY + (seededUnit(combo + i * 5.6 + timeSeed) - 0.5) * fieldH * 0.22
      drawElectricBolt(
        ctx,
        baseX,
        baseY,
        baseX + side * reach,
        endY,
        palette,
        lifeAlpha * 0.82,
        stageScale,
        seed,
        depth,
        branchMode === undefined ? budget === 'normal' && tier >= 1 : branchMode && i % 2 === 0
      )
    }

    const angle = seededUnit(combo + i * 2.13 + timeSeed * 0.31) * Math.PI * 2 + t * Math.PI * 3.4
    const startR = fieldW * (0.03 + seededUnit(seed + 4.2) * 0.07)
    const endR = fieldW * (0.24 + p * 0.36) * (0.78 + seededUnit(seed + 8.6) * 0.28)
    const yScale = fieldH / Math.max(fieldW, 1)
    const drift = (seededUnit(seed + 14.8) - 0.5) * 0.42
    const x1 = Math.cos(angle) * startR
    const y1 = Math.sin(angle) * startR * yScale
    const x2 = Math.cos(angle + drift) * endR
    const y2 = Math.sin(angle + drift) * endR * yScale
    drawElectricBolt(
      ctx,
      x1,
      y1,
      x2,
      y2,
      palette,
      lifeAlpha * 0.74,
      stageScale,
      seed + 51.2,
      depth,
      branchMode === undefined ? budget === 'normal' && i % 2 === 0 : branchMode && i % 2 === 1
    )
  }
  ctx.restore()
}

export function drawComboBurstElectricField(
  ctx: CanvasRenderingContext2D,
  burstW: number,
  burstH: number,
  combo: number,
  progress: ComboBurstFxProgress,
  palette: ComboFeedbackPalette,
  stageScale: number,
  budget: HudFxBudget = 'normal'
): void {
  drawLocalizedElectricField(ctx, burstW, burstH, combo, progress.t, progress.fade, palette, stageScale, { budget })
}

/** Ambient jagged arcs inside the top COMBO rail chip. */
export function drawComboRailInteriorArcs(
  ctx: CanvasRenderingContext2D,
  asset: { x: number; y: number; w: number; h: number },
  combo: number,
  palette: ComboFeedbackPalette,
  stageScale: number,
  nowMs = performance.now()
): void {
  if (combo <= 1) return

  const profile = getComboRailArcProfile(combo)
  if (profile.intensity <= 0.04) return

  const { tier } = profile
  const padX = asset.w * 0.05
  const padTop = asset.h * 0.2
  const padBottom = asset.h * 0.16
  const bleedX = tier >= 3 ? asset.w * 0.04 : tier >= 2 ? asset.w * 0.02 : 0
  const clipW = asset.w - padX * 2 + bleedX * 2
  const clipH = asset.h - padTop - padBottom
  if (clipW <= 6 || clipH <= 6) return

  const cx = asset.x + asset.w / 2
  const fieldW = clipW * (tier >= 3 ? 1.1 : tier >= 2 ? 1.06 : 1.04)
  const fieldH = clipH * 0.92
  const t = (nowMs % 1800) / 1800

  ctx.save()
  ctx.translate(cx, asset.y + asset.h * 0.58)
  drawLocalizedElectricField(ctx, fieldW, fieldH, combo, t, profile.fade, palette, stageScale * profile.lineScale, {
    maxBolts: profile.maxBolts,
    intensity: profile.intensity,
    depth: profile.depth,
    branches: profile.branches,
    budget: 'lite',
  })
  ctx.restore()
}
