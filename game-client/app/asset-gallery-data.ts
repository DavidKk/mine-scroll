import type { EffectPanelId } from './asset-gallery/cell-effects.ts'
import type { AssetLabSection } from './routes.ts'

export const TILE_BASE = '/assets/tiles'
export const RUNTIME_BOARD_TILE_BASE = '/assets/candidates/board-v3-square/tiles'

export interface AssetItem {
  id: string
  label: string
  src: string
  image: HTMLImageElement
}

export interface AssetSection {
  id: string
  title: string
  description: string
  items: AssetItem[]
}

export interface StaticPreviewItem {
  id: string
  label: string
  src: string
  note?: string
  background?: 'checker' | 'black' | 'dark'
}

export interface StaticPreviewSection {
  id: string
  title: string
  description: string
  items: StaticPreviewItem[]
}

const V3_CANDIDATE_BASE = '/assets/candidates/game-ui-v3'
const V3_BOARD_TILE_BASE = '/assets/candidates/board-v3-square/tiles'

export const SOURCE_SECTIONS: StaticPreviewSection[] = [
  {
    id: 'current-sources',
    title: 'Current sources',
    description: 'Active board sources and manifest runtime previews.',
    items: [
      {
        id: 'board-v3-square-tiles-source',
        label: 'Board v3 square tiles source',
        src: '/assets/candidates/board-v3-square/board-v3-square-tiles-source.png',
        note: 'Current square tile source: normalized into 128x128 review sprites.',
        background: 'checker',
      },
      {
        id: 'board-v3-square-digits-source',
        label: 'Board v3 digit glyph source',
        src: '/assets/candidates/board-v3-square/board-v3-square-digits-source.png',
        note: 'Current digit glyph source: numbers are sliced separately from tile backgrounds.',
        background: 'checker',
      },
      {
        id: 'runtime-cutout-preview',
        label: 'Runtime cutout preview',
        src: '/assets/game/preview-cutouts.png',
        note: 'Manifest-driven runtime cutout preview.',
        background: 'checker',
      },
      {
        id: 'runtime-fx-preview',
        label: 'Runtime FX preview',
        src: '/assets/game/preview-fx.png',
        note: 'Middle-frame preview from manifest FX entries (wrong-flag-break, level-up).',
        background: 'black',
      },
    ],
  },
]

export const V3_CANDIDATE_CUTOUTS: StaticPreviewItem[] = [
  { id: 'mine-standard', label: 'Mine standard', src: `${V3_CANDIDATE_BASE}/runtime-cutouts/mine-standard.png`, background: 'checker' },
  { id: 'mine-cracked', label: 'Mine cracked', src: `${V3_CANDIDATE_BASE}/runtime-cutouts/mine-cracked.png`, background: 'checker' },
  { id: 'flag-standard', label: 'Flag standard', src: `${V3_CANDIDATE_BASE}/runtime-cutouts/flag-standard.png`, background: 'checker' },
  { id: 'heart-full', label: 'Heart full', src: `${V3_CANDIDATE_BASE}/cutouts/heart-full.png`, background: 'checker' },
  { id: 'heart-empty', label: 'Heart empty', src: `${V3_CANDIDATE_BASE}/cutouts/heart-empty.png`, background: 'checker' },
]

export const V3_HUD_ALERT_CANDIDATES: StaticPreviewItem[] = [
  {
    id: 'speed-up-alert-v3',
    label: 'Speed up alert v3',
    src: '/assets/candidates/hud-alerts-v3/runtime/speed-up-alert-v3.png',
    background: 'black',
  },
  {
    id: 'danger-rise-alert-v3',
    label: 'Danger rise alert v3',
    src: '/assets/candidates/hud-alerts-v3/runtime/danger-rise-alert-v3.png',
    background: 'black',
  },
]

export const V3_BOARD_TILE_CANDIDATES: StaticPreviewItem[] = [
  { id: 'cell-hidden', label: 'Cell hidden square v3', src: `${V3_BOARD_TILE_BASE}/cell-hidden.png`, background: 'checker' },
  { id: 'cell-revealed', label: 'Cell revealed square v3', src: `${V3_BOARD_TILE_BASE}/cell-revealed.png`, background: 'checker' },
  { id: 'cell-hover', label: 'Cell hover square v3', src: `${V3_BOARD_TILE_BASE}/cell-hover.png`, background: 'checker' },
  { id: 'cell-pressed', label: 'Cell pressed square v3', src: `${V3_BOARD_TILE_BASE}/cell-pressed.png`, background: 'checker' },
  { id: 'cell-safe', label: 'Cell safe square v3', src: `${V3_BOARD_TILE_BASE}/cell-safe.png`, background: 'checker' },
  ...Array.from({ length: 8 }, (_, index): StaticPreviewItem => ({
    id: `num-${index + 1}`,
    label: `Digit ${index + 1} glyph v3`,
    src: `${V3_BOARD_TILE_BASE}/num-${index + 1}.png`,
    background: 'checker',
  })),
]

export const FX_NAV: Array<{ id: EffectPanelId; label: string }> = [
  { id: 'cells', label: 'Cell states' },
  { id: 'board-interactions-v3', label: 'Board interactions v3' },
  { id: 'digits', label: 'Digit particles' },
  { id: 'flag', label: 'Flag wave current' },
  { id: 'flag-place-v3', label: 'Flag place v3' },
  { id: 'wrong-flag-v3', label: 'Wrong flag v3' },
  { id: 'mine', label: 'Mine explosion' },
  { id: 'mine-hit-v3', label: 'Mine hit v3' },
  { id: 'heart-refill-v3', label: 'Heart refill v3' },
  { id: 'heart-loss-v3', label: 'Heart loss v3' },
  { id: 'start-panel-v3', label: 'Start panel v3' },
  { id: 'game-over-panel-v3', label: 'Game over panel v3' },
  { id: 'score-hud-v3', label: 'Score HUD v3' },
  { id: 'combo-hud-v3', label: 'Combo HUD v3' },
  { id: 'score-pop-v3', label: 'Score pop v3' },
  { id: 'combo-burst-v3', label: 'Combo burst v3' },
  { id: 'life-loss-popup-v3', label: 'Life loss popup v3' },
  { id: 'speed-up-alert-v3', label: 'Speed up alert v3' },
  { id: 'speed-up-chevron-v3', label: 'Speed up chevrons v3' },
  { id: 'danger-rise-alert-v3', label: 'Danger rise alert v3' },
]

export const FOOTER_NOTES: Record<AssetLabSection, string> = {
  sources: 'Board sources and manifest runtime previews',
  sprites: 'Static runtime and candidate cutouts · transparent PNG review before manifest wiring',
  animations: 'Motion previews and FX frame review · canvas-driven behavior lives here',
  'game-ui': 'Runtime UI panels and HUD icons only · source sheets moved to Sources',
  background: 'Environment and backdrop preview · game-client/ui/game-canvas/shell/background.ts',
  audio: 'Game SFX & BGM · public/assets/game/audio · gains in game-audio.ts',
}
