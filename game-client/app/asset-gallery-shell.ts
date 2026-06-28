import { createAdminShell } from './admin-shell.ts'
import { assetLabSectionMeta, createFooterNote, type NavItem, populateSidebar } from './asset-gallery/editor-shell.ts'
import { type AssetSection, FOOTER_NOTES, type StaticPreviewSection, V3_BOARD_TILE_CANDIDATES, V3_CANDIDATE_CUTOUTS, V3_HUD_ALERT_CANDIDATES } from './asset-gallery-data.ts'
import { createSpritePanel, createStaticPreviewPanel } from './asset-gallery-panels.ts'
import type { AssetLabSection } from './routes.ts'
import { syncAssetLabPanelPath } from './routes.ts'

function resolveActivePanelId(items: NavItem[], panelId: string | null): string {
  if (panelId && items.some((item) => item.id === panelId)) return panelId
  return items[0]?.id ?? ''
}

function mountAssetSectionShell(
  root: HTMLElement,
  section: AssetLabSection,
  onNavigate: (path: string) => void,
  render: (panelHost: HTMLElement, subnavScroll: HTMLElement, setPageHeader: (eyebrow: string, title: string, description?: string) => void) => () => void
): () => void {
  const meta = assetLabSectionMeta(section)
  const layout = createAdminShell({
    module: 'assets',
    activeAssetSection: section,
    onNavigate,
    withSubnav: true,
    eyebrow: meta.eyebrow,
    title: meta.title,
    description: meta.description,
  })

  root.append(layout.root)

  const footer = createFooterNote(FOOTER_NOTES[section])
  layout.panelHost.append(footer)

  const disposeInner = render(layout.panelHost, layout.subnavScroll!, layout.setPageHeader)

  return () => {
    disposeInner()
    layout.disposeScroll()
  }
}

export function mountSpritesSection(
  root: HTMLElement,
  sections: AssetSection[],
  section: AssetLabSection,
  onNavigate: (path: string) => void,
  initialPanelId: string | null
): () => void {
  const spritePanels = new Map(sections.map((s) => [s.id, createSpritePanel(s)]))
  const candidateCutoutSection: StaticPreviewSection = {
    id: 'v3-cutouts',
    title: 'Runtime cutouts',
    description: 'Manifest-wired mine, flag, and heart cutouts used by the game canvas.',
    items: V3_CANDIDATE_CUTOUTS,
  }
  const candidateBoardTileSection: StaticPreviewSection = {
    id: 'board-v3-tiles',
    title: 'Board v3 square slices',
    description: 'Runtime 128x128 square board tiles and digit glyphs from board-v3-square.',
    items: V3_BOARD_TILE_CANDIDATES,
  }
  const candidateHudAlertSection: StaticPreviewSection = {
    id: 'hud-alerts-v3',
    title: 'HUD alerts v3',
    description: 'Runtime difficulty alert badge art. Chevron acceleration streaks are Canvas-driven — see Animations → Speed up chevrons v3.',
    items: V3_HUD_ALERT_CANDIDATES,
  }
  spritePanels.set(candidateCutoutSection.id, createStaticPreviewPanel(candidateCutoutSection))
  spritePanels.set(candidateBoardTileSection.id, createStaticPreviewPanel(candidateBoardTileSection))
  spritePanels.set(candidateHudAlertSection.id, createStaticPreviewPanel(candidateHudAlertSection))

  const navItems = (): NavItem[] => [
    ...sections.map((s) => ({
      id: s.id,
      label: s.title.replace(' tiles', '').replace(' glyphs', ''),
      group: 'sprites' as const,
      count: s.items.length,
    })),
    {
      id: candidateCutoutSection.id,
      label: 'Runtime cutouts',
      group: 'sprites' as const,
      count: candidateCutoutSection.items.length,
    },
    {
      id: candidateBoardTileSection.id,
      label: 'Board v3 Tiles',
      group: 'sprites' as const,
      count: candidateBoardTileSection.items.length,
    },
    {
      id: candidateHudAlertSection.id,
      label: 'HUD Alerts v3',
      group: 'sprites' as const,
      count: candidateHudAlertSection.items.length,
    },
  ]

  let activeId = resolveActivePanelId(navItems(), initialPanelId)
  const contentHost = document.createElement('div')
  contentHost.className = 'admin-shell__panel-content'

  return mountAssetSectionShell(root, section, onNavigate, (panelHost, subnavScroll, setPageHeader) => {
    panelHost.prepend(contentHost)

    function showPanel(id: string, syncUrl = true): void {
      activeId = id
      contentHost.replaceChildren()
      const panel = spritePanels.get(id)
      if (panel) contentHost.append(panel)
      const active = navItems().find((item) => item.id === id)
      if (active) {
        setPageHeader('Sprites', active.label, assetLabSectionMeta(section).description)
      }
      populateSidebar(subnavScroll, navItems(), activeId, section, showPanel)
      if (syncUrl && id) syncAssetLabPanelPath(section, id)
    }

    showPanel(activeId, false)
    if (activeId) syncAssetLabPanelPath(section, activeId, 'replace')
    return () => contentHost.replaceChildren()
  })
}

export function mountLabSection(
  root: HTMLElement,
  section: AssetLabSection,
  onNavigate: (path: string) => void,
  items: NavItem[],
  getPanel: (id: string) => HTMLElement | undefined,
  initialPanelId: string | null,
  options?: { onPanelHide?: (id: string) => void }
): () => void {
  let activeId = resolveActivePanelId(items, initialPanelId)
  const contentHost = document.createElement('div')
  contentHost.className = 'admin-shell__panel-content'

  return mountAssetSectionShell(root, section, onNavigate, (panelHost, subnavScroll, setPageHeader) => {
    panelHost.prepend(contentHost)

    function showPanel(id: string, syncUrl = true): void {
      if (activeId !== id) options?.onPanelHide?.(activeId)
      activeId = id
      contentHost.replaceChildren()
      const panel = getPanel(id)
      if (panel) contentHost.append(panel)
      const active = items.find((item) => item.id === id)
      if (active) {
        setPageHeader(assetLabSectionMeta(section).title, active.label, assetLabSectionMeta(section).description)
      }
      populateSidebar(subnavScroll, items, activeId, section, showPanel)
      if (syncUrl && id) syncAssetLabPanelPath(section, id)
    }

    if (activeId) {
      showPanel(activeId, false)
      syncAssetLabPanelPath(section, activeId, 'replace')
    }

    return () => {
      options?.onPanelHide?.(activeId)
      contentHost.replaceChildren()
    }
  })
}
