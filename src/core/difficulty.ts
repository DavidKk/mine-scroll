import type { Difficulty } from './types.ts';

export const BEGINNER: Difficulty = {
  id: 'beginner',
  rows: 9,
  cols: 9,
  mines: 10,
};

export function getDefaultDifficulty(): Difficulty {
  return BEGINNER;
}
