import { LANDING_AUDIO_UNLOCK_EVENT, loadLocalSettings } from '../../config/local-settings.ts'
import type { GameAudioController } from '../../ui/game-audio.ts'

export function attachDemoAudioUnlock(audio: GameAudioController): () => void {
  const unlockOnce = (): void => {
    audio.unlock()
    if (!loadLocalSettings().soundMuted) {
      audio.setIdleBgm(true)
    }
    window.removeEventListener(LANDING_AUDIO_UNLOCK_EVENT, unlockOnce)
    window.removeEventListener('pointerdown', unlockOnce, true)
    window.removeEventListener('keydown', unlockOnce, true)
    window.removeEventListener('wheel', unlockOnce, true)
  }
  window.addEventListener(LANDING_AUDIO_UNLOCK_EVENT, unlockOnce)
  window.addEventListener('pointerdown', unlockOnce, { capture: true, passive: true })
  window.addEventListener('keydown', unlockOnce, { capture: true, passive: true })
  window.addEventListener('wheel', unlockOnce, { capture: true, passive: true })
  return () => {
    window.removeEventListener(LANDING_AUDIO_UNLOCK_EVENT, unlockOnce)
    window.removeEventListener('pointerdown', unlockOnce, true)
    window.removeEventListener('keydown', unlockOnce, true)
    window.removeEventListener('wheel', unlockOnce, true)
  }
}

export function applyLandingAudioPrefs(soundMuted: boolean, opts?: { unlock?: boolean; audio?: GameAudioController }): void {
  const audio = opts?.audio
  if (!audio) return
  audio.setSfxMuted(soundMuted)
  audio.setIdleBgmMuted(soundMuted)
  if (soundMuted) {
    audio.setIdleBgm(false)
    return
  }
  if (opts?.unlock) audio.unlock()
  audio.setIdleBgm(true)
}
