import { getTileSprites } from '../../ui/tile-sprites.ts'
import { createPreviewExpandButton, itemFromCanvas } from './asset-lightbox.ts'
import { createEffectFrameGrid } from './cell-effect-frame-grid.ts'
import { createAnimPreview } from './cell-effect-live-previews.ts'
import { EFFECT_SPECS, type EffectCardSpec, type EffectPanelId } from './cell-effect-panels.ts'
import { createFpsControl, createPanelHead } from './editor-shell.ts'

export type { EffectPanelId } from './cell-effect-panels.ts'

const INTERACTIVE_HINTS: Partial<Record<EffectPanelId, string>> = {
  mine: 'Click the preview to play the blast sequence. Use ⊕ to enlarge.',
  'heart-refill-v3': 'Click the preview to play refill; it holds on the full heart. Use ⊕ to enlarge.',
  'heart-loss-v3': 'Click the preview to toggle full / empty heart states. Use ⊕ to enlarge.',
  'start-panel-v3': 'Click the preview to play the button press feedback. Use ⊕ to enlarge.',
  'game-over-panel-v3': 'Click the preview to play the button press feedback. Use ⊕ to enlarge.',
}

function createEffectPanel(spec: EffectCardSpec): { panel: HTMLElement; dispose: () => void } | null {
  const sprites = getTileSprites()
  if (!sprites) return null

  let fps = spec.defaultFps
  const getFps = (): number => fps

  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel'
  panel.dataset.panelId = spec.id
  panel.append(createPanelHead(spec.title, spec.description))

  const workspace = document.createElement('div')
  workspace.className = 'asset-lab__anim-workspace'

  const previewWrap = document.createElement('div')
  previewWrap.className = 'asset-lab__anim-preview asset-lab__checker'
  const preview = createAnimPreview(spec.id, sprites, getFps, spec.defaultFps)
  if (preview) {
    previewWrap.append(preview.canvas)
    previewWrap.append(createPreviewExpandButton(() => itemFromCanvas(preview.canvas, spec.title, `${spec.frameCount} frames`)))
  }

  const controls = document.createElement('div')
  controls.className = 'asset-lab__anim-controls'

  const meta = document.createElement('dl')
  meta.className = 'asset-lab__meta-list'
  meta.innerHTML = `
    <div><dt>Cycle</dt><dd>${spec.cycleMs} ms</dd></div>
    <div><dt>Frames</dt><dd>${spec.frameCount}</dd></div>
    <div><dt>Loop</dt><dd>${spec.loop ? 'yes' : 'one-shot'}</dd></div>
  `

  controls.append(meta)

  if (spec.loop) {
    controls.append(
      createFpsControl(spec.defaultFps, (next) => {
        fps = next
      })
    )
  }

  if (spec.interactive) {
    const hint = document.createElement('p')
    hint.className = 'asset-lab__field-hint'
    hint.textContent = INTERACTIVE_HINTS[spec.id] ?? 'Hover and click the preview to test states. Click keyframes to enlarge.'
    controls.append(hint)
  }

  workspace.append(previewWrap, controls)

  const framesSection = document.createElement('div')
  framesSection.className = 'asset-lab__frames-section'

  const framesHeader = document.createElement('div')
  framesHeader.className = 'asset-lab__frames-header'
  framesHeader.innerHTML = `<span>Keyframes</span><small>${spec.frameCount} samples · click to enlarge</small>`

  framesSection.append(framesHeader, createEffectFrameGrid(spec.id, sprites))
  panel.append(workspace, framesSection)

  return {
    panel,
    dispose: () => preview?.dispose(),
  }
}

export interface EffectPanelRegistry {
  getPanel: (id: EffectPanelId) => HTMLElement | undefined
  hidePanel: (id: EffectPanelId) => void
  dispose: () => void
}

export function mountEffectPanels(): EffectPanelRegistry {
  const cache = new Map<EffectPanelId, { panel: HTMLElement; dispose: () => void }>()

  const hidePanel = (id: EffectPanelId): void => {
    const entry = cache.get(id)
    if (!entry) return
    entry.dispose()
    cache.delete(id)
  }

  return {
    getPanel(id) {
      const cached = cache.get(id)
      if (cached) return cached.panel

      const spec = EFFECT_SPECS.find((item) => item.id === id)
      if (!spec) return undefined

      const built = createEffectPanel(spec)
      if (!built) return undefined

      cache.set(id, built)
      return built.panel
    },
    hidePanel,
    dispose() {
      for (const id of [...cache.keys()]) hidePanel(id)
    },
  }
}
