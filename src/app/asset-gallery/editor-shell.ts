import { ROUTES, assetLabPanelPath, assetLabSectionPath, type AssetLabSection } from '../routes.ts';
import { wrapWithCustomScrollbar } from '../../ui/custom-scrollbar.ts';

const ASSET_LAB_SCROLL_HOST = 'scroll-host scroll-host--asset-lab';

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
  group: 'sources' | 'sprites' | 'animations' | 'game-ui' | 'background' | 'audio';
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
      <p>Source sheets, sprites, motion previews, UI, environment &amp; audio</p>
    </div>
  `;

  const tabs = document.createElement('nav');
  tabs.className = 'asset-lab__tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Asset sections');

  const groups: Array<{ id: AssetLabSection; label: string }> = [
    { id: 'sources', label: 'Sources' },
    { id: 'sprites', label: 'Sprites' },
    { id: 'animations', label: 'Animations' },
    { id: 'game-ui', label: 'UI' },
    { id: 'background', label: 'Environment' },
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

export function populateSidebar(
  container: HTMLElement,
  items: NavItem[],
  activeId: string,
  section: AssetLabSection,
  onSelect: (id: string) => void,
): void {
  container.replaceChildren();

  const label = document.createElement('p');
  label.className = 'asset-lab__control-label';
  label.textContent = 'Browser';
  container.append(label);

  const list = document.createElement('div');
  list.className = 'asset-lab__nav-list';

  for (const item of items) {
    const link = document.createElement('a');
    link.href = assetLabPanelPath(section, item.id);
    link.className = `asset-lab__nav-item${item.id === activeId ? ' asset-lab__nav-item--active' : ''}`;
    link.dataset.navId = item.id;

    const name = document.createElement('span');
    name.className = 'asset-lab__nav-item-label';
    name.textContent = item.label;

    const count = document.createElement('span');
    count.className = 'asset-lab__nav-item-count';
    if (item.count !== undefined) count.textContent = String(item.count);

    link.append(name, count);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      onSelect(item.id);
    });
    list.append(link);
  }

  container.append(list);
}

export function createSidebar(
  items: NavItem[],
  activeId: string,
  section: AssetLabSection,
  onSelect: (id: string) => void,
): HTMLElement {
  const aside = document.createElement('aside');
  aside.className = 'asset-lab__sidebar';
  populateSidebar(aside, items, activeId, section, onSelect);
  return aside;
}

export function createAssetLabSidebarScroll(): {
  host: HTMLElement;
  scrollView: HTMLElement;
  dispose: () => void;
} {
  const host = document.createElement('div');
  host.className = 'asset-lab__sidebar-host';

  const scrollView = document.createElement('aside');
  scrollView.className = 'asset-lab__sidebar';
  const dispose = wrapWithCustomScrollbar(scrollView, ASSET_LAB_SCROLL_HOST);
  host.append(scrollView.parentElement!);

  return { host, scrollView, dispose };
}

export function createAssetLabWorkspaceScroll(): {
  host: HTMLElement;
  scrollView: HTMLElement;
  dispose: () => void;
} {
  const scrollView = document.createElement('main');
  scrollView.className = 'asset-lab__workspace';
  const dispose = wrapWithCustomScrollbar(scrollView, ASSET_LAB_SCROLL_HOST);
  return {
    host: scrollView.parentElement as HTMLElement,
    scrollView,
    dispose,
  };
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
