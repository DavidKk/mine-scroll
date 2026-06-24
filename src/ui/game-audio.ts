import type { Board } from '../core/board.ts';
import { countNewlyRevealed } from '../core/modes/endless/reveal-pipeline.ts';
import type { ModeSession } from '../core/types.ts';

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
  uiClick: '/assets/game/audio/ui-click.wav',
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

export function hadMineLifeLoss(beforeLives: number | undefined, next: ModeSession): boolean {
  if (beforeLives === undefined || (next.lives ?? beforeLives) >= beforeLives) return false;
  const cause = next.lastLifeLoss?.cause;
  return cause === 'mine-reveal' || cause === 'chord-mine';
}

export function playLifeLossAudio(
  audio: GameAudioController,
  beforeLives: number | undefined,
  next: ModeSession,
): void {
  if (beforeLives === undefined || (next.lives ?? beforeLives) >= beforeLives) return;
  const cause = next.lastLifeLoss?.cause;
  if (cause === 'mine-reveal' || cause === 'chord-mine') {
    audio.play('mineHit');
    return;
  }
  if (cause === 'scroll-bottom') {
    audio.play('lifeWarning');
  }
}

export function playHealRewardAudio(
  audio: GameAudioController,
  beforeLives: number | undefined,
  prev: ModeSession,
  next: ModeSession,
): void {
  if (beforeLives === undefined) return;
  const afterLives = next.lives ?? beforeLives;
  if (afterLives <= beforeLives) return;

  if ((next.lastAutoHeal?.livesGained ?? 0) > 0) {
    audio.play('healReward');
    return;
  }

  const beforeMines = prev.minesDefused ?? 0;
  const afterMines = next.minesDefused ?? 0;
  if (afterMines < beforeMines) {
    audio.play('healReward');
  }
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
