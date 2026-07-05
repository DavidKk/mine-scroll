'use client'

import { LANDING_AUDIO_UNLOCK_EVENT, loadLocalSettings, LOCAL_SETTINGS_CHANGE_EVENT, type LocalSettings,patchLocalSettings } from '@game-client/config/local-settings.ts'
import { useEffect, useState } from 'react'

function SoundOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="landing__sound-toggle-icon">
      <path d="M4 10v4h3.5L13 19V5L7.5 10H4Z" fill="currentColor" stroke="none" />
      <path d="M16 9.5a4.5 4.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M18.5 7a7.5 7.5 0 0 1 0 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function SoundOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="landing__sound-toggle-icon">
      <path d="M4 10v4h3.5L13 19V5L7.5 10H4Z" fill="currentColor" stroke="none" />
      <path d="M4.5 4.5 19.5 19.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

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

  if (!ready) {
    return <button type="button" className="landing__sound-toggle" aria-hidden="true" tabIndex={-1} disabled />
  }

  const toggle = () => {
    window.dispatchEvent(new Event(LANDING_AUDIO_UNLOCK_EVENT))
    const next = patchLocalSettings({ soundMuted: !muted })
    setMuted(next.soundMuted)
  }

  return (
    <button
      type="button"
      className={`landing__sound-toggle${muted ? ' landing__sound-toggle--muted' : ''}`}
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? 'Unmute landing sounds' : 'Mute landing sounds'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      <span className="landing__sound-toggle-icon-wrap" aria-hidden="true">
        {muted ? <SoundOffIcon /> : <SoundOnIcon />}
      </span>
      <span className="landing__sound-toggle-label">{muted ? 'Sound off' : 'Sound on'}</span>
    </button>
  )
}
