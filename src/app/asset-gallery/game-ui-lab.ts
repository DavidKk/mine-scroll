import {
  getGameCutout,
  getGameUiPanel,
  type GameUiPanelName,
} from '../../ui/game-assets.ts';
import { getHudIcon, type HudIconName } from '../../ui/hud-sprites.ts';
import { createPanelHead } from './editor-shell.ts';

export type GameUiLabPanelId = 'overview' | 'panels' | 'icons' | 'cutouts';

const MAIN_FLOW_PANELS: GameUiPanelName[] = [
  'start-panel',
  'game-over-panel',
  'retry-button',
  'auto-off',
  'auto-on',
  'break-chip',
  'heal-chip',
];

const MAIN_FLOW_ICONS: HudIconName[] = [
  'play',
  'skull',
  'refresh',
  'volume-on',
  'volume-off',
  'volume-on-hover',
  'volume-off-hover',
];

const MAIN_FLOW_CUTOUTS = ['heart-full', 'heart-empty', 'heart-refill'] as const;

const UI_OVERVIEW_ASSETS = [
  {
    title: 'Runtime UI panel preview',
    src: '/assets/game/preview-ui-panels.png',
    note: 'Sliced UI panels currently referenced by the runtime manifest.',
  },
  {
    title: 'UI panels production v2',
    src: '/assets/production/ui-panels-production-v2.png',
    note: 'START / GAME OVER / AUTO / break & heal chips production sheet.',
  },
  {
    title: 'HUD icons production v2',
    src: '/assets/production/hud-icons-production-v2.png',
    note: 'Play, skull, refresh, and volume icon states.',
  },
] as const;

interface StaticAsset {
  id: string;
  label: string;
  src: string;
  image: HTMLImageElement;
}

function panelPath(name: string): string {
  return `/assets/game/ui/${name}.png`;
}

function cutoutPath(name: string): string {
  return `/assets/game/cutouts/${name}.png`;
}

function iconPath(name: string): string {
  return `/assets/hud/icons/${name}.png`;
}

function collectPanels(): StaticAsset[] {
  const items: StaticAsset[] = [];
  for (const name of MAIN_FLOW_PANELS) {
    const image = getGameUiPanel(name);
    if (!image) continue;
    items.push({ id: name, label: name, src: panelPath(name), image });
  }
  return items;
}

function collectIcons(): StaticAsset[] {
  const items: StaticAsset[] = [];
  for (const name of MAIN_FLOW_ICONS) {
    const image = getHudIcon(name);
    if (!image) continue;
    items.push({ id: name, label: name, src: iconPath(name), image });
  }
  return items;
}

function collectCutouts(): StaticAsset[] {
  const items: StaticAsset[] = [];
  for (const name of MAIN_FLOW_CUTOUTS) {
    const image = getGameCutout(name);
    if (!image) continue;
    items.push({ id: name, label: name, src: cutoutPath(name), image });
  }
  return items;
}

function createStaticGridPanel(title: string, description: string, items: StaticAsset[]): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'asset-lab__panel';
  panel.append(createPanelHead(title, description));

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'asset-lab__field-hint';
    empty.textContent = 'No runtime assets loaded. Check public/assets/game/manifest.json.';
    panel.append(empty);
    return panel;
  }

  const grid = document.createElement('div');
  grid.className = 'asset-lab__frame-grid';

  items.forEach((item, index) => {
    const cell = document.createElement('article');
    cell.className = 'asset-lab__frame-cell asset-lab__frame-cell--static';

    const thumb = document.createElement('div');
    thumb.className = 'asset-lab__frame-thumb asset-lab__checker';

    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.label;
    img.className = 'asset-lab__sprite-img';
    thumb.append(img);

    const num = document.createElement('span');
    num.className = 'asset-lab__frame-num';
    num.textContent = String(index + 1).padStart(2, '0');
    thumb.append(num);

    const meta = document.createElement('div');
    meta.className = 'asset-lab__frame-meta';
    const name = document.createElement('strong');
    name.textContent = item.label;
    const dims = document.createElement('span');
    dims.textContent = `${item.image.naturalWidth}x${item.image.naturalHeight}`;
    const path = document.createElement('code');
    path.textContent = item.src;
    meta.append(name, dims, path);
    cell.append(thumb, meta);
    grid.append(cell);
  });

  panel.append(grid);
  return panel;
}

function createOverviewPanel(): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'asset-lab__panel';
  panel.append(
    createPanelHead(
      'Runtime UI assets',
      'UI-only review. Source sheets live in Sources; sprite cutouts live in Sprites; motion previews live in Animations.',
    ),
  );

  const grid = document.createElement('div');
  grid.className = 'asset-lab__frame-grid';

  for (const asset of UI_OVERVIEW_ASSETS) {
    const cell = document.createElement('article');
    cell.className = 'asset-lab__frame-cell asset-lab__frame-cell--static';

    const thumb = document.createElement('div');
    thumb.className = 'asset-lab__frame-thumb asset-lab__checker';

    const img = document.createElement('img');
    img.src = asset.src;
    img.alt = asset.title;
    img.className = 'asset-lab__sprite-img';
    img.loading = 'lazy';
    thumb.append(img);

    const meta = document.createElement('div');
    meta.className = 'asset-lab__frame-meta';
    const name = document.createElement('strong');
    name.textContent = asset.title;
    const note = document.createElement('span');
    note.textContent = asset.note;
    const path = document.createElement('code');
    path.textContent = asset.src;
    meta.append(name, note, path);
    cell.append(thumb, meta);
    grid.append(cell);
  }

  const meta = document.createElement('dl');
  meta.className = 'asset-lab__meta-list';
  meta.innerHTML = `
    <div><dt>Runtime loader</dt><dd><code>src/ui/game-assets.ts</code> · <code>src/ui/hud-sprites.ts</code></dd></div>
    <div><dt>Manifest</dt><dd><code>public/assets/game/manifest.json</code></dd></div>
  `;

  panel.append(grid, meta);
  return panel;
}

export function gameUiNavItems(): Array<{ id: GameUiLabPanelId; label: string; count?: number }> {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'panels', label: 'Panels', count: MAIN_FLOW_PANELS.length },
    { id: 'icons', label: 'HUD icons', count: MAIN_FLOW_ICONS.length },
    { id: 'cutouts', label: 'HUD cutouts', count: MAIN_FLOW_CUTOUTS.length },
  ];
}

export function mountGameUiPanels(): {
  panels: Partial<Record<GameUiLabPanelId, HTMLElement>>;
  dispose: () => void;
} {
  const panels: Partial<Record<GameUiLabPanelId, HTMLElement>> = {
    overview: createOverviewPanel(),
    panels: createStaticGridPanel(
      'UI panels',
      'Start / game over / retry / AUTO / break & heal chips from public/assets/game/ui.',
      collectPanels(),
    ),
    icons: createStaticGridPanel(
      'HUD icons',
      'Overlay icons including BGM mute default and hover states.',
      collectIcons(),
    ),
    cutouts: createStaticGridPanel(
      'HUD cutouts',
      'Lives row and heal highlight sprites from public/assets/game/cutouts.',
      collectCutouts(),
    ),
  };

  return {
    panels,
    dispose: () => undefined,
  };
}
