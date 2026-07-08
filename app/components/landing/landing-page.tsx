'use client'

import { attachCustomScrollbar } from '@game-client/ui/custom-scrollbar.ts'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { BRAND_DETAILS, BRAND_GAME_GENRE, BRAND_IDENTITY, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'
import { cn } from '@/lib/cn'
import { LANDING_HOW_TO } from '@/lib/landing-content'

import { LandingBackdrop } from './landing-backdrop'
import { LandingBoardPreview } from './landing-board-preview'
import { LandingLeaderboard } from './landing-leaderboard'
import { LandingSoundToggle } from './landing-sound-toggle'
import { useLandingPreviewEnabled } from './use-landing-preview-enabled'

const MODES = [
  {
    href: '/play',
    name: 'Endless Scroll',
    tag: 'Featured',
    tagClass: 'bg-landing-cyan/10 text-landing-cyan',
    featured: true,
    description: 'Survive the upward scroll. Dynamic mines, five lives, and ranked leaderboards.',
  },
  {
    href: '/play/rush',
    name: 'Puzzle Rush',
    tag: 'Streak',
    tagClass: 'bg-indigo-400/15 text-indigo-300',
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

/** Matches scroll-indicator fade-out duration in globals.css. */
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
    const view = scrollViewRef.current
    const section = modesSectionRef.current
    if (!view || !section) return
    const viewTop = view.getBoundingClientRect().top
    const sectionTop = section.getBoundingClientRect().top
    view.scrollTo({ top: view.scrollTop + sectionTop - viewTop, behavior: 'smooth' })
  }

  return (
    <div className="scroll-host scroll-host--landing">
      <div className="scroll-view relative h-full overscroll-contain text-slate-200 font-sans scroll-smooth" ref={scrollViewRef}>
        <LandingSoundToggle />
        <LandingBackdrop scrollRootRef={scrollViewRef} />

        <div className="relative z-[1]">
          <section
            className="mx-auto flex min-h-dvh max-w-[1120px] flex-col items-stretch px-6 pb-16 pt-12 landing-lg:flex-row landing-lg:gap-12 landing-lg:px-8 landing-lg:pb-20 landing-lg:pt-16"
            aria-labelledby="landing-title"
          >
            <div
              className={cn(
                'flex w-full min-w-0 flex-1 flex-col justify-center',
                'min-h-[calc(100dvh-48px-64px)] pt-[clamp(0.5rem,3vh,1.5rem)] pb-[clamp(2.5rem,10vh,5.5rem)]',
                'landing-lg:min-h-[calc(100dvh-64px-80px)] landing-lg:max-w-[520px] landing-lg:flex-[1_1_48%] landing-lg:min-w-[360px]',
                'landing-lg:pt-[clamp(1rem,4vh,2.5rem)] landing-lg:pb-[clamp(3rem,12vh,6.5rem)]'
              )}
            >
              <div className="flex w-full flex-none flex-col items-start justify-start">
                <div className="flex w-full max-w-lg min-w-0 flex-none flex-col items-start gap-3.5 text-left">
                  <p className="m-0 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-landing-cyan">{BRAND_GAME_GENRE} · Browser game</p>
                  <h1
                    id="landing-title"
                    className="m-0 bg-[linear-gradient(135deg,#f8fafc_0%,#818cf8_55%,#2decff_100%)] bg-clip-text text-[clamp(2.4rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.04em] text-transparent"
                  >
                    {BRAND_NAME}
                    <span className="sr-only"> — {BRAND_TAGLINE}</span>
                  </h1>
                  <p className="m-0 max-w-[38ch] text-balance text-[1.05rem] font-medium leading-relaxed text-slate-300">{BRAND_IDENTITY}</p>
                  <p className="m-0 max-w-[38ch] text-balance text-[1.05rem] leading-relaxed text-slate-400">{BRAND_DETAILS}</p>
                  <div className="mt-0 flex flex-wrap justify-start gap-3">
                    <Link
                      href="/play"
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-landing-cyan to-blue-400 px-[22px] text-[0.95rem] font-semibold text-game-bg no-underline shadow-[0_0_32px_rgba(45,236,255,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(45,236,255,0.5)]"
                    >
                      Play Now
                    </Link>
                    <button
                      type="button"
                      className="inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border border-indigo-400/35 bg-zinc-900/60 px-[22px] font-[inherit] text-[0.95rem] font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-landing-cyan/45 hover:bg-zinc-800/85"
                      onClick={scrollToModes}
                    >
                      Choose Mode
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="h-[clamp(3rem,9vh,5rem)] min-h-12 max-h-20 flex-none landing-lg:h-[clamp(3.5rem,10vh,5.5rem)] landing-lg:min-h-14 landing-lg:max-h-[5.5rem]"
                aria-hidden="true"
              />

              <div className="flex w-full flex-none flex-col items-stretch gap-8 landing-lg:gap-10">
                <div className="w-full min-w-0 landing-lg:max-w-[420px]">
                  <LandingLeaderboard />
                </div>

                <p className="m-0 flex items-center justify-start gap-2 font-mono text-[0.72rem] uppercase tracking-[0.08em] text-slate-500">
                  Scroll to explore{' '}
                  <span className="animate-landing-bounce motion-reduce:animate-none" aria-hidden="true">
                    ↓
                  </span>
                </p>
              </div>
            </div>

            <div
              className={cn(
                'hidden w-full min-w-0 landing-lg:flex landing-lg:flex-[1_1_52%] landing-lg:items-center landing-lg:justify-center',
                'landing-lg:min-h-[calc(var(--landing-preview-h,844px)+28px)]'
              )}
              aria-hidden={!showPreview}
            >
              <LandingBoardPreview mountDemo={showPreview} />
            </div>
          </section>

          <section
            ref={modesSectionRef}
            className="mx-auto max-w-[1120px] px-6 pb-16 pt-12 [contain-intrinsic-size:auto_520px] [content-visibility:auto] landing-lg:px-8"
            aria-labelledby="modes-title"
          >
            <div className="mb-8 text-center">
              <h2 id="modes-title" className="mb-2.5 text-[clamp(1.6rem,3vw,2rem)] font-bold tracking-[-0.03em]">
                Pick your run
              </h2>
              <p className="m-0 text-[0.95rem] text-slate-400">Two minesweeper arcade modes on one neon board.</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {MODES.map((mode) => (
                <Link
                  key={mode.href}
                  href={mode.href}
                  className={cn(
                    'flex cursor-pointer flex-col items-start gap-2.5 rounded-2xl border border-landing-border bg-landing-panel p-5 text-left text-inherit no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400/45 hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)]',
                    mode.featured && 'border-landing-cyan/30 bg-gradient-to-br from-[rgba(22,28,45,0.95)] to-landing-panel'
                  )}
                >
                  <span className={cn('rounded-full px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.06em]', mode.tagClass)}>{mode.tag}</span>
                  <span className="text-[1.15rem] font-bold">{mode.name}</span>
                  <span className="text-[0.86rem] leading-snug text-slate-400">{mode.description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section
            className="mx-auto max-w-[1120px] px-6 pb-16 pt-12 [contain-intrinsic-size:auto_520px] [content-visibility:auto] landing-lg:px-8"
            aria-labelledby="features-title"
          >
            <div className="mb-8 text-center">
              <h2 id="features-title" className="mb-2.5 text-[clamp(1.6rem,3vw,2rem)] font-bold tracking-[-0.03em]">
                Built for the web
              </h2>
              <p className="m-0 text-[0.95rem] text-slate-400">Fast loads, sharp visuals, competitive runs.</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              {FEATURES.map((feature) => (
                <article key={feature.icon} className="rounded-[14px] border border-white/[0.06] bg-[rgba(15,15,22,0.75)] p-[18px]">
                  <div className="mb-2.5 font-mono text-xs text-landing-cyan">{feature.icon}</div>
                  <h3 className="mb-1.5 text-base font-bold">{feature.title}</h3>
                  <p className="m-0 text-[0.84rem] leading-normal text-slate-400">{feature.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-[1120px] px-6 pb-16 pt-12 [contain-intrinsic-size:auto_520px] [content-visibility:auto] landing-lg:px-8" aria-labelledby="howto-title">
            <div className="mb-8 text-center">
              <h2 id="howto-title" className="mb-2.5 text-[clamp(1.6rem,3vw,2rem)] font-bold tracking-[-0.03em]">
                How to play
              </h2>
              <p className="m-0 text-[0.95rem] text-slate-400">Classic minesweeper rules, neon presentation.</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              {LANDING_HOW_TO.map((item) => (
                <div key={item.key} className="rounded-xl border-l-[3px] border-l-landing-cyan/45 bg-zinc-900/55 p-4">
                  <span className="mb-1.5 block font-mono text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-landing-cyan">{item.key}</span>
                  <p className="m-0 text-[0.88rem] leading-normal text-slate-300">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-6 pb-12 pt-6 text-[0.82rem] text-slate-500 landing-lg:px-8">
            <span suppressHydrationWarning>
              © {new Date().getFullYear()} {BRAND_NAME}
            </span>
            <Link href="/play" className="text-slate-400 no-underline hover:text-landing-cyan">
              Launch game
            </Link>
          </footer>
        </div>
      </div>
      <div className="scroll-indicator" ref={indicatorRef} aria-hidden="true">
        <div className="scroll-indicator__thumb" ref={thumbRef} />
      </div>
    </div>
  )
}
