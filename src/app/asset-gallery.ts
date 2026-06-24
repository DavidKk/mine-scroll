import { getTileSprites } from '../ui/tile-sprites.ts';
import { ROUTES } from './routes.ts';
import { mountCellEffectSection } from './asset-gallery/cell-effects.ts';

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
    { id: 'cell-hidden', label: '未翻开', src: `${TILE_BASE}/cell-hidden.png`, image: sprites.hidden },
    { id: 'cell-revealed', label: '已翻开', src: `${TILE_BASE}/cell-revealed.png`, image: sprites.revealed },
  ];

  const digitItems: AssetItem[] = sprites.numbers.map((image, index) => ({
    id: `num-${index + 1}`,
    label: `数字 ${index + 1}`,
    src: `${TILE_BASE}/num-${index + 1}.png`,
    image,
  }));

  return [
    {
      id: 'cells',
      title: '方格',
      description: '棋盘格子的隐藏态与翻开态，128×128 PNG。',
      items: cellItems,
    },
    {
      id: 'digits',
      title: '数字',
      description: '邻格雷数 1–8，各数字单独切片展示。',
      items: digitItems,
    },
    {
      id: 'mine',
      title: '地雷',
      description: '踩雷后显示的地雷图标。',
      items: [{ id: 'mine', label: '地雷', src: `${TILE_BASE}/mine.png`, image: sprites.mine }],
    },
    {
      id: 'flag',
      title: '旗帜',
      description: '玩家插旗标记。',
      items: [{ id: 'flag', label: '旗帜', src: `${TILE_BASE}/flag.png`, image: sprites.flag }],
    },
  ];
}

function createLink(href: string, text: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  return link;
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

function createAssetCard(item: AssetItem): HTMLElement {
  const card = document.createElement('article');
  card.className = 'asset-gallery__item';
  card.dataset.assetId = item.id;

  const stage = document.createElement('div');
  stage.className = 'asset-gallery__stage';

  const img = document.createElement('img');
  img.src = item.src;
  img.alt = item.label;
  img.width = item.image.naturalWidth;
  img.height = item.image.naturalHeight;
  img.className = 'asset-gallery__image';
  img.style.width = `${item.image.naturalWidth}px`;
  img.style.height = `${item.image.naturalHeight}px`;
  stage.append(img);

  const body = document.createElement('div');
  body.className = 'asset-gallery__item-body';

  const title = document.createElement('h3');
  title.textContent = item.label;

  const meta = document.createElement('p');
  meta.className = 'asset-gallery__meta';
  const bb = getContentBBox(item.image);
  meta.textContent = bb
    ? `${item.id} · ${item.image.naturalWidth}×${item.image.naturalHeight} · 内容 ${bb.w}×${bb.h}`
    : `${item.id} · ${item.image.naturalWidth}×${item.image.naturalHeight}`;

  const path = document.createElement('code');
  path.className = 'asset-gallery__path';
  path.textContent = item.src;

  body.append(title, meta, path);
  card.append(stage, body);
  return card;
}

function createSection(section: AssetSection): HTMLElement {
  const el = document.createElement('section');
  el.className = 'asset-gallery__section';
  el.id = `section-${section.id}`;

  const head = document.createElement('div');
  head.className = 'asset-gallery__section-head';

  const title = document.createElement('h2');
  title.textContent = section.title;

  const copy = document.createElement('p');
  copy.textContent = section.description;

  head.append(title, copy);

  const grid = document.createElement('div');
  grid.className = 'asset-gallery__grid';
  for (const item of section.items) {
    grid.append(createAssetCard(item));
  }

  el.append(head, grid);
  return el;
}

export function mountAssetGallery(root: HTMLElement): () => void {
  root.className = 'app app--asset-gallery';
  root.replaceChildren();

  const page = document.createElement('main');
  page.className = 'asset-gallery';

  const header = document.createElement('header');
  header.className = 'asset-gallery__header';

  const intro = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'Tile Asset Gallery';
  const subtitle = document.createElement('p');
  subtitle.textContent =
    '单独预览棋盘切片资产与程序动效（Hover、呼吸）。静态 PNG 按 1:1 像素展示；动效区含关键帧与整合预览。';
  intro.append(title, subtitle);

  const links = document.createElement('div');
  links.className = 'asset-gallery__links';
  links.append(
    createLink(ROUTES.game, '返回游戏'),
    createLink(ROUTES.lab, 'UI Lab'),
    createLink(ROUTES.responsive, 'Responsive Matrix'),
  );

  header.append(intro, links);

  const sections = buildSections();
  if (sections.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'asset-gallery__empty';
    empty.textContent = '未能加载 tile 资产，请确认 public/assets/tiles 下文件存在。';
    page.append(header, empty);
    root.append(page);
    return () => root.replaceChildren();
  }

  const nav = document.createElement('nav');
  nav.className = 'asset-gallery__nav';
  nav.setAttribute('aria-label', '资产分类');
  const navItems = [...sections, { id: 'effects', title: '动效' }];
  for (const section of navItems) {
    const link = document.createElement('a');
    link.href = `#section-${section.id}`;
    link.textContent = section.title;
    nav.append(link);
  }

  page.append(header, nav);
  for (const section of sections) {
    page.append(createSection(section));
  }

  const effects = mountCellEffectSection();
  page.append(effects.section);
  root.append(page);

  return () => {
    effects.dispose();
    root.replaceChildren();
  };
}
