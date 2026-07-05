'use client'

import { LANDING_PREVIEW_DESKTOP_MEDIA } from '@game-client/app/landing-preview/viewport.ts'
import { useEffect, useState } from 'react'

/** Landing attract DEMO is desktop-only — skip mount on mobile to save load and layout space. */
export function useLandingPreviewEnabled(): boolean {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(LANDING_PREVIEW_DESKTOP_MEDIA)
    const sync = () => setEnabled(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return enabled
}
