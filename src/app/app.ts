import { createModeHub } from './mode-hub.ts';
import { mountGameSession } from './game-session.ts';
import type { GameModeId } from '../core/types.ts';

export function mountApp(root: HTMLElement): void {
  let cleanupSession: (() => void) | null = null;

  function showHub(): void {
    if (cleanupSession) {
      cleanupSession();
      cleanupSession = null;
    }
    root.replaceChildren();
    createModeHub(root, {
      onSelect(modeId) {
        showSession(modeId);
      },
    });
  }

  function showSession(modeId: GameModeId): void {
    root.replaceChildren();
    cleanupSession = mountGameSession(root, modeId, {
      onBack: () => showHub(),
    });
  }

  showHub();
}
