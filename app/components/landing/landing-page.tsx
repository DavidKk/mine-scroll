'use client'

import './landing.css'

import { attachCustomScrollbar } from '@game-client/ui/custom-scrollbar.ts'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { BRAND_DESCRIPTION, BRAND_NAME } from '@/lib/brand'

import { LandingBackdrop } from './landing-backdrop'
import { LandingBoardPreview } from './landing-board-preview'
import { LandingSoundToggle } from './landing-sound-toggle'
import { useLandingPreviewEnabled } from './use-landing-preview-enabled'

const MODES = [
  {
    href: '/play',
    name: 'Endless Scroll',
    tag: 'Featured',
    tagClass: 'landing__mode-tag--cyan',
    featured: true,
    description: 'Survive the upward scroll. Dynamic mines, five lives, and ranked leaderboards.',
  },
  {
    href: '/play/rush',
    name: 'Puzzle Rush',
    tag: 'Streak',
    tagClass: '',
    featured: false,
    description: 'Clear 7×7 boards back-to-back. Stack combos and climb the rush leaderboard.',
  },
] as const

const FEATURES = [
  {
    icon: '01',
    title: 'Neon Canvas',
    description: 'Program-drawn board, HUD, and effects — tuned for desktop and mobile.',
  },
  {
    icon: '02',
    title: 'Ranked Runs',
    description: 'Server-verified scores with anti-cheat input recording on endless and rush.',
  },
  {
    icon: '03',
    title: 'Touch Ready',
    description: 'Tap to reveal, vertical swipe to flag, double-tap chord on small screens.',
  },
] as const

const HOW_TO = [
  { key: 'Reveal', text: 'Left-click or tap a covered cell to open it. Numbers show adjacent mines.' },
  { key: 'Flag', text: 'Right-click or swipe vertically to mark suspected mines.' },
  { key: 'Chord', text: 'Double-click or double-tap a revealed number when flags match the count.' },
] as const

/** Matches scroll-indicator fade-out duration in landing.css. */
const SCROLL_INDICATOR_HOLD_MS = 520

export function LandingPage() {
  const scrollViewRef = useRef<HTMLDivElement>(null)
  const modesSectionRef = useRef<HTMLElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const showPreview = useLandingPreviewEnabled()

  useEffect(() => {
    const { hash } = window.location
    if (hash !== '#modes') return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    scrollViewRef.current?.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const view = scrollViewRef.current
    const indicator = indicatorRef.current
    const thumb = thumbRef.current
    if (!view || !indicator || !thumb) return

    return attachCustomScrollbar(view, indicator, thumb, {
      scrollingClass: 'scroll-indicator--scrolling',
      scrollingHoldMs: SCROLL_INDICATOR_HOLD_MS,
    })
  }, [])

  const scrollToModes = (): void => {
    modesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="scroll-host scroll-host--landing">
      <div className="landing scroll-view" ref={scrollViewRef}>
        <LandingSoundToggle />
        <LandingBackdrop scrollRootRef={scrollViewRef} />

        <div className="landing__content">
          <section className="landing__hero" aria-labelledby="landing-title">
            <div className="landing__hero-copy">
              <p className="landing__eyebrow">Neon minesweeper</p>
              <h1 id="landing-title" className="landing__title">
                {BRAND_NAME}
              </h1>
              <p className="landing__tagline">{BRAND_DESCRIPTION}</p>
              <div className="landing__cta-row">
                <Link href="/play" className="landing__cta landing__cta--primary">
                  Play Now
                </Link>
                <button type="button" className="landing__cta landing__cta--ghost" onClick={scrollToModes}>
                  Choose Mode
                </button>
              </div>
              <p className="landing__scroll-hint">
                Scroll to explore <span aria-hidden="true">↓</span>
              </p>
            </div>

            <div className="landing__preview-slot" aria-hidden={!showPreview}>
              <LandingBoardPreview mountDemo={showPreview} />
            </div>
          </section>

          <section ref={modesSectionRef} className="landing__section" aria-labelledby="modes-title">
            <div className="landing__section-head">
              <h2 id="modes-title" className="landing__section-title">
                Pick your run
              </h2>
              <p className="landing__section-sub">Two arcade modes, one neon board.</p>
            </div>
            <div className="landing__modes">
              {MODES.map((mode) => (
                <Link key={mode.href} href={mode.href} className={`landing__mode-card${mode.featured ? ' landing__mode-card--featured' : ''}`}>
                  <span className={`landing__mode-tag${mode.tagClass ? ` ${mode.tagClass}` : ''}`}>{mode.tag}</span>
                  <span className="landing__mode-name">{mode.name}</span>
                  <span className="landing__mode-desc">{mode.description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="landing__section" aria-labelledby="features-title">
            <div className="landing__section-head">
              <h2 id="features-title" className="landing__section-title">
                Built for the web
              </h2>
              <p className="landing__section-sub">Fast loads, sharp visuals, competitive runs.</p>
            </div>
            <div className="landing__features">
              {FEATURES.map((feature) => (
                <article key={feature.icon} className="landing__feature">
                  <div className="landing__feature-icon">{feature.icon}</div>
                  <h3 className="landing__feature-title">{feature.title}</h3>
                  <p className="landing__feature-desc">{feature.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="landing__section" aria-labelledby="howto-title">
            <div className="landing__section-head">
              <h2 id="howto-title" className="landing__section-title">
                How to play
              </h2>
              <p className="landing__section-sub">Classic minesweeper rules, neon presentation.</p>
            </div>
            <div className="landing__howto">
              {HOW_TO.map((item) => (
                <div key={item.key} className="landing__howto-item">
                  <span className="landing__howto-key">{item.key}</span>
                  <p className="landing__howto-text">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="landing__footer">
            <span>
              © {new Date().getFullYear()} {BRAND_NAME}
            </span>
            <Link href="/play">Launch game</Link>
          </footer>
        </div>
      </div>
      <div className="scroll-indicator" ref={indicatorRef} aria-hidden="true">
        <div className="scroll-indicator__thumb" ref={thumbRef} />
      </div>
    </div>
  )
}
