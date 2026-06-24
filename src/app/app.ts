import { mountAssetGallery } from './asset-gallery.ts';
import { mountGameSession } from './game-session/index.ts';
import {
  canonicalAssetLabPath,
  resolveAssetLabSection,
  resolveRoute,
} from './routes.ts';
import { mountResponsiveMatrix } from './responsive-matrix.ts';
import { mountUiLab } from './ui-lab.ts';

let cleanup: (() => void) | undefined;

export function navigateApp(path: string): void {
  const normalized = path.replace(/\/+$/, '') || '/';
  const current = window.location.pathname.replace(/\/+$/, '') || '/';
  if (normalized === current) return;
  window.history.pushState(null, '', path);
  mountApp(document.querySelector<HTMLElement>('#app')!);
}

export function mountApp(root: HTMLElement): void {
  cleanup?.();
  cleanup = undefined;
  root.replaceChildren();

  const canonical = canonicalAssetLabPath();
  if (canonical) {
    window.history.replaceState(null, '', canonical);
  }

  switch (resolveRoute()) {
    case 'assets': {
      const section = resolveAssetLabSection() ?? 'sprites';
      cleanup = mountAssetGallery(root, section, navigateApp);
      return;
    }
    case 'lab':
      mountUiLab(root);
      return;
    case 'responsive':
      mountResponsiveMatrix(root);
      return;
    default:
      mountGameSession(root);
  }
}
