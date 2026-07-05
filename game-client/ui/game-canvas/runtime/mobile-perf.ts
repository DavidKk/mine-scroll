import type { GameStatus } from '@shared/core/types.ts'

import { getEndlessLayoutProfile } from '../../game-stage-layout.ts'

export const MOBILE_MAX_CANVAS_DPR = 2
export const DESKTOP_MAX_CANVAS_DPR = 2
/** Embedded landing attract preview — save GPU fill on a small canvas. */
export const ATTRACT_PREVIEW_MAX_DPR = 1.5

const MOBILE_AMBIENT_FPS = 20
const DESKTOP_AMBIENT_FPS = 40
const ATTRACT_AMBIENT_FPS = 12

export function isMobileViewport(viewportW: number): boolean {
  return getEndlessLayoutProfile(viewportW) === 'mobile'
}

export function resolveCanvasDpr(viewportW: number, maxDpr?: number): number {
  const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const cap = maxDpr ?? (isMobileViewport(viewportW) ? MOBILE_MAX_CANVAS_DPR : DESKTOP_MAX_CANVAS_DPR)
  return Math.min(raw, cap)
}

export function ambientFrameMs(viewportW: number, lowPower = false): number {
  if (lowPower) return 1000 / ATTRACT_AMBIENT_FPS
  const fps = isMobileViewport(viewportW) ? MOBILE_AMBIENT_FPS : DESKTOP_AMBIENT_FPS
  return 1000 / fps
}

/** Backdrop particle density multiplier (0–1). */
export function backdropParticleScale(viewportW: number): number {
  return isMobileViewport(viewportW) ? 0.42 : 1
}

export function backdropLiteStars(viewportW: number): boolean {
  return isMobileViewport(viewportW)
}

export function fpsOverlayMinIntervalMs(viewportW: number): number {
  return isMobileViewport(viewportW) ? 250 : 0
}

/** Desktop fullscreen always animates backdrop; mobile only when idle (start screen). */
export function shouldForceFullscreenAmbient(viewportW: number, status: GameStatus): boolean {
  if (!isMobileViewport(viewportW)) return true
  return status === 'idle'
}
