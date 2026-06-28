import { resolveRasterUrl } from '../../ui/boot/image-format.ts'
import { type GameUiPanelName, getGameCutout, getGameUiPanel } from '../../ui/game-assets.ts'
import { getHudIcon, type HudIconName } from '../../ui/hud-sprites.ts'
import { wireAssetFrameGrid } from './asset-lightbox.ts'
import { createPanelHead } from './editor-shell.ts'

export type GameUiLabPanelId = 'panels' | 'icons' | 'cutouts'

const MAIN_FLOW_PANELS: GameUiPanelName[] = ['start-panel', 'game-over-panel']

const MAIN_FLOW_ICONS: HudIconName[] = [
  'play',
  'skull',
  'refresh',
  'volume-on',
  'volume-off',
  'volume-on-hover',
  'volume-off-hover',
  'leaderboard',
  'leaderboard-hover',
  'rank-trophy-gold',
  'rank-trophy-silver',
  'rank-trophy-bronze',
]

const MAIN_FLOW_CUTOUTS = ['heart-full', 'heart-empty', 'heart-refill'] as const

const PANEL_PATHS: Partial<Record<GameUiPanelName, string>> = {
  'start-panel': '/assets/candidates/game-ui-v3/panels/runtime/start-panel-v3.png',
  'game-over-panel': '/assets/candidates/game-ui-v3/panels/runtime/game-over-panel-v3.png',
}

const CUTOUT_PATHS: Record<(typeof MAIN_FLOW_CUTOUTS)[number], string> = {
  'heart-full': '/assets/candidates/game-ui-v3/cutouts/heart-full.png',
  'heart-empty': '/assets/candidates/game-ui-v3/cutouts/heart-empty.png',
  'heart-refill': '/assets/candidates/game-ui-v3/cutouts/heart-full.png',
}

interface StaticAsset {
  id: string
  label: string
  src: string
  image: HTMLImageElement
}

function panelPath(name: GameUiPanelName): string {
  const path = PANEL_PATHS[name]
  if (!path) throw new Error(`Unknown UI panel asset: ${name}`)
  return path
}

function cutoutPath(name: (typeof MAIN_FLOW_CUTOUTS)[number]): string {
  return CUTOUT_PATHS[name]
}

function iconPath(name: string): string {
  return resolveRasterUrl(`/assets/hud/icons/${name}.png`)
}

function collectPanels(): StaticAsset[] {
  const items: StaticAsset[] = []
  for (const name of MAIN_FLOW_PANELS) {
    const image = getGameUiPanel(name)
    if (!image) continue
    items.push({ id: name, label: name, src: panelPath(name), image })
  }
  return items
}

function collectIcons(): StaticAsset[] {
  const items: StaticAsset[] = []
  for (const name of MAIN_FLOW_ICONS) {
    const image = getHudIcon(name)
    if (!image) continue
    items.push({ id: name, label: name, src: iconPath(name), image })
  }
  return items
}

function collectCutouts(): StaticAsset[] {
  const items: StaticAsset[] = []
  for (const name of MAIN_FLOW_CUTOUTS) {
    const image = getGameCutout(name)
    if (!image) continue
    items.push({ id: name, label: name, src: cutoutPath(name), image })
  }
  return items
}

function createStaticGridPanel(title: string, description: string, items: StaticAsset[]): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel'
  panel.append(createPanelHead(title, description))

  if (items.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'asset-lab__field-hint'
    empty.textContent = 'No runtime assets loaded.'
    panel.append(empty)
    return panel
  }

  const grid = document.createElement('div')
  grid.className = 'asset-lab__frame-grid'

  items.forEach((item, index) => {
    const cell = document.createElement('article')
    cell.className = 'asset-lab__frame-cell asset-lab__frame-cell--static asset-lab__frame-cell--zoomable'

    const thumb = document.createElement('div')
    thumb.className = 'asset-lab__frame-thumb asset-lab__frame-thumb--zoomable asset-lab__checker'

    const img = document.createElement('img')
    img.src = item.src
    img.alt = item.label
    img.className = 'asset-lab__sprite-img'
    thumb.append(img)

    const num = document.createElement('span')
    num.className = 'asset-lab__frame-num'
    num.textContent = String(index + 1).padStart(2, '0')
    thumb.append(num)

    const meta = document.createElement('div')
    meta.className = 'asset-lab__frame-meta'
    const name = document.createElement('strong')
    name.textContent = item.label
    const dims = document.createElement('span')
    dims.textContent = `${item.image.naturalWidth}×${item.image.naturalHeight}`
    meta.append(name, dims)
    cell.append(thumb, meta)
    grid.append(cell)
  })

  wireAssetFrameGrid(grid)
  panel.append(grid)
  return panel
}

export function gameUiNavItems(): Array<{ id: GameUiLabPanelId; label: string; count?: number }> {
  return [
    { id: 'panels', label: 'Panels', count: MAIN_FLOW_PANELS.length },
    { id: 'icons', label: 'HUD icons', count: MAIN_FLOW_ICONS.length },
    { id: 'cutouts', label: 'HUD cutouts', count: MAIN_FLOW_CUTOUTS.length },
  ]
}

export function mountGameUiPanels(): {
  panels: Partial<Record<GameUiLabPanelId, HTMLElement>>
  dispose: () => void
} {
  const panels: Partial<Record<GameUiLabPanelId, HTMLElement>> = {
    panels: createStaticGridPanel('UI panels', '', collectPanels()),
    icons: createStaticGridPanel('HUD icons', '', collectIcons()),
    cutouts: createStaticGridPanel('HUD cutouts', '', collectCutouts()),
  }

  return {
    panels,
    dispose: () => undefined,
  }
}
