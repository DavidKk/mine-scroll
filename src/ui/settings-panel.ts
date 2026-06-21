import {
  LIMITS,
  PRESET_OPTIONS,
  difficultyFromPreset,
  getMaxMines,
  validateDifficulty,
} from '../core/difficulty.ts';
import type { Difficulty } from '../core/types.ts';

export interface SettingsPanelCallbacks {
  onApply(difficulty: Difficulty): void;
}

export interface SettingsPanelController {
  setDifficulty(difficulty: Difficulty): void;
}

export function createSettingsPanel(
  container: HTMLElement,
  initial: Difficulty,
  callbacks: SettingsPanelCallbacks,
): SettingsPanelController {
  container.className = 'settings';

  const presetLabel = document.createElement('label');
  presetLabel.className = 'settings__field';
  presetLabel.textContent = '难度预设';
  const presetSelect = document.createElement('select');
  presetSelect.className = 'settings__select';
  for (const option of PRESET_OPTIONS) {
    const el = document.createElement('option');
    el.value = option.id;
    el.textContent = option.label;
    presetSelect.appendChild(el);
  }

  const rowsLabel = createField('行数', 'settings__input');
  const rowsInput = rowsLabel.querySelector('input')!;

  const colsLabel = createField('列数', 'settings__input');
  const colsInput = colsLabel.querySelector('input')!;

  const minesLabel = createField('雷数', 'settings__input');
  const minesInput = minesLabel.querySelector('input')!;

  rowsInput.type = 'number';
  colsInput.type = 'number';
  minesInput.type = 'number';
  rowsInput.min = String(LIMITS.minRows);
  rowsInput.max = String(LIMITS.maxRows);
  colsInput.min = String(LIMITS.minCols);
  colsInput.max = String(LIMITS.maxCols);
  minesInput.min = String(LIMITS.minMines);

  const hint = document.createElement('p');
  hint.className = 'settings__hint';

  const errorEl = document.createElement('p');
  errorEl.className = 'settings__error';
  errorEl.hidden = true;

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'settings__apply';
  applyBtn.textContent = '应用并开始新局';

  const grid = document.createElement('div');
  grid.className = 'settings__grid';
  grid.append(presetLabel, presetSelect, rowsLabel, colsLabel, minesLabel);

  container.append(grid, hint, errorEl, applyBtn);

  function updateHint(): void {
    const rows = Number(rowsInput.value);
    const cols = Number(colsInput.value);
    if (Number.isFinite(rows) && Number.isFinite(cols) && rows > 0 && cols > 0) {
      minesInput.max = String(getMaxMines(rows, cols));
      hint.textContent = `当前棋盘 ${rows}×${cols}，雷数上限 ${getMaxMines(rows, cols)}（首击安全区预留 9 格）`;
    }
  }

  function setDifficulty(difficulty: Difficulty): void {
    const presetMatch = PRESET_OPTIONS.find((p) => p.id === difficulty.id)?.id ?? 'custom';
    presetSelect.value = presetMatch === 'custom' ? 'custom' : difficulty.id;
    rowsInput.value = String(difficulty.rows);
    colsInput.value = String(difficulty.cols);
    minesInput.value = String(difficulty.mines);
    updateHint();
    errorEl.hidden = true;
  }

  presetSelect.addEventListener('change', () => {
    const preset = difficultyFromPreset(presetSelect.value);
    if (preset) {
      setDifficulty(preset);
    } else {
      presetSelect.value = 'custom';
      updateHint();
    }
  });

  for (const input of [rowsInput, colsInput]) {
    input.addEventListener('input', () => {
      presetSelect.value = 'custom';
      updateHint();
    });
  }

  minesInput.addEventListener('input', () => {
    presetSelect.value = 'custom';
  });

  applyBtn.addEventListener('click', () => {
    const result = validateDifficulty({
      rows: Number(rowsInput.value),
      cols: Number(colsInput.value),
      mines: Number(minesInput.value),
      id: presetSelect.value,
    });

    if (!result.ok) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }

    errorEl.hidden = true;
    callbacks.onApply(result.value);
  });

  setDifficulty(initial);

  return { setDifficulty };
}

function createField(labelText: string, inputClass: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'settings__field';
  label.textContent = labelText;
  const input = document.createElement('input');
  input.className = inputClass;
  label.appendChild(input);
  return label;
}
