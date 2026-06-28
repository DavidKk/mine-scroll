import { wrapWithCustomScrollbar } from '../../ui/custom-scrollbar.ts'
import { assetLabPanelPath, type AssetLabSection } from '../routes.ts'

const ASSET_LAB_SCROLL_HOST = 'scroll-host scroll-host--admin'

export function paintCheckerBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const tile = 16
  ctx.fillStyle = '#1a1d26'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#232732'
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) continue
      ctx.fillRect(x, y, tile, tile)
    }
  }
}

export interface NavItem {
  id: string
  label: string
  group: 'sources' | 'sprites' | 'animations' | 'game-ui' | 'background' | 'audio' | 'lab' | 'responsive'
  count?: number
}

export type AssetLabGroup = NavItem['group']

const SECTION_META: Record<AssetLabSection, { eyebrow: string; title: string; description: string }> = {
  sources: {
    eyebrow: 'Asset Lab',
    title: 'Source sheets',
    description: '',
  },
  sprites: {
    eyebrow: 'Asset Lab',
    title: 'Sprites',
    description: '',
  },
  animations: {
    eyebrow: 'Asset Lab',
    title: 'Animations',
    description: '',
  },
  'game-ui': {
    eyebrow: 'Asset Lab',
    title: 'Game UI',
    description: '',
  },
  background: {
    eyebrow: 'Asset Lab',
    title: 'Environment',
    description: '',
  },
  audio: {
    eyebrow: 'Asset Lab',
    title: 'Audio',
    description: '',
  },
}

export function assetLabSectionMeta(section: AssetLabSection): (typeof SECTION_META)[AssetLabSection] {
  return SECTION_META[section]
}

export function populateSidebar(container: HTMLElement, items: NavItem[], activeId: string, section: AssetLabSection, onSelect: (id: string) => void): void {
  container.replaceChildren()

  const label = document.createElement('p')
  label.className = 'admin-shell__subnav-label'
  label.textContent = 'Browser'
  container.append(label)

  const list = document.createElement('div')
  list.className = 'admin-shell__subnav-list'

  for (const item of items) {
    const link = document.createElement('a')
    link.href = assetLabPanelPath(section, item.id)
    link.className = `admin-shell__subnav-item${item.id === activeId ? ' admin-shell__subnav-item--active' : ''}`
    link.dataset.navId = item.id

    const name = document.createElement('span')
    name.className = 'admin-shell__subnav-item-label'
    name.textContent = item.label

    const count = document.createElement('span')
    count.className = 'admin-shell__subnav-count'
    if (item.count !== undefined) count.textContent = String(item.count)

    link.append(name, count)
    link.addEventListener('click', (event) => {
      event.preventDefault()
      onSelect(item.id)
    })
    list.append(link)
  }

  container.append(list)
}

export function populateAdminSubnav(
  container: HTMLElement,
  items: Array<{ id: string; label: string; count?: number }>,
  activeId: string,
  onSelect: (id: string) => void,
  labelText = 'Views'
): void {
  container.replaceChildren()

  const label = document.createElement('p')
  label.className = 'admin-shell__subnav-label'
  label.textContent = labelText
  container.append(label)

  const list = document.createElement('div')
  list.className = 'admin-shell__subnav-list'

  for (const item of items) {
    const link = document.createElement('a')
    link.href = '#'
    link.className = `admin-shell__subnav-item${item.id === activeId ? ' admin-shell__subnav-item--active' : ''}`
    link.dataset.navId = item.id

    const name = document.createElement('span')
    name.className = 'admin-shell__subnav-item-label'
    name.textContent = item.label

    const count = document.createElement('span')
    count.className = 'admin-shell__subnav-count'
    if (item.count !== undefined) count.textContent = String(item.count)

    link.append(name, count)
    link.addEventListener('click', (event) => {
      event.preventDefault()
      onSelect(item.id)
    })
    list.append(link)
  }

  container.append(list)
}

export function createSidebar(items: NavItem[], activeId: string, section: AssetLabSection, onSelect: (id: string) => void): HTMLElement {
  const aside = document.createElement('aside')
  aside.className = 'admin-shell__subnav'
  populateSidebar(aside, items, activeId, section, onSelect)
  return aside
}

export function createAssetLabSidebarScroll(): {
  host: HTMLElement
  scrollView: HTMLElement
  dispose: () => void
} {
  const host = document.createElement('div')
  host.className = 'admin-shell__subnav-host'

  const scrollView = document.createElement('aside')
  scrollView.className = 'admin-shell__subnav'
  const dispose = wrapWithCustomScrollbar(scrollView, ASSET_LAB_SCROLL_HOST)
  host.append(scrollView.parentElement!)

  return { host, scrollView, dispose }
}

export function createAssetLabWorkspaceScroll(): {
  host: HTMLElement
  scrollView: HTMLElement
  dispose: () => void
} {
  const scrollView = document.createElement('main')
  scrollView.className = 'admin-shell__main'
  const dispose = wrapWithCustomScrollbar(scrollView, ASSET_LAB_SCROLL_HOST)
  return {
    host: scrollView.parentElement as HTMLElement,
    scrollView,
    dispose,
  }
}

export function createPanelHead(title: string, description: string): HTMLElement {
  const head = document.createElement('div')
  head.className = 'asset-lab__panel-head'
  const h2 = document.createElement('h2')
  h2.textContent = title
  head.append(h2)
  if (description.trim()) {
    const p = document.createElement('p')
    p.textContent = description
    head.append(p)
  }
  return head
}

export function createFpsControl(initialFps: number, onChange: (fps: number) => void, maxFps = 24): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'asset-lab__fps'

  const label = document.createElement('label')
  label.className = 'asset-lab__fps-label'
  label.textContent = 'FPS'

  const input = document.createElement('input')
  input.type = 'range'
  input.min = '1'
  input.max = String(maxFps)
  input.step = '1'
  input.value = String(initialFps)

  const value = document.createElement('code')
  value.textContent = String(initialFps)

  const apply = (): void => {
    const fps = Math.max(1, Math.min(maxFps, Number(input.value) || initialFps))
    value.textContent = String(fps)
    onChange(fps)
  }

  input.addEventListener('input', apply)
  apply()

  label.append(input)
  wrap.append(label, value)
  return wrap
}
