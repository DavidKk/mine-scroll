import { isDev } from '../../env.ts'
import { drawFpsHud, FpsMeter } from '../fps-meter.ts'
import { fpsOverlayMinIntervalMs } from './runtime/mobile-perf.ts'
import { applyCanvasSize } from './types.ts'

export interface FpsOverlayAnchor {
  x: number
  y: number
  scale: number
}

export interface FpsOverlay {
  recordGameFrame(now?: number): void
  setAnchor(anchor: FpsOverlayAnchor): void
  syncSize(width: number, height: number): void
  destroy(): void
}

/** Dev always on; production requires `?fps` or `?fps=1` / `?fps=true`. */
export function isFpsOverlayEnabled(): boolean {
  if (isDev) return true
  if (typeof window === 'undefined') return false
  const search = window.location?.search
  if (search === undefined) return false
  const params = new URLSearchParams(search)
  if (!params.has('fps')) return false
  const value = params.get('fps')
  return value === null || value === '' || value === '1' || value === 'true'
}

function createNoopFpsOverlay(): FpsOverlay {
  return {
    recordGameFrame() {},
    setAnchor() {},
    syncSize() {},
    destroy() {},
  }
}

/** Independent overlay canvas — own loop, not blocked by game paint cost. */
export function createFpsOverlay(mount: HTMLElement): FpsOverlay {
  if (!isFpsOverlayEnabled()) return createNoopFpsOverlay()
  const canvas = document.createElement('canvas')
  canvas.className = 'game-canvas__fps-overlay'
  canvas.setAttribute('aria-hidden', 'true')
  mount.appendChild(canvas)

  const ctxOrNull = canvas.getContext('2d')
  if (!ctxOrNull) throw new Error('FPS overlay 2D context not available')
  const ctx = ctxOrNull

  const meter = new FpsMeter()
  let anchor: FpsOverlayAnchor = { x: 8, y: 8, scale: 1 }
  let width = 0
  let height = 0
  let loopId: number | null = null
  let loopIsTimeout = false
  let destroyed = false

  function viewportW(): number {
    return width > 0 ? width : typeof window !== 'undefined' ? window.innerWidth : 768
  }

  function draw(): void {
    if (destroyed) return
    ctx.clearRect(0, 0, width, height)
    drawFpsHud(ctx, anchor.x, anchor.y, meter.getFps(), meter.getFrameMs(), anchor.scale)
  }

  function cancelLoop(): void {
    if (loopId === null) return
    if (loopIsTimeout) window.clearTimeout(loopId)
    else window.cancelAnimationFrame(loopId)
    loopId = null
  }

  function scheduleLoop(): void {
    if (destroyed) return
    const gap = fpsOverlayMinIntervalMs(viewportW())
    if (gap > 0) {
      loopIsTimeout = true
      loopId = window.setTimeout(() => {
        loopId = null
        draw()
        scheduleLoop()
      }, gap)
      return
    }
    loopIsTimeout = false
    loopId = window.requestAnimationFrame(() => {
      loopId = null
      draw()
      scheduleLoop()
    })
  }

  scheduleLoop()

  return {
    recordGameFrame(now = performance.now()) {
      meter.tick(now)
    },
    setAnchor(next) {
      anchor = next
    },
    syncSize(w, h) {
      if (w === width && h === height) return
      width = w
      height = h
      applyCanvasSize(canvas, ctx, w, h)
    },
    destroy() {
      destroyed = true
      cancelLoop()
      canvas.remove()
    },
  }
}
