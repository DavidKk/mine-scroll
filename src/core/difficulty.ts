import type { Difficulty } from './types.ts';

export const LIMITS = {
  minRows: 5,
  maxRows: 30,
  minCols: 5,
  maxCols: 40,
  minMines: 1,
} as const;

export const BEGINNER: Difficulty = {
  id: 'beginner',
  rows: 9,
  cols: 9,
  mines: 10,
};

export const INTERMEDIATE: Difficulty = {
  id: 'intermediate',
  rows: 16,
  cols: 16,
  mines: 40,
};

export const EXPERT: Difficulty = {
  id: 'expert',
  rows: 16,
  cols: 30,
  mines: 99,
};

export const PRESETS: Record<string, Difficulty> = {
  beginner: BEGINNER,
  intermediate: INTERMEDIATE,
  expert: EXPERT,
};

export const PRESET_OPTIONS = [
  { id: 'beginner', label: 'Beginner 9×9 / 10 mines' },
  { id: 'intermediate', label: 'Intermediate 16×16 / 40 mines' },
  { id: 'expert', label: 'Expert 16×30 / 99 mines' },
  { id: 'custom', label: 'Custom' },
] as const;

export function getDefaultDifficulty(): Difficulty {
  return { ...BEGINNER };
}

/** First-click safe zone uses up to 9 cells; caps mine count. */
export function getMaxMines(rows: number, cols: number): number {
  return Math.max(1, rows * cols - 9);
}

export type DifficultyValidation =
  | { ok: true; value: Difficulty }
  | { ok: false; error: string };

export function validateDifficulty(input: {
  rows: number;
  cols: number;
  mines: number;
  id?: string;
}): DifficultyValidation {
  const rows = Math.floor(input.rows);
  const cols = Math.floor(input.cols);
  const mines = Math.floor(input.mines);

  if (!Number.isFinite(rows) || !Number.isFinite(cols) || !Number.isFinite(mines)) {
    return { ok: false, error: 'Enter valid numbers' };
  }

  if (rows < LIMITS.minRows || rows > LIMITS.maxRows) {
    return { ok: false, error: `Rows must be between ${LIMITS.minRows} and ${LIMITS.maxRows}` };
  }

  if (cols < LIMITS.minCols || cols > LIMITS.maxCols) {
    return { ok: false, error: `Columns must be between ${LIMITS.minCols} and ${LIMITS.maxCols}` };
  }

  const maxMines = getMaxMines(rows, cols);
  if (mines < LIMITS.minMines || mines > maxMines) {
    return { ok: false, error: `Mines must be between ${LIMITS.minMines} and ${maxMines} (first-click safe zone reserved)` };
  }

  const preset = input.id && PRESETS[input.id];
  const id =
    preset && preset.rows === rows && preset.cols === cols && preset.mines === mines
      ? input.id!
      : 'custom';

  return {
    ok: true,
    value: { id, rows, cols, mines },
  };
}

export function difficultyFromPreset(presetId: string): Difficulty | null {
  const preset = PRESETS[presetId];
  return preset ? { ...preset } : null;
}
