import type { ComboFeedbackPalette } from './types.ts'

/** Combo HUD v3 tier gates — wide spans so color does not flip at x10. */
export const COMBO_HUD_TIER_THRESHOLDS = [25, 55, 100] as const

export function getComboHudTier(combo: number): 0 | 1 | 2 | 3 {
  if (combo >= COMBO_HUD_TIER_THRESHOLDS[2]) return 3
  if (combo >= COMBO_HUD_TIER_THRESHOLDS[1]) return 2
  if (combo >= COMBO_HUD_TIER_THRESHOLDS[0]) return 1
  return 0
}

export function getComboFeedbackPalette(combo: number): ComboFeedbackPalette {
  const tier = getComboHudTier(combo)
  if (tier === 3) {
    return {
      main: '239, 68, 68',
      soft: '248, 113, 113',
      text: '#fca5a5',
      hot: '#fecaca',
      stroke: 'rgba(252, 165, 165, 0.95)',
      glow: 'rgba(239, 68, 68, 0.3)',
      digitColor: '#ef4444',
    }
  }
  if (tier === 2) {
    return {
      main: '251, 113, 36',
      soft: '239, 68, 68',
      text: '#ffffff',
      hot: '#fde047',
      stroke: 'rgba(251, 146, 60, 0.9)',
      glow: 'rgba(245, 158, 11, 0.22)',
      digitColor: '#fb923c',
    }
  }
  if (tier === 1) {
    return {
      main: '250, 204, 21',
      soft: '255, 213, 92',
      text: '#ffffff',
      hot: '#fef08a',
      stroke: 'rgba(250, 204, 21, 0.88)',
      glow: 'rgba(245, 158, 11, 0.2)',
      digitColor: '#facc15',
    }
  }
  return {
    main: '45, 236, 255',
    soft: '96, 165, 250',
    text: '#67e8f9',
    hot: '#dbeafe',
    stroke: 'rgba(147, 197, 253, 0.95)',
    glow: 'rgba(45, 236, 255, 0.14)',
    digitColor: '#93c5fd',
  }
}

/** CSS filter for the shared combo rail sprite — one shift per HUD tier. */
export function getComboRailFilter(combo: number): string {
  const tier = getComboHudTier(combo)
  if (tier === 3) return 'hue-rotate(180deg) saturate(1.62) brightness(1.06)'
  if (tier === 2) return 'hue-rotate(-150deg) saturate(1.45) brightness(1.08)'
  if (tier === 1) return 'hue-rotate(-118deg) saturate(1.45) brightness(1.08)'
  return 'none'
}

export function comboHudGlowRgba(combo: number, alpha: number): string {
  const { main } = getComboFeedbackPalette(combo)
  return `rgba(${main}, ${alpha})`
}

/** Legacy stroke/fill bundle — same tier colors as top COMBO HUD. */
export function getComboHudAccentColors(combo: number): {
  fill: string
  stroke: string
  glow: string
  text: string
} {
  const palette = getComboFeedbackPalette(combo)
  return {
    fill: `rgba(${palette.main}, 0.92)`,
    stroke: palette.stroke,
    glow: palette.glow,
    text: palette.digitColor,
  }
}

export function getComboFireflyAccent(combo: number): string {
  const tier = getComboHudTier(combo)
  if (tier === 3) return 'rgba(254, 202, 202, 0.95)'
  if (tier >= 1) return 'rgba(251, 191, 36, 0.95)'
  return 'rgba(45, 236, 255, 0.92)'
}
