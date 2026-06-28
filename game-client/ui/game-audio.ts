import { countNewlyRevealed } from '@shared/core/modes/endless/reveal-pipeline.ts'
import type { Board, ModeSession } from '@shared/core/types.ts'

import { cloneAudioTemplate } from './boot/audio-cache.ts'

export const GAME_AUDIO_ASSETS = {
  cellReveal: '/assets/game/audio/sfx-cell-reveal-01.wav',
  cellFlood: '/assets/game/audio/sfx-cell-flood-reveal.wav',
  flagPlace: '/assets/game/audio/sfx-flag-place.wav',
  flagRemove: '/assets/game/audio/sfx-flag-remove.wav',
  chordAction: '/assets/game/audio/sfx-chord-action.wav',
  mineHit: '/assets/game/audio/sfx-mine-hit.wav',
  lifeWarning: '/assets/game/audio/sfx-life-warning.wav',
  scrollUp: '/assets/game/audio/sfx-scroll-up.wav',
  healReward: '/assets/game/audio/sfx-heal-reward.wav',
  uiHover: '/assets/game/audio/ui-hover.wav',
  startHover: '/assets/game/audio/ui-start-hover.wav',
  retryHover: '/assets/game/audio/ui-retry-hover.wav',
  uiClick: '/assets/game/audio/ui-click.wav',
} as const

export const BGM_IDLE_SRC = '/assets/game/audio/bgm-idle.wav'

export type GameAudioId = keyof typeof GAME_AUDIO_ASSETS

/** Master bus — keep headroom for overlapping one-shots. */
const MASTER_VOLUME = 0.62

/**
 * Per-clip gain (0–1) from peak analysis — targets similar perceived loudness.
 * Loudest sources (scroll-up, heal-reward @ 0 dBFS) are pulled down most.
 */
const SFX_GAIN: Record<GameAudioId, number> = {
  cellReveal: 0.88,
  cellFlood: 0.78,
  flagPlace: 0.76,
  flagRemove: 0.78,
  chordAction: 0.82,
  mineHit: 0.55,
  lifeWarning: 0.72,
  scrollUp: 0.28,
  healReward: 0.3,
  uiHover: 0.85,
  startHover: 0.72,
  retryHover: 0.72,
  uiClick: 0.62,
}

function clipVolume(id: GameAudioId): number {
  return Math.min(1, MASTER_VOLUME * (SFX_GAIN[id] ?? 1))
}

export function getEffectiveSfxVolume(id: GameAudioId): number {
  return clipVolume(id)
}

export const GAME_AUDIO_MASTER_VOLUME = MASTER_VOLUME
export const GAME_AUDIO_SFX_GAIN = SFX_GAIN

/** BGM loop — source peaks near 0 dBFS, keep it under gameplay SFX. */
const BGM_IDLE_VOLUME = 0.24

export const GAME_AUDIO_BGM_IDLE_VOLUME = BGM_IDLE_VOLUME

export interface GameAudioOptions {
  bgmMuted?: boolean
}

export interface GameAudioController {
  play(id: GameAudioId): void
  unlock(): void
  setIdleBgm(active: boolean): void
  isIdleBgmMuted(): boolean
  toggleIdleBgmMuted(): boolean
  destroy(): void
}

export function playRevealAudio(audio: GameAudioController, before: Board, after: Board): void {
  const revealedDelta = countNewlyRevealed(before, after)
  if (revealedDelta > 1) {
    audio.play('cellFlood')
  } else if (revealedDelta === 1) {
    audio.play('cellReveal')
  }
}

export function playFlagToggleAudio(audio: GameAudioController, placing: boolean): void {
  audio.play(placing ? 'flagPlace' : 'flagRemove')
}

export function hadMineLifeLoss(beforeLives: number | undefined, next: ModeSession): boolean {
  if (beforeLives === undefined || (next.lives ?? beforeLives) >= beforeLives) return false
  const cause = next.lastLifeLoss?.cause
  return cause === 'mine-reveal' || cause === 'chord-mine'
}

export function playLifeLossAudio(audio: GameAudioController, beforeLives: number | undefined, next: ModeSession): void {
  if (beforeLives === undefined || (next.lives ?? beforeLives) >= beforeLives) return
  const cause = next.lastLifeLoss?.cause
  if (cause === 'mine-reveal' || cause === 'chord-mine') {
    audio.play('mineHit')
    return
  }
  if (cause === 'scroll-bottom') {
    const hasMine = next.lastLifeLoss?.cells.some((cell) => cell.kind === 'mine-unflagged') === true
    if (!hasMine) audio.play('lifeWarning')
    return
  }
}

export function playHealRewardAudio(audio: GameAudioController, beforeLives: number | undefined, prev: ModeSession, next: ModeSession): void {
  if (beforeLives === undefined) return
  const afterLives = next.lives ?? beforeLives
  if (afterLives <= beforeLives) return

  if ((next.lastAutoHeal?.livesGained ?? 0) > 0) {
    audio.play('healReward')
    return
  }

  const beforeMines = prev.minesDefused ?? 0
  const afterMines = next.minesDefused ?? 0
  if (afterMines < beforeMines) {
    audio.play('healReward')
  }
}

export function createGameAudio(options: GameAudioOptions = {}): GameAudioController {
  const clips = new Map<GameAudioId, HTMLAudioElement>()
  let unlocked = false
  let idleBgmSceneActive = false
  let idleBgmMuted = options.bgmMuted ?? false
  let idleBgmPlayPending = false

  const idleBgm = cloneAudioTemplate(BGM_IDLE_SRC)
  idleBgm.loop = true
  idleBgm.preload = 'auto'
  idleBgm.volume = BGM_IDLE_VOLUME

  for (const [id, src] of Object.entries(GAME_AUDIO_ASSETS) as [GameAudioId, string][]) {
    const audio = cloneAudioTemplate(src)
    audio.volume = clipVolume(id)
    clips.set(id, audio)
  }

  function syncIdleBgmPlayback(): void {
    const shouldPlay = idleBgmSceneActive && !idleBgmMuted
    if (shouldPlay) {
      tryPlayIdleBgm()
      return
    }
    idleBgmPlayPending = false
    idleBgm.pause()
    if (!idleBgmSceneActive) idleBgm.currentTime = 0
  }

  function tryPlayIdleBgm(): void {
    if (!idleBgmSceneActive || idleBgmMuted || !unlocked) return
    void idleBgm.play().catch(() => {
      idleBgmPlayPending = true
    })
  }

  idleBgm.addEventListener('canplaythrough', () => {
    if (!idleBgmPlayPending) return
    idleBgmPlayPending = false
    tryPlayIdleBgm()
  })

  function unlock(): void {
    if (unlocked) return
    unlocked = true
    for (const audio of clips.values()) {
      const probe = audio.cloneNode() as HTMLAudioElement
      probe.volume = 0
      void probe
        .play()
        .then(() => {
          probe.pause()
          probe.currentTime = 0
        })
        .catch(() => undefined)
    }

    // Unlock the loop element itself — required before play() on large preloaded files.
    idleBgm.muted = true
    void idleBgm
      .play()
      .then(() => {
        idleBgm.pause()
        idleBgm.currentTime = 0
        idleBgm.muted = false
        tryPlayIdleBgm()
      })
      .catch(() => {
        idleBgm.muted = false
        tryPlayIdleBgm()
      })
  }

  function setIdleBgm(active: boolean): void {
    idleBgmSceneActive = active
    syncIdleBgmPlayback()
  }

  function isIdleBgmMuted(): boolean {
    return idleBgmMuted
  }

  function toggleIdleBgmMuted(): boolean {
    unlock()
    idleBgmMuted = !idleBgmMuted
    syncIdleBgmPlayback()
    return idleBgmMuted
  }

  function play(id: GameAudioId): void {
    if (!unlocked) unlock()
    const template = clips.get(id)
    if (!template) return
    const audio = template.cloneNode() as HTMLAudioElement
    audio.volume = clipVolume(id)
    void audio.play().catch(() => undefined)
  }

  function destroy(): void {
    for (const audio of clips.values()) {
      audio.pause()
      audio.src = ''
    }
    clips.clear()
    idleBgmPlayPending = false
    idleBgm.pause()
    idleBgm.src = ''
    idleBgmSceneActive = false
    idleBgmMuted = true
  }

  return { play, unlock, setIdleBgm, isIdleBgmMuted, toggleIdleBgmMuted, destroy }
}
