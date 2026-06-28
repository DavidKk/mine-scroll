import { wrapWithCustomScrollbar } from '../ui/custom-scrollbar.ts'
import { createAdminLogoutButton } from './admin-chrome.ts'
import { bindAdminNavIndicator, playAdminNavIndicatorEntrance } from './admin-nav-indicator.ts'
import { type AssetLabSection, assetLabSectionPath, ROUTES } from './routes.ts'

export type AdminModuleId = 'assets' | 'lab' | 'responsive'

const ADMIN_SCROLL_HOST = 'scroll-host scroll-host--admin'

const MODULE_LINKS: Array<{ id: AdminModuleId; href: string; label: string }> = [
  { id: 'assets', href: `${ROUTES.assets}/sources`, label: 'Assets' },
  { id: 'lab', href: ROUTES.lab, label: 'UI Lab' },
  { id: 'responsive', href: ROUTES.responsive, label: 'Responsive' },
]

const ASSET_RAIL: Array<{ id: AssetLabSection; label: string; short: string }> = [
  { id: 'sources', label: 'Sources', short: 'SRC' },
  { id: 'sprites', label: 'Sprites', short: 'SPR' },
  { id: 'animations', label: 'Animations', short: 'FX' },
  { id: 'game-ui', label: 'UI', short: 'UI' },
  { id: 'background', label: 'Environment', short: 'ENV' },
  { id: 'audio', label: 'Audio', short: 'SND' },
]

export interface AdminShellOptions {
  module: AdminModuleId
  activeAssetSection?: AssetLabSection
  onNavigate: (path: string) => void
  withSubnav?: boolean
  eyebrow?: string
  title?: string
  description?: string
}

export interface AdminShellLayout {
  root: HTMLElement
  subnavScroll: HTMLElement | null
  panelHost: HTMLElement
  disposeScroll: () => void
  setPageHeader: (eyebrow: string, title: string, description?: string) => void
}

function createAdminBackdrop(): HTMLElement {
  const backdrop = document.createElement('div')
  backdrop.className = 'game-admin-backdrop'
  backdrop.setAttribute('aria-hidden', 'true')
  backdrop.innerHTML = `
    <div class="game-admin-backdrop__aurora"></div>
    <div class="game-admin-backdrop__stars game-admin-backdrop__stars--far"></div>
    <div class="game-admin-backdrop__stars game-admin-backdrop__stars--near"></div>
    <div class="game-admin-backdrop__grid"></div>
    <div class="game-admin-backdrop__vignette"></div>
  `
  return backdrop
}

function createAdminHeader(module: AdminModuleId, onNavigate: (path: string) => void): HTMLElement {
  const header = document.createElement('header')
  header.className = 'admin-shell__header'

  const brand = document.createElement('a')
  brand.className = 'admin-shell__brand'
  brand.href = ROUTES.game
  brand.setAttribute('aria-label', 'Return to game')
  brand.innerHTML = `
    <span class="admin-shell__mark" aria-hidden="true">◫</span>
    <span class="admin-shell__brand-copy">
      <span class="admin-shell__brand-title">Minesweeper</span>
      <span class="admin-shell__brand-sub">Admin</span>
    </span>
  `
  brand.addEventListener('click', (event) => {
    event.preventDefault()
    onNavigate(ROUTES.game)
  })

  const modules = document.createElement('nav')
  modules.className = 'admin-shell__modules'
  modules.setAttribute('aria-label', 'Admin sections')

  for (const link of MODULE_LINKS) {
    const a = document.createElement('a')
    a.href = link.href
    a.className = 'admin-shell__module'
    a.textContent = link.label
    if (link.id === module) {
      a.setAttribute('aria-current', 'page')
    }
    a.addEventListener('click', (event) => {
      event.preventDefault()
      onNavigate(link.href)
    })
    modules.append(a)
  }

  bindAdminNavIndicator(modules)

  const actions = document.createElement('div')
  actions.className = 'admin-shell__actions'
  actions.append(createAdminLogoutButton('admin-shell__logout'))

  const toolbar = document.createElement('div')
  toolbar.className = 'admin-shell__toolbar'
  toolbar.append(modules, actions)

  header.append(brand, toolbar)
  requestAnimationFrame(() => playAdminNavIndicatorEntrance(modules))
  return header
}

function createAssetRail(active: AssetLabSection, onNavigate: (path: string) => void): HTMLElement {
  const rail = document.createElement('aside')
  rail.className = 'admin-shell__rail'
  rail.setAttribute('aria-label', 'Asset sections')

  for (const item of ASSET_RAIL) {
    const link = document.createElement('a')
    link.href = assetLabSectionPath(item.id)
    link.className = `admin-shell__rail-btn${item.id === active ? ' admin-shell__rail-btn--active' : ''}`
    link.title = item.label
    link.setAttribute('aria-label', item.label)
    link.innerHTML = `<span class="admin-shell__rail-short">${item.short}</span>`
    link.addEventListener('click', (event) => {
      event.preventDefault()
      onNavigate(assetLabSectionPath(item.id))
    })
    rail.append(link)
  }

  return rail
}

export function createAdminShell(options: AdminShellOptions): AdminShellLayout {
  const { module, activeAssetSection, onNavigate, withSubnav = false, eyebrow = '', title = '', description = '' } = options

  const root = document.createElement('div')
  root.className = 'admin-shell'

  root.append(createAdminBackdrop(), createAdminHeader(module, onNavigate))

  const frame = document.createElement('div')
  frame.className = 'admin-shell__frame'

  if (module === 'assets' && activeAssetSection) {
    frame.append(createAssetRail(activeAssetSection, onNavigate))
  }

  const content = document.createElement('div')
  content.className = 'admin-shell__content'

  const pageHead = document.createElement('header')
  pageHead.className = 'admin-shell__page-head'

  const eyebrowEl = document.createElement('p')
  eyebrowEl.className = 'admin-shell__eyebrow'

  const titleEl = document.createElement('h1')
  titleEl.className = 'admin-shell__page-title'

  const descEl = document.createElement('p')
  descEl.className = 'admin-shell__page-desc'

  const setPageHeader = (nextEyebrow: string, nextTitle: string, nextDescription?: string): void => {
    eyebrowEl.textContent = nextEyebrow
    titleEl.textContent = nextTitle
    descEl.textContent = nextDescription ?? ''
    pageHead.hidden = !nextEyebrow && !nextTitle && !nextDescription
  }

  setPageHeader(eyebrow, title, description)
  pageHead.append(eyebrowEl, titleEl, descEl)

  let subnavScroll: HTMLElement | null = null
  let disposeSubnavScroll = (): void => {}

  const workspace = document.createElement('div')
  workspace.className = 'admin-shell__workspace'

  if (withSubnav) {
    const subnavHost = document.createElement('div')
    subnavHost.className = 'admin-shell__subnav-host'

    subnavScroll = document.createElement('aside')
    subnavScroll.className = 'admin-shell__subnav'
    disposeSubnavScroll = wrapWithCustomScrollbar(subnavScroll, ADMIN_SCROLL_HOST)
    subnavHost.append(subnavScroll.parentElement!)
    workspace.append(subnavHost)
  }

  const mainScroll = document.createElement('main')
  mainScroll.className = 'admin-shell__main'
  const disposeMainScroll = wrapWithCustomScrollbar(mainScroll, ADMIN_SCROLL_HOST)

  const panelHost = document.createElement('div')
  panelHost.className = 'admin-shell__panel-host'
  mainScroll.append(panelHost)

  workspace.append(mainScroll.parentElement!)
  content.append(pageHead, workspace)
  frame.append(content)
  root.append(frame)

  return {
    root,
    subnavScroll,
    panelHost,
    disposeScroll: () => {
      disposeSubnavScroll()
      disposeMainScroll()
    },
    setPageHeader,
  }
}
