import type { Board } from '../core/board.ts';
import { countNewlyRevealed } from '../core/modes/endless/reveal-pipeline.ts';

export const GAME_AUDIO_ASSETS = {
  cellReveal: '/assets/game/audio/sfx-cell-reveal-01.wav',
  cellFlood: '/assets/game/audio/sfx-cell-flood-reveal.wav',
  flagPlace: '/assets/game/audio/sfx-flag-place.wav',
  flagRemove: '/assets/game/audio/sfx-flag-remove.wav',
  uiHover: '/assets/game/audio/ui-hover.wav',
} as const;

export type GameAudioId = keyof typeof GAME_AUDIO_ASSETS;

const DEFAULT_VOLUME = 0.72;

export interface GameAudioController {
  play(id: GameAudioId): void;
  unlock(): void;
  destroy(): void;
}

export function playRevealAudio(
  audio: GameAudioController,
  before: Board,
  after: Board,
): void {
  const revealedDelta = countNewlyRevealed(before, after);
  if (revealedDelta > 1) {
    audio.play('cellFlood');
  } else if (revealedDelta === 1) {
    audio.play('cellReveal');
  }
}

export function playFlagToggleAudio(audio: GameAudioController, placing: boolean): void {
  audio.play(placing ? 'flagPlace' : 'flagRemove');
}

export function createGameAudio(): GameAudioController {
  const clips = new Map<GameAudioId, HTMLAudioElement>();
  let unlocked = false;

  for (const [id, src] of Object.entries(GAME_AUDIO_ASSETS) as [GameAudioId, string][]) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = DEFAULT_VOLUME;
    clips.set(id, audio);
  }

  function unlock(): void {
    if (unlocked) return;
    unlocked = true;
    for (const audio of clips.values()) {
      const probe = audio.cloneNode() as HTMLAudioElement;
      probe.volume = 0;
      void probe.play()
        .then(() => {
          probe.pause();
          probe.currentTime = 0;
        })
        .catch(() => undefined);
    }
  }

  function play(id: GameAudioId): void {
    if (!unlocked) unlock();
    const template = clips.get(id);
    if (!template) return;
    const audio = template.cloneNode() as HTMLAudioElement;
    audio.volume = template.volume;
    void audio.play().catch(() => undefined);
  }

  function destroy(): void {
    for (const audio of clips.values()) {
      audio.pause();
      audio.src = '';
    }
    clips.clear();
  }

  return { play, unlock, destroy };
}
