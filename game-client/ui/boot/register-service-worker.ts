import { brandLogPrefix } from '../../../lib/brand.ts'
import { isProd } from '../../env.ts'

/** Register the static asset service worker after boot completes (production only). */
export function registerBootServiceWorker(): void {
  if (!isProd) return
  if (!('serviceWorker' in navigator)) return

  void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
    console.warn(`${brandLogPrefix('boot')} Service worker registration failed`, error)
  })
}
