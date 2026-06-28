import { GAME_ASSET_TUNING } from '../../game-assets.ts';

export type CellMode = 'hidden' | 'hover' | 'open' | 'breath';
export type MineMode = 'armed' | 'flash' | 'blast' | 'exploded';
export type BoardV3TileKey =
  | 'cell-hidden'
  | 'cell-revealed'
  | 'cell-hover'
  | 'cell-danger'
  | 'cell-pressed'
  | 'cell-safe'
  | 'cell-empty'
  | 'cell-disabled'
  | `num-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type PanelConceptKind = 'start' | 'game-over';

export interface CellEffectDrawOpts {
  scale?: number;
  lift?: number;
  brightness?: number;
  ringAlpha?: number;
  ringWidth?: number;
  innerGlow?: number;
}

export interface LivePreview {
  canvas: HTMLCanvasElement;
  dispose: () => void;
}

export interface ImageBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const PREVIEW_PX = 200;

export const V3_CANDIDATE_FLAG_SRC = '/assets/candidates/game-ui-v3/cutouts/flag-standard.png';
export const V3_CANDIDATE_MINE_STANDARD_SRC = '/assets/candidates/game-ui-v3/cutouts/mine-standard.png';
export const V3_CANDIDATE_MINE_CRACKED_SRC = '/assets/candidates/game-ui-v3/cutouts/mine-cracked.png';
export const V3_CANDIDATE_HEART_FULL_SRC = '/assets/candidates/game-ui-v3/cutouts/heart-full.png';
export const V3_CANDIDATE_HEART_EMPTY_SRC = '/assets/candidates/game-ui-v3/cutouts/heart-empty.png';
export const V3_BOARD_TILE_BASE = '/assets/candidates/board-v3-square/tiles';

/** Match in-game revealed mine scale so armed / blast / exploded stay the same size. */
export const MINE_CUTOUT_SCALE = GAME_ASSET_TUNING.cutouts.mineScale;

export const BREATH_CYCLE_MS = 2400;
export const BOARD_INTERACTION_V3_MS = 1680;
export const BOARD_INTERACTION_V3_ACTION_MS = 1280;
export const FLAG_WAVE_MS = 1500;
export const FLAG_PLACE_MS = 1180;
export const FLAG_PLACE_ACTION_MS = 430;
export const WRONG_FLAG_V3_MS = 1180;
export const WRONG_FLAG_V3_ACTION_MS = 520;
export const DIGIT_PARTICLE_MS = 1800;
export const MINE_HIT_V3_MS = 980;
export const MINE_HIT_V3_ACTION_MS = 620;
export const HEART_REFILL_V3_MS = 1180;
export const HEART_REFILL_V3_ACTION_MS = 560;

export const DIGIT_COLORS = [
  '#60a5fa',
  '#34d399',
  '#f87171',
  '#fbbf24',
  '#c084fc',
  '#22d3ee',
  '#ec4899',
  '#fb923c',
];
