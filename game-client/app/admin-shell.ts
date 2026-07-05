import { createAdminBackdropElement } from '../../lib/admin-backdrop.ts'
import { BRAND_MARK_PATH, BRAND_NAME } from '../../lib/brand.ts'
import { wrapWithCustomScrollbar } from '../ui/custom-scrollbar.ts'
import { createAdminUserMenu } from './admin-chrome.ts'
import { bindAdminNavIndicator, playAdminNavIndicatorEntrance } from './admin-nav-indicator.ts'
import {
  type AssetLabSection,
  assetLabSectionPath,
  labPanelPath,
  LAYOUT_EDITOR_DEFAULT_PANEL,
  layoutEditorPanelPath,
  RESPONSIVE_DEFAULT_PANEL,
  responsivePanelPath,
  ROUTES,
  UI_LAB_DEFAULT_PANEL,
} from './routes.ts'

export type AdminTopModule = 'assets' | 'leaderboard' | 'layout-editor'

export type AdminRailId = AssetLabSection | 'lab' | 'responsive'

const ADMIN_SCROLL_HOST = 'scroll-host scroll-host--admin'

const ASSETS_HOME = `${ROUTES.assets}/sources`

const ASSET_RAIL: Array<{ id: AssetLabSection; label: string; short: string }> = [
  { id: 'sources', label: 'Sources', short: 'SRC' },
  { id: 'sprites', label: 'Sprites', short: 'SPR' },
  { id: 'animations', label: 'Animations', short: 'FX' },
  { id: 'game-ui', label: 'UI', short: 'UI' },
  { id: 'background', label: 'Environment', short: 'ENV' },
  { id: 'audio', label: 'Audio', short: 'SND' },
]

const TOOL_RAIL: Array<{ id: 'lab' | 'responsive'; label: string; short: string; href: string }> = [
  { id: 'lab', label: 'UI Lab', short: 'LAB', href: labPanelPath(UI_LAB_DEFAULT_PANEL) },
  { id: 'responsive', label: 'Responsive', short: 'RSP', href: responsivePanelPath(RESPONSIVE_DEFAULT_PANEL) },
]

const TOP_MODULES: Array<{ id: AdminTopModule; label: string; href: string }> = [
  { id: 'assets', label: 'Assets', href: ASSETS_HOME },
  { id: 'layout-editor', label: 'Layout', href: layoutEditorPanelPath(LAYOUT_EDITOR_DEFAULT_PANEL) },
  { id: 'leaderboard', label: 'Leaderboard', href: '/admin/leaderboard' },
]

export interface AdminShellOptions {
  activeModule: AdminTopModule
  activeRail?: AdminRailId
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

function createAdminHeader(onNavigate: (path: string) => void, activeModule: AdminTopModule): HTMLElement {
  const header = document.createElement('header')
  header.className = 'admin-shell__header'

  const brand = document.createElement('a')
  brand.className = 'admin-shell__brand'
  brand.href = ROUTES.game
  brand.setAttribute('aria-label', 'Return to game')
  brand.innerHTML = `
    <span class="admin-shell__mark" aria-hidden="true">
      <img class="admin-shell__mark-image" src="${BRAND_MARK_PATH}" alt="" width="28" height="28" decoding="async" />
    </span>
    <span class="admin-shell__brand-copy">
      <span class="admin-shell__brand-title">${BRAND_NAME}</span>
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

  for (const item of TOP_MODULES) {
    const link = document.createElement('a')
    link.href = item.href
    link.className = 'admin-shell__module'
    link.textContent = item.label
    if (item.id === activeModule) link.setAttribute('aria-current', 'page')
    link.addEventListener('click', (event) => {
      event.preventDefault()
      onNavigate(item.href)
    })
    modules.append(link)
  }

  bindAdminNavIndicator(modules)

  const actions = document.createElement('div')
  actions.className = 'admin-shell__actions'
  actions.append(createAdminUserMenu())

  const toolbar = document.createElement('div')
  toolbar.className = 'admin-shell__toolbar'
  toolbar.append(modules, actions)

  header.append(brand, toolbar)
  requestAnimationFrame(() => playAdminNavIndicatorEntrance(modules))
  return header
}

function createAdminRail(active: AdminRailId, onNavigate: (path: string) => void): HTMLElement {
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

  const divider = document.createElement('div')
  divider.className = 'admin-shell__rail-divider'
  divider.setAttribute('aria-hidden', 'true')
  rail.append(divider)

  for (const item of TOOL_RAIL) {
    const link = document.createElement('a')
    link.href = item.href
    link.className = `admin-shell__rail-btn${item.id === active ? ' admin-shell__rail-btn--active' : ''}`
    link.title = item.label
    link.setAttribute('aria-label', item.label)
    link.innerHTML = `<span class="admin-shell__rail-short">${item.short}</span>`
    link.addEventListener('click', (event) => {
      event.preventDefault()
      onNavigate(item.href)
    })
    rail.append(link)
  }

  return rail
}

export function createAdminShell(options: AdminShellOptions): AdminShellLayout {
  const { activeModule, activeRail, onNavigate, withSubnav = false, eyebrow = '', title = '', description = '' } = options

  const root = document.createElement('div')
  root.className = `admin-shell${activeModule === 'assets' ? '' : ' admin-shell--no-rail'}`

  root.append(createAdminBackdropElement(), createAdminHeader(onNavigate, activeModule))

  const frame = document.createElement('div')
  frame.className = 'admin-shell__frame'

  if (activeModule === 'assets' && activeRail) {
    frame.append(createAdminRail(activeRail, onNavigate))
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
    descEl.hidden = !nextDescription?.trim()
    pageHead.hidden = !nextEyebrow && !nextTitle && !nextDescription?.trim()
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
