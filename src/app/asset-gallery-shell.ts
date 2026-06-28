import type { AssetLabSection } from './routes.ts';
import { syncAssetLabPanelPath } from './routes.ts';
import {
  createAssetLabSidebarScroll,
  createAssetLabWorkspaceScroll,
  createFooterNote,
  createTopbar,
  populateSidebar,
  type NavItem,
} from './asset-gallery/editor-shell.ts';
import {
  FOOTER_NOTES,
  V3_BOARD_TILE_CANDIDATES,
  V3_CANDIDATE_CUTOUTS,
  V3_HUD_ALERT_CANDIDATES,
  type AssetSection,
  type StaticPreviewSection,
} from './asset-gallery-data.ts';
import { createSpritePanel, createStaticPreviewPanel } from './asset-gallery-panels.ts';

function resolveActivePanelId(items: NavItem[], panelId: string | null): string {
  if (panelId && items.some((item) => item.id === panelId)) return panelId;
  return items[0]?.id ?? '';
}

export function mountSpritesSection(
  root: HTMLElement,
  sections: AssetSection[],
  section: AssetLabSection,
  onNavigate: (path: string) => void,
  initialPanelId: string | null,
): () => void {
  const shell = document.createElement('div');
  shell.className = 'asset-lab';

  const spritePanels = new Map(sections.map((s) => [s.id, createSpritePanel(s)]));
  const candidateCutoutSection: StaticPreviewSection = {
    id: 'v3-cutouts',
    title: 'Runtime cutouts',
    description: 'Manifest-wired mine, flag, and heart cutouts used by the game canvas.',
    items: V3_CANDIDATE_CUTOUTS,
  };
  const candidateBoardTileSection: StaticPreviewSection = {
    id: 'board-v3-tiles',
    title: 'Board v3 square slices',
    description: 'Runtime 128x128 square board tiles and digit glyphs from board-v3-square.',
    items: V3_BOARD_TILE_CANDIDATES,
  };
  const candidateHudAlertSection: StaticPreviewSection = {
    id: 'hud-alerts-v3',
    title: 'HUD alerts v3',
    description: 'Runtime difficulty alert badge art. Chevron acceleration streaks are Canvas-driven — see Animations → Speed up chevrons v3.',
    items: V3_HUD_ALERT_CANDIDATES,
  };
  spritePanels.set(candidateCutoutSection.id, createStaticPreviewPanel(candidateCutoutSection));
  spritePanels.set(candidateBoardTileSection.id, createStaticPreviewPanel(candidateBoardTileSection));
  spritePanels.set(candidateHudAlertSection.id, createStaticPreviewPanel(candidateHudAlertSection));
  const { host: sidebarHost, scrollView: sidebarScroll, dispose: disposeSidebarScroll } =
    createAssetLabSidebarScroll();
  const { host: workspaceHost, scrollView: workspaceScroll, dispose: disposeWorkspaceScroll } =
    createAssetLabWorkspaceScroll();
  const panelHost = document.createElement('div');
  panelHost.className = 'asset-lab__panel-host';

  const navItems = (): NavItem[] =>
    [
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
    ];

  let activeId = resolveActivePanelId(navItems(), initialPanelId);

  function showPanel(id: string, syncUrl = true): void {
    activeId = id;
    panelHost.replaceChildren();
    const panel = spritePanels.get(id);
    if (panel) panelHost.append(panel);
    renderSidebar();
    if (syncUrl && id) syncAssetLabPanelPath(section, id);
  }

  function renderSidebar(): void {
    populateSidebar(sidebarScroll, navItems(), activeId, section, showPanel);
  }

  const panel = document.createElement('div');
  panel.className = 'asset-lab__panel-layout';
  panel.append(sidebarHost, workspaceHost);
  workspaceScroll.append(panelHost);
  shell.append(createTopbar(section, onNavigate), panel, createFooterNote(FOOTER_NOTES[section]));
  root.append(shell);
  showPanel(activeId, false);
  if (activeId) syncAssetLabPanelPath(section, activeId, 'replace');

  return () => {
    disposeSidebarScroll();
    disposeWorkspaceScroll();
  };
}

export function mountLabSection(
  root: HTMLElement,
  section: AssetLabSection,
  onNavigate: (path: string) => void,
  items: NavItem[],
  getPanel: (id: string) => HTMLElement | undefined,
  initialPanelId: string | null,
): () => void {
  const shell = document.createElement('div');
  shell.className = 'asset-lab';

  let activeId = resolveActivePanelId(items, initialPanelId);
  const { host: sidebarHost, scrollView: sidebarScroll, dispose: disposeSidebarScroll } =
    createAssetLabSidebarScroll();
  const { host: workspaceHost, scrollView: workspaceScroll, dispose: disposeWorkspaceScroll } =
    createAssetLabWorkspaceScroll();
  const panelHost = document.createElement('div');
  panelHost.className = 'asset-lab__panel-host';

  function showPanel(id: string, syncUrl = true): void {
    activeId = id;
    panelHost.replaceChildren();
    const panel = getPanel(id);
    if (panel) panelHost.append(panel);
    renderSidebar();
    if (syncUrl && id) syncAssetLabPanelPath(section, id);
  }

  function renderSidebar(): void {
    populateSidebar(sidebarScroll, items, activeId, section, showPanel);
  }

  const panel = document.createElement('div');
  panel.className = 'asset-lab__panel-layout';
  panel.append(sidebarHost, workspaceHost);
  workspaceScroll.append(panelHost);
  shell.append(createTopbar(section, onNavigate), panel, createFooterNote(FOOTER_NOTES[section]));
  root.append(shell);
  if (activeId) {
    showPanel(activeId, false);
    syncAssetLabPanelPath(section, activeId, 'replace');
  }

  return () => {
    disposeSidebarScroll();
    disposeWorkspaceScroll();
  };
}
