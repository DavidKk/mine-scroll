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
  { id: 'beginner', label: '初级 9×9 / 10 雷' },
  { id: 'intermediate', label: '中级 16×16 / 40 雷' },
  { id: 'expert', label: '高级 16×30 / 99 雷' },
  { id: 'custom', label: '自定义' },
] as const;

export function getDefaultDifficulty(): Difficulty {
  return { ...BEGINNER };
}

/** 首击安全区最多占 9 格，可放雷上限 */
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
    return { ok: false, error: '请输入有效的数字' };
  }

  if (rows < LIMITS.minRows || rows > LIMITS.maxRows) {
    return { ok: false, error: `行数需在 ${LIMITS.minRows}–${LIMITS.maxRows} 之间` };
  }

  if (cols < LIMITS.minCols || cols > LIMITS.maxCols) {
    return { ok: false, error: `列数需在 ${LIMITS.minCols}–${LIMITS.maxCols} 之间` };
  }

  const maxMines = getMaxMines(rows, cols);
  if (mines < LIMITS.minMines || mines > maxMines) {
    return { ok: false, error: `雷数需在 ${LIMITS.minMines}–${maxMines} 之间（需保留首击安全区）` };
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
