import { getDefaultDifficulty, validateDifficulty } from '../core/difficulty.ts';
import type { Difficulty } from '../core/types.ts';

const STORAGE_KEY = 'chill-minesweeper-config';

export function loadGameConfig(): Difficulty {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultDifficulty();

    const parsed = JSON.parse(raw) as Partial<Difficulty>;
    const result = validateDifficulty({
      rows: Number(parsed.rows),
      cols: Number(parsed.cols),
      mines: Number(parsed.mines),
      id: parsed.id,
    });

    return result.ok ? result.value : getDefaultDifficulty();
  } catch {
    return getDefaultDifficulty();
  }
}

export function saveGameConfig(difficulty: Difficulty): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(difficulty));
}
