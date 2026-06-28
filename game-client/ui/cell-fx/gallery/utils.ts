import { resolveRasterUrl } from '../../boot/image-format.ts'
import { easeOutCubic, lerp } from '../../primitives/index.ts'
import type { CellEffectDrawOpts, ImageBounds } from './types.ts'
import { BREATH_CYCLE_MS, PREVIEW_PX } from './types.ts'

function paintCheckerBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const tile = 16
  ctx.fillStyle = '#1a1d26'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#232732'
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) continue
      ctx.fillRect(x, y, tile, tile)
    }
  }
}

export function readImageBounds(image: HTMLImageElement): ImageBounds | null {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null

  ctx.drawImage(image, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let x0 = width
  let y0 = height
  let x1 = 0
  let y1 = 0
  let found = false

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        found = true
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x + 1)
        y1 = Math.max(y1, y + 1)
      }
    }
  }

  if (!found) return null
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function createAssetImage(src: string): HTMLImageElement {
  const image = new Image()
  const preferred = resolveRasterUrl(src)
  image.src = preferred
  image.onerror = () => {
    if (preferred !== src) image.src = src
  }
  return image
}

export function paintStageBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  paintCheckerBg(ctx, w, h)
}

/** Live preview canvases are built before the panel enters the DOM — use a fixed layout size. */
export function measurePreviewCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): { w: number; h: number } {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const parent = canvas.parentElement
  let w = Math.floor(rect.width) || parent?.clientWidth || PREVIEW_PX
  let h = Math.floor(rect.height) || parent?.clientHeight || PREVIEW_PX
  if (w < 2) w = PREVIEW_PX
  if (h < 2) h = PREVIEW_PX
  const pw = Math.floor(w * dpr)
  const ph = Math.floor(h * dpr)
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw
    canvas.height = ph
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  return { w, h }
}

export function initPreviewCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  canvas.style.width = `${PREVIEW_PX}px`
  canvas.style.height = `${PREVIEW_PX}px`
  measurePreviewCanvas(canvas, ctx)
  return ctx
}

export function startPreviewLoop(canvas: HTMLCanvasElement, tick: () => void): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let frame = 0
  let running = true

  const loop = (): void => {
    if (!running) return
    frame = window.requestAnimationFrame(loop)
    if (!canvas.isConnected) return
    measurePreviewCanvas(canvas, ctx)
    tick()
  }

  loop()

  return () => {
    running = false
    window.cancelAnimationFrame(frame)
  }
}

export function layoutCell(canvasW: number, canvasH: number, ratio = 0.54): { x: number; y: number; size: number } {
  const size = Math.min(canvasW, canvasH) * ratio
  return {
    x: (canvasW - size) / 2,
    y: (canvasH - size) / 2,
    size,
  }
}

export function mixOpts(a: CellEffectDrawOpts, b: CellEffectDrawOpts, t: number): CellEffectDrawOpts {
  return {
    scale: lerp(a.scale ?? 1, b.scale ?? 1, t),
    lift: lerp(a.lift ?? 0, b.lift ?? 0, t),
    brightness: lerp(a.brightness ?? 0, b.brightness ?? 0, t),
    ringAlpha: lerp(a.ringAlpha ?? 0, b.ringAlpha ?? 0, t),
    ringWidth: lerp(a.ringWidth ?? 0, b.ringWidth ?? 0, t),
    innerGlow: lerp(a.innerGlow ?? 0, b.innerGlow ?? 0, t),
  }
}

export function breathPhase(tMs: number): CellEffectDrawOpts {
  const phase = (tMs % BREATH_CYCLE_MS) / BREATH_CYCLE_MS
  const wave = Math.sin(phase * Math.PI * 2)
  return {
    scale: 1 + wave * 0.026,
    lift: wave * -1.1,
    brightness: wave * 0.055,
    ringAlpha: 0.14 + (wave + 1) * 0.12,
    ringWidth: 1.7 + (wave + 1) * 0.55,
    innerGlow: 0.08 + (wave + 1) * 0.06,
  }
}

export function hoverStateOpts(progress: number, pressed = false): CellEffectDrawOpts {
  const hover = {
    scale: pressed ? 0.97 : 1.046,
    lift: pressed ? 2 : -2.6,
    brightness: pressed ? -0.04 : 0.11,
    ringAlpha: pressed ? 0.28 : 0.56,
    ringWidth: pressed ? 1.8 : 2.5,
    innerGlow: pressed ? 0.1 : 0.24,
  }
  return mixOpts({ scale: 1, lift: 0, brightness: 0, ringAlpha: 0, ringWidth: 0, innerGlow: 0 }, hover, easeOutCubic(progress))
}
