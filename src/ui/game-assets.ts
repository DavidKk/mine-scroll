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
  'cell-breath',
  'cell-hover',
  'digit-particles',
  'flag-wave',
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

/** Sprite sheets that loop continuously (ambient cell / digit / flag FX). */
export const LOOPING_GAME_FX = new Set<GameFxName>([
  'cell-breath',
  'digit-particles',
  'flag-wave',
]);

export function isLoopingGameFx(name: GameFxName): boolean {
  return LOOPING_GAME_FX.has(name);
}

export function resolveFxFrameIndex(progress: number, frameCount: number, loop: boolean): number {
  if (frameCount <= 0) return 0;
  const t = Math.max(0, Math.min(1, progress));
  const raw = Math.floor(t * frameCount);
  return loop ? raw % frameCount : Math.min(frameCount - 1, raw);
}

export const GAME_UI_PANEL_NAMES = [
  'auto-off',
  'auto-on',
  'start-panel',
  'ready-panel',
  'retry-button',
  'game-over-panel',
  'log-panel',
  'score-chip',
  'depth-chip',
  'lives-chip',
  'countdown-yellow',
  'countdown-orange',
  'countdown-red',
  'heal-chip',
  'break-chip',
  'full-life-panel',
  'row-one-chip',
  'row-two-chip',
  'row-five-chip',
  'safe-number-badge',
  'flag-badge',
  'target-yellow-badge',
  'target-purple-badge',
  'warning-badge',
] as const;

export type GameUiPanelName = (typeof GAME_UI_PANEL_NAMES)[number];

export const GAME_ASSET_TUNING = {
  tiles: {
    /** Render clue digits from the v3 glyph sprite set. */
    crispDigits: false,
    digitShadowBlurRatio: 0.1,
  },
  cutouts: {
    flagScale: 1,
    mineScale: 1.04,
    /** Shift mine draw up so opaque bbox center aligns with cell center (256px art). */
    mineAnchorYOffset: -7.5 / 256,
    heartScale: 1.18,
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
      durationMs: 980,
      spriteW: 2.55,
      spriteH: 1.95,
      spriteAlpha: 0.56,
      glowAlpha: 0.72,
      streakAlpha: 0.72,
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
      /** Bottom +score pop only; top score HUD pulse/particles stay on when false. */
      enabled: false,
      durationMs: 760,
      spriteAlpha: 0.38,
    },
    break: {
      durationMs: 720,
      spriteAlpha: 0.46,
      flashAlpha: 0.18,
    },
    cellBreath: {
      cycleMs: 2400,
      spriteW: 1.62,
      spriteH: 1.62,
      spriteAlpha: 0.38,
    },
    cellHover: {
      spriteW: 1.68,
      spriteH: 1.68,
      spriteAlpha: 0.52,
    },
    digitParticles: {
      cycleMs: 1800,
      spriteW: 2.35,
      spriteH: 2.35,
      spriteAlpha: 0.72,
    },
    flagWave: {
      cycleMs: 1500,
      spriteW: 1.55,
      spriteH: 1.15,
      spriteAlpha: 0.42,
    },
    heartRefillHud: {
      durationMs: 820,
      spriteW: 1.2,
      spriteH: 1.2,
      spriteAlpha: 0.58,
    },
    levelUp: {
      durationMs: 900,
      spriteW: 1.35,
      spriteH: 1.35,
      spriteAlpha: 0.48,
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
  scale: number = 1,
): void {
  const sourceW = 'naturalWidth' in img ? img.naturalWidth : 'width' in img ? Number(img.width) : w;
  const sourceH = 'naturalHeight' in img ? img.naturalHeight : 'height' in img ? Number(img.height) : h;
  const fit = Math.min(w / sourceW, h / sourceH) * scale;
  const dw = sourceW * fit;
  const dh = sourceH * fit;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function drawGameMineCutout(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  cellX: number,
  cellY: number,
  cellSize: number,
  scale: number = GAME_ASSET_TUNING.cutouts.mineScale,
): void {
  const anchorY = cellSize * GAME_ASSET_TUNING.cutouts.mineAnchorYOffset;
  drawImageContained(ctx, img, cellX, cellY + anchorY, cellSize, cellSize, scale);
}

export function drawGameMineCutoutAtCenter(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  cx: number,
  cy: number,
  cellSize: number,
  scale: number = GAME_ASSET_TUNING.cutouts.mineScale,
): void {
  drawGameMineCutout(ctx, img, cx - cellSize / 2, cy - cellSize / 2, cellSize, scale);
}

export interface DrawFxSpriteOptions {
  /** When true, progress wraps through all frames at full alpha (no end fade). */
  loop?: boolean;
}

export function drawFxSpriteFrame(
  ctx: CanvasRenderingContext2D,
  name: GameFxName,
  progress: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  alphaScale = 1,
  options: DrawFxSpriteOptions = {},
): boolean {
  const frames = getGameFxFrames(name);
  if (!frames || frames.length === 0) return false;
  const loop = options.loop ?? isLoopingGameFx(name);
  const index = resolveFxFrameIndex(progress, frames.length, loop);
  const frame = frames[index];
  if (!frame) return false;

  ctx.save();
  ctx.globalCompositeOperation = getGameFxBlendMode(name);
  ctx.globalAlpha = alphaScale;
  drawImageContained(ctx, frame, cx - w / 2, cy - h / 2, w, h, 1);
  ctx.restore();
  return true;
}
