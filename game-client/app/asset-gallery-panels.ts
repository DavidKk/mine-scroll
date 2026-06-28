import { getTileSprites } from '../ui/tile-sprites.ts'
import { wireAssetFrameGrid } from './asset-gallery/asset-lightbox.ts'
import { createPanelHead } from './asset-gallery/editor-shell.ts'
import { type AssetSection, RUNTIME_BOARD_TILE_BASE, type StaticPreviewSection, TILE_BASE } from './asset-gallery-data.ts'

export function buildSpriteSections(): AssetSection[] {
  const sprites = getTileSprites()
  if (!sprites) {
    return []
  }

  const cellItems = [
    { id: 'cell-hidden', label: 'Hidden', src: `${RUNTIME_BOARD_TILE_BASE}/cell-hidden.png`, image: sprites.hidden },
    { id: 'cell-revealed', label: 'Revealed', src: `${RUNTIME_BOARD_TILE_BASE}/cell-revealed.png`, image: sprites.revealed },
    { id: 'cell-hover', label: 'Hover', src: `${RUNTIME_BOARD_TILE_BASE}/cell-hover.png`, image: sprites.hover },
    { id: 'cell-pressed', label: 'Pressed', src: `${RUNTIME_BOARD_TILE_BASE}/cell-pressed.png`, image: sprites.pressed },
    { id: 'cell-safe', label: 'Safe', src: `${RUNTIME_BOARD_TILE_BASE}/cell-safe.png`, image: sprites.safe },
  ]

  const digitItems = sprites.numbers.map((image, index) => ({
    id: `num-${index + 1}`,
    label: `Digit ${index + 1}`,
    src: `${RUNTIME_BOARD_TILE_BASE}/num-${index + 1}.png`,
    image,
  }))

  return [
    {
      id: 'cells',
      title: 'Cell tiles',
      description: '',
      items: cellItems,
    },
    {
      id: 'digits',
      title: 'Digit glyphs',
      description: '',
      items: digitItems,
    },
    {
      id: 'icons',
      title: 'Icons',
      description: '',
      items: [
        { id: 'mine', label: 'Mine', src: `${TILE_BASE}/mine.png`, image: sprites.mine },
        { id: 'flag', label: 'Flag', src: `${TILE_BASE}/flag.png`, image: sprites.flag },
      ],
    },
  ]
}

export function createStaticPreviewPanel(section: StaticPreviewSection): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel'
  panel.dataset.panelId = section.id
  panel.append(createPanelHead(section.title, section.description))

  const grid = document.createElement('div')
  grid.className = 'asset-lab__frame-grid asset-lab__frame-grid--wide'

  for (const item of section.items) {
    const cell = document.createElement('article')
    cell.className = 'asset-lab__frame-cell asset-lab__frame-cell--static asset-lab__frame-cell--zoomable'
    cell.title = item.src

    const thumb = document.createElement('div')
    const bgClass = item.background === 'black' ? ' asset-lab__thumb--black' : item.background === 'dark' ? ' asset-lab__thumb--dark' : ' asset-lab__checker'
    thumb.className = `asset-lab__frame-thumb asset-lab__frame-thumb--zoomable${bgClass}`

    const img = document.createElement('img')
    img.src = item.src
    img.alt = item.label
    img.loading = 'lazy'
    img.className = 'asset-lab__sprite-img'
    thumb.append(img)

    const meta = document.createElement('div')
    meta.className = 'asset-lab__frame-meta'
    const name = document.createElement('strong')
    name.textContent = item.label
    meta.append(name)
    if (item.note) {
      const note = document.createElement('span')
      note.textContent = item.note
      meta.append(note)
    }

    cell.append(thumb, meta)
    grid.append(cell)
  }

  wireAssetFrameGrid(grid)
  panel.append(grid)
  return panel
}

function getContentBBox(image: HTMLImageElement): { w: number; h: number } | null {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null

  ctx.drawImage(image, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let x0 = width
  let y0 = height
  let x1 = 0
  let y1 = 0
  let found = false

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        found = true
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x + 1)
        y1 = Math.max(y1, y + 1)
      }
    }
  }

  if (!found) return null
  return { w: x1 - x0, h: y1 - y0 }
}

export function createSpritePanel(section: AssetSection): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel'
  panel.dataset.panelId = section.id
  panel.append(createPanelHead(section.title, section.description))

  const grid = document.createElement('div')
  grid.className = 'asset-lab__frame-grid'

  section.items.forEach((item, index) => {
    const cell = document.createElement('article')
    cell.className = 'asset-lab__frame-cell asset-lab__frame-cell--static asset-lab__frame-cell--zoomable'
    cell.title = item.src

    const thumb = document.createElement('div')
    thumb.className = 'asset-lab__frame-thumb asset-lab__frame-thumb--zoomable asset-lab__checker'

    const img = document.createElement('img')
    img.src = item.src
    img.alt = item.label
    img.width = item.image.naturalWidth
    img.height = item.image.naturalHeight
    img.className = 'asset-lab__sprite-img'
    thumb.append(img)

    const num = document.createElement('span')
    num.className = 'asset-lab__frame-num'
    num.textContent = String(index + 1).padStart(2, '0')
    thumb.append(num)

    const meta = document.createElement('div')
    meta.className = 'asset-lab__frame-meta'

    const name = document.createElement('strong')
    name.textContent = item.label

    const bb = getContentBBox(item.image)
    const dims = document.createElement('span')
    dims.textContent = bb ? `${item.image.naturalWidth}×${item.image.naturalHeight} · content ${bb.w}×${bb.h}` : `${item.image.naturalWidth}×${item.image.naturalHeight}`

    meta.append(name, dims)
    cell.append(thumb, meta)
    grid.append(cell)
  })

  wireAssetFrameGrid(grid)
  panel.append(grid)
  return panel
}
