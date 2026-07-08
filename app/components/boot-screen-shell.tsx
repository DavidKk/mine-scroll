import { forwardRef } from 'react'

import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'

export const BootScreenShell = forwardRef<HTMLDivElement>(function BootScreenShell(_props, ref) {
  return (
    <div ref={ref} id="boot-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="boot-screen__backdrop">
        <div className="boot-screen__aurora" />
        <div className="boot-screen__stars boot-screen__stars--far" />
        <div className="boot-screen__stars boot-screen__stars--near" />
        <div className="boot-screen__grid-lines" />
        <div className="boot-screen__vignette" />
      </div>
      <div className="boot-screen__panel">
        <div className="boot-screen__panel-glow" aria-hidden="true" />
        <div className="boot-screen__panel-frame" aria-hidden="true" />
        <div className="boot-screen__panel-scanlines" aria-hidden="true" />
        <div className="boot-screen__grid-wrap">
          <div className="boot-screen__grid-stage">
            <div className="boot-screen__grid-scan" aria-hidden="true" />
            <div className="boot-screen__grid" role="group" aria-label={`Mini ${BRAND_NAME}`}>
              {Array.from({ length: 9 }, (_, index) => (
                <button key={index} type="button" className="boot-screen__cell" />
              ))}
            </div>
          </div>
          <p className="boot-screen__grid-hint">Tap cells while loading</p>
        </div>
        <h1 className="boot-screen__title">{BRAND_NAME}</h1>
        <p className="boot-screen__subtitle">{BRAND_TAGLINE}</p>
        <p className="boot-screen__label" id="boot-label">
          INITIALIZING — 0%
        </p>
        <div className="boot-screen__rail-wrap">
          <div className="boot-screen__track-shell">
            <div className="boot-screen__track-clip">
              <div className="boot-screen__track-glow" aria-hidden="true" />
              <div className="boot-screen__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
                <div className="boot-screen__fill" id="boot-fill">
                  <div className="boot-screen__fill-spark" aria-hidden="true" />
                  <div className="boot-screen__fill-head" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="boot-screen__error">
          <p className="boot-screen__error-msg" />
          <button type="button" className="boot-screen__action">
            <span className="boot-screen__action-plate" aria-hidden="true" />
            <span className="boot-screen__action-text">RETRY</span>
          </button>
        </div>
      </div>
    </div>
  )
})
