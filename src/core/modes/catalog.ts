import type { GameModeId } from '../types.ts';

export interface ModeEntry {
  id: GameModeId;
  name: string;
  tag: string;
  description: string;
}

export const MODE_ENTRIES: ModeEntry[] = [
  {
    id: 'endless',
    name: 'Endless',
    tag: 'Scroll',
    description: 'The view scrolls upward over time; each unflagged mine leaving the bottom costs a life, with new rows generated at the top.',
  },
];

export function getModeEntry(_id: GameModeId = 'endless'): ModeEntry {
  return MODE_ENTRIES[0]!;
}
