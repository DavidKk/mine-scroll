import type { GameModeId } from '../types.ts'

export interface ModeEntry {
  id: GameModeId
  name: string
  tag: string
  description: string
}

export const MODE_ENTRIES: ModeEntry[] = [
  {
    id: 'endless',
    name: 'Endless',
    tag: 'Scroll',
    description: 'The view scrolls upward over time; each unflagged mine leaving the bottom costs a life, with new rows generated at the top.',
  },
]

/** Arcade puzzle-rush mode (separate route `/play/rush`). */
export const PUZZLE_RUSH_MODE_ENTRY = {
  id: 'puzzle-rush' as const,
  name: 'Puzzle Rush',
  tag: 'Streak',
  description: 'Clear 7×7 boards back-to-back; stack combo multipliers without scroll pressure.',
}

export function getModeEntry(_id: GameModeId = 'endless'): ModeEntry {
  return MODE_ENTRIES[0]!
}
