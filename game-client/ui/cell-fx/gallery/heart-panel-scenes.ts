import { drawRuntimePanelV3Fx } from '../../game-canvas/hud/canvas-primitives.ts'
import type { GameCanvasRuntime } from '../../game-canvas/runtime/context.ts'
import { clamp01, easeOutBack, easeOutCubic, lerp } from '../../primitives/index.ts'
import type { ImageBounds, PanelConceptKind } from './types.ts'
import { HEART_REFILL_V3_ACTION_MS, HEART_REFILL_V3_MS, V3_CANDIDATE_HEART_EMPTY_SRC, V3_CANDIDATE_HEART_FULL_SRC } from './types.ts'
import { createAssetImage, paintStageBg, readImageBounds } from './utils.ts'

const PREVIEW_RT = { state: {} } as GameCanvasRuntime

const candidateHeartFullImage = new Image()
candidateHeartFullImage.src = V3_CANDIDATE_HEART_FULL_SRC
let candidateHeartFullBounds: ImageBounds | null = null
candidateHeartFullImage.addEventListener('load', () => {
  candidateHeartFullBounds = readImageBounds(candidateHeartFullImage)
})

const candidateHeartEmptyImage = new Image()
candidateHeartEmptyImage.src = V3_CANDIDATE_HEART_EMPTY_SRC
let candidateHeartEmptyBounds: ImageBounds | null = null
candidateHeartEmptyImage.addEventListener('load', () => {
  candidateHeartEmptyBounds = readImageBounds(candidateHeartEmptyImage)
})

const panelConceptImages = {
  startPanel: createAssetImage('/assets/candidates/game-ui-v3/panels/runtime/start-panel-v3.png'),
  gameOverPanel: createAssetImage('/assets/candidates/game-ui-v3/panels/runtime/game-over-panel-v3.png'),
} as const

function getCandidateHeartImage(full: boolean): HTMLImageElement | null {
  const image = full ? candidateHeartFullImage : candidateHeartEmptyImage
  return image.complete && image.naturalWidth > 0 ? image : null
}

function getCandidateHeartBounds(image: HTMLImageElement): ImageBounds {
  if (image === candidateHeartFullImage) {
    return candidateHeartFullBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
  }
  if (image === candidateHeartEmptyImage) {
    return candidateHeartEmptyBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
  }
  return { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
}

function drawCandidateHeart(ctx: CanvasRenderingContext2D, image: HTMLImageElement, cx: number, cy: number, size: number, scale: number, alpha: number): void {
  const bounds = getCandidateHeartBounds(image)
  const drawH = size * scale
  const drawW = drawH * (bounds.w / bounds.h)

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
  ctx.restore()
}

function drawHeartRefillV3Effects(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, progress: number): void {
  const ring = clamp01((progress - 0.1) / 0.46)
  if (ring > 0 && ring < 1) {
    const alpha = (1 - ring) * 0.72
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(255, 213, 92, ${alpha})`
    ctx.lineWidth = lerp(4.5, 1, ring)
    ctx.beginPath()
    ctx.arc(cx, cy, lerp(size * 0.26, size * 0.76, easeOutCubic(ring)), 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = `rgba(45, 236, 255, ${alpha * 0.58})`
    ctx.lineWidth = lerp(2.5, 0.7, ring)
    ctx.beginPath()
    ctx.arc(cx, cy, lerp(size * 0.18, size * 0.58, easeOutCubic(ring)), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const bloom = clamp01((progress - 0.14) / 0.32)
  if (bloom > 0 && bloom < 1) {
    const fade = Math.sin(bloom * Math.PI)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * lerp(0.22, 0.7, bloom))
    g.addColorStop(0, `rgba(255, 246, 202, ${0.72 * fade})`)
    g.addColorStop(0.4, `rgba(255, 213, 92, ${0.42 * fade})`)
    g.addColorStop(1, 'rgba(45, 236, 255, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.72, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const particles = clamp01((progress - 0.18) / 0.56)
  if (particles <= 0 || particles >= 1) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 12; i += 1) {
    const angle = i * ((Math.PI * 2) / 12) - Math.PI / 2
    const lift = i % 2 === 0 ? 0.82 : 1.08
    const dist = lerp(size * 0.18, size * 0.68, easeOutCubic(particles)) * lift
    const x = cx + Math.cos(angle) * dist
    const y = cy + Math.sin(angle) * dist * 0.82
    const alpha = (1 - particles) * 0.86
    ctx.fillStyle = i % 3 === 0 ? `rgba(45, 236, 255, ${alpha})` : `rgba(255, 213, 92, ${alpha})`
    ctx.beginPath()
    ctx.arc(x, y, lerp(2.8, 0.9, particles), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawHeartRefillV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): void {
  paintStageBg(ctx, w, h)
  const cx = w / 2
  const cy = h / 2
  const size = Math.min(w, h) * 0.58
  const actionTime = tMs % HEART_REFILL_V3_MS
  const progress = clamp01(actionTime / HEART_REFILL_V3_ACTION_MS)
  const full = getCandidateHeartImage(true)
  const empty = getCandidateHeartImage(false)
  const popIn = clamp01((progress - 0.22) / 0.34)
  const settle = clamp01((progress - 0.56) / 0.22)
  const popScale = settle > 0 ? lerp(1.12, 1, easeOutCubic(settle)) : lerp(0.76, 1.12, easeOutBack(popIn))
  const fullAlpha = clamp01((progress - 0.18) / 0.22)

  ctx.save()
  ctx.fillStyle = 'rgba(7, 8, 15, 0.8)'
  ctx.beginPath()
  ctx.roundRect(cx - size * 0.72, cy - size * 0.58, size * 1.44, size * 1.16, size * 0.16)
  ctx.fill()
  ctx.restore()

  if (empty) {
    drawCandidateHeart(ctx, empty, cx, cy, size, 0.98, 0.5 + (1 - fullAlpha) * 0.35)
  }

  drawHeartRefillV3Effects(ctx, cx, cy, size, progress)

  if (full && fullAlpha > 0) {
    ctx.save()
    ctx.shadowColor = 'rgba(255, 213, 92, 0.52)'
    ctx.shadowBlur = size * 0.12
    drawCandidateHeart(ctx, full, cx, cy, size, popScale, fullAlpha)
    ctx.restore()
  }
}

export function drawHeartStaticV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, full: boolean): void {
  paintStageBg(ctx, w, h)
  const cx = w / 2
  const cy = h / 2
  const size = Math.min(w, h) * 0.58
  const image = getCandidateHeartImage(full)

  ctx.save()
  ctx.fillStyle = 'rgba(7, 8, 15, 0.8)'
  ctx.beginPath()
  ctx.roundRect(cx - size * 0.72, cy - size * 0.58, size * 1.44, size * 1.16, size * 0.16)
  ctx.fill()
  ctx.restore()

  if (!image) return
  ctx.save()
  ctx.shadowColor = full ? 'rgba(255, 213, 92, 0.38)' : 'rgba(45, 236, 255, 0.18)'
  ctx.shadowBlur = size * 0.08
  drawCandidateHeart(ctx, image, cx, cy, size, full ? 1 : 0.98, full ? 1 : 0.78)
  ctx.restore()
}

function drawPanelConceptImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  scale = 1,
  alpha = 1
): { x: number; y: number; w: number; h: number } | null {
  if (!image || !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return null
  const ratio = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight) * scale
  const w = image.naturalWidth * ratio
  const h = image.naturalHeight * ratio
  const x = cx - w / 2
  const y = cy - h / 2
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(image, x, y, w, h)
  ctx.restore()
  return { x, y, w, h }
}

function drawPanelV3CanvasFx(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  kind: PanelConceptKind,
  nowMs: number,
  actionProgress = 0
): void {
  drawRuntimePanelV3Fx(PREVIEW_RT, ctx, bounds.x, bounds.y, bounds.w, bounds.h, kind, nowMs, actionProgress)
}

export function drawPanelV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, kind: PanelConceptKind, tMs: number, actionProgress = 0): void {
  paintStageBg(ctx, w, h)
  const image = kind === 'start' ? panelConceptImages.startPanel : panelConceptImages.gameOverPanel
  const action = clamp01(actionProgress)
  const shake = kind === 'game-over' && action > 0 && action < 0.55 ? Math.sin(action * Math.PI * 18) * (1 - action) * Math.min(w, h) * 0.012 : 0
  const pop = action > 0 ? 1 - Math.sin(action * Math.PI) * 0.025 : 1
  const bounds = drawPanelConceptImage(ctx, image, w / 2 + shake, h / 2, w * 0.88, h * 0.72, pop)
  if (bounds) drawPanelV3CanvasFx(ctx, bounds, kind, tMs, action)
}
