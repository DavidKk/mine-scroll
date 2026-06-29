import { isDev } from '../../../env.ts'
import { getEndlessLayoutProfile } from '../../game-stage-layout.ts'

/** Dev-only touch simulation on desktop (`?dual-input=1`). Never enables mouse on mobile. */
export function isDualInputDebugEnabled(): boolean {
  if (!isDev || typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('dual-input') === '1' || params.get('dual-input') === 'true'
}

/** Viewport-based layout profile (not input gating when dual debug is on). */
export function isMobileInputProfile(viewportW: number): boolean {
  return getEndlessLayoutProfile(viewportW) === 'mobile'
}

export function isDesktopInputProfile(viewportW: number): boolean {
  return getEndlessLayoutProfile(viewportW) === 'desktop'
}

export function useDesktopMouseInput(viewportW: number): boolean {
  if (isMobileInputProfile(viewportW)) return false
  return isDesktopInputProfile(viewportW)
}

export function useTouchPointerInput(viewportW: number): boolean {
  if (isMobileInputProfile(viewportW)) return true
  return isDualInputDebugEnabled()
}
