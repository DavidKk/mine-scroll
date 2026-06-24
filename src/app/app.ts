import { mountAssetGallery } from './asset-gallery.ts';
import { mountGameSession } from './game-session/index.ts';
import { resolveRoute } from './routes.ts';
import { mountResponsiveMatrix } from './responsive-matrix.ts';
import { mountUiLab } from './ui-lab.ts';

export function mountApp(root: HTMLElement): void {
  root.replaceChildren();

  switch (resolveRoute()) {
    case 'assets':
      mountAssetGallery(root);
      return;
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
