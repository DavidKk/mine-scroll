import {
  getGameCutout,
  getGameFxBlendMode,
  getGameFxFrames,
  getGameUiPanel,
  type GameFxName,
  type GameUiPanelName,
} from '../../ui/game-assets.ts';
import { getHudIcon, type HudIconName } from '../../ui/hud-sprites.ts';
import { createFpsControl, createPanelHead } from './editor-shell.ts';

export type GameUiLabPanelId =
  | 'overview'
  | 'panels'
  | 'icons'
  | 'cutouts'
  | 'fx-score-pop'
  | 'fx-combo-burst'
  | 'fx-wrong-flag-break'
  | 'fx-level-up'
  | 'fx-heart-refill';

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

const MAIN_FLOW_FX: Array<{ id: GameUiLabPanelId; fx: GameFxName; title: string; note: string }> = [
  {
    id: 'fx-score-pop',
    fx: 'score-pop',
    title: 'Score pop',
    note: 'Safe defuse score burst at the bottom rail.',
  },
  {
    id: 'fx-combo-burst',
    fx: 'combo-burst',
    title: 'Combo burst',
    note: 'Combo increment ring; additive on black.',
  },
  {
    id: 'fx-wrong-flag-break',
    fx: 'wrong-flag-break',
    title: 'Combo break',
    note: 'Wrong flag / combo break shatter.',
  },
  {
    id: 'fx-level-up',
    fx: 'level-up',
    title: 'Level up',
    note: 'Combo milestones at 10 / 20 / 50.',
  },
  {
    id: 'fx-heart-refill',
    fx: 'heart-refill',
    title: 'Heart refill',
    note: 'Life heal pulse on the top-right HUD.',
  },
];

const PRODUCTION_SHEETS = [
  {
    title: 'UI panels v2',
    src: '/assets/production/ui-panels-production-v2.png',
    note: 'START / GAME OVER / AUTO / break & heal chips',
  },
  {
    title: 'HUD icons v2',
    src: '/assets/production/hud-icons-production-v2.png',
    note: 'play · skull · refresh · volume (incl. hover)',
  },
  {
    title: 'Cutouts v2',
    src: '/assets/production/core-cutouts-production-v2.png',
    note: 'heart full / empty / refill',
  },
  {
    title: 'FX sprites v2',
    src: '/assets/production/fx-additive-sprites-production-v2.png',
    note: 'Main-flow additive rows · 192×128 × 8 frames',
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
    dims.textContent = `${item.image.naturalWidth}×${item.image.naturalHeight}`;
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
      'Main-flow game UI',
      'v2 slices wired in manifest.json · brief: docs/NON-BOARD-UI-ASSET-INVENTORY.md',
    ),
  );

  const grid = document.createElement('div');
  grid.className = 'asset-lab__frame-grid';

  for (const sheet of PRODUCTION_SHEETS) {
    const cell = document.createElement('article');
    cell.className = 'asset-lab__frame-cell asset-lab__frame-cell--static';

    const thumb = document.createElement('div');
    thumb.className = 'asset-lab__frame-thumb asset-lab__checker';

    const img = document.createElement('img');
    img.src = sheet.src;
    img.alt = sheet.title;
    img.className = 'asset-lab__sprite-img';
    img.loading = 'lazy';
    thumb.append(img);

    const meta = document.createElement('div');
    meta.className = 'asset-lab__frame-meta';
    const name = document.createElement('strong');
    name.textContent = sheet.title;
    const note = document.createElement('span');
    note.textContent = sheet.note;
    const path = document.createElement('code');
    path.textContent = sheet.src;
    meta.append(name, note, path);
    cell.append(thumb, meta);
    grid.append(cell);
  }

  const previews = document.createElement('dl');
  previews.className = 'asset-lab__meta-list';
  previews.innerHTML = `
    <div><dt>Sliced previews</dt><dd><code>/assets/game/preview-cutouts.png</code> · <code>preview-fx.png</code> · <code>preview-ui-panels.png</code></dd></div>
    <div><dt>Runtime loader</dt><dd><code>src/ui/game-assets.ts</code> · <code>src/ui/hud-sprites.ts</code></dd></div>
  `;

  panel.append(grid, previews);
  return panel;
}

function createFxPanel(spec: (typeof MAIN_FLOW_FX)[number]): { panel: HTMLElement; dispose: () => void } {
  const frames = getGameFxFrames(spec.fx) ?? [];
  const blend = getGameFxBlendMode(spec.fx);
  let fps = 12;
  let raf = 0;
  let frameIndex = 0;
  let lastTick = 0;

  const panel = document.createElement('section');
  panel.className = 'asset-lab__panel';
  panel.dataset.panelId = spec.id;
  panel.append(createPanelHead(spec.title, spec.note));

  const workspace = document.createElement('div');
  workspace.className = 'asset-lab__anim-workspace';

  const previewWrap = document.createElement('div');
  previewWrap.className = 'asset-lab__anim-preview';
  previewWrap.style.background = '#000';

  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__anim-canvas';
  previewWrap.append(canvas);

  const controls = document.createElement('div');
  controls.className = 'asset-lab__anim-controls';
  const meta = document.createElement('dl');
  meta.className = 'asset-lab__meta-list';
  meta.innerHTML = `
    <div><dt>FX</dt><dd><code>${spec.fx}</code></dd></div>
    <div><dt>Blend</dt><dd><code>${blend}</code></dd></div>
    <div><dt>Frames</dt><dd>${frames.length}</dd></div>
  `;
  controls.append(meta, createFpsControl(fps, (next) => {
    fps = next;
  }));

  workspace.append(previewWrap, controls);

  const framesSection = document.createElement('div');
  framesSection.className = 'asset-lab__frames-section';
  const framesHeader = document.createElement('div');
  framesHeader.className = 'asset-lab__frames-header';
  framesHeader.innerHTML = `<span>Keyframes</span><small>${frames.length} frames</small>`;

  const frameGrid = document.createElement('div');
  frameGrid.className = 'asset-lab__frame-grid';
  frames.forEach((frame, index) => {
    const cell = document.createElement('article');
    cell.className = 'asset-lab__frame-cell asset-lab__frame-cell--static';
    const thumb = document.createElement('div');
    thumb.className = 'asset-lab__frame-thumb';
    thumb.style.background = '#000';
    const img = document.createElement('img');
    img.src = frame.src;
    img.alt = `${spec.fx} frame ${index + 1}`;
    img.className = 'asset-lab__sprite-img';
    thumb.append(img);
    const label = document.createElement('span');
    label.className = 'asset-lab__frame-num';
    label.textContent = String(index + 1).padStart(2, '0');
    thumb.append(label);
    cell.append(thumb);
    frameGrid.append(cell);
  });
  framesSection.append(framesHeader, frameGrid);
  panel.append(workspace, framesSection);

  function resize(): void {
    const rect = previewWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  function draw(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || frames.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const frame = frames[frameIndex % frames.length]!;
    const scale = Math.min((w * 0.88) / frame.naturalWidth, (h * 0.88) / frame.naturalHeight);
    const dw = frame.naturalWidth * scale;
    const dh = frame.naturalHeight * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;

    ctx.save();
    ctx.globalCompositeOperation = blend;
    ctx.drawImage(frame, dx, dy, dw, dh);
    ctx.restore();
  }

  function tick(now: number): void {
    if (frames.length > 0) {
      const interval = 1000 / fps;
      if (now - lastTick >= interval) {
        lastTick = now;
        frameIndex = (frameIndex + 1) % frames.length;
        draw();
      }
    }
    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(() => {
    resize();
    draw();
  });
  ro.observe(previewWrap);
  resize();
  raf = requestAnimationFrame(tick);

  return {
    panel,
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}

export function gameUiNavItems(): Array<{ id: GameUiLabPanelId; label: string; count?: number }> {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'panels', label: 'Panels', count: MAIN_FLOW_PANELS.length },
    { id: 'icons', label: 'HUD icons', count: MAIN_FLOW_ICONS.length },
    { id: 'cutouts', label: 'Hearts', count: MAIN_FLOW_CUTOUTS.length },
    ...MAIN_FLOW_FX.map((fx) => ({ id: fx.id, label: fx.title, count: 8 })),
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
      'Heart cutouts',
      'Lives row and heal highlight sprites from public/assets/game/cutouts.',
      collectCutouts(),
    ),
  };

  const disposers: Array<() => void> = [];
  for (const spec of MAIN_FLOW_FX) {
    const built = createFxPanel(spec);
    panels[spec.id] = built.panel;
    disposers.push(built.dispose);
  }

  return {
    panels,
    dispose: () => {
      for (const dispose of disposers) dispose();
    },
  };
}
