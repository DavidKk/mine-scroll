import { type AdminRailId, type AdminTopModule, createAdminShell } from './admin-shell.ts'
import { populateAdminSubnav } from './asset-gallery/editor-shell.ts'

export interface AdminModuleNavItem {
  id: string
  label: string
  count?: number
  description?: string
}

export interface MountAdminModuleShellOptions {
  activeModule: AdminTopModule
  activeRail?: AdminRailId
  onNavigate: (path: string) => void
  eyebrow: string
  title: string
  description: string
  navItems: AdminModuleNavItem[]
  panels: Map<string, HTMLElement>
  initialPanelId: string
  subnavLabel?: string
  footerNote?: string
  onPanelSelect?: (id: string) => void
}

function resolveActivePanelId(items: AdminModuleNavItem[], panelId: string): string {
  if (items.some((item) => item.id === panelId)) return panelId
  return items[0]?.id ?? ''
}

export function mountAdminModuleShell(root: HTMLElement, options: MountAdminModuleShellOptions): () => void {
  const { activeModule, activeRail, onNavigate, eyebrow, title, description, navItems, panels, initialPanelId, subnavLabel = 'Views', footerNote, onPanelSelect } = options

  const layout = createAdminShell({
    activeModule,
    activeRail,
    onNavigate,
    withSubnav: true,
    eyebrow,
    title,
    description,
  })

  root.append(layout.root)

  if (footerNote) {
    const foot = document.createElement('footer')
    foot.className = 'admin-shell__footer'
    foot.textContent = footerNote
    layout.panelHost.append(foot)
  }

  let activeId = resolveActivePanelId(navItems, initialPanelId)
  const contentHost = document.createElement('div')
  contentHost.className = 'admin-shell__panel-content'
  layout.panelHost.prepend(contentHost)

  function showPanel(id: string, syncUrl = true): void {
    activeId = id
    contentHost.replaceChildren()
    const panel = panels.get(id)
    if (panel) contentHost.append(panel)

    const active = navItems.find((item) => item.id === id)
    if (active) {
      layout.setPageHeader(eyebrow, active.label, active.description ?? description)
    }
    populateAdminSubnav(layout.subnavScroll!, navItems, activeId, (nextId) => showPanel(nextId), subnavLabel)
    if (syncUrl) onPanelSelect?.(id)
  }

  showPanel(activeId, false)

  return () => {
    contentHost.replaceChildren()
    layout.root.remove()
    layout.disposeScroll()
  }
}
