import type { GameStatus } from '@shared/core/types.ts'

import { resolveBackdropLayers } from './mood.ts'
import { drawParticlesLayer } from './particles.ts'
import { cosmicPalette, drawDeepVoid, drawEdgeFade, drawSkyWash } from './shared.ts'
import { drawShmupBulletsLayer, drawShmupShipLayer } from './shmup.ts'
import type { AmbientBackdropInput, BackdropMood } from './types.ts'

export {
  type BackdropGlyphsTuning,
  type BackdropLayerTuning,
  type BackdropParticlesTuning,
  type BackdropShmupTuning,
  computeBackdropIntensity,
  computeBackdropMood,
  resolveBackdropLayers,
  smoothBackdropIntensity,
  smoothBackdropMood,
} from './mood.ts'
export type { AmbientBackdropInput, BackdropDifficultyInput, BackdropMood } from './types.ts'

/** Full-screen cosmic backdrop — ship under stars, bullets over stars. */
export function drawAmbientBackdrop(ctx: CanvasRenderingContext2D, input: AmbientBackdropInput): void {
  const { shellW, shellH, nowMs, mood } = input
  if (shellW <= 0 || shellH <= 0) return

  const colors = cosmicPalette(mood.heat)
  const layers = resolveBackdropLayers(mood)

  ctx.save()
  drawDeepVoid(ctx, shellW, shellH, colors)
  drawSkyWash(ctx, shellW, shellH, colors, layers.particles.glow)
  drawShmupShipLayer(ctx, shellW, shellH, nowMs, colors, layers.shmup)
  drawParticlesLayer(ctx, shellW, shellH, nowMs, colors, layers.particles)
  drawShmupBulletsLayer(ctx, shellW, shellH, nowMs, colors, layers.shmup)
  drawEdgeFade(ctx, shellW, shellH, mood.intensity)
  ctx.restore()
}

export interface BackdropLabPreset {
  id: string
  label: string
  description: string
  mood: BackdropMood
  status: GameStatus
}

export const BACKDROP_LAB_PRESETS: BackdropLabPreset[] = [
  {
    id: 'compare',
    label: 'All tiers',
    description: 'Side-by-side comparison of every cosmic backdrop tier.',
    mood: { heat: 0.12, energy: 0.78, intensity: 0.16 },
    status: 'idle',
  },
  {
    id: 'idle',
    label: 'Idle',
    description: 'Quiet deep space — faint shmup vignette under the starfield (background only).',
    mood: { heat: 0.12, energy: 0.78, intensity: 0.16 },
    status: 'idle',
  },
  {
    id: 'easy',
    label: 'Easy',
    description: 'Gentle star drift with light motion.',
    mood: { heat: 0.22, energy: 0.86, intensity: 0.18 },
    status: 'playing',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Denser starfield with light motion streaks.',
    mood: { heat: 0.4, energy: 0.94, intensity: 0.45 },
    status: 'playing',
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Faster star drift, warm sky tint.',
    mood: { heat: 0.62, energy: 1.02, intensity: 0.68 },
    status: 'playing',
  },
  {
    id: 'extreme',
    label: 'Extreme',
    description: 'Hot crimson sky, peak star density and streaks.',
    mood: { heat: 0.82, energy: 1.12, intensity: 0.92 },
    status: 'playing',
  },
  {
    id: 'lost',
    label: 'Game over',
    description: 'Collapsed void — heavy vignette, dim stars.',
    mood: { heat: 0.82, energy: 0.88, intensity: 0.92 },
    status: 'lost',
  },
]
