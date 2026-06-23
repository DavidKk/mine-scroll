const TILE_BASE = '/assets/tiles';

export interface TileSprites {
  hidden: HTMLImageElement;
  revealed: HTMLImageElement;
  mine: HTMLImageElement;
  flag: HTMLImageElement;
  numbers: HTMLImageElement[];
  digits: HTMLImageElement[];
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

function loadOptionalImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function loadTileSprites(): Promise<TileSprites | null> {
  if (cached) return Promise.resolve(cached);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const [hidden, revealed, mine, flag, ...numbers] = await Promise.all([
        loadImage(`${TILE_BASE}/cell-hidden.png`),
        loadImage(`${TILE_BASE}/cell-revealed.png`),
        loadImage(`${TILE_BASE}/mine.png`),
        loadImage(`${TILE_BASE}/flag.png`),
        ...Array.from({ length: 8 }, (_, i) => loadImage(`${TILE_BASE}/num-${i + 1}.png`)),
      ]);
      const maybeDigits = await Promise.all(
        Array.from({ length: 8 }, (_, i) => loadOptionalImage(`${TILE_BASE}/digit-${i + 1}.png`)),
      );
      const digits = maybeDigits.filter((img): img is HTMLImageElement => Boolean(img));
      cached = { hidden, revealed, mine, flag, numbers, digits: digits.length === 8 ? digits : [] };
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
  ctx.drawImage(img, x, y, cellSize, cellSize);
}
