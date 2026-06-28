import { getBootManifest, getCachedImage, registerBootResetHook } from './boot/asset-cache.ts'
import type { GameAssetManifestSnapshot } from './boot/types.ts'

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
] as const

export type GameCutoutName = (typeof GAME_CUTOUT_NAMES)[number]

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
] as const

export type GameFxName = (typeof GAME_FX_NAMES)[number]

/** Sprite sheets that loop continuously (ambient cell / digit / flag FX). */
export const LOOPING_GAME_FX = new Set<GameFxName>(['cell-breath', 'digit-particles', 'flag-wave'])

export function isLoopingGameFx(name: GameFxName): boolean {
  return LOOPING_GAME_FX.has(name)
}

export function resolveFxFrameIndex(progress: number, frameCount: number, loop: boolean): number {
  if (frameCount <= 0) return 0
  const t = Math.max(0, Math.min(1, progress))
  const raw = Math.floor(t * frameCount)
  return loop ? raw % frameCount : Math.min(frameCount - 1, raw)
}

export const GAME_UI_PANEL_NAMES = ['start-panel', 'game-over-panel', 'countdown-yellow', 'countdown-orange', 'countdown-red'] as const

export type GameUiPanelName = (typeof GAME_UI_PANEL_NAMES)[number]

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
} as const

export interface LoadedGameAssets {
  cutouts: Partial<Record<GameCutoutName, HTMLImageElement>>
  fx: Partial<Record<GameFxName, HTMLImageElement[]>>
  blendModes: Partial<Record<GameFxName, GlobalCompositeOperation>>
  uiPanels: Partial<Record<GameUiPanelName, HTMLImageElement>>
}

let cached: LoadedGameAssets | null = null

function buildLoadedGameAssetsFromCache(manifest: GameAssetManifestSnapshot | null): LoadedGameAssets {
  const cutouts = {} as Partial<Record<GameCutoutName, HTMLImageElement>>
  for (const name of GAME_CUTOUT_NAMES) {
    const src = manifest?.cutouts?.items?.[name]
    if (!src) continue
    const img = getCachedImage(src)
    if (img) cutouts[name] = img
  }

  const fx = {} as Partial<Record<GameFxName, HTMLImageElement[]>>
  for (const name of GAME_FX_NAMES) {
    const framePaths = manifest?.fx?.effects?.[name]?.frames ?? []
    if (framePaths.length === 0) continue
    const frames = framePaths.map((src) => getCachedImage(src)).filter((img): img is HTMLImageElement => Boolean(img))
    if (frames.length > 0) fx[name] = frames
  }

  const uiPanels = {} as Partial<Record<GameUiPanelName, HTMLImageElement>>
  for (const name of GAME_UI_PANEL_NAMES) {
    const src = manifest?.uiPanels?.items?.[name]?.src
    if (!src) continue
    const img = getCachedImage(src)
    if (img) uiPanels[name] = img
  }

  const blendModes = Object.fromEntries(GAME_FX_NAMES.map((name) => [name, manifest?.fx?.effects?.[name]?.blendMode ?? 'source-over'])) as Partial<
    Record<GameFxName, GlobalCompositeOperation>
  >

  return { cutouts, fx, blendModes, uiPanels }
}

export function loadGameAssets(): Promise<LoadedGameAssets | null> {
  if (cached) return Promise.resolve(cached)
  const manifest = getBootManifest()
  cached = buildLoadedGameAssetsFromCache(manifest)
  return Promise.resolve(cached)
}

export function getGameCutout(name: GameCutoutName): HTMLImageElement | null {
  return cached?.cutouts[name] ?? null
}

export function getGameFxFrames(name: GameFxName): HTMLImageElement[] | null {
  return cached?.fx[name] ?? null
}

export function getGameFxBlendMode(name: GameFxName): GlobalCompositeOperation {
  return cached?.blendModes[name] ?? 'source-over'
}

export function getGameUiPanel(name: GameUiPanelName): HTMLImageElement | null {
  return cached?.uiPanels[name] ?? null
}

export function drawImageContained(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number, scale = 1): void {
  const sourceW = 'naturalWidth' in img ? img.naturalWidth : 'width' in img ? Number(img.width) : w
  const sourceH = 'naturalHeight' in img ? img.naturalHeight : 'height' in img ? Number(img.height) : h
  const fit = Math.min(w / sourceW, h / sourceH) * scale
  const dw = sourceW * fit
  const dh = sourceH * fit
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

export function drawGameMineCutout(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  cellX: number,
  cellY: number,
  cellSize: number,
  scale: number = GAME_ASSET_TUNING.cutouts.mineScale
): void {
  const anchorY = cellSize * GAME_ASSET_TUNING.cutouts.mineAnchorYOffset
  drawImageContained(ctx, img, cellX, cellY + anchorY, cellSize, cellSize, scale)
}

export function drawGameMineCutoutAtCenter(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  cx: number,
  cy: number,
  cellSize: number,
  scale: number = GAME_ASSET_TUNING.cutouts.mineScale
): void {
  drawGameMineCutout(ctx, img, cx - cellSize / 2, cy - cellSize / 2, cellSize, scale)
}

export interface DrawFxSpriteOptions {
  /** When true, progress wraps through all frames at full alpha (no end fade). */
  loop?: boolean
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
  options: DrawFxSpriteOptions = {}
): boolean {
  const frames = getGameFxFrames(name)
  if (!frames || frames.length === 0) return false
  const loop = options.loop ?? isLoopingGameFx(name)
  const index = resolveFxFrameIndex(progress, frames.length, loop)
  const frame = frames[index]
  if (!frame) return false

  ctx.save()
  ctx.globalCompositeOperation = getGameFxBlendMode(name)
  ctx.globalAlpha = alphaScale
  drawImageContained(ctx, frame, cx - w / 2, cy - h / 2, w, h, 1)
  ctx.restore()
  return true
}

registerBootResetHook(() => {
  cached = null
})
