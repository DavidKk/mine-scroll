/** Landing attract DEMO config — see docs/LANDING-DEMO-SPEC.md */
import type { AiHintDisplay, AiMove } from '@shared/core/ai/types.ts'
import { EXPERT_PRESET } from '@shared/core/modes/endless/presets.ts'
import type { ModeSession } from '@shared/core/types.ts'

/** Fixed seed — choreographed attract demo. */
export const DEMO_SCRIPT_SEED = 0xdeadc0de

export const DEMO_LOST_HOLD_MS = 2_400
export const DEMO_LEADERBOARD_MS = 4_500

export const DEMO_START_STEP = 2
export const DEMO_SPEED_STEP = 3
export const DEMO_BATCH_STEP = 4

/** ~46s active demo + 6.9s end cards */
export const DEMO_PACE = {
  openingPauseMs: 1_000,
  firstFlagHoldMs: 480,
  introPlayMs: 4_500,
  afterLifeLossMs: 1_200,
  burstScrollCount: 3,
  burstScrollGapMs: 420,
  afterBurstScrollMs: 1_200,
  bridgePlayMs: 3_500,
  afterSpeedBoostMs: 2_000,
  pressurePlayMs: 4_800,
  midDifficultyLifeLossGapMs: 600,
  afterBatchBoostMs: 2_000,
  climaxPlayMs: 3_800,
  endgameDeathScrollBudgetMs: 18_000,
  endgameHeadroomScrollCount: 3,
  endgameHeadroomScrollGapMs: 400,
  beforeFatalGuessMs: 420,
  lifeLossHesitationMs: [600, 950] as const,
  endgameRevealHesitationMs: [140, 240] as const,
  afterEndgameRevealMs: 180,
  endgameMineHesitationMs: [180, 280] as const,
  afterEndgameMineMs: 300,
  endgameSafeBurstPattern: [2, 2, 2, 2] as const,
  endgamePrepScrollMax: 3,
  endgamePrepScrollGapMs: 380,
  pollMs: 180,
} as const

export type DemoPhase = 'playing' | 'lost' | 'leaderboard' | 'idle'

export type DemoTimelineStage =
  | 'opening-pause'
  | 'mobile-flag'
  | 'intro-play'
  | 'life-loss'
  | 'heal-burst'
  | 'difficulty-bridge'
  | 'speed-up'
  | 'pressure-play'
  | 'difficulty-life-loss'
  | 'danger-rise'
  | 'climax-play'
  | 'death-drain'
  | 'fatal-guess'
  | 'lost-hold'
  | 'leaderboard'

export const REQUIRED_DEMO_TIMELINE_STAGES: readonly DemoTimelineStage[] = [
  'opening-pause',
  'mobile-flag',
  'intro-play',
  'life-loss',
  'heal-burst',
  'difficulty-bridge',
  'speed-up',
  'pressure-play',
  'danger-rise',
  'climax-play',
  'death-drain',
  'fatal-guess',
  'lost-hold',
  'leaderboard',
] as const

export interface DemoScriptCallbacks {
  onPhaseChange(phase: DemoPhase): void
  onRestart(): void
  onStageEnter?(stage: DemoTimelineStage): void
}

export interface DemoScriptController {
  readonly phase: DemoPhase
  start(): void
  stop(): void
}

export function setDemoElapsed(runtime: { scrollGameStartedAt: number }, elapsedMs: number): void {
  runtime.scrollGameStartedAt = Date.now() - Math.max(0, elapsedMs)
}

export function elapsedForScrollStep(step: number): number {
  return step * EXPERT_PRESET.scrollStepMs + 1_000
}

export interface DemoScriptContext {
  runtime: {
    session: ModeSession
    scrollGameStartedAt: number
    aiHint: AiHintDisplay | null
  }
  applySession(next: ModeSession, beforeLives?: number, context?: { trigger?: string }): void
  render(): void
  syncDifficultyStep(step: number): void
  resyncScrollTimer(): void
  startScrollAndAi(): void
  startAiOnly(): void
  stopScrollAndAi(): void
  stopAiOnly(): void
  postponeNextScroll(delayMs: number): void
  setDemoEndgameFastAi(fast: boolean): void
  performScrollTick(reason: string): void
  setDemoAiMove(move: AiMove | null): void
  playMobileFlagSwipe(screenRow: number, col: number, onSwipeCommit?: () => void): Promise<void>
  cancelFlagSwipePreview?(): void
}
