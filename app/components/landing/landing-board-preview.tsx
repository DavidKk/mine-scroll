'use client'

import { computeLandingPreviewScale, LANDING_PREVIEW_VIEWPORT } from '@game-client/app/landing-preview/viewport.ts'
import { type CSSProperties, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

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
    <div className="relative flex min-h-[inherit] w-full justify-center [perspective:900px]">
      <div
        className="pointer-events-none absolute inset-x-[10%] top-[20%] bottom-[-10%] bg-[radial-gradient(circle,rgba(45,236,255,0.18),transparent_70%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        ref={frameRef}
        className="relative box-border h-[calc(var(--landing-preview-h,844px)+28px)] min-h-[calc(var(--landing-preview-h,844px)+28px)] w-[min(100%,420px)] overflow-hidden rounded-[22px] border border-landing-cyan/[0.18] bg-[rgba(3,8,20,0.72)] p-3.5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_64px_rgba(0,0,0,0.55),0_0_80px_rgba(45,236,255,0.08)] [transform-style:preserve-3d] before:pointer-events-none before:absolute before:-inset-px before:rounded-[inherit] before:bg-[linear-gradient(135deg,rgba(45,236,255,0.45),rgba(129,140,248,0.2),transparent_60%)] before:p-px before:content-[''] before:[mask-composite:exclude] before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]"
        style={previewFrameStyle}
      >
        {status === 'loading' ? (
          <p
            className="pointer-events-none absolute inset-0 z-[1] m-0 grid place-items-center p-6 text-center font-mono text-[0.72rem] uppercase tracking-[0.08em] text-slate-500"
            role="status"
          >
            Loading game preview…
          </p>
        ) : null}
        {status === 'error' ? (
          <p
            className="pointer-events-none absolute inset-0 z-[1] m-0 grid place-items-center p-6 text-center font-mono text-[0.72rem] uppercase tracking-[0.08em] text-red-400"
            role="alert"
          >
            Preview unavailable
          </p>
        ) : null}
        <div
          ref={hostRef}
          className={cn(
            'landing-preview-host landing-preview-canvas-host pointer-events-none mx-auto opacity-0 transition-opacity duration-[280ms] ease-out motion-reduce:transition-none',
            status === 'ready' && 'opacity-100'
          )}
          style={{
            width: 'var(--landing-preview-w, 390px)',
            height: 'var(--landing-preview-h, 844px)',
            marginBottom: 'calc(var(--landing-preview-h, 844px) * (var(--landing-preview-scale, 1) - 1))',
            transform: 'scale(var(--landing-preview-scale, 1))',
            transformOrigin: 'top center',
          }}
          aria-hidden={status !== 'ready'}
        />
      </div>
    </div>
  )
}
