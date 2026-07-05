'use client'

import { computeLandingPreviewScale, LANDING_PREVIEW_VIEWPORT } from '@game-client/app/landing-preview/viewport.ts'
import { type CSSProperties, useEffect, useRef, useState } from 'react'

type LandingBoardPreviewProps = {
  /** When false (mobile), only the reserved shell is kept — no demo mount. */
  mountDemo?: boolean
}

const previewFrameStyle = {
  '--landing-preview-w': `${LANDING_PREVIEW_VIEWPORT.width}px`,
  '--landing-preview-h': `${LANDING_PREVIEW_VIEWPORT.height}px`,
  '--landing-preview-scale': '1',
} as CSSProperties

function waitForLandingIdle(timeoutMs = 1800): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: timeoutMs })
      return
    }
    window.requestAnimationFrame(() => resolve())
  })
}

export function LandingBoardPreview({ mountDemo = true }: LandingBoardPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(mountDemo ? 'loading' : 'idle')

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const syncScale = () => {
      const scale = computeLandingPreviewScale(frame.clientWidth)
      frame.style.setProperty('--landing-preview-scale', String(scale))
    }

    syncScale()
    const ro = new ResizeObserver(syncScale)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!mountDemo) {
      setStatus('idle')
      return
    }

    const host = hostRef.current
    const frame = frameRef.current
    if (!host || !frame) return

    let cleanup: (() => void) | undefined
    let disposed = false
    setStatus('loading')

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
        const scale = computeLandingPreviewScale(frame.clientWidth)
        frame.style.setProperty('--landing-preview-scale', String(scale))
      } catch {
        if (!disposed) setStatus('error')
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [mountDemo])

  return (
    <div className="landing__preview-wrap">
      <div className="landing__preview-glow" aria-hidden="true" />
      <div ref={frameRef} className="landing__preview-frame" style={previewFrameStyle}>
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
        <div ref={hostRef} className={`landing__preview-canvas-host${status === 'ready' ? ' landing__preview-canvas-host--ready' : ''}`} aria-hidden={status !== 'ready'} />
      </div>
    </div>
  )
}
