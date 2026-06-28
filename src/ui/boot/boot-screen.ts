import './boot-screen.css';
import { attachBootMiniBoard } from './boot-mini-board.ts';
import {
  BOOT_RETRY_UI_DELAY_MS,
  type BootProgress,
  type BootProgressLabel,
  type BootScreenController,
} from './types.ts';

const LABEL_TEXT: Record<BootProgressLabel, string> = {
  starting: 'INITIALIZING',
  tiles: 'LOADING BOARD',
  ui: 'LOADING UI',
  fx: 'LOADING FX',
  ready: 'READY',
};

const SCAN_INTERVAL_MS = 380;
const RETRYING_LABEL = 'CONNECTION SLOW — RETRYING';

export function bindBootScreen(root: HTMLElement | Document = document): BootScreenController {
  const screen = root.querySelector<HTMLElement>('#boot-screen');
  const labelEl = root.querySelector<HTMLElement>('#boot-label');
  const fillEl = root.querySelector<HTMLElement>('#boot-fill');
  const railWrapEl = root.querySelector<HTMLElement>('.boot-screen__rail-wrap');
  const trackEl = root.querySelector<HTMLElement>('.boot-screen__track');
  const errorMsgEl = root.querySelector<HTMLElement>('.boot-screen__error-msg');
  const retryBtn = root.querySelector<HTMLButtonElement>('.boot-screen__action');
  const cells = [...root.querySelectorAll<HTMLElement>('.boot-screen__cell')];

  if (!screen || !labelEl || !fillEl || !railWrapEl || !trackEl) {
    throw new Error('Boot screen markup missing from index.html');
  }

  let targetRatio = 0;
  let displayRatio = 0;
  let rafId = 0;
  let scanIndex = 0;
  let scanTimer = 0;
  let userPlaying = false;
  let failureStartedAt: number | null = null;
  let retryRevealTimer = 0;
  let phaseLabel: BootProgressLabel = 'starting';

  const hideRetryUi = () => {
    window.clearTimeout(retryRevealTimer);
    screen.classList.remove('boot-screen--error');
    screen.setAttribute('aria-busy', 'true');
  };

  const markFailure = () => {
    if (failureStartedAt === null) failureStartedAt = performance.now();
  };

  const failureElapsedMs = () =>
    failureStartedAt === null ? 0 : performance.now() - failureStartedAt;

  const tickScan = () => {
    if (cells.length === 0 || userPlaying) return;
    cells.forEach((cell, index) => {
      if (cell.classList.contains('boot-screen__cell--revealed')) return;
      cell.classList.toggle('boot-screen__cell--scan', index === scanIndex);
    });
    scanIndex = (scanIndex + 1) % cells.length;
  };

  tickScan();
  scanTimer = window.setInterval(tickScan, SCAN_INTERVAL_MS);

  const detachMiniBoard = attachBootMiniBoard(cells, {
    onFirstInteract: () => {
      userPlaying = true;
      screen.classList.add('boot-screen--playing');
      cells.forEach((cell) => cell.classList.remove('boot-screen__cell--scan'));
    },
  });

  const tick = () => {
    displayRatio += (targetRatio - displayRatio) * 0.15;
    if (Math.abs(targetRatio - displayRatio) < 0.001) displayRatio = targetRatio;

    const progress = Math.min(1, Math.max(0, displayRatio));
    screen.style.setProperty('--boot-progress', String(progress));
    railWrapEl.style.setProperty('--boot-progress', String(progress));
    fillEl.style.setProperty('--boot-progress', String(progress));

    const percent = Math.round(progress * 100);
    trackEl.setAttribute('aria-valuenow', String(percent));

    if (failureStartedAt === null) {
      labelEl.textContent =
        phaseLabel === 'ready' ? LABEL_TEXT.ready : `${LABEL_TEXT[phaseLabel]} — ${percent}%`;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  const update = (progress: BootProgress) => {
    targetRatio = progress.ratio;
    if (failureStartedAt === null) {
      phaseLabel = progress.label;
    }
    screen.classList.toggle('boot-screen--ready', progress.label === 'ready');
    screen.setAttribute('aria-busy', progress.label === 'ready' ? 'false' : 'true');
  };

  const showRetrying = () => {
    markFailure();
    hideRetryUi();
    labelEl.textContent = RETRYING_LABEL;
    screen.setAttribute('aria-busy', 'true');
  };

  const waitForRetry = (message: string): Promise<void> =>
    new Promise((resolve) => {
      markFailure();
      hideRetryUi();
      if (errorMsgEl) errorMsgEl.textContent = message;

      const reveal = () => {
        screen.classList.add('boot-screen--error');
        labelEl.textContent = message;
        screen.setAttribute('aria-busy', 'true');
      };

      const remaining = BOOT_RETRY_UI_DELAY_MS - failureElapsedMs();
      if (remaining <= 0) {
        reveal();
      } else {
        labelEl.textContent = RETRYING_LABEL;
        retryRevealTimer = window.setTimeout(reveal, remaining);
      }

      if (retryBtn) {
        retryBtn.onclick = () => {
          window.clearTimeout(retryRevealTimer);
          hideRetryUi();
          failureStartedAt = null;
          resolve();
        };
      }
    });

  const clearRetryState = () => {
    window.clearTimeout(retryRevealTimer);
    failureStartedAt = null;
    hideRetryUi();
  };

  const dismiss = (): Promise<void> =>
    new Promise((resolve) => {
      cancelAnimationFrame(rafId);
      window.clearInterval(scanTimer);
      window.clearTimeout(retryRevealTimer);
      detachMiniBoard();
      screen.classList.add('boot-screen--dismissed');
      const done = () => {
        screen.removeEventListener('transitionend', done);
        screen.remove();
        resolve();
      };
      screen.addEventListener('transitionend', done);
      window.setTimeout(() => {
        if (screen.isConnected) {
          screen.remove();
          resolve();
        }
      }, 320);
    });

  return { update, showRetrying, waitForRetry, clearRetryState, dismiss };
}
