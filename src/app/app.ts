import { mountGameSession } from './game-session.ts';

export function mountApp(root: HTMLElement): void {
  root.replaceChildren();
  mountGameSession(root, 'endless', {
    onBack: () => undefined,
  });
}
