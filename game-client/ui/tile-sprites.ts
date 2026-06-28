import { getCachedImage } from './boot/asset-cache.ts'
import { TILE_SPRITE_URLS } from './boot/asset-registry.ts'

export interface TileSprites {
  hidden: HTMLImageElement
  revealed: HTMLImageElement
  hover: HTMLImageElement
  pressed: HTMLImageElement
  safe: HTMLImageElement
  mine: HTMLImageElement
  flag: HTMLImageElement
  numbers: HTMLImageElement[]
}

let cached: TileSprites | null = null

function imageOrNull(url: string): HTMLImageElement | null {
  return getCachedImage(url) ?? null
}

function buildTileSpritesFromCache(): TileSprites | null {
  const hidden = imageOrNull(TILE_SPRITE_URLS.hidden)
  const revealed = imageOrNull(TILE_SPRITE_URLS.revealed)
  const hover = imageOrNull(TILE_SPRITE_URLS.hover)
  const pressed = imageOrNull(TILE_SPRITE_URLS.pressed)
  const safe = imageOrNull(TILE_SPRITE_URLS.safe)
  const mine = imageOrNull(TILE_SPRITE_URLS.mine)
  const flag = imageOrNull(TILE_SPRITE_URLS.flag)
  const numbers = TILE_SPRITE_URLS.numbers.map((url) => imageOrNull(url))

  if (!hidden || !revealed || !hover || !pressed || !safe || !mine || !flag || numbers.some((img) => !img)) {
    return null
  }

  return {
    hidden,
    revealed,
    hover,
    pressed,
    safe,
    mine,
    flag,
    numbers: numbers as HTMLImageElement[],
  }
}

export function loadTileSprites(): Promise<TileSprites | null> {
  if (cached) return Promise.resolve(cached)
  cached = buildTileSpritesFromCache()
  return Promise.resolve(cached)
}

export function getTileSprites(): TileSprites | null {
  return cached
}

export function drawSpriteInCell(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, cellSize: number): void {
  const prevSmooth = ctx.imageSmoothingEnabled
  const prevQuality = ctx.imageSmoothingQuality
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const ix = Math.round(x)
  const iy = Math.round(y)
  const size = Math.round(cellSize)
  ctx.drawImage(img, ix, iy, size, size)
  ctx.imageSmoothingEnabled = prevSmooth
  ctx.imageSmoothingQuality = prevQuality
}

/** cell-hidden.png is a frame — center is transparent; fill before drawing the sprite. */
const HIDDEN_CELL_UNDERLAY = '#121f35'

function hiddenCellCornerRadius(cellSize: number): number {
  return Math.max(4, cellSize * 0.08)
}

function hiddenCellUnderlayPath(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number): void {
  const r = hiddenCellCornerRadius(cellSize)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + cellSize, y, x + cellSize, y + cellSize, r)
  ctx.arcTo(x + cellSize, y + cellSize, x, y + cellSize, r)
  ctx.arcTo(x, y + cellSize, x, y, r)
  ctx.arcTo(x, y, x + cellSize, y, r)
  ctx.closePath()
}

export function drawHiddenCellUnderlay(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number): void {
  ctx.save()
  hiddenCellUnderlayPath(ctx, x, y, cellSize)
  ctx.fillStyle = HIDDEN_CELL_UNDERLAY
  ctx.fill()
  ctx.restore()
}

export function drawHiddenCellSprite(ctx: CanvasRenderingContext2D, sprites: TileSprites, x: number, y: number, cellSize: number): void {
  drawHiddenCellUnderlay(ctx, x, y, cellSize)
  drawSpriteInCell(ctx, sprites.hidden, x, y, cellSize)
}
