import { navigateApp, replaceAppPath } from '../navigation.ts'

export const ROUTES = {
  game: '/play',
  assets: '/admin/assets',
  lab: '/admin/lab',
  responsive: '/admin/responsive',
} as const

export type AssetLabSection = 'sources' | 'sprites' | 'animations' | 'game-ui' | 'background' | 'audio'

export const UI_LAB_PANELS = ['asset-sheets', 'fx-loops'] as const
export type UiLabPanelId = (typeof UI_LAB_PANELS)[number]
export const UI_LAB_DEFAULT_PANEL: UiLabPanelId = 'asset-sheets'

export const RESPONSIVE_PANELS = ['matrix', 'checklist'] as const
export type ResponsivePanelId = (typeof RESPONSIVE_PANELS)[number]
export const RESPONSIVE_DEFAULT_PANEL: ResponsivePanelId = 'matrix'

const ASSET_SECTIONS: AssetLabSection[] = ['sources', 'sprites', 'animations', 'game-ui', 'background', 'audio']

export interface AssetLabRoute {
  section: AssetLabSection
  panelId: string | null
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function assetLabSectionPath(section: AssetLabSection): string {
  return `${ROUTES.assets}/${section}`
}

export function assetLabPanelPath(section: AssetLabSection, panelId: string): string {
  return `${assetLabSectionPath(section)}/${encodeURIComponent(panelId)}`
}

export function isAssetLabSection(value: string): value is AssetLabSection {
  return (ASSET_SECTIONS as string[]).includes(value)
}

/** Next.js `[[...path]]` segments → asset lab route. */
export function parseAssetPathFromSegments(segments: string[] | undefined): AssetLabRoute {
  const parts = segments?.filter(Boolean) ?? []
  if (parts.length === 0) {
    return { section: 'sources', panelId: null }
  }

  const section = isAssetLabSection(parts[0]) ? parts[0] : 'sources'
  if (parts.length < 2) {
    return { section, panelId: null }
  }

  try {
    return { section, panelId: decodeURIComponent(parts.slice(1).join('/')) }
  } catch {
    return { section, panelId: null }
  }
}

/** Resolve /assets and /assets/:section[/:panel]. Bare /assets maps to source sheets. */
export function resolveAssetLabSection(pathname = window.location.pathname): AssetLabSection | null {
  const path = normalizePath(pathname)
  if (path === ROUTES.assets) return 'sources'
  if (!path.startsWith(`${ROUTES.assets}/`)) return null

  const segment = path.slice(`${ROUTES.assets}/`.length).split('/')[0] ?? ''
  return isAssetLabSection(segment) ? segment : null
}

export function resolveAssetLabPanelId(pathname = window.location.pathname): string | null {
  const path = normalizePath(pathname)
  if (!path.startsWith(`${ROUTES.assets}/`)) return null

  const rest = path.slice(`${ROUTES.assets}/`.length)
  const parts = rest.split('/').filter(Boolean)
  if (parts.length < 2) return null

  try {
    return decodeURIComponent(parts.slice(1).join('/'))
  } catch {
    return null
  }
}

export function parseAssetLabRoute(pathname = window.location.pathname): AssetLabRoute | null {
  const section = resolveAssetLabSection(pathname)
  if (!section) return null
  return { section, panelId: resolveAssetLabPanelId(pathname) }
}

export function syncAssetLabPanelPath(section: AssetLabSection, panelId: string, mode: 'push' | 'replace' = 'push'): void {
  const path = assetLabPanelPath(section, panelId)
  const current = normalizePath(window.location.pathname)
  if (path === current) return

  if (mode === 'replace') replaceAppPath(path)
  else navigateApp(path)
}

/** Canonical URL for an asset lab section (redirect bare /assets here). */
export function canonicalAssetLabPath(pathname = window.location.pathname): string | null {
  const path = normalizePath(pathname)
  if (path === ROUTES.assets) return assetLabSectionPath('sources')
  if (path.startsWith(`${ROUTES.assets}/`) && resolveAssetLabSection(path) === null) {
    return assetLabSectionPath('sources')
  }
  return null
}

export function isUiLabPanel(value: string): value is UiLabPanelId {
  return (UI_LAB_PANELS as readonly string[]).includes(value)
}

export function labPanelPath(panelId: UiLabPanelId): string {
  return `${ROUTES.lab}/${encodeURIComponent(panelId)}`
}

export function parseLabPathFromSegments(segments: string[] | undefined): { panelId: string | null } {
  const parts = segments?.filter(Boolean) ?? []
  if (parts.length === 0) return { panelId: null }

  try {
    const panelId = decodeURIComponent(parts.join('/'))
    return { panelId: isUiLabPanel(panelId) ? panelId : null }
  } catch {
    return { panelId: null }
  }
}

export function resolveUiLabPanelId(pathname = window.location.pathname): UiLabPanelId | null {
  const path = normalizePath(pathname)
  if (!path.startsWith(`${ROUTES.lab}/`)) return null

  const rest = path.slice(`${ROUTES.lab}/`.length)
  if (!rest) return null

  try {
    const panelId = decodeURIComponent(rest.split('/')[0] ?? '')
    return isUiLabPanel(panelId) ? panelId : null
  } catch {
    return null
  }
}

export function syncUiLabPanelPath(panelId: UiLabPanelId, mode: 'push' | 'replace' = 'push'): void {
  const path = labPanelPath(panelId)
  const current = normalizePath(window.location.pathname)
  if (path === current) return

  if (mode === 'replace') replaceAppPath(path)
  else navigateApp(path)
}

export function canonicalUiLabPath(pathname = window.location.pathname): string | null {
  const path = normalizePath(pathname)
  if (path === ROUTES.lab) return labPanelPath(UI_LAB_DEFAULT_PANEL)
  if (path.startsWith(`${ROUTES.lab}/`) && resolveUiLabPanelId(path) === null) {
    return labPanelPath(UI_LAB_DEFAULT_PANEL)
  }
  return null
}

export function isResponsivePanel(value: string): value is ResponsivePanelId {
  return (RESPONSIVE_PANELS as readonly string[]).includes(value)
}

export function responsivePanelPath(panelId: ResponsivePanelId): string {
  return `${ROUTES.responsive}/${encodeURIComponent(panelId)}`
}

export function parseResponsivePathFromSegments(segments: string[] | undefined): { panelId: string | null } {
  const parts = segments?.filter(Boolean) ?? []
  if (parts.length === 0) return { panelId: null }

  try {
    const panelId = decodeURIComponent(parts.join('/'))
    return { panelId: isResponsivePanel(panelId) ? panelId : null }
  } catch {
    return { panelId: null }
  }
}

export function resolveResponsivePanelId(pathname = window.location.pathname): ResponsivePanelId | null {
  const path = normalizePath(pathname)
  if (!path.startsWith(`${ROUTES.responsive}/`)) return null

  const rest = path.slice(`${ROUTES.responsive}/`.length)
  if (!rest) return null

  try {
    const panelId = decodeURIComponent(rest.split('/')[0] ?? '')
    return isResponsivePanel(panelId) ? panelId : null
  } catch {
    return null
  }
}

export function syncResponsivePanelPath(panelId: ResponsivePanelId, mode: 'push' | 'replace' = 'push'): void {
  const path = responsivePanelPath(panelId)
  const current = normalizePath(window.location.pathname)
  if (path === current) return

  if (mode === 'replace') replaceAppPath(path)
  else navigateApp(path)
}

export function canonicalResponsivePath(pathname = window.location.pathname): string | null {
  const path = normalizePath(pathname)
  if (path === ROUTES.responsive) return responsivePanelPath(RESPONSIVE_DEFAULT_PANEL)
  if (path.startsWith(`${ROUTES.responsive}/`) && resolveResponsivePanelId(path) === null) {
    return responsivePanelPath(RESPONSIVE_DEFAULT_PANEL)
  }
  return null
}
