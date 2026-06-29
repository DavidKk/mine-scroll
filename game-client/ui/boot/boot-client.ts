import { getEndlessLayoutProfile } from '../game-stage-layout.ts'

/** Boot must block until every asset (incl. audio) is ready — mobile only. */
export function isMobileBootClient(): boolean {
  if (typeof window === 'undefined') return false
  return getEndlessLayoutProfile(window.innerWidth) === 'mobile'
}
