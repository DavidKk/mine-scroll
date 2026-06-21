import { mountApp } from './app/app.ts';
import { attachPageScrollbar } from './ui/custom-scrollbar.ts';
import { loadGameAssets } from './ui/game-assets.ts';
import { loadTileSprites } from './ui/tile-sprites.ts';
import { loadHudSprites } from './ui/hud-sprites.ts';
import './styles/main.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('Root element #app not found');
}

attachPageScrollbar();
void Promise.all([loadTileSprites(), loadHudSprites(), loadGameAssets()]).then(() => mountApp(root));
