import { computeGameStageLayout, getEndlessLayoutProfile } from '../ui/game-stage-layout.ts'
import {
  createLayoutEditorPaintContext,
  hitTestLayoutEditorWidget,
  type LayoutEditorPaintContext,
  paintLayoutEditorScene,
  resyncLayoutEditorViewport,
} from '../ui/layout-editor-paint.ts'
import {
  formatLayoutExport,
  layoutEditorStorageKey,
  loadLayoutOverrides,
  saveLayoutOverrides,
  UI_WIDGET_LABELS,
  UI_WIDGET_ORDER,
  type UiLayoutOverrides,
  type UiWidgetId,
  type UiWidgetTransform,
} from '../ui/ui-layout-overrides.ts'
import { mountAdminModuleShell } from './admin-module-shell.ts'
import { createPanelHead } from './asset-gallery/editor-shell.ts'
import { isLayoutEditorPanel, LAYOUT_EDITOR_DEFAULT_PANEL, type LayoutEditorPanelId, syncLayoutEditorPanelPath } from './routes.ts'

interface ViewportPreset {
  label: string
  w: number
  h: number
}

const VIEWPORT_PRESETS: ViewportPreset[] = [
  { label: 'Mobile 360×640', w: 360, h: 640 },
  { label: 'Mobile 390×844', w: 390, h: 844 },
  { label: 'Tablet 768×1024', w: 768, h: 1024 },
  { label: 'Desktop 1280×900', w: 1280, h: 900 },
]

interface EditorPanelHandle {
  panel: HTMLElement
  repaint: () => void
  dispose: () => void
}

function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function createEditorPanel(): EditorPanelHandle {
  let viewport = VIEWPORT_PRESETS[1]
  let profile = getEndlessLayoutProfile(viewport.w)
  let storageKey = layoutEditorStorageKey(profile, viewport.w, viewport.h)
  let overrides: UiLayoutOverrides = loadLayoutOverrides(storageKey)
  let selectedId: UiWidgetId | null = 'board'
  let dragging: { id: UiWidgetId; startX: number; startY: number; baseDx: number; baseDy: number } | null = null
  let paintContext: LayoutEditorPaintContext | null = null
  let lastLayout = computeGameStageLayout(viewport.w, viewport.h, 320, 480)

  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel layout-editor-panel'
  panel.append(createPanelHead('Interactive editor', 'Real HUD and board rendering (no FX layer). Drag or nudge with arrow keys, then copy the export.'))

  const workspace = document.createElement('div')
  workspace.className = 'layout-editor'

  const controls = document.createElement('div')
  controls.className = 'layout-editor__controls'

  const viewportSelect = document.createElement('select')
  viewportSelect.className = 'layout-editor__select'
  for (const preset of VIEWPORT_PRESETS) {
    const opt = document.createElement('option')
    opt.value = `${preset.w}x${preset.h}`
    opt.textContent = preset.label
    if (preset.w === viewport.w && preset.h === viewport.h) opt.selected = true
    viewportSelect.append(opt)
  }

  const resetBtn = document.createElement('button')
  resetBtn.type = 'button'
  resetBtn.className = 'layout-editor__btn'
  resetBtn.textContent = 'Reset offsets'

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'layout-editor__btn layout-editor__btn--primary'
  copyBtn.textContent = 'Copy export'

  const hint = document.createElement('p')
  hint.className = 'layout-editor__hint'
  hint.textContent = 'Click to select · drag to move · arrow keys ±1px · Shift+arrow ±10px'

  controls.append(viewportSelect, resetBtn, copyBtn, hint)

  const body = document.createElement('div')
  body.className = 'layout-editor__body'

  const canvasWrap = document.createElement('div')
  canvasWrap.className = 'layout-editor__canvas-wrap'
  const canvas = document.createElement('canvas')
  canvas.className = 'layout-editor__canvas'
  canvasWrap.append(canvas)

  const sidebar = document.createElement('aside')
  sidebar.className = 'layout-editor__sidebar'

  const widgetList = document.createElement('div')
  widgetList.className = 'layout-editor__widgets'

  for (const id of UI_WIDGET_ORDER) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'layout-editor__widget-btn'
    btn.dataset.widgetId = id
    btn.textContent = UI_WIDGET_LABELS[id]
    widgetList.append(btn)
  }

  const exportLabel = document.createElement('label')
  exportLabel.className = 'layout-editor__export-label'
  exportLabel.textContent = 'Export (for Agent)'

  const exportArea = document.createElement('textarea')
  exportArea.className = 'layout-editor__export'
  exportArea.readOnly = true
  exportArea.spellcheck = false

  sidebar.append(widgetList, exportLabel, exportArea)
  body.append(canvasWrap, sidebar)
  workspace.append(controls, body)
  panel.append(workspace)

  const paintCtx = canvas.getContext('2d')
  if (!paintCtx) {
    return {
      panel,
      repaint: () => {},
      dispose: () => {},
    }
  }
  const shellCtx = paintCtx

  paintContext = createLayoutEditorPaintContext(canvas, shellCtx, viewport.w, viewport.h)

  function syncWidgetButtons(): void {
    for (const btn of widgetList.querySelectorAll<HTMLButtonElement>('.layout-editor__widget-btn')) {
      const id = btn.dataset.widgetId as UiWidgetId
      btn.classList.toggle('layout-editor__widget-btn--active', id === selectedId)
      const t = overrides[id]
      const badge = t && (t.dx !== 0 || t.dy !== 0) ? ` (${t.dx}, ${t.dy})` : ''
      btn.textContent = `${UI_WIDGET_LABELS[id]}${badge}`
    }
  }

  function persist(): void {
    saveLayoutOverrides(storageKey, overrides)
  }

  function ensureOverride(id: UiWidgetId): UiWidgetTransform {
    overrides[id] ??= { dx: 0, dy: 0 }
    return overrides[id]!
  }

  function nudgeSelected(dx: number, dy: number): void {
    if (!selectedId) return
    const t = ensureOverride(selectedId)
    t.dx += dx
    t.dy += dy
    persist()
    repaint()
  }

  function repaint(): void {
    if (!paintContext) return

    const maxW = canvasWrap.clientWidth - 24
    const maxH = Math.max(320, canvasWrap.clientHeight - 24)
    const fit = Math.min(1, maxW / viewport.w, maxH / viewport.h)
    const displayW = Math.round(viewport.w * fit)
    const displayH = Math.round(viewport.h * fit)
    fitCanvas(canvas, shellCtx, displayW, displayH)

    shellCtx.save()
    shellCtx.scale(fit, fit)
    const base = computeGameStageLayout(viewport.w, viewport.h, paintContext.rt.state.boardWidth, paintContext.rt.state.boardHeight)
    lastLayout = paintLayoutEditorScene(paintContext, shellCtx, viewport.w, viewport.h, overrides, selectedId)
    shellCtx.restore()

    exportArea.value = formatLayoutExport({
      profile,
      viewportW: viewport.w,
      viewportH: viewport.h,
      overrides,
      baseLayout: base,
      finalLayout: lastLayout,
    })
    syncWidgetButtons()
  }

  function canvasPoint(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect()
    const fit = Math.min(rect.width / viewport.w, rect.height / viewport.h)
    return {
      x: (event.clientX - rect.left) / fit,
      y: (event.clientY - rect.top) / fit,
    }
  }

  const onViewportChange = (): void => {
    const [w, h] = viewportSelect.value.split('x').map(Number)
    viewport = VIEWPORT_PRESETS.find((p) => p.w === w && p.h === h) ?? viewport
    profile = getEndlessLayoutProfile(viewport.w)
    storageKey = layoutEditorStorageKey(profile, viewport.w, viewport.h)
    overrides = loadLayoutOverrides(storageKey)
    if (paintContext) resyncLayoutEditorViewport(paintContext, viewport.w, viewport.h)
    repaint()
  }

  const onReset = (): void => {
    overrides = {}
    persist()
    repaint()
  }

  const onCopy = (): void => {
    void navigator.clipboard.writeText(exportArea.value)
    copyBtn.textContent = 'Copied'
    window.setTimeout(() => {
      copyBtn.textContent = 'Copy export'
    }, 1200)
  }

  const onWidgetClick = (event: Event): void => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.layout-editor__widget-btn')
    if (!btn?.dataset.widgetId) return
    selectedId = btn.dataset.widgetId as UiWidgetId
    repaint()
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (!paintContext) return
    const p = canvasPoint(event)
    const hit = hitTestLayoutEditorWidget(paintContext, lastLayout, p.x, p.y)
    if (!hit) return
    selectedId = hit
    const t = ensureOverride(hit)
    dragging = { id: hit, startX: p.x, startY: p.y, baseDx: t.dx, baseDy: t.dy }
    canvas.setPointerCapture(event.pointerId)
    repaint()
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    const p = canvasPoint(event)
    const t = ensureOverride(dragging.id)
    t.dx = dragging.baseDx + Math.round(p.x - dragging.startX)
    t.dy = dragging.baseDy + Math.round(p.y - dragging.startY)
    persist()
    repaint()
  }

  const onPointerUp = (): void => {
    dragging = null
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
    const step = event.shiftKey ? 10 : 1
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      nudgeSelected(-step, 0)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      nudgeSelected(step, 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      nudgeSelected(0, -step)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      nudgeSelected(0, step)
    }
  }

  viewportSelect.addEventListener('change', onViewportChange)
  resetBtn.addEventListener('click', onReset)
  copyBtn.addEventListener('click', onCopy)
  widgetList.addEventListener('click', onWidgetClick)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  window.addEventListener('keydown', onKeyDown)

  const resizeObserver = new ResizeObserver(() => repaint())
  resizeObserver.observe(canvasWrap)
  repaint()

  return {
    panel,
    repaint,
    dispose: () => {
      resizeObserver.disconnect()
      viewportSelect.removeEventListener('change', onViewportChange)
      resetBtn.removeEventListener('click', onReset)
      copyBtn.removeEventListener('click', onCopy)
      widgetList.removeEventListener('click', onWidgetClick)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}

function createWorkflowPanel(): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel'
  panel.append(createPanelHead('Hard-code workflow', 'How to tune layout once and ship constants to game-stage-layout.ts.'))

  const body = document.createElement('div')
  body.className = 'asset-lab__field-hint'
  body.style.padding = '0 2px'
  body.innerHTML = `
    <ol class="responsive-matrix__checklist">
      <li>Open <strong>Interactive editor</strong> and pick the target viewport (mobile + desktop).</li>
      <li>Drag widgets or use arrow keys. Offsets persist in localStorage per viewport.</li>
      <li>Click <strong>Copy export</strong> and paste the <em>For Agent</em> block into chat.</li>
      <li>Ask Agent to hard-code the suggested constants in <code>game-stage-layout.ts</code>.</li>
      <li>Reset offsets in the editor and repeat for the next viewport/profile.</li>
      <li>Verify in-game at <code>/play</code> — editor skips FX layers; compare HUD anchors only.</li>
    </ol>
  `
  panel.append(body)
  return panel
}

export function mountLayoutEditor(root: HTMLElement, initialPanelId: string | null, onNavigate: (path: string) => void): () => void {
  root.className = 'app app--admin'
  root.replaceChildren()

  const editor = createEditorPanel()
  const panels = new Map<string, HTMLElement>([
    ['editor', editor.panel],
    ['workflow', createWorkflowPanel()],
  ])

  const resolvedPanelId: LayoutEditorPanelId = initialPanelId && isLayoutEditorPanel(initialPanelId) ? initialPanelId : LAYOUT_EDITOR_DEFAULT_PANEL

  const disposeShell = mountAdminModuleShell(root, {
    activeModule: 'layout-editor',
    onNavigate,
    eyebrow: 'Layout',
    title: 'UI layout editor',
    description: 'Tune endless-mode HUD and board anchors, then export offsets for Agent.',
    navItems: [
      {
        id: 'editor',
        label: 'Interactive editor',
        count: UI_WIDGET_ORDER.length,
      },
      {
        id: 'workflow',
        label: 'Hard-code workflow',
        count: 6,
      },
    ],
    panels,
    initialPanelId: resolvedPanelId,
    subnavLabel: 'Views',
    onPanelSelect: (id) => {
      if (isLayoutEditorPanel(id)) syncLayoutEditorPanelPath(id)
      if (id === 'editor') editor.repaint()
    },
  })

  syncLayoutEditorPanelPath(resolvedPanelId, 'replace')

  return () => {
    editor.dispose()
    disposeShell()
  }
}
