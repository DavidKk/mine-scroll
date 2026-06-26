const TILE_BASE = '/assets/tiles';
const BOARD_V3_TILE_BASE = '/assets/candidates/board-v3-square/tiles';

export interface TileSprites {
  hidden: HTMLImageElement;
  revealed: HTMLImageElement;
  mine: HTMLImageElement;
  flag: HTMLImageElement;
  numbers: HTMLImageElement[];
}

let loadPromise: Promise<TileSprites | null> | null = null;
let cached: TileSprites | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile sprite: ${src}`));
    img.src = src;
  });
}

export function loadTileSprites(): Promise<TileSprites | null> {
  if (cached) return Promise.resolve(cached);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const [hidden, revealed, mine, flag, ...numbers] = await Promise.all([
        loadImage(`${BOARD_V3_TILE_BASE}/cell-hidden.png`),
        loadImage(`${BOARD_V3_TILE_BASE}/cell-revealed.png`),
        loadImage(`${TILE_BASE}/mine.png`),
        loadImage(`${TILE_BASE}/flag.png`),
        ...Array.from({ length: 8 }, (_, i) => loadImage(`${BOARD_V3_TILE_BASE}/num-${i + 1}.png`)),
      ]);
      cached = { hidden, revealed, mine, flag, numbers };
      return cached;
    } catch {
      return null;
    }
  })();

  return loadPromise;
}

export function getTileSprites(): TileSprites | null {
  return cached;
}

export function drawSpriteInCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  cellSize: number,
): void {
  const prevSmooth = ctx.imageSmoothingEnabled;
  const prevQuality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const ix = Math.round(x);
  const iy = Math.round(y);
  const size = Math.round(cellSize);
  ctx.drawImage(img, ix, iy, size, size);
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.imageSmoothingQuality = prevQuality;
}

/** cell-hidden.png is a frame — center is transparent; fill before drawing the sprite. */
const HIDDEN_CELL_UNDERLAY = '#121f35';

function hiddenCellCornerRadius(cellSize: number): number {
  return Math.max(4, cellSize * 0.08);
}

function hiddenCellUnderlayPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
): void {
  const r = hiddenCellCornerRadius(cellSize);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + cellSize, y, x + cellSize, y + cellSize, r);
  ctx.arcTo(x + cellSize, y + cellSize, x, y + cellSize, r);
  ctx.arcTo(x, y + cellSize, x, y, r);
  ctx.arcTo(x, y, x + cellSize, y, r);
  ctx.closePath();
}

export function drawHiddenCellUnderlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
): void {
  ctx.save();
  hiddenCellUnderlayPath(ctx, x, y, cellSize);
  ctx.fillStyle = HIDDEN_CELL_UNDERLAY;
  ctx.fill();
  ctx.restore();
}

export function drawHiddenCellSprite(
  ctx: CanvasRenderingContext2D,
  sprites: TileSprites,
  x: number,
  y: number,
  cellSize: number,
): void {
  drawHiddenCellUnderlay(ctx, x, y, cellSize);
  drawSpriteInCell(ctx, sprites.hidden, x, y, cellSize);
}
