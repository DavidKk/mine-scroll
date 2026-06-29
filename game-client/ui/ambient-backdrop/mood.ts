import { getEndlessScrollProfile, SCROLL_BATCH_TIERS, SCROLL_INTERVAL_TIERS_MS } from '@shared/core/modes/endless/index.ts'

import { clamp01, lerp } from './math.ts'
import type { BackdropDifficultyInput, BackdropMood } from './types.ts'

export function computeBackdropMood(input: BackdropDifficultyInput, combo = 0): BackdropMood {
  let heat = 0.12
  let energy = 0.78
  let intensity = 0

  if (input.status === 'lost') {
    return { heat: 0.82, energy: 0.88, intensity: 0.92 }
  }

  if (input.status === 'playing') {
    const profile = getEndlessScrollProfile(input.scrollElapsedMs)
    const speedNorm = profile.speedTier / Math.max(1, SCROLL_INTERVAL_TIERS_MS.length - 1)
    const batchNorm = profile.batchTier / Math.max(1, SCROLL_BATCH_TIERS.length - 1)
    const depthNorm = clamp01(input.scrollDepth / 80)
    heat = clamp01(0.12 + speedNorm * 0.3 + batchNorm * 0.24 + depthNorm * 0.22)
    if (input.maxLives > 0) {
      heat = clamp01(heat + ((input.maxLives - input.lives) / input.maxLives) * 0.14)
    }
    energy = clamp01(0.78 + speedNorm * 0.18 + batchNorm * 0.14 + depthNorm * 0.1)
    intensity = clamp01(speedNorm * 0.3 + batchNorm * 0.28 + depthNorm * 0.24)
    if (input.maxLives > 0 && input.lives < input.maxLives) {
      intensity = clamp01(intensity + ((input.maxLives - input.lives) / input.maxLives) * 0.16)
    }
  }

  if (combo > 1) {
    energy = Math.min(1.15, energy + Math.min(0.12, combo * 0.01))
    intensity = clamp01(intensity + Math.min(0.06, combo * 0.004))
  }

  return { heat, energy: Math.max(0.74, energy), intensity }
}

/** Per-layer tuning — particles, glyphs, and shmup stay independent. */
export interface BackdropParticlesTuning {
  density: number
  glow: number
  drift: number
  streakIntensity: number
  liteStars?: boolean
}

export interface BackdropGlyphsTuning {
  density: number
  intensity: number
  motion: number
}

export interface BackdropShmupTuning {
  intensity: number
}

export interface BackdropLayerTuning {
  particles: BackdropParticlesTuning
  glyphs: BackdropGlyphsTuning
  shmup: BackdropShmupTuning
}

const GLYPH_MOTION_BASE = 0.82

export function resolveBackdropLayers(mood: BackdropMood): BackdropLayerTuning {
  const vis = Math.max(mood.intensity, 0.16)
  return {
    particles: {
      density: 0.95 + vis * 0.65,
      glow: 1.02 + vis * 0.55,
      drift: mood.energy,
      streakIntensity: vis,
    },
    glyphs: {
      density: 0.95 + vis * 0.65,
      intensity: vis,
      motion: GLYPH_MOTION_BASE,
    },
    shmup: {
      /** Background vignette only — stay subtle even at high game intensity. */
      intensity: clamp01(0.2 + vis * 0.14),
    },
  }
}

export function smoothBackdropMood(current: BackdropMood, target: BackdropMood, dtMs: number): BackdropMood {
  const tau = 1400
  const t = 1 - Math.exp(-Math.max(0, dtMs) / tau)
  return {
    heat: lerp(current.heat, target.heat, t),
    energy: lerp(current.energy, target.energy, t),
    intensity: lerp(current.intensity, target.intensity, t),
  }
}

/** @deprecated use computeBackdropMood */
export function computeBackdropIntensity(input: BackdropDifficultyInput): number {
  return computeBackdropMood(input).heat
}

/** @deprecated use smoothBackdropMood */
export function smoothBackdropIntensity(current: number, target: number, dtMs: number): number {
  const tau = 1400
  const t = 1 - Math.exp(-Math.max(0, dtMs) / tau)
  return lerp(current, target, t)
}
