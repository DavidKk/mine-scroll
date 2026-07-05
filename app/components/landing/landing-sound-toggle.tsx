'use client'

import { LANDING_AUDIO_UNLOCK_EVENT, loadLocalSettings, LOCAL_SETTINGS_CHANGE_EVENT, type LocalSettings, patchLocalSettings } from '@game-client/config/local-settings.ts'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/cn'

function SoundOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="block h-[22px] w-[22px] shrink-0 overflow-visible">
      <path d="M4 10v4h3.5L13 19V5L7.5 10H4Z" fill="currentColor" stroke="none" />
      <path d="M16 9.5a4.5 4.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M18.5 7a7.5 7.5 0 0 1 0 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function SoundOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="block h-[22px] w-[22px] shrink-0 overflow-visible">
      <path d="M4 10v4h3.5L13 19V5L7.5 10H4Z" fill="currentColor" stroke="none" />
      <path d="M4.5 4.5 19.5 19.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

const toggleBase = cn(
  'fixed top-3.5 right-7 z-40 box-border inline-flex min-h-[46px] w-[156px] cursor-pointer items-center justify-start gap-2.5 rounded-full border-[1.5px] px-4 py-[5px] pl-1.5 backdrop-blur-[14px] transition-all duration-200 hover:-translate-y-0.5',
  'max-[959px]:hidden'
)

const toggleOn = cn(
  'animate-landing-sound-glow border-landing-cyan/[0.52] bg-gradient-to-br from-[rgba(16,26,44,0.96)] to-[rgba(8,12,22,0.92)] text-[#bffcff]',
  'shadow-[0_0_0_1px_rgba(45,236,255,0.14)_inset,0_0_28px_rgba(45,236,255,0.28),0_14px_36px_rgba(0,0,0,0.48)]',
  'hover:border-landing-cyan/[0.78] hover:from-[rgba(20,32,54,0.98)] hover:to-[rgba(10,16,28,0.94)]',
  'hover:shadow-[0_0_0_1px_rgba(45,236,255,0.2)_inset,0_0_36px_rgba(45,236,255,0.42),0_16px_40px_rgba(0,0,0,0.52)]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-landing-cyan/85',
  'motion-reduce:animate-none motion-reduce:hover:translate-y-0'
)

const toggleMuted = cn(
  'border-red-400/[0.58] text-red-200',
  'shadow-[0_0_0_1px_rgba(248,113,113,0.16)_inset,0_0_22px_rgba(248,113,113,0.22),0_14px_36px_rgba(0,0,0,0.48)]',
  'hover:border-red-400/[0.82] hover:shadow-[0_0_0_1px_rgba(248,113,113,0.22)_inset,0_0_30px_rgba(248,113,113,0.34),0_16px_40px_rgba(0,0,0,0.52)]'
)

export function LandingSoundToggle() {
  const [muted, setMuted] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setMuted(loadLocalSettings().soundMuted)
    setReady(true)

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<LocalSettings>).detail
      if (detail) setMuted(detail.soundMuted)
    }

    window.addEventListener(LOCAL_SETTINGS_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(LOCAL_SETTINGS_CHANGE_EVENT, onChange)
  }, [])

  const toggle = () => {
    if (!ready) return
    window.dispatchEvent(new Event(LANDING_AUDIO_UNLOCK_EVENT))
    const next = patchLocalSettings({ soundMuted: !muted })
    setMuted(next.soundMuted)
  }

  return (
    <button
      type="button"
      className={cn(toggleBase, ready ? (muted ? toggleMuted : toggleOn) : toggleOn, !ready && 'pointer-events-none opacity-0')}
      onClick={toggle}
      aria-pressed={ready ? muted : undefined}
      aria-label={ready ? (muted ? 'Unmute landing sounds' : 'Mute landing sounds') : undefined}
      aria-hidden={!ready}
      tabIndex={ready ? 0 : -1}
      disabled={!ready}
      title={ready ? (muted ? 'Sound off' : 'Sound on') : undefined}
    >
      <span
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full',
          muted && ready
            ? 'bg-red-400/15 shadow-[0_0_0_1px_rgba(248,113,113,0.28)_inset,0_0_16px_rgba(248,113,113,0.32)]'
            : 'bg-landing-cyan/15 shadow-[0_0_0_1px_rgba(45,236,255,0.28)_inset,0_0_18px_rgba(45,236,255,0.38)]'
        )}
        aria-hidden="true"
      >
        {muted && ready ? <SoundOffIcon /> : <SoundOnIcon />}
      </span>
      <span
        className={cn(
          'w-[6.35rem] flex-1 text-left text-[0.78rem] font-bold uppercase tracking-[0.12em] whitespace-nowrap',
          muted && ready ? '[text-shadow:0_0_12px_rgba(248,113,113,0.35)]' : '[text-shadow:0_0_14px_rgba(45,236,255,0.42)]'
        )}
      >
        {muted && ready ? 'Sound off' : 'Sound on'}
      </span>
    </button>
  )
}
