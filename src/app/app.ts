import { mountGameSession } from './game-session.ts';
import { mountUiLab } from './ui-lab.ts';

export function mountApp(root: HTMLElement): void {
  root.replaceChildren();
  const params = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV && params.get('ui') === 'lab') {
    mountUiLab(root);
    return;
  }

  mountGameSession(root, 'endless', {
    onBack: () => undefined,
  });
}
