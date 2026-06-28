import { drawGameMineCutoutAtCenter, drawImageContained, getGameCutout, getGameFxBlendMode, getGameFxFrames } from '../../game-assets.ts'
import { clamp01, easeOutCubic, lerp } from '../../primitives/index.ts'
import type { TileSprites } from '../../tile-sprites.ts'
import { drawMineBurstSmoke, drawMineScorchMark, drawMineSettledSmoke } from '../mine-smoke.ts'
import { drawOpenCell } from './cell-scenes.ts'
import type { ImageBounds, MineMode } from './types.ts'
import { MINE_CUTOUT_SCALE, MINE_HIT_V3_ACTION_MS, MINE_HIT_V3_MS, V3_CANDIDATE_MINE_CRACKED_SRC, V3_CANDIDATE_MINE_STANDARD_SRC } from './types.ts'
import { layoutCell, paintStageBg, readImageBounds } from './utils.ts'

function mineBlastPopScale(progress: number): number {
  if (progress <= 0 || progress >= 1) return 1
  return 1 + Math.sin(progress * Math.PI) * 0.035
}

const candidateMineStandardImage = new Image()
candidateMineStandardImage.src = V3_CANDIDATE_MINE_STANDARD_SRC
let candidateMineStandardBounds: ImageBounds | null = null
candidateMineStandardImage.addEventListener('load', () => {
  candidateMineStandardBounds = readImageBounds(candidateMineStandardImage)
})

const candidateMineCrackedImage = new Image()
candidateMineCrackedImage.src = V3_CANDIDATE_MINE_CRACKED_SRC
let candidateMineCrackedBounds: ImageBounds | null = null
candidateMineCrackedImage.addEventListener('load', () => {
  candidateMineCrackedBounds = readImageBounds(candidateMineCrackedImage)
})

function drawFxFramesOneShot(
  ctx: CanvasRenderingContext2D,
  frames: HTMLImageElement[] | null,
  blendMode: GlobalCompositeOperation,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number,
  alphaScale = 1
): void {
  if (!frames || frames.length === 0 || alphaScale <= 0.01) return
  const t = clamp01(progress)
  if (t <= 0) return
  const index = Math.min(frames.length - 1, Math.floor(t * frames.length))
  const frame = frames[index]
  if (!frame) return
  ctx.save()
  ctx.globalCompositeOperation = blendMode
  ctx.globalAlpha = alphaScale
  drawImageContained(ctx, frame, x, y, w, h, 1)
  ctx.restore()
}

function drawMineCutout(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, size: number, scale: number): void {
  ctx.save()
  ctx.shadowColor = 'rgba(248, 113, 113, 0.72)'
  ctx.shadowBlur = size * 0.1
  drawGameMineCutoutAtCenter(ctx, img, cx, cy, size, scale)
  ctx.restore()
}

export function drawMineScene(ctx: CanvasRenderingContext2D, w: number, h: number, sprites: TileSprites, mode: MineMode, tMs: number, blastProgress = 0): void {
  paintStageBg(ctx, w, h)
  const cell = layoutCell(w, h, 0.55)
  const cx = cell.x + cell.size / 2
  const cy = cell.y + cell.size / 2
  const standard = getGameCutout('mine-standard') ?? sprites.mine
  const exploded = getGameCutout('mine-exploded') ?? standard
  const flash = getGameCutout('mine-hit-flash') ?? standard
  const frames = getGameFxFrames('mine-explosion')
  const blendMode = getGameFxBlendMode('mine-explosion')
  const pulse = Math.sin((tMs / 900) * Math.PI * 2) * 0.5 + 0.5

  drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, mode === 'exploded' ? 0 : 0.35)

  if (mode === 'armed') {
    ctx.save()
    ctx.globalAlpha = 0.22 + pulse * 0.24
    ctx.strokeStyle = '#fb7185'
    ctx.shadowColor = 'rgba(251, 113, 133, 0.68)'
    ctx.shadowBlur = cell.size * 0.14
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, cell.size * (0.35 + pulse * 0.035), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    drawMineCutout(ctx, standard, cx, cy, cell.size, MINE_CUTOUT_SCALE)
    return
  }

  if (mode === 'flash') {
    drawMineCutout(ctx, flash, cx, cy, cell.size, MINE_CUTOUT_SCALE)
    ctx.save()
    ctx.globalAlpha = 0.46
    ctx.fillStyle = '#fff7ed'
    ctx.beginPath()
    ctx.arc(cx, cy, cell.size * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  if (mode === 'blast') {
    const eased = easeOutCubic(blastProgress)
    const fxAlpha = 1 - easeOutCubic(Math.max(0, (blastProgress - 0.42) / 0.58))
    drawFxFramesOneShot(ctx, frames, blendMode, cx - cell.size * 0.95, cy - cell.size * 0.72, cell.size * 1.9, cell.size * 1.42, eased, fxAlpha)
    drawMineBurstSmoke(ctx, cx, cy, cell.size, blastProgress, 0.85 + blastProgress * 0.15)
    const mineImg = blastProgress > 0.55 ? exploded : flash
    drawMineCutout(ctx, mineImg, cx, cy, cell.size, MINE_CUTOUT_SCALE * mineBlastPopScale(blastProgress))
    return
  }

  drawMineScorchMark(ctx, cx, cy, cell.size)
  drawMineSettledSmoke(ctx, cx, cy, cell.size, tMs, 0.9)
  drawMineCutout(ctx, exploded, cx, cy, cell.size, MINE_CUTOUT_SCALE)
}

function getCandidateMineImage(cracked: boolean, sprites: TileSprites): HTMLImageElement {
  const img = cracked ? candidateMineCrackedImage : candidateMineStandardImage
  return img.complete && img.naturalWidth > 0 ? img : sprites.mine
}

function drawCandidateMineCutout(ctx: CanvasRenderingContext2D, image: HTMLImageElement, cx: number, cy: number, size: number, scale: number, alpha = 1): void {
  const bounds =
    image === candidateMineStandardImage
      ? (candidateMineStandardBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight })
      : image === candidateMineCrackedImage
        ? (candidateMineCrackedBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight })
        : { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
  const drawSize = size * 0.84 * scale

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize)
  ctx.restore()
}

function drawMineHitV3Shock(ctx: CanvasRenderingContext2D, cx: number, cy: number, cellSize: number, progress: number): void {
  const ring = clamp01((progress - 0.16) / 0.38)
  if (ring > 0 && ring < 1) {
    const alpha = (1 - ring) * 0.8
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(255, 69, 82, ${alpha})`
    ctx.lineWidth = lerp(4, 1, ring)
    ctx.beginPath()
    ctx.arc(cx, cy, lerp(cellSize * 0.16, cellSize * 0.72, easeOutCubic(ring)), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const sparks = clamp01((progress - 0.1) / 0.48)
  if (sparks <= 0 || sparks >= 1) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 10; i += 1) {
    const angle = i * ((Math.PI * 2) / 10) + 0.35
    const spread = lerp(cellSize * 0.12, cellSize * 0.54, easeOutCubic(sparks))
    const x = cx + Math.cos(angle) * spread
    const y = cy + Math.sin(angle) * spread
    const alpha = (1 - sparks) * (i % 2 === 0 ? 0.85 : 0.55)
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 205, 82, ${alpha})` : `rgba(255, 66, 86, ${alpha})`
    ctx.beginPath()
    ctx.arc(x, y, lerp(2.6, 0.8, sparks), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawMineHitV3CoreBurst(ctx: CanvasRenderingContext2D, cx: number, cy: number, cellSize: number, progress: number): void {
  const burst = clamp01((progress - 0.22) / 0.34)
  if (burst <= 0 || burst >= 1) return

  const fade = Math.sin(burst * Math.PI)
  const radius = lerp(cellSize * 0.12, cellSize * 0.42, easeOutCubic(burst))

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < 11; i += 1) {
    const angle = i * ((Math.PI * 2) / 11) + 0.22 + burst * 0.42
    const width = cellSize * lerp(0.08, 0.03, burst) * (i % 3 === 0 ? 1.24 : 1)
    const inner = cellSize * lerp(0.04, 0.13, burst)
    const outer = cellSize * lerp(0.22, 0.62, easeOutCubic(burst)) * (i % 2 === 0 ? 1.08 : 0.82)
    const tipX = cx + Math.cos(angle) * outer
    const tipY = cy + Math.sin(angle) * outer
    const leftX = cx + Math.cos(angle - 0.5) * inner + Math.cos(angle + Math.PI / 2) * width
    const leftY = cy + Math.sin(angle - 0.5) * inner + Math.sin(angle + Math.PI / 2) * width
    const rightX = cx + Math.cos(angle + 0.5) * inner + Math.cos(angle - Math.PI / 2) * width
    const rightY = cy + Math.sin(angle + 0.5) * inner + Math.sin(angle - Math.PI / 2) * width
    const controlA = cellSize * lerp(0.2, 0.36, burst)
    const controlB = cellSize * lerp(0.16, 0.28, burst)
    const flame = ctx.createRadialGradient(cx, cy, cellSize * 0.02, tipX, tipY, outer * 0.42)
    flame.addColorStop(0, `rgba(255, 252, 218, ${0.84 * fade})`)
    flame.addColorStop(0.36, `rgba(255, 175, 48, ${0.75 * fade})`)
    flame.addColorStop(0.72, `rgba(255, 66, 38, ${0.48 * fade})`)
    flame.addColorStop(1, 'rgba(255, 66, 38, 0)')

    ctx.fillStyle = flame
    ctx.beginPath()
    ctx.moveTo(leftX, leftY)
    ctx.quadraticCurveTo(cx + Math.cos(angle - 0.18) * controlA, cy + Math.sin(angle - 0.18) * controlA, tipX, tipY)
    ctx.quadraticCurveTo(cx + Math.cos(angle + 0.18) * controlB, cy + Math.sin(angle + 0.18) * controlB, rightX, rightY)
    ctx.closePath()
    ctx.fill()
  }

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  core.addColorStop(0, `rgba(255, 255, 238, ${0.95 * fade})`)
  core.addColorStop(0.18, `rgba(255, 213, 92, ${0.88 * fade})`)
  core.addColorStop(0.5, `rgba(255, 71, 82, ${0.62 * fade})`)
  core.addColorStop(1, 'rgba(255, 71, 82, 0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = `rgba(255, 238, 184, ${0.68 * fade})`
  ctx.lineWidth = lerp(3.2, 0.8, burst)
  for (let i = 0; i < 8; i += 1) {
    const angle = i * ((Math.PI * 2) / 8) + burst * 0.55
    const inner = cellSize * lerp(0.12, 0.22, burst)
    const outer = cellSize * lerp(0.22, 0.46, easeOutCubic(burst)) * (i % 2 === 0 ? 1 : 0.72)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
    ctx.stroke()
  }

  ctx.restore()
}

export function drawMineHitV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, sprites: TileSprites, tMs: number): void {
  paintStageBg(ctx, w, h)
  const cell = layoutCell(w, h, 0.55)
  const cx = cell.x + cell.size / 2
  const cy = cell.y + cell.size / 2
  const actionTime = tMs % MINE_HIT_V3_MS
  const progress = clamp01(actionTime / MINE_HIT_V3_ACTION_MS)
  const cracked = progress > 0.54
  const mine = getCandidateMineImage(cracked, sprites)
  const shake = progress < 0.42 ? Math.sin(progress * Math.PI * 18) * (1 - progress / 0.42) : 0
  const pop = progress < 0.42 ? 1 + Math.sin(progress * Math.PI) * 0.075 : lerp(1.03, 1, easeOutCubic((progress - 0.42) / 0.58))
  const flash = progress < 0.22 ? 1 - easeOutCubic(progress / 0.22) : 0

  drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, 0.18)
  drawMineHitV3Shock(ctx, cx, cy, cell.size, progress)

  if (progress > 0.34 && progress < 0.88) {
    drawMineBurstSmoke(ctx, cx, cy, cell.size, clamp01((progress - 0.34) / 0.54), 0.42)
  }

  const dx = shake * cell.size * 0.045
  const dy = Math.cos(progress * Math.PI * 15) * Math.abs(shake) * cell.size * 0.018
  ctx.save()
  ctx.shadowColor = cracked ? 'rgba(255, 68, 86, 0.46)' : 'rgba(38, 229, 255, 0.28)'
  ctx.shadowBlur = cell.size * (cracked ? 0.08 : 0.045)
  drawCandidateMineCutout(ctx, mine, cx + dx, cy + dy, cell.size, pop)
  ctx.restore()

  drawMineHitV3CoreBurst(ctx, cx, cy, cell.size, progress)

  if (flash > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = flash * 0.62
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell.size * 0.45)
    g.addColorStop(0, 'rgba(255, 240, 210, 0.95)')
    g.addColorStop(0.28, 'rgba(255, 69, 82, 0.62)')
    g.addColorStop(1, 'rgba(255, 69, 82, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, cell.size * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  if (progress >= 0.9) {
    drawMineSettledSmoke(ctx, cx, cy, cell.size, tMs, 0.26)
  }
}
