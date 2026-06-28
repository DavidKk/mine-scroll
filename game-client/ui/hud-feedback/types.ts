import type { HudFxBudget } from '../cell-fx.ts'

export type { HudFxBudget }

export interface ComboFeedbackPalette {
  main: string
  soft: string
  text: string
  hot: string
  stroke: string
  glow: string
  digitColor: string
}

export interface ScorePopFxProgress {
  t: number
  alpha: number
  pop: number
  fireflyFade: number
}

export interface ComboBurstFxProgress {
  t: number
  alpha: number
  fade: number
  hit: number
  burstScale: number
  shakeX: number
  fireflyFade: number
}

export interface ScorePopStripOrbit {
  cx: number
  cy: number
  width: number
  height: number
}

export interface ScorePopFxDrawOptions {
  cx: number
  cy: number
  scoreText: string
  comboTier: number
  progress: ScorePopFxProgress
  stageScale: number
  scorePopBase: HTMLImageElement | null
  assetMaxW: number
  assetMaxH: number
  assetCyOffset?: number
  fontPx?: number
  fontFamily: string
  drawFallbackFx?: (ctx: CanvasRenderingContext2D, t: number) => void
}

export interface ComboBurstFxDrawOptions {
  cx: number
  cy: number
  combo: number
  progress: ComboBurstFxProgress
  stageScale: number
  isMobile?: boolean
  burstW: number
  burstH: number
  fontFamilyMono: string
  fontFamilyDisplay: string
  hudFxBudget?: HudFxBudget
}

export interface ScorePopBottomStripDrawOptions {
  stripCx: number
  stripTopY: number
  chipW: number
  chipH: number
  scoreStrip: HTMLImageElement | null
  comboTier: number
  progress: ScorePopFxProgress
  budget?: HudFxBudget
}

export type ScorePopV3Layer = 'all' | 'strip' | 'pop'

export interface ScorePopV3Layout {
  stripCx: number
  stripTopY: number
  chipW: number
  chipH: number
  popCx: number
  popCy: number
  stageScale: number
  assetMaxW: number
  assetMaxH: number
  assetCyOffset?: number
  fontPx?: number
}

export interface ScorePopV3DrawOptions {
  canvasW: number
  canvasH: number
  progress: ScorePopFxProgress
  layout: ScorePopV3Layout
  comboTier: number
  scoreText: string
  scoreStrip: HTMLImageElement | null
  scorePopBase: HTMLImageElement | null
  fontFamily: string
  layer?: ScorePopV3Layer
  hudFxBudget?: HudFxBudget
  drawFallbackFx?: (ctx: CanvasRenderingContext2D, t: number) => void
  drawStripFallback?: (ctx: CanvasRenderingContext2D) => void
}

export interface ComboBurstV3Layout {
  cx: number
  cy: number
  burstW: number
  burstH: number
  stageScale: number
  isMobile: boolean
}

export interface ComboBurstV3DrawOptions {
  canvasW: number
  canvasH: number
  combo: number
  progress: ComboBurstFxProgress
  layout: ComboBurstV3Layout
  fontFamilyMono: string
  fontFamilyDisplay: string
  hudFxBudget?: HudFxBudget
}
