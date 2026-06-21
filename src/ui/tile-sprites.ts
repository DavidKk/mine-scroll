const TILE_BASE = '/assets/tiles';

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
        loadImage(`${TILE_BASE}/cell-hidden.png`),
        loadImage(`${TILE_BASE}/cell-revealed.png`),
        loadImage(`${TILE_BASE}/mine.png`),
        loadImage(`${TILE_BASE}/flag.png`),
        ...Array.from({ length: 8 }, (_, i) => loadImage(`${TILE_BASE}/num-${i + 1}.png`)),
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
  ctx.drawImage(img, x, y, cellSize, cellSize);
}
