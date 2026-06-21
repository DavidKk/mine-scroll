import { getModeEntry, MODE_ENTRIES, type ModeEntry } from '../core/modes/catalog.ts';
import type { GameModeId } from '../core/types.ts';
import { wrapWithCustomScrollbar } from '../ui/custom-scrollbar.ts';

export interface ModeHubCallbacks {
  onSelect(modeId: GameModeId): void;
}

export function createModeHub(container: HTMLElement, callbacks: ModeHubCallbacks): void {
  container.className = 'hub';
  container.replaceChildren();

  const header = document.createElement('div');
  header.className = 'hub__header';
  header.innerHTML = `
    <h1 class="hub__title">扫雷</h1>
    <p class="hub__subtitle">经典方形 · 六边形 · 无尽向上探索</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'hub__grid';

  for (const entry of MODE_ENTRIES) {
    grid.appendChild(createModeCard(entry, () => callbacks.onSelect(entry.id)));
  }

  const scroll = document.createElement('div');
  scroll.className = 'hub__scroll';
  scroll.append(header, grid);
  container.append(scroll);
  wrapWithCustomScrollbar(scroll, 'scroll-host--hub');
}

function createModeCard(entry: ModeEntry, onClick: () => void): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `hub__card hub__card--${entry.category}`;

  const tag = document.createElement('span');
  tag.className = 'hub__tag';
  tag.textContent = entry.tag;

  const title = document.createElement('span');
  title.className = 'hub__name';
  title.textContent = entry.name;

  const desc = document.createElement('span');
  desc.className = 'hub__desc';
  desc.textContent = entry.description;

  card.append(tag, title, desc);
  card.addEventListener('click', onClick);

  return card;
}

export function getModeMeta(modeId: GameModeId): ModeEntry {
  return getModeEntry(modeId);
}
