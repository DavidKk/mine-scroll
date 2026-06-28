import { isDev } from '../../../env.ts'
import { getEndlessLayoutProfile } from '../../game-stage-layout.ts'

/** Dev builds: mouse + touch pointer paths both active (touch ignores mouse pointers). */
export function isDualInputDebugEnabled(): boolean {
  return isDev
}

/** Viewport-based layout profile (not input gating when dual debug is on). */
export function isMobileInputProfile(viewportW: number): boolean {
  return getEndlessLayoutProfile(viewportW) === 'mobile'
}

export function isDesktopInputProfile(viewportW: number): boolean {
  return getEndlessLayoutProfile(viewportW) === 'desktop'
}

export function useDesktopMouseInput(viewportW: number): boolean {
  return isDesktopInputProfile(viewportW) || isDualInputDebugEnabled()
}

export function useTouchPointerInput(viewportW: number): boolean {
  return isMobileInputProfile(viewportW) || isDualInputDebugEnabled()
}
