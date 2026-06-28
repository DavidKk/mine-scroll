import type { AssetLabSection } from './routes.ts';
import {
  canonicalAssetLabPath,
  parseAssetLabRoute,
  resolveRoute,
} from './routes.ts';
import { mountGameSession } from './game-session/index.ts';

let cleanup: (() => void) | undefined;

export function navigateApp(path: string): void {
  const normalized = path.replace(/\/+$/, '') || '/';
  const current = window.location.pathname.replace(/\/+$/, '') || '/';
  if (normalized === current) return;
  window.history.pushState(null, '', path);
  mountApp(document.querySelector<HTMLElement>('#app')!);
}

function mountRouteLoading(root: HTMLElement, label: string): void {
  root.className = 'app app--route-loading';
  root.replaceChildren();
  const main = document.createElement('main');
  main.className = 'route-loading';
  main.setAttribute('aria-busy', 'true');
  main.textContent = label;
  root.append(main);
}

function mountLazyRoute(
  root: HTMLElement,
  route: 'assets' | 'lab' | 'responsive',
  loadingLabel: string,
  importer: (root: HTMLElement) => Promise<() => void>,
): void {
  let routeCleanup: (() => void) | undefined;
  let cancelled = false;

  mountRouteLoading(root, loadingLabel);

  void importer(root).then((dispose) => {
    if (cancelled) {
      dispose();
      return;
    }
    if (resolveRoute() !== route) {
      dispose();
      return;
    }
    routeCleanup = dispose;
  });

  cleanup = () => {
    cancelled = true;
    routeCleanup?.();
    root.replaceChildren();
  };
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
      const route = parseAssetLabRoute() ?? { section: 'sources' as AssetLabSection, panelId: null };
      mountLazyRoute(root, 'assets', 'Loading Asset Lab…', async (mountRoot) => {
        const { mountAssetGallery } = await import('./asset-gallery.ts');
        mountRoot.replaceChildren();
        return mountAssetGallery(mountRoot, route.section, route.panelId, navigateApp);
      });
      return;
    }
    case 'lab':
      mountLazyRoute(root, 'lab', 'Loading UI Lab…', async (mountRoot) => {
        const { mountUiLab } = await import('./ui-lab.ts');
        mountRoot.replaceChildren();
        mountUiLab(mountRoot);
        return () => mountRoot.replaceChildren();
      });
      return;
    case 'responsive':
      mountLazyRoute(root, 'responsive', 'Loading responsive matrix…', async (mountRoot) => {
        const { mountResponsiveMatrix } = await import('./responsive-matrix.ts');
        mountRoot.replaceChildren();
        mountResponsiveMatrix(mountRoot);
        return () => mountRoot.replaceChildren();
      });
      return;
    default:
      cleanup = mountGameSession(root);
  }
}
