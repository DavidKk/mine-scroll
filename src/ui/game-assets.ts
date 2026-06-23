export const GAME_CUTOUT_NAMES = [
  'mine-standard',
  'mine-cracked',
  'flag-blue',
  'flag-pole',
  'flag-cloth',
  'heart-full',
  'heart-empty',
  'chord-crosshair',
  'scan-strip',
  'spark-blue',
  'spark-red',
  'spark-amber',
] as const;

export type GameCutoutName = (typeof GAME_CUTOUT_NAMES)[number];

export const GAME_FX_NAMES = [
  'mine-explosion',
  'combo-burst',
  'safe-reveal',
  'flag-pop',
  'wrong-flag-break',
  'score-pop',
] as const;

export type GameFxName = (typeof GAME_FX_NAMES)[number];

export const GAME_UI_PANEL_NAMES = ['start-panel', 'game-over-panel'] as const;

export type GameUiPanelName = (typeof GAME_UI_PANEL_NAMES)[number];

export const GAME_ASSET_TUNING = {
  cutouts: {
    flagScale: 0.56,
    mineScale: 0.68,
    heartScale: 1.18,
  },
  tiles: {
    cellScale: 1,
    digitScale: 0.58,
  },
  fx: {
    safeReveal: {
      durationMs: 340,
      spriteW: 1.75,
      spriteH: 1.75,
      spriteAlpha: 0.5,
      ringAlpha: 0.72,
    },
    flagPop: {
      durationMs: 300,
      spriteW: 1.9,
      spriteH: 1.45,
      spriteAlpha: 0.62,
      ringAlpha: 0.62,
    },
    mineExplosion: {
      durationMs: 620,
      spriteW: 2.55,
      spriteH: 1.95,
      spriteAlpha: 0.56,
      glowAlpha: 0.58,
      streakAlpha: 0.56,
    },
    comboBurst: {
      durationMs: 700,
      spriteW: 1.35,
      spriteH: 1.85,
      spriteAlpha: 0.36,
      maxScale: 1.18,
      particleScale: 0.62,
    },
    scorePop: {
      durationMs: 760,
      spriteAlpha: 0.38,
    },
    break: {
      durationMs: 720,
      spriteAlpha: 0.46,
      flashAlpha: 0.18,
    },
  },
} as const;

interface GameAssetManifest {
  cutouts?: {
    items?: Partial<Record<GameCutoutName, string>>;
  };
  fx?: {
    effects?: Partial<
      Record<
        GameFxName,
        {
          frames?: string[];
          blendMode?: GlobalCompositeOperation;
        }
      >
    >;
  };
  uiPanels?: {
    items?: Partial<
      Record<
        GameUiPanelName,
        {
          src?: string;
          width?: number;
          height?: number;
        }
      >
    >;
  };
}

export interface LoadedGameAssets {
  cutouts: Partial<Record<GameCutoutName, HTMLImageElement>>;
  fx: Partial<Record<GameFxName, HTMLImageElement[]>>;
  blendModes: Partial<Record<GameFxName, GlobalCompositeOperation>>;
  uiPanels: Partial<Record<GameUiPanelName, HTMLImageElement>>;
}

const MANIFEST_URL = '/assets/game/manifest.json';

let loadPromise: Promise<LoadedGameAssets | null> | null = null;
let cached: LoadedGameAssets | null = null;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadManifest(): Promise<GameAssetManifest | null> {
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) return null;
    return (await response.json()) as GameAssetManifest;
  } catch {
    return null;
  }
}

export function loadGameAssets(): Promise<LoadedGameAssets | null> {
  if (cached) return Promise.resolve(cached);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const manifest = await loadManifest();
    if (!manifest) return null;

    const cutoutEntries = await Promise.all(
      GAME_CUTOUT_NAMES.map(async (name) => {
        const src = manifest.cutouts?.items?.[name];
        if (!src) return [name, null] as const;
        return [name, await loadImage(src)] as const;
      }),
    );

    const fxEntries = await Promise.all(
      GAME_FX_NAMES.map(async (name) => {
        const framePaths = manifest.fx?.effects?.[name]?.frames ?? [];
        if (framePaths.length === 0) return [name, []] as const;
        const frames = await Promise.all(framePaths.map((src) => loadImage(src)));
        return [name, frames.filter((img): img is HTMLImageElement => Boolean(img))] as const;
      }),
    );

    const panelEntries = await Promise.all(
      GAME_UI_PANEL_NAMES.map(async (name) => {
        const src = manifest.uiPanels?.items?.[name]?.src;
        if (!src) return [name, null] as const;
        return [name, await loadImage(src)] as const;
      }),
    );

    const cutouts = Object.fromEntries(
      cutoutEntries.filter((entry): entry is readonly [GameCutoutName, HTMLImageElement] =>
        Boolean(entry[1]),
      ),
    ) as Partial<Record<GameCutoutName, HTMLImageElement>>;

    const fx = Object.fromEntries(
      fxEntries.filter(([, frames]) => frames.length > 0),
    ) as Partial<Record<GameFxName, HTMLImageElement[]>>;

    const blendModes = Object.fromEntries(
      GAME_FX_NAMES.map((name) => [
        name,
        manifest.fx?.effects?.[name]?.blendMode ?? 'source-over',
      ]),
    ) as Partial<Record<GameFxName, GlobalCompositeOperation>>;

    const uiPanels = Object.fromEntries(
      panelEntries.filter((entry): entry is readonly [GameUiPanelName, HTMLImageElement] =>
        Boolean(entry[1]),
      ),
    ) as Partial<Record<GameUiPanelName, HTMLImageElement>>;

    cached = { cutouts, fx, blendModes, uiPanels };
    return cached;
  })();

  return loadPromise;
}

export function getGameCutout(name: GameCutoutName): HTMLImageElement | null {
  return cached?.cutouts[name] ?? null;
}

export function getGameFxFrames(name: GameFxName): HTMLImageElement[] | null {
  return cached?.fx[name] ?? null;
}

export function getGameFxBlendMode(name: GameFxName): GlobalCompositeOperation {
  return cached?.blendModes[name] ?? 'source-over';
}

export function getGameUiPanel(name: GameUiPanelName): HTMLImageElement | null {
  return cached?.uiPanels[name] ?? null;
}

export function drawImageContained(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 1,
): void {
  const sourceW = 'naturalWidth' in img ? img.naturalWidth : 'width' in img ? Number(img.width) : w;
  const sourceH = 'naturalHeight' in img ? img.naturalHeight : 'height' in img ? Number(img.height) : h;
  const fit = Math.min(w / sourceW, h / sourceH) * scale;
  const dw = sourceW * fit;
  const dh = sourceH * fit;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const visibleRectCache = new WeakMap<object, SourceRect | null>();

function getImageSize(img: CanvasImageSource): { width: number; height: number } | null {
  const width = 'naturalWidth' in img ? img.naturalWidth : 'width' in img ? Number(img.width) : 0;
  const height = 'naturalHeight' in img ? img.naturalHeight : 'height' in img ? Number(img.height) : 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

function getVisibleSourceRect(img: CanvasImageSource): SourceRect | null {
  const key = img as object;
  if (visibleRectCache.has(key)) return visibleRectCache.get(key) ?? null;

  const size = getImageSize(img);
  if (!size) {
    visibleRectCache.set(key, null);
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const measureCtx = canvas.getContext('2d', { willReadFrequently: true });
    if (!measureCtx) {
      visibleRectCache.set(key, null);
      return null;
    }
    measureCtx.clearRect(0, 0, size.width, size.height);
    measureCtx.drawImage(img, 0, 0, size.width, size.height);
    const data = measureCtx.getImageData(0, 0, size.width, size.height).data;
    let minX = size.width;
    let minY = size.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < size.height; y += 1) {
      for (let x = 0; x < size.width; x += 1) {
        const alpha = data[(y * size.width + x) * 4 + 3] ?? 0;
        if (alpha <= 16) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const rect =
      maxX >= minX && maxY >= minY
        ? { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 }
        : null;
    visibleRectCache.set(key, rect);
    return rect;
  } catch {
    visibleRectCache.set(key, null);
    return null;
  }
}

export function drawImageVisibleContained(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 1,
): void {
  const rect = getVisibleSourceRect(img);
  if (!rect) {
    drawImageContained(ctx, img, x, y, w, h, scale);
    return;
  }

  const fit = Math.min(w / rect.sw, h / rect.sh) * scale;
  const dw = rect.sw * fit;
  const dh = rect.sh * fit;
  ctx.drawImage(
    img,
    rect.sx,
    rect.sy,
    rect.sw,
    rect.sh,
    x + (w - dw) / 2,
    y + (h - dh) / 2,
    dw,
    dh,
  );
}
