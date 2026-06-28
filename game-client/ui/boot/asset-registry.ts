import { GAME_CUTOUT_NAMES, GAME_FX_NAMES, GAME_UI_PANEL_NAMES } from '../game-assets.ts'
import { applyBootWeightMap, BOOT_WEIGHTS_URL } from './boot-weights.ts'
import { BOOT_WEBP_MAP_URL } from './image-format.ts'
import type { BootAsset, GameAssetManifestSnapshot } from './types.ts'

export const MANIFEST_URL = '/assets/game/manifest.json'

export const TILE_BASE = '/assets/tiles'
export const BOARD_V3_TILE_BASE = '/assets/candidates/board-v3-square/tiles'
export const HUD_BASE = '/assets/hud'
export const HUD_ICON_BASE = `${HUD_BASE}/icons`

export const HUD_ICON_NAMES = [
  'play',
  'skull',
  'refresh',
  'volume-on',
  'volume-off',
  'volume-on-hover',
  'volume-off-hover',
  'leaderboard',
  'leaderboard-hover',
  'rank-trophy-gold',
  'rank-trophy-silver',
  'rank-trophy-bronze',
] as const

export const HUD_FEEDBACK_URLS = {
  scoreStrip: '/assets/candidates/hud-feedback-v3/runtime/score-energy-strip-v3.png',
  scorePanelV6: '/assets/candidates/hud-feedback-v3/runtime/score-energy-panel-v6.png',
  comboRail: '/assets/candidates/hud-feedback-v3/runtime/combo-energy-rail-v3.png',
  scorePopBase: '/assets/candidates/hud-feedback-v3/runtime/score-pop-energy-base-v3.png',
  speedUpAlert: '/assets/candidates/hud-alerts-v3/runtime/speed-up-alert-v3.png',
  dangerRiseAlert: '/assets/candidates/hud-alerts-v3/runtime/danger-rise-alert-v3.png',
  lifeLossPopupSheet: '/assets/candidates/hud-damage-v3/runtime/life-loss-popup-v3-sheet.png',
} as const

export const SCORE_DIGIT_URLS = Array.from({ length: 10 }, (_, digit) => `/assets/candidates/hud-feedback-v3/runtime/score-digits-v1/digit-${digit}.png`)

const SMALL_SPRITE_WEIGHT = 4096
const CUTOUT_WEIGHT = 256 * 256
const HUD_FEEDBACK_PANEL_WEIGHT = 512 * 512

function tileAssets(): BootAsset[] {
  const entries: Array<{ id: string; url: string }> = [
    { id: 'tile.hidden', url: `${BOARD_V3_TILE_BASE}/cell-hidden.png` },
    { id: 'tile.revealed', url: `${BOARD_V3_TILE_BASE}/cell-revealed.png` },
    { id: 'tile.hover', url: `${BOARD_V3_TILE_BASE}/cell-hover.png` },
    { id: 'tile.pressed', url: `${BOARD_V3_TILE_BASE}/cell-pressed.png` },
    { id: 'tile.safe', url: `${BOARD_V3_TILE_BASE}/cell-safe.png` },
    { id: 'tile.mine', url: `${TILE_BASE}/mine.png` },
    { id: 'tile.flag', url: `${TILE_BASE}/flag.png` },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `tile.num-${i + 1}`,
      url: `${BOARD_V3_TILE_BASE}/num-${i + 1}.png`,
    })),
  ]

  return entries.map(({ id, url }) => ({
    id,
    url,
    tier: 1,
    group: 'tiles',
    weight: SMALL_SPRITE_WEIGHT,
  }))
}

function hudIconAssets(): BootAsset[] {
  const entries: BootAsset[] = [
    {
      id: 'hud.heart-full',
      url: `${HUD_BASE}/heart-full.png`,
      tier: 1,
      group: 'hud-icons',
      weight: SMALL_SPRITE_WEIGHT,
    },
    {
      id: 'hud.heart-empty',
      url: `${HUD_BASE}/heart-empty.png`,
      tier: 1,
      group: 'hud-icons',
      weight: SMALL_SPRITE_WEIGHT,
    },
    ...HUD_ICON_NAMES.map((name) => ({
      id: `hud.icon.${name}`,
      url: `${HUD_ICON_BASE}/${name}.png`,
      tier: 1 as const,
      group: 'hud-icons' as const,
      weight: name.startsWith('volume') || name.startsWith('leaderboard') ? 256 * 256 : SMALL_SPRITE_WEIGHT,
    })),
  ]
  return entries
}

function hudFeedbackAssets(): BootAsset[] {
  const panelEntries = Object.entries(HUD_FEEDBACK_URLS).map(([key, url]) => ({
    id: `hud-feedback.${key}`,
    url,
    tier: 2 as const,
    group: 'hud-feedback' as const,
    weight: HUD_FEEDBACK_PANEL_WEIGHT,
  }))

  const digitEntries = SCORE_DIGIT_URLS.map((url, digit) => ({
    id: `hud-feedback.digit-${digit}`,
    url,
    tier: 2 as const,
    group: 'hud-feedback' as const,
    weight: SMALL_SPRITE_WEIGHT,
  }))

  return [...panelEntries, ...digitEntries]
}

function manifestAssets(manifest: GameAssetManifestSnapshot): BootAsset[] {
  const assets: BootAsset[] = []

  for (const name of GAME_CUTOUT_NAMES) {
    const url = manifest.cutouts?.items?.[name]
    if (!url) continue
    assets.push({
      id: `cutout.${name}`,
      url,
      tier: 2,
      group: 'cutouts',
      weight: CUTOUT_WEIGHT,
      optional: true,
    })
  }

  for (const name of GAME_FX_NAMES) {
    const effect = manifest.fx?.effects?.[name]
    const frames = effect?.frames ?? []
    const frameWeight = (effect?.frameWidth ?? 192) * (effect?.frameHeight ?? 128)
    frames.forEach((url, index) => {
      assets.push({
        id: `fx.${name}.${index}`,
        url,
        tier: 2,
        group: 'fx',
        weight: frameWeight,
        optional: true,
      })
    })
  }

  for (const name of GAME_UI_PANEL_NAMES) {
    const panel = manifest.uiPanels?.items?.[name]
    const url = panel?.src
    if (!url) continue
    const weight = (panel.width ?? 512) * (panel.height ?? 512)
    assets.push({
      id: `panel.${name}`,
      url,
      tier: 2,
      group: 'panels',
      weight,
      optional: true,
    })
  }

  return assets
}

export function dedupeBootAssets(assets: BootAsset[]): BootAsset[] {
  const byUrl = new Map<string, BootAsset>()
  for (const asset of assets) {
    const existing = byUrl.get(asset.url)
    if (!existing) {
      byUrl.set(asset.url, { ...asset })
      continue
    }
    existing.weight = Math.max(existing.weight, asset.weight)
    existing.optional = existing.optional && asset.optional
    if (asset.tier < existing.tier) existing.tier = asset.tier
  }
  return [...byUrl.values()]
}

export async function fetchGameManifest(): Promise<GameAssetManifestSnapshot | null> {
  try {
    const response = await fetch(MANIFEST_URL)
    if (!response.ok) return null
    return (await response.json()) as GameAssetManifestSnapshot
  } catch {
    return null
  }
}

export async function fetchBootWebpMap(): Promise<Record<string, string>> {
  try {
    const response = await fetch(BOOT_WEBP_MAP_URL)
    if (!response.ok) return {}
    return (await response.json()) as Record<string, string>
  } catch {
    return {}
  }
}

export async function fetchBootWeights(): Promise<Record<string, number>> {
  try {
    const response = await fetch(BOOT_WEIGHTS_URL)
    if (!response.ok) return {}
    return (await response.json()) as Record<string, number>
  } catch {
    return {}
  }
}

export function collectBootAssets(manifest: GameAssetManifestSnapshot | null): BootAsset[] {
  const combined = [...tileAssets(), ...hudIconAssets(), ...hudFeedbackAssets(), ...(manifest ? manifestAssets(manifest) : [])]
  return dedupeBootAssets(combined)
}

export async function buildBootAssetList(): Promise<{
  assets: BootAsset[]
  manifest: GameAssetManifestSnapshot | null
}> {
  const [manifest, weights, webpMap] = await Promise.all([fetchGameManifest(), fetchBootWeights(), fetchBootWebpMap()])
  const assets = applyBootWeightMap(collectBootAssets(manifest), weights, webpMap)
  return { assets, manifest }
}

/** Tile sprite URLs in load order — used by tile-sprites.ts */
export const TILE_SPRITE_URLS = {
  hidden: `${BOARD_V3_TILE_BASE}/cell-hidden.png`,
  revealed: `${BOARD_V3_TILE_BASE}/cell-revealed.png`,
  hover: `${BOARD_V3_TILE_BASE}/cell-hover.png`,
  pressed: `${BOARD_V3_TILE_BASE}/cell-pressed.png`,
  safe: `${BOARD_V3_TILE_BASE}/cell-safe.png`,
  mine: `${TILE_BASE}/mine.png`,
  flag: `${TILE_BASE}/flag.png`,
  numbers: Array.from({ length: 8 }, (_, i) => `${BOARD_V3_TILE_BASE}/num-${i + 1}.png`),
} as const

export { HUD_ICON_NAMES as BOOT_HUD_ICON_NAMES }
