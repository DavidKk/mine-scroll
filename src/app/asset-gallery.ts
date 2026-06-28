import type { AssetLabSection } from './routes.ts';
import { audioNavItems, mountAudioPanels, type AudioPanelId } from './asset-gallery/audio-lab.ts';
import { backdropNavItems, mountBackdropPanels, type BackdropPanelId } from './asset-gallery/ambient-backdrop-lab.ts';
import { mountEffectPanels, type EffectPanelId } from './asset-gallery/cell-effects.ts';
import { gameUiNavItems, mountGameUiPanels, type GameUiLabPanelId } from './asset-gallery/game-ui-lab.ts';
import { FX_NAV, SOURCE_SECTIONS } from './asset-gallery-data.ts';
import { buildSpriteSections, createStaticPreviewPanel } from './asset-gallery-panels.ts';
import { mountLabSection, mountSpritesSection } from './asset-gallery-shell.ts';

export function mountAssetGallery(
  root: HTMLElement,
  section: AssetLabSection,
  initialPanelId: string | null,
  onNavigate: (path: string) => void,
): () => void {
  root.className = 'app app--asset-lab';
  root.replaceChildren();

  const disposers: Array<() => void> = [];

  if (section === 'sources') {
    const panels = new Map(SOURCE_SECTIONS.map((s) => [s.id, createStaticPreviewPanel(s)]));
    disposers.push(mountLabSection(root, section, onNavigate, SOURCE_SECTIONS.map((s) => ({
      id: s.id,
      label: s.title,
      group: 'sources' as const,
      count: s.items.length,
    })), (id) => panels.get(id), initialPanelId));
    return () => {
      for (const dispose of disposers) dispose();
      root.replaceChildren();
    };
  }

  if (section === 'sprites') {
    const sections = buildSpriteSections();
    if (sections.length === 0) {
      const empty = document.createElement('main');
      empty.className = 'asset-lab asset-lab--empty';
      empty.textContent = 'Failed to load tile assets. Check public/assets/tiles.';
      root.append(empty);
      return () => root.replaceChildren();
    }

    disposers.push(mountSpritesSection(root, sections, section, onNavigate, initialPanelId));
    return () => {
      for (const dispose of disposers) dispose();
      root.replaceChildren();
    };
  }

  if (section === 'animations') {
    const effects = mountEffectPanels();
    disposers.push(effects.dispose);
    disposers.push(mountLabSection(root, section, onNavigate, FX_NAV.map((fx) => ({
      id: fx.id,
      label: fx.label,
      group: 'animations' as const,
      count: 8,
    })), (id) => effects.panels[id as EffectPanelId], initialPanelId));
    return () => {
      for (const dispose of disposers) dispose();
      root.replaceChildren();
    };
  }

  if (section === 'game-ui') {
    const gameUi = mountGameUiPanels();
    disposers.push(gameUi.dispose);
    disposers.push(mountLabSection(root, section, onNavigate, gameUiNavItems().map((item) => ({
      id: item.id,
      label: item.label,
      group: 'game-ui' as const,
      count: item.count,
    })), (id) => gameUi.panels[id as GameUiLabPanelId], initialPanelId));
    return () => {
      for (const dispose of disposers) dispose();
      root.replaceChildren();
    };
  }

  if (section === 'background') {
    const backdrop = mountBackdropPanels();
    disposers.push(backdrop.dispose);
    disposers.push(mountLabSection(root, section, onNavigate, backdropNavItems().map((item) => ({
      id: item.id,
      label: item.label,
      group: 'background' as const,
      count: item.count,
    })), (id) => backdrop.panels[id as BackdropPanelId], initialPanelId));
    return () => {
      for (const dispose of disposers) dispose();
      root.replaceChildren();
    };
  }

  const audio = mountAudioPanels();
  disposers.push(audio.dispose);
  disposers.push(mountLabSection(root, section, onNavigate, audioNavItems().map((item) => ({
    id: item.id,
    label: item.label,
    group: 'audio' as const,
    count: item.count,
  })), (id) => audio.panels[id as AudioPanelId], initialPanelId));

  return () => {
    for (const dispose of disposers) dispose();
    root.replaceChildren();
  };
}
