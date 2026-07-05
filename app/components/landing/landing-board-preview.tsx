'use client'

import { computeLandingPreviewScale, LANDING_PREVIEW_VIEWPORT } from '@game-client/app/landing-preview/viewport.ts'
import { type CSSProperties,useEffect, useRef, useState } from 'react'

import { waitForLandingIdle } from './landing-idle'

export function LandingBoardPreview() {
  const hostRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const host = hostRef.current
    const frame = frameRef.current
    if (!host || !frame) return

    let cleanup: (() => void) | undefined
    let disposed = false

    const syncScale = () => {
      const scale = computeLandingPreviewScale(frame.clientWidth)
      frame.style.setProperty('--landing-preview-scale', String(scale))
    }

    syncScale()
    const ro = new ResizeObserver(syncScale)
    ro.observe(frame)

    void (async () => {
      try {
        await waitForLandingIdle()
        if (disposed) return
        const { ensureClientBoot } = await import('@game-client/bootstrap')
        const { mountLandingPreview } = await import('@game-client/app/landing-preview/mount.ts')
        await ensureClientBoot({ silent: true })
        if (disposed) return
        cleanup = mountLandingPreview(host)
        setStatus('ready')
        syncScale()
      } catch {
        if (!disposed) setStatus('error')
      }
    })()

    return () => {
      disposed = true
      ro.disconnect()
      cleanup?.()
    }
  }, [])

  return (
    <div className="landing__preview-wrap">
      <div className="landing__preview-glow" aria-hidden="true" />
      <div
        ref={frameRef}
        className="landing__preview-frame"
        style={
          {
            '--landing-preview-w': `${LANDING_PREVIEW_VIEWPORT.width}px`,
            '--landing-preview-h': `${LANDING_PREVIEW_VIEWPORT.height}px`,
          } as CSSProperties
        }
      >
        {status === 'loading' ? (
          <p className="landing__preview-status" role="status">
            Loading game preview…
          </p>
        ) : null}
        {status === 'error' ? (
          <p className="landing__preview-status landing__preview-status--error" role="alert">
            Preview unavailable
          </p>
        ) : null}
        <div ref={hostRef} className={`landing__preview-canvas-host${status === 'ready' ? ' landing__preview-canvas-host--ready' : ''}`} />
      </div>
    </div>
  )
}
