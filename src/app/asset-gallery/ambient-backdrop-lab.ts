import type { GameStatus } from '../../core/types.ts';
import {
  BACKDROP_LAB_PRESETS,
  drawAmbientBackdrop,
  type BackdropLabPreset,
  type BackdropMood,
} from '../../ui/ambient-backdrop.ts';
import { createFpsControl, createPanelHead } from './editor-shell.ts';

export type BackdropPanelId = (typeof BACKDROP_LAB_PRESETS)[number]['id'];

interface LivePreview {
  canvas: HTMLCanvasElement;
  dispose: () => void;
}

const PREVIEW_W = 390;
const PREVIEW_H = 693;
const TIER_PREVIEW_W = 176;
const TIER_PREVIEW_H = 312;

function paintBackdropFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nowMs: number,
  mood: BackdropMood,
  status: GameStatus,
): void {
  ctx.clearRect(0, 0, w, h);
  drawAmbientBackdrop(ctx, {
    shellW: w,
    shellH: h,
    nowMs,
    status,
    mood,
  });
}

function initCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function startLoop(_canvas: HTMLCanvasElement, tick: () => void): () => void {
  let raf = 0;
  const frame = (): void => {
    tick();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

function createBackdropPreview(
  preset: BackdropLabPreset,
  getFps: () => number,
  width: number,
  height: number,
  className: string,
): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  const ctx = initCanvas(canvas, width, height);
  if (!ctx) return null;

  const baseFps = 40;
  let lastAt = performance.now();

  const stop = startLoop(canvas, () => {
    const now = performance.now();
    const fps = getFps();
    const scale = fps / baseFps;
    lastAt += (now - lastAt) * Math.min(1, scale * 0.35);
    paintBackdropFrame(ctx, width, height, lastAt, preset.mood, preset.status);
  });

  return { canvas, dispose: stop };
}

function createMoodMeta(preset: BackdropLabPreset): HTMLElement {
  const meta = document.createElement('dl');
  meta.className = 'asset-lab__meta-list';
  const { mood } = preset;
  meta.innerHTML = `
    <div><dt>Heat</dt><dd>${mood.heat.toFixed(2)}</dd></div>
    <div><dt>Energy</dt><dd>${mood.energy.toFixed(2)}</dd></div>
    <div><dt>Intensity</dt><dd>${mood.intensity.toFixed(2)}</dd></div>
    <div><dt>Status</dt><dd>${preset.status}</dd></div>
  `;
  return meta;
}

function createSinglePresetPanel(preset: BackdropLabPreset): { panel: HTMLElement; dispose: () => void } {
  let fps = 40;
  const getFps = (): number => fps;

  const panel = document.createElement('section');
  panel.className = 'asset-lab__panel';
  panel.dataset.panelId = preset.id;
  panel.append(createPanelHead(preset.label, preset.description));

  const workspace = document.createElement('div');
  workspace.className = 'asset-lab__backdrop-workspace';

  const previewWrap = document.createElement('div');
  previewWrap.className = 'asset-lab__backdrop-preview';
  const preview = createBackdropPreview(
    preset,
    getFps,
    PREVIEW_W,
    PREVIEW_H,
    'asset-lab__preview-canvas asset-lab__preview-canvas--backdrop',
  );
  if (preview) previewWrap.append(preview.canvas);

  const controls = document.createElement('div');
  controls.className = 'asset-lab__anim-controls';
  controls.append(createMoodMeta(preset));
  controls.append(createFpsControl(40, (next) => {
    fps = next;
  }, 40));

  const hint = document.createElement('p');
  hint.className = 'asset-lab__field-hint';
  hint.textContent =
    'Layered star bloom + faint shmup vignette; dim stars stay lightweight.';
  controls.append(hint);

  workspace.append(previewWrap, controls);
  panel.append(workspace);

  return {
    panel,
    dispose: () => preview?.dispose(),
  };
}

function createComparePanel(): { panel: HTMLElement; dispose: () => void } {
  const preset = BACKDROP_LAB_PRESETS[0]!;
  const tierPresets = BACKDROP_LAB_PRESETS.filter((p) => p.id !== 'compare');

  const panel = document.createElement('section');
  panel.className = 'asset-lab__panel';
  panel.dataset.panelId = preset.id;
  panel.append(createPanelHead(preset.label, preset.description));

  const grid = document.createElement('div');
  grid.className = 'asset-lab__backdrop-tier-grid';

  const disposers: Array<() => void> = [];
  let fps = 40;
  const getFps = (): number => fps;

  for (const tier of tierPresets) {
    const cell = document.createElement('article');
    cell.className = 'asset-lab__backdrop-tier-cell';

    const label = document.createElement('strong');
    label.textContent = tier.label;

    const previewWrap = document.createElement('div');
    previewWrap.className = 'asset-lab__backdrop-tier-preview';
    const preview = createBackdropPreview(
      tier,
      getFps,
      TIER_PREVIEW_W,
      TIER_PREVIEW_H,
      'asset-lab__preview-canvas asset-lab__preview-canvas--backdrop-tier',
    );
    if (preview) {
      previewWrap.append(preview.canvas);
      disposers.push(preview.dispose);
    }

    const dims = document.createElement('span');
    dims.className = 'asset-lab__backdrop-tier-meta';
    dims.textContent = `heat ${tier.mood.heat.toFixed(2)} · intensity ${tier.mood.intensity.toFixed(2)}`;

    cell.append(label, previewWrap, dims);
    grid.append(cell);
  }

  const controls = document.createElement('div');
  controls.className = 'asset-lab__backdrop-compare-controls';
  controls.append(createFpsControl(40, (next) => {
    fps = next;
  }, 40));

  panel.append(grid, controls);

  return {
    panel,
    dispose: () => {
      for (const dispose of disposers) dispose();
    },
  };
}

export function mountBackdropPanels(): {
  panels: Partial<Record<BackdropPanelId, HTMLElement>>;
  dispose: () => void;
} {
  const panels: Partial<Record<BackdropPanelId, HTMLElement>> = {};
  const disposers: Array<() => void> = [];

  const compare = createComparePanel();
  panels.compare = compare.panel;
  disposers.push(compare.dispose);

  for (const preset of BACKDROP_LAB_PRESETS) {
    if (preset.id === 'compare') continue;
    const built = createSinglePresetPanel(preset);
    panels[preset.id as BackdropPanelId] = built.panel;
    disposers.push(built.dispose);
  }

  return {
    panels,
    dispose: () => {
      for (const dispose of disposers) dispose();
    },
  };
}

export function backdropNavItems(): Array<{ id: BackdropPanelId; label: string; count?: number }> {
  return BACKDROP_LAB_PRESETS.map((p) => ({
    id: p.id as BackdropPanelId,
    label: p.label,
    count: p.id === 'compare' ? BACKDROP_LAB_PRESETS.length - 1 : undefined,
  }));
}
