export const GAME_CUTOUT_NAMES = [
  'mine-standard',
  'mine-exploded',
  'mine-cracked',
  'mine-hit-flash',
  'flag-blue',
  'flag-danger-red',
  'flag-wrong-correction',
  'flag-pole',
  'heart-full',
  'heart-empty',
  'heart-lost',
  'heart-refill',
  'warning-triangle',
  'danger-exclamation',
  'shield-safe-zone',
  'chord-crosshair',
] as const;

export type GameCutoutName = (typeof GAME_CUTOUT_NAMES)[number];

export const GAME_FX_NAMES = [
  'mine-explosion',
  'combo-burst',
  'safe-reveal',
  'flag-pop',
  'wrong-flag-break',
  'heart-refill',
  'level-up',
  'score-pop',
] as const;

export type GameFxName = (typeof GAME_FX_NAMES)[number];

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
}

export interface LoadedGameAssets {
  cutouts: Partial<Record<GameCutoutName, HTMLImageElement>>;
  fx: Partial<Record<GameFxName, HTMLImageElement[]>>;
  blendModes: Partial<Record<GameFxName, GlobalCompositeOperation>>;
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

    cached = { cutouts, fx, blendModes };
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

