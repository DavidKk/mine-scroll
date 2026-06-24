import { ROUTES, assetLabSectionPath, type AssetLabSection } from '../routes.ts';

export function paintCheckerBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const tile = 16;
  ctx.fillStyle = '#1a1d26';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#232732';
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) continue;
      ctx.fillRect(x, y, tile, tile);
    }
  }
}

export interface NavItem {
  id: string;
  label: string;
  group: 'sprites' | 'animations' | 'background' | 'audio';
  count?: number;
}

export type AssetLabGroup = NavItem['group'];

export function createTopbar(
  activeGroup: AssetLabGroup,
  onNavigate: (path: string) => void,
): HTMLElement {
  const bar = document.createElement('header');
  bar.className = 'asset-lab__topbar';

  const brand = document.createElement('div');
  brand.className = 'asset-lab__brand';
  brand.innerHTML = `
    <div class="asset-lab__brand-mark" aria-hidden="true">◫</div>
    <div>
      <h1>Asset Lab</h1>
      <p>Tile slices, animation frames, backdrop &amp; audio · 1:1 preview</p>
    </div>
  `;

  const tabs = document.createElement('nav');
  tabs.className = 'asset-lab__tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Asset sections');

  const groups: Array<{ id: AssetLabSection; label: string }> = [
    { id: 'sprites', label: 'Sprites' },
    { id: 'animations', label: 'Animations' },
    { id: 'background', label: 'Background' },
    { id: 'audio', label: 'Audio' },
  ];

  for (const group of groups) {
    const tab = document.createElement('a');
    tab.className = `asset-lab__tab${group.id === activeGroup ? ' asset-lab__tab--active' : ''}`;
    tab.href = assetLabSectionPath(group.id);
    tab.textContent = group.label;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(group.id === activeGroup));
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      onNavigate(assetLabSectionPath(group.id));
    });
    tabs.append(tab);
  }

  const links = document.createElement('nav');
  links.className = 'asset-lab__toplinks';
  links.setAttribute('aria-label', 'App pages');
  for (const [href, text] of [
    [ROUTES.game, 'Game'],
    [ROUTES.lab, 'UI Lab'],
    [ROUTES.responsive, 'Responsive'],
  ] as const) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    links.append(a);
  }

  bar.append(brand, tabs, links);
  return bar;
}

export function createSidebar(
  items: NavItem[],
  activeId: string,
  onSelect: (id: string) => void,
): HTMLElement {
  const aside = document.createElement('aside');
  aside.className = 'asset-lab__sidebar';

  const label = document.createElement('p');
  label.className = 'asset-lab__control-label';
  label.textContent = 'Browser';
  aside.append(label);

  const list = document.createElement('div');
  list.className = 'asset-lab__nav-list';

  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `asset-lab__nav-item${item.id === activeId ? ' asset-lab__nav-item--active' : ''}`;
    btn.dataset.navId = item.id;

    const name = document.createElement('span');
    name.className = 'asset-lab__nav-item-label';
    name.textContent = item.label;

    const count = document.createElement('span');
    count.className = 'asset-lab__nav-item-count';
    if (item.count !== undefined) count.textContent = String(item.count);

    btn.append(name, count);
    btn.addEventListener('click', () => onSelect(item.id));
    list.append(btn);
  }

  aside.append(list);
  return aside;
}

export function createWorkspace(): HTMLElement {
  const main = document.createElement('main');
  main.className = 'asset-lab__workspace';
  return main;
}

export function createPanelHead(title: string, description: string): HTMLElement {
  const head = document.createElement('div');
  head.className = 'asset-lab__panel-head';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const p = document.createElement('p');
  p.textContent = description;
  head.append(h2, p);
  return head;
}

export function createFpsControl(
  initialFps: number,
  onChange: (fps: number) => void,
  maxFps = 24,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'asset-lab__fps';

  const label = document.createElement('label');
  label.className = 'asset-lab__fps-label';
  label.textContent = 'FPS';

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '1';
  input.max = String(maxFps);
  input.step = '1';
  input.value = String(initialFps);

  const value = document.createElement('code');
  value.textContent = String(initialFps);

  const apply = (): void => {
    const fps = Math.max(1, Math.min(maxFps, Number(input.value) || initialFps));
    value.textContent = String(fps);
    onChange(fps);
  };

  input.addEventListener('input', apply);
  apply();

  label.append(input);
  wrap.append(label, value);
  return wrap;
}

export function createFooterNote(text: string): HTMLElement {
  const foot = document.createElement('footer');
  foot.className = 'asset-lab__footer';
  foot.textContent = text;
  return foot;
}
