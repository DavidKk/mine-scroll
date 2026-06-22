import { mountGameSession } from './game-session/index.ts';
import { mountResponsiveMatrix } from './responsive-matrix.ts';
import { mountUiLab } from './ui-lab.ts';

export function mountApp(root: HTMLElement): void {
  root.replaceChildren();
  const params = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV && params.get('ui') === 'lab') {
    mountUiLab(root);
    return;
  }
  if (import.meta.env.DEV && params.get('ui') === 'responsive') {
    mountResponsiveMatrix(root);
    return;
  }

  mountGameSession(root);
}
