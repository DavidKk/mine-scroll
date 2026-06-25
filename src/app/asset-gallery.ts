import { getTileSprites } from '../ui/tile-sprites.ts';
import type { AssetLabSection } from './routes.ts';
import { audioNavItems, mountAudioPanels, type AudioPanelId } from './asset-gallery/audio-lab.ts';
import { backdropNavItems, mountBackdropPanels, type BackdropPanelId } from './asset-gallery/ambient-backdrop-lab.ts';
import {
  createFooterNote,
  createPanelHead,
  createSidebar,
  createTopbar,
  createWorkspace,
  type NavItem,
} from './asset-gallery/editor-shell.ts';
import { mountEffectPanels, type EffectPanelId } from './asset-gallery/cell-effects.ts';
import { gameUiNavItems, mountGameUiPanels, type GameUiLabPanelId } from './asset-gallery/game-ui-lab.ts';

const TILE_BASE = '/assets/tiles';

interface AssetItem {
  id: string;
  label: string;
  src: string;
  image: HTMLImageElement;
}

interface AssetSection {
  id: string;
  title: string;
  description: string;
  items: AssetItem[];
}

function buildSections(): AssetSection[] {
  const sprites = getTileSprites();
  if (!sprites) {
    return [];
  }

  const cellItems: AssetItem[] = [
    { id: 'cell-hidden', label: 'Hidden', src: `${TILE_BASE}/cell-hidden.png`, image: sprites.hidden },
    { id: 'cell-revealed', label: 'Revealed', src: `${TILE_BASE}/cell-revealed.png`, image: sprites.revealed },
  ];

  const digitItems: AssetItem[] = sprites.numbers.map((image, index) => ({
    id: `num-${index + 1}`,
    label: `Digit ${index + 1}`,
    src: `${TILE_BASE}/num-${index + 1}.png`,
    image,
  }));

  return [
    {
      id: 'cells',
      title: 'Cell tiles',
      description: 'Board cell surfaces at 128×128. Shown at native resolution on the transparency checker.',
      items: cellItems,
    },
    {
      id: 'digits',
      title: 'Digit glyphs',
      description: 'Legacy digit slices (1–8). Runtime uses crisp canvas text when crispDigits is enabled.',
      items: digitItems,
    },
    {
      id: 'icons',
      title: 'Icons',
      description: 'Mine and flag markers from the tile atlas.',
      items: [
        { id: 'mine', label: 'Mine', src: `${TILE_BASE}/mine.png`, image: sprites.mine },
        { id: 'flag', label: 'Flag', src: `${TILE_BASE}/flag.png`, image: sprites.flag },
      ],
    },
  ];
}

function getContentBBox(image: HTMLImageElement): { w: number; h: number } | null {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null;

  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        found = true;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
    }
  }

  if (!found) return null;
  return { w: x1 - x0, h: y1 - y0 };
}

function createSpritePanel(section: AssetSection): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'asset-lab__panel';
  panel.dataset.panelId = section.id;
  panel.append(createPanelHead(section.title, section.description));

  const grid = document.createElement('div');
  grid.className = 'asset-lab__frame-grid';

  section.items.forEach((item, index) => {
    const cell = document.createElement('article');
    cell.className = 'asset-lab__frame-cell asset-lab__frame-cell--static';
    cell.title = item.src;

    const thumb = document.createElement('div');
    thumb.className = 'asset-lab__frame-thumb asset-lab__checker';

    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.label;
    img.width = item.image.naturalWidth;
    img.height = item.image.naturalHeight;
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

    const bb = getContentBBox(item.image);
    const dims = document.createElement('span');
    dims.textContent = bb
      ? `${item.image.naturalWidth}×${item.image.naturalHeight} · content ${bb.w}×${bb.h}`
      : `${item.image.naturalWidth}×${item.image.naturalHeight}`;

    const path = document.createElement('code');
    path.textContent = item.src;

    meta.append(name, dims, path);
    cell.append(thumb, meta);
    grid.append(cell);
  });

  panel.append(grid);
  return panel;
}

const FX_NAV: Array<{ id: EffectPanelId; label: string }> = [
  { id: 'cells', label: 'Cell states' },
  { id: 'digits', label: 'Digit particles' },
  { id: 'flag', label: 'Flag wave' },
  { id: 'mine', label: 'Mine explosion' },
];

const FOOTER_NOTES: Record<AssetLabSection, string> = {
  sprites: 'Tile slices under public/assets/tiles · npm run assets:all for atlas rebuild',
  animations: 'Procedural cell FX previews · src/app/asset-gallery/cell-effects.ts',
  'game-ui': 'Main-flow HUD v2 · public/assets/game · docs/NON-BOARD-UI-ASSET-INVENTORY.md',
  background: 'Live parallax backdrop · src/ui/ambient-backdrop.ts',
  audio: 'Game SFX & BGM · public/assets/game/audio · gains in game-audio.ts',
};

export function mountAssetGallery(
  root: HTMLElement,
  section: AssetLabSection,
  onNavigate: (path: string) => void,
): () => void {
  root.className = 'app app--asset-lab';
  root.replaceChildren();

  const disposers: Array<() => void> = [];

  if (section === 'sprites') {
    const sections = buildSections();
    if (sections.length === 0) {
      const empty = document.createElement('main');
      empty.className = 'asset-lab asset-lab--empty';
      empty.textContent = 'Failed to load tile assets. Check public/assets/tiles.';
      root.append(empty);
      return () => root.replaceChildren();
    }

    disposers.push(mountSpritesSection(root, sections, section, onNavigate));
    return () => {
      for (const dispose of disposers) dispose();
      root.replaceChildren();
    };
  }

  if (section === 'animations') {
    const effects = mountEffectPanels();
    disposers.push(effects.dispose);
    disposers.push(mountLabSection(root, section, onNavigate, FX_NAV.map((fx) => ({
      id: fx.id,
      label: fx.label,
      group: 'animations' as const,
      count: 8,
    })), (id) => effects.panels[id as EffectPanelId]));
    return () => {
      for (const dispose of disposers) dispose();
      root.replaceChildren();
    };
  }

  if (section === 'game-ui') {
    const gameUi = mountGameUiPanels();
    disposers.push(gameUi.dispose);
    disposers.push(mountLabSection(root, section, onNavigate, gameUiNavItems().map((item) => ({
      id: item.id,
      label: item.label,
      group: 'game-ui' as const,
      count: item.count,
    })), (id) => gameUi.panels[id as GameUiLabPanelId]));
    return () => {
      for (const dispose of disposers) dispose();
      root.replaceChildren();
    };
  }

  if (section === 'background') {
    const backdrop = mountBackdropPanels();
    disposers.push(backdrop.dispose);
    disposers.push(mountLabSection(root, section, onNavigate, backdropNavItems().map((item) => ({
      id: item.id,
      label: item.label,
      group: 'background' as const,
      count: item.count,
    })), (id) => backdrop.panels[id as BackdropPanelId]));
    return () => {
      for (const dispose of disposers) dispose();
      root.replaceChildren();
    };
  }

  const audio = mountAudioPanels();
  disposers.push(audio.dispose);
  disposers.push(mountLabSection(root, section, onNavigate, audioNavItems().map((item) => ({
    id: item.id,
    label: item.label,
    group: 'audio' as const,
    count: item.count,
  })), (id) => audio.panels[id as AudioPanelId]));

  return () => {
    for (const dispose of disposers) dispose();
    root.replaceChildren();
  };
}

function mountSpritesSection(
  root: HTMLElement,
  sections: AssetSection[],
  section: AssetLabSection,
  onNavigate: (path: string) => void,
): () => void {
  const shell = document.createElement('div');
  shell.className = 'asset-lab';

  let activeId = sections[0]!.id;
  const spritePanels = new Map(sections.map((s) => [s.id, createSpritePanel(s)]));
  const workspace = createWorkspace();
  const sidebarHost = document.createElement('div');
  sidebarHost.className = 'asset-lab__sidebar-host';
  const panelHost = document.createElement('div');
  panelHost.className = 'asset-lab__panel-host';

  const navItems = (): NavItem[] =>
    sections.map((s) => ({
      id: s.id,
      label: s.title.replace(' tiles', '').replace(' glyphs', ''),
      group: 'sprites' as const,
      count: s.items.length,
    }));

  function showPanel(id: string): void {
    activeId = id;
    panelHost.replaceChildren();
    const panel = spritePanels.get(id);
    if (panel) panelHost.append(panel);
    renderSidebar();
  }

  function renderSidebar(): void {
    sidebarHost.replaceChildren(createSidebar(navItems(), activeId, showPanel));
  }

  const panel = document.createElement('div');
  panel.className = 'asset-lab__panel-layout';
  panel.append(sidebarHost, workspace);
  workspace.append(panelHost);
  shell.append(createTopbar(section, onNavigate), panel, createFooterNote(FOOTER_NOTES[section]));
  root.append(shell);
  showPanel(activeId);

  return () => undefined;
}

function mountLabSection(
  root: HTMLElement,
  section: AssetLabSection,
  onNavigate: (path: string) => void,
  items: NavItem[],
  getPanel: (id: string) => HTMLElement | undefined,
): () => void {
  const shell = document.createElement('div');
  shell.className = 'asset-lab';

  let activeId = items[0]?.id ?? '';
  const workspace = createWorkspace();
  const sidebarHost = document.createElement('div');
  sidebarHost.className = 'asset-lab__sidebar-host';
  const panelHost = document.createElement('div');
  panelHost.className = 'asset-lab__panel-host';

  function showPanel(id: string): void {
    activeId = id;
    panelHost.replaceChildren();
    const panel = getPanel(id);
    if (panel) panelHost.append(panel);
    renderSidebar();
  }

  function renderSidebar(): void {
    sidebarHost.replaceChildren(createSidebar(items, activeId, showPanel));
  }

  const panel = document.createElement('div');
  panel.className = 'asset-lab__panel-layout';
  panel.append(sidebarHost, workspace);
  workspace.append(panelHost);
  shell.append(createTopbar(section, onNavigate), panel, createFooterNote(FOOTER_NOTES[section]));
  root.append(shell);
  if (activeId) showPanel(activeId);

  return () => undefined;
}
