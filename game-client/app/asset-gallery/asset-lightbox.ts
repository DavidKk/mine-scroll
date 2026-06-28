export type AssetLightboxRender = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

export interface AssetLightboxItem {
  label: string
  subtitle?: string
  kind: 'image' | 'canvas' | 'render'
  src?: string
  sourceCanvas?: HTMLCanvasElement
  render?: AssetLightboxRender
  nativeWidth: number
  nativeHeight: number
  pixelArt?: boolean
  checker?: boolean
}

export interface AssetLightboxOpenOptions {
  items: AssetLightboxItem[]
  index?: number
}

const canvasRenderers = new WeakMap<HTMLCanvasElement, { draw: AssetLightboxRender; w: number; h: number; label: string; pixelArt?: boolean; checker?: boolean }>()

let overlay: HTMLElement | null = null
let activeGroup: AssetLightboxItem[] = []
let activeIndex = 0
let keyHandler: ((event: KeyboardEvent) => void) | null = null

function computeZoomSize(nativeW: number, nativeH: number): { w: number; h: number; scale: number } {
  const maxW = Math.min(window.innerWidth * 0.92, 1280)
  const maxH = Math.min(window.innerHeight * 0.78, 960)
  const scale = Math.min(maxW / nativeW, maxH / nativeH, 8)
  const clamped = Math.max(scale, nativeW < 160 && nativeH < 160 ? 3 : 1.5)
  return {
    w: Math.max(1, Math.round(nativeW * clamped)),
    h: Math.max(1, Math.round(nativeH * clamped)),
    scale: clamped,
  }
}

function paintChecker(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const tile = 16
  ctx.fillStyle = '#1a1d26'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#232732'
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) continue
      ctx.fillRect(x, y, tile, tile)
    }
  }
}

function renderLightboxStage(stage: HTMLElement, item: AssetLightboxItem): void {
  stage.replaceChildren()
  const { w, h } = computeZoomSize(item.nativeWidth, item.nativeHeight)

  if (item.kind === 'image' && item.src) {
    const wrap = document.createElement('div')
    wrap.className = `asset-lightbox__media${item.checker ? ' asset-lightbox__media--checker' : ''}`

    const img = document.createElement('img')
    img.className = 'asset-lightbox__image'
    img.src = item.src
    img.alt = item.label
    img.width = w
    img.height = h
    if (item.pixelArt) img.classList.add('asset-lightbox__image--pixel')
    wrap.append(img)
    stage.append(wrap)
    return
  }

  const canvas = document.createElement('canvas')
  canvas.className = 'asset-lightbox__canvas'
  canvas.width = w
  canvas.height = h
  if (item.pixelArt) canvas.classList.add('asset-lightbox__canvas--pixel')

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (item.checker) paintChecker(ctx, w, h)

  if (item.kind === 'render' && item.render) {
    ctx.save()
    ctx.scale(w / item.nativeWidth, h / item.nativeHeight)
    item.render(ctx, item.nativeWidth, item.nativeHeight)
    ctx.restore()
  } else if (item.sourceCanvas) {
    ctx.imageSmoothingEnabled = !item.pixelArt
    ctx.drawImage(item.sourceCanvas, 0, 0, w, h)
  }

  const wrap = document.createElement('div')
  wrap.className = `asset-lightbox__media${item.checker ? ' asset-lightbox__media--checker' : ''}`
  wrap.append(canvas)
  stage.append(wrap)
}

function updateLightboxMeta(meta: HTMLElement, item: AssetLightboxItem, index: number, total: number): void {
  meta.replaceChildren()
  const title = document.createElement('strong')
  title.textContent = item.label
  const detail = document.createElement('span')
  const parts = [`${item.nativeWidth}×${item.nativeHeight}`]
  if (item.subtitle) parts.push(item.subtitle)
  if (total > 1) parts.push(`${index + 1} / ${total}`)
  detail.textContent = parts.join(' · ')
  meta.append(title, detail)
}

function setLightboxIndex(index: number): void {
  if (!overlay || activeGroup.length === 0) return
  activeIndex = (index + activeGroup.length) % activeGroup.length
  const item = activeGroup[activeIndex]!
  const stage = overlay.querySelector('.asset-lightbox__stage') as HTMLElement
  const meta = overlay.querySelector('.asset-lightbox__meta') as HTMLElement
  const prev = overlay.querySelector('.asset-lightbox__nav--prev') as HTMLButtonElement
  const next = overlay.querySelector('.asset-lightbox__nav--next') as HTMLButtonElement
  renderLightboxStage(stage, item)
  updateLightboxMeta(meta, item, activeIndex, activeGroup.length)
  prev.hidden = activeGroup.length <= 1
  next.hidden = activeGroup.length <= 1
  overlay.dataset.activeIndex = String(activeIndex)
}

function ensureOverlay(): HTMLElement {
  if (overlay) return overlay

  overlay = document.createElement('div')
  overlay.className = 'asset-lightbox'
  overlay.hidden = true
  overlay.innerHTML = `
    <div class="asset-lightbox__backdrop" data-close="true"></div>
    <div class="asset-lightbox__dialog" role="dialog" aria-modal="true" aria-label="Asset preview">
      <button type="button" class="asset-lightbox__close" aria-label="Close preview">×</button>
      <button type="button" class="asset-lightbox__nav asset-lightbox__nav--prev" aria-label="Previous frame">‹</button>
      <button type="button" class="asset-lightbox__nav asset-lightbox__nav--next" aria-label="Next frame">›</button>
      <div class="asset-lightbox__stage"></div>
      <div class="asset-lightbox__meta"></div>
      <p class="asset-lightbox__hint">Esc close · ← → navigate · click backdrop to dismiss</p>
    </div>
  `

  overlay.querySelector('.asset-lightbox__close')?.addEventListener('click', () => closeAssetLightbox())
  overlay.querySelector('.asset-lightbox__backdrop')?.addEventListener('click', () => closeAssetLightbox())
  overlay.querySelector('.asset-lightbox__nav--prev')?.addEventListener('click', () => setLightboxIndex(activeIndex - 1))
  overlay.querySelector('.asset-lightbox__nav--next')?.addEventListener('click', () => setLightboxIndex(activeIndex + 1))

  document.body.append(overlay)
  return overlay
}

export function openAssetLightbox(options: AssetLightboxOpenOptions): void {
  if (options.items.length === 0) return

  const shell = ensureOverlay()
  activeGroup = options.items
  activeIndex = Math.min(Math.max(options.index ?? 0, 0), options.items.length - 1)

  shell.hidden = false
  document.body.classList.add('asset-lightbox-open')
  setLightboxIndex(activeIndex)

  if (keyHandler) window.removeEventListener('keydown', keyHandler)
  keyHandler = (event: KeyboardEvent) => {
    if (shell.hidden) return
    const target = event.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeAssetLightbox()
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setLightboxIndex(activeIndex - 1)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setLightboxIndex(activeIndex + 1)
    }
  }
  window.addEventListener('keydown', keyHandler)
}

export function closeAssetLightbox(): void {
  if (!overlay) return
  overlay.hidden = true
  document.body.classList.remove('asset-lightbox-open')
  activeGroup = []
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler)
    keyHandler = null
  }
}

export function registerZoomableCanvas(
  canvas: HTMLCanvasElement,
  draw: AssetLightboxRender,
  options: { w: number; h: number; label: string; pixelArt?: boolean; checker?: boolean }
): void {
  canvasRenderers.set(canvas, { draw, ...options })
}

export function itemFromImage(img: HTMLImageElement, label: string, subtitle?: string): AssetLightboxItem {
  const nativeWidth = img.naturalWidth || img.width || img.clientWidth || 1
  const nativeHeight = img.naturalHeight || img.height || img.clientHeight || 1
  return {
    label,
    subtitle,
    kind: 'image',
    src: img.currentSrc || img.src,
    nativeWidth,
    nativeHeight,
    pixelArt: true,
    checker: img.closest('.asset-lab__checker') !== null,
  }
}

export function itemFromCanvas(canvas: HTMLCanvasElement, label: string, subtitle?: string): AssetLightboxItem | null {
  const registered = canvasRenderers.get(canvas)
  if (registered) {
    return {
      label: registered.label,
      subtitle,
      kind: 'render',
      render: registered.draw,
      nativeWidth: registered.w,
      nativeHeight: registered.h,
      pixelArt: registered.pixelArt ?? true,
      checker: registered.checker ?? true,
    }
  }

  if (canvas.width === 0 || canvas.height === 0) return null
  return {
    label,
    subtitle,
    kind: 'canvas',
    sourceCanvas: canvas,
    nativeWidth: canvas.width,
    nativeHeight: canvas.height,
    pixelArt: canvas.classList.contains('asset-lab__frame-canvas') || canvas.classList.contains('asset-lab__preview-canvas'),
    checker: canvas.closest('.asset-lab__checker') !== null,
  }
}

function collectGridItems(grid: HTMLElement): AssetLightboxItem[] {
  const items: AssetLightboxItem[] = []
  for (const cell of grid.querySelectorAll<HTMLElement>('.asset-lab__frame-cell')) {
    const label = cell.querySelector('.asset-lab__frame-caption')?.textContent?.trim() || cell.querySelector('.asset-lab__frame-meta strong')?.textContent?.trim() || 'Asset'
    const subtitle = cell.querySelector('.asset-lab__frame-meta span')?.textContent?.trim() || undefined
    const img = cell.querySelector('img.asset-lab__sprite-img')
    if (img instanceof HTMLImageElement && img.src) {
      items.push(itemFromImage(img, label, subtitle))
      continue
    }
    const canvas = cell.querySelector('canvas')
    if (canvas instanceof HTMLCanvasElement) {
      const item = itemFromCanvas(canvas, label, subtitle)
      if (item) items.push(item)
    }
  }
  return items
}

function bindZoomTarget(target: HTMLElement, items: AssetLightboxItem[], index: number): void {
  target.classList.add('asset-lab__zoom-target')
  target.setAttribute('role', 'button')
  target.setAttribute('tabindex', '0')
  target.setAttribute('aria-label', `Enlarge ${items[index]?.label ?? 'asset'}`)
  target.title = 'Click to enlarge'

  const open = (): void => {
    if (items.length === 0) return
    openAssetLightbox({ items, index })
  }

  target.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    open()
  })
  target.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    open()
  })
}

export function wireAssetFrameGrid(grid: HTMLElement): void {
  const items = collectGridItems(grid)
  if (items.length === 0) return

  const cells = [...grid.querySelectorAll<HTMLElement>('.asset-lab__frame-cell')]
  cells.forEach((cell, index) => {
    cell.classList.add('asset-lab__frame-cell--zoomable')
    const thumb = cell.querySelector<HTMLElement>('.asset-lab__frame-thumb')
    bindZoomTarget(thumb ?? cell, items, index)
  })
}

export function wireAssetImage(img: HTMLImageElement, label: string, subtitle?: string, group?: { items: AssetLightboxItem[]; index: number }): void {
  const item = itemFromImage(img, label, subtitle)
  const items = group?.items ?? [item]
  const index = group?.index ?? 0
  const thumb = img.closest<HTMLElement>('.asset-lab__frame-thumb') ?? img
  bindZoomTarget(thumb, items, index)
}

export function createPreviewExpandButton(getItem: () => AssetLightboxItem | null): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'asset-lab__preview-expand'
  button.setAttribute('aria-label', 'Enlarge preview')
  button.title = 'Enlarge preview'
  button.textContent = '⊕'
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const item = getItem()
    if (item) openAssetLightbox({ items: [item], index: 0 })
  })
  return button
}
