import { createGame, chordReveal, getFlagCount, reveal, toCellViews, toggleFlag } from '../core/game.ts';
import { getDefaultDifficulty } from '../core/difficulty.ts';
import type { GameState } from '../core/types.ts';
import { createGameCanvas } from '../ui/game-canvas.ts';

export function mountApp(root: HTMLElement): void {
  const diff = getDefaultDifficulty();
  let state: GameState = createGame(diff);
  let timerStarted = false;

  root.className = 'app';

  const title = document.createElement('h1');
  title.className = 'app__title';
  title.textContent = '扫雷';

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'app__canvas';

  root.append(title, canvasContainer);

  const view = createGameCanvas(canvasContainer, diff.rows, diff.cols, diff.mines, {
    onReset: () => {
      state = createGame(diff);
      timerStarted = false;
      view.resetTimer();
      render();
    },
    onReveal(row, col) {
      if (state.status === 'won' || state.status === 'lost') {
        return;
      }

      const wasIdle = state.status === 'idle';
      state = reveal(state, row, col);

      if (wasIdle && state.status === 'playing' && !timerStarted) {
        view.startTimer();
        timerStarted = true;
      }

      if (state.status === 'won' || state.status === 'lost') {
        view.stopTimer();
      }

      render();
    },
    onToggleFlag(row, col) {
      if (state.status === 'won' || state.status === 'lost') {
        return;
      }
      state = toggleFlag(state, row, col);
      render();
    },
    onChord(row, col) {
      if (state.status === 'won' || state.status === 'lost') {
        return;
      }
      state = chordReveal(state, row, col);
      if (state.status === 'won' || state.status === 'lost') {
        view.stopTimer();
      }
      render();
    },
  });

  function render(): void {
    view.render(toCellViews(state), state.status, getFlagCount(state));
  }

  render();
}
