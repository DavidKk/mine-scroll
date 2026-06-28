import { getGameCutout } from '../../game-assets.ts'
import { clamp01, easeOutBack, easeOutCubic, lerp } from '../../primitives/index.ts'
import type { TileSprites } from '../../tile-sprites.ts'
import { drawDigitParticles, drawHiddenCellWithEffect } from './cell-scenes.ts'
import type { ImageBounds } from './types.ts'
import { FLAG_PLACE_ACTION_MS, FLAG_PLACE_MS, FLAG_WAVE_MS, V3_CANDIDATE_FLAG_SRC, WRONG_FLAG_V3_ACTION_MS, WRONG_FLAG_V3_MS } from './types.ts'
import { breathPhase, hoverStateOpts, layoutCell, mixOpts, paintStageBg, readImageBounds } from './utils.ts'

const candidateFlagImage = new Image()
candidateFlagImage.src = V3_CANDIDATE_FLAG_SRC
let candidateFlagBounds: ImageBounds | null = null
candidateFlagImage.addEventListener('load', () => {
  candidateFlagBounds = readImageBounds(candidateFlagImage)
})

function drawWaveImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, tMs: number, amplitude: number): void {
  const segments = 14
  const phase = (tMs % FLAG_WAVE_MS) / FLAG_WAVE_MS
  for (let i = 0; i < segments; i += 1) {
    const sx = (img.naturalWidth / segments) * i
    const sw = img.naturalWidth / segments
    const dx = x + (w / segments) * i
    const dw = w / segments + 1
    const local = i / Math.max(1, segments - 1)
    const wave = Math.sin(phase * Math.PI * 2 + local * Math.PI * 2.2)
    const dy = y + wave * amplitude * local
    const dh = h * (1 + Math.cos(phase * Math.PI * 2 + local * Math.PI) * 0.025 * local)
    ctx.drawImage(img, sx, 0, sw, img.naturalHeight, dx, dy, dw, dh)
  }
}

function getCandidateFlagImage(sprites: TileSprites): HTMLImageElement {
  return candidateFlagImage.complete && candidateFlagImage.naturalWidth > 0 ? candidateFlagImage : sprites.flag
}

function drawCandidateFlagAnchored(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  baseX: number,
  baseY: number,
  height: number,
  alpha: number,
  rotation: number,
  scale: number
): void {
  const bounds =
    image === candidateFlagImage
      ? (candidateFlagBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight })
      : { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
  const drawH = height * scale
  const drawW = drawH * (bounds.w / bounds.h)

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(baseX, baseY)
  ctx.rotate(rotation)
  ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, -drawW / 2, -drawH, drawW, drawH)
  ctx.restore()
}

function drawFlagPlaceImpact(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, cellSize: number, progress: number): void {
  const impact = clamp01((progress - 0.42) / 0.34)
  if (impact <= 0 || impact >= 1) return

  const alpha = (1 - impact) * 0.62
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = `rgba(45, 236, 255, ${alpha})`
  ctx.lineWidth = lerp(2.2, 0.8, impact)
  ctx.beginPath()
  ctx.ellipse(
    baseX,
    baseY + cellSize * 0.025,
    lerp(cellSize * 0.08, cellSize * 0.34, easeOutCubic(impact)),
    lerp(cellSize * 0.025, cellSize * 0.105, easeOutCubic(impact)),
    0,
    0,
    Math.PI * 2
  )
  ctx.stroke()

  for (let i = 0; i < 5; i += 1) {
    const angle = -Math.PI * 0.92 + i * ((Math.PI * 0.84) / 4)
    const dist = lerp(cellSize * 0.04, cellSize * 0.23, easeOutCubic(impact))
    const x = baseX + Math.cos(angle) * dist
    const y = baseY + Math.sin(angle) * dist * 0.32
    ctx.fillStyle = i % 2 === 0 ? `rgba(255, 203, 74, ${alpha})` : `rgba(45, 236, 255, ${alpha})`
    ctx.beginPath()
    ctx.arc(x, y, lerp(2.4, 0.8, impact), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawWrongFlagV3Effects(ctx: CanvasRenderingContext2D, cx: number, cy: number, cellSize: number, progress: number): void {
  const warn = clamp01((progress - 0.18) / 0.42)
  if (warn > 0 && warn < 1) {
    const alpha = (1 - warn) * 0.82
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(255, 65, 86, ${alpha})`
    ctx.lineWidth = lerp(4, 1, warn)
    ctx.beginPath()
    ctx.arc(cx, cy, lerp(cellSize * 0.2, cellSize * 0.68, easeOutCubic(warn)), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const slash = clamp01((progress - 0.24) / 0.22)
  if (slash > 0 && slash < 1) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(255, 76, 96, ${0.9 * (1 - Math.max(0, slash - 0.72) / 0.28)})`
    ctx.lineWidth = cellSize * 0.07
    ctx.lineCap = 'round'
    const len = cellSize * 0.34 * easeOutCubic(slash)
    ctx.beginPath()
    ctx.moveTo(cx - len, cy - len)
    ctx.lineTo(cx + len, cy + len)
    ctx.moveTo(cx + len, cy - len)
    ctx.lineTo(cx - len, cy + len)
    ctx.stroke()
    ctx.restore()
  }

  const bits = clamp01((progress - 0.34) / 0.44)
  if (bits <= 0 || bits >= 1) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI * 0.85 + i * ((Math.PI * 1.7) / 9)
    const dist = lerp(cellSize * 0.08, cellSize * 0.52, easeOutCubic(bits)) * (i % 2 === 0 ? 1 : 0.7)
    const x = cx + Math.cos(angle) * dist
    const y = cy + Math.sin(angle) * dist * 0.72
    const alpha = (1 - bits) * 0.78
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 203, 74, ${alpha})` : `rgba(255, 65, 86, ${alpha})`
    ctx.beginPath()
    ctx.arc(x, y, lerp(2.6, 0.8, bits), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawFlagScene(ctx: CanvasRenderingContext2D, w: number, h: number, sprites: TileSprites, tMs: number): void {
  paintStageBg(ctx, w, h)
  const cell = layoutCell(w, h, 0.56)
  const cx = cell.x + cell.size / 2
  const cy = cell.y + cell.size / 2
  const flag = getGameCutout('flag-blue') ?? sprites.flag
  const phase = (tMs % FLAG_WAVE_MS) / FLAG_WAVE_MS
  const pop = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5

  drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size, mixOpts(breathPhase(tMs), hoverStateOpts(0.35), 0.35))

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.25 + pop * 0.25
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, cell.size * (0.43 + pop * 0.06), 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.shadowColor = 'rgba(56, 189, 248, 0.75)'
  ctx.shadowBlur = cell.size * 0.1
  const drawW = cell.size * 0.74
  const drawH = cell.size * 0.74
  drawWaveImage(ctx, flag, cx - drawW / 2, cy - drawH / 2, drawW, drawH, tMs, cell.size * 0.032)
  ctx.restore()

  drawDigitParticles(ctx, cx, cy, cell.size * 0.82, '#38bdf8', tMs, 3, FLAG_WAVE_MS)
}

export function drawFlagPlaceScene(ctx: CanvasRenderingContext2D, w: number, h: number, sprites: TileSprites, tMs: number): void {
  paintStageBg(ctx, w, h)
  const cell = layoutCell(w, h, 0.56)
  const cx = cell.x + cell.size / 2
  const baseY = cell.y + cell.size * 0.82
  const actionTime = tMs % FLAG_PLACE_MS
  const progress = clamp01(actionTime / FLAG_PLACE_ACTION_MS)
  const land = easeOutBack(clamp01(progress / 0.78))
  const settle = easeOutCubic(clamp01((progress - 0.78) / 0.22))
  const flag = getCandidateFlagImage(sprites)

  drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size, mixOpts(breathPhase(tMs), hoverStateOpts(0.18), 0.22))

  drawFlagPlaceImpact(ctx, cx, baseY, cell.size, progress)

  const yOffset = settle > 0 ? lerp(-cell.size * 0.035, 0, settle) : lerp(-cell.size * 0.42, -cell.size * 0.035, land)
  const rotation = settle > 0 ? lerp(0.025, 0, settle) : lerp(-0.055, 0.025, easeOutCubic(progress))
  const scale = settle > 0 ? lerp(1.015, 1, settle) : lerp(0.96, 1.015, land)
  const alpha = clamp01(progress / 0.16)
  const holdWave = Math.sin((actionTime / FLAG_PLACE_MS) * Math.PI * 2) * 0.006

  ctx.save()
  ctx.shadowColor = 'rgba(38, 229, 255, 0.36)'
  ctx.shadowBlur = cell.size * 0.045
  drawCandidateFlagAnchored(ctx, flag, cx, baseY + yOffset, cell.size * 1.04, alpha, rotation + (progress >= 1 ? holdWave : 0), scale)
  ctx.restore()
}

export function drawWrongFlagV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, sprites: TileSprites, tMs: number): void {
  paintStageBg(ctx, w, h)
  const cell = layoutCell(w, h, 0.56)
  const cx = cell.x + cell.size / 2
  const baseY = cell.y + cell.size * 0.82
  const actionTime = tMs % WRONG_FLAG_V3_MS
  const progress = clamp01(actionTime / WRONG_FLAG_V3_ACTION_MS)
  const flag = getCandidateFlagImage(sprites)

  drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size, mixOpts(breathPhase(tMs), hoverStateOpts(0.12), 0.18))

  const shakeWindow = clamp01((progress - 0.08) / 0.52)
  const shakeFade = 1 - clamp01((shakeWindow - 0.48) / 0.52)
  const shake = Math.sin(progress * Math.PI * 16) * Math.max(0, shakeFade)
  const rotation = shake * 0.13
  const xOffset = shake * cell.size * 0.05
  const sink = progress > 0.58 ? lerp(0, cell.size * 0.05, easeOutCubic((progress - 0.58) / 0.3)) : 0
  const scale = progress > 0.58 ? lerp(1, 0.88, easeOutCubic((progress - 0.58) / 0.3)) : 1
  const alpha = progress > 0.68 ? lerp(1, 0.72, easeOutCubic((progress - 0.68) / 0.24)) : 1

  ctx.save()
  ctx.shadowColor = 'rgba(255, 65, 86, 0.42)'
  ctx.shadowBlur = cell.size * 0.075
  drawCandidateFlagAnchored(ctx, flag, cx + xOffset, baseY + sink, cell.size * 1.04, alpha, rotation, scale)
  ctx.restore()

  drawWrongFlagV3Effects(ctx, cx, cell.y + cell.size * 0.52, cell.size, progress)
}
