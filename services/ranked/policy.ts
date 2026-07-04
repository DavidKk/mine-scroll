import type { PolicyDecision, ReplayResult } from './types.ts'

const ACCEPT_THRESHOLD = 0.42
const REVIEW_THRESHOLD = 0.28

export function evaluateRankedRun(replay: ReplayResult): PolicyDecision {
  const riskFlags: string[] = []

  if (!replay.replayOk) {
    return {
      decision: 'rejected',
      inputChainScore: 0,
      shadowAiScore: 0,
      riskFlags: ['replay_failed'],
    }
  }

  const actionableMetrics = replay.inputMetrics
  const zeroMoveActions = actionableMetrics.filter((metric) => metric.moveSamplesBeforeDown === 0).length
  const zeroMoveRatio = actionableMetrics.length > 0 ? zeroMoveActions / actionableMetrics.length : 1

  if (zeroMoveRatio > 0.65) {
    riskFlags.push('low_pointer_samples')
  }

  const avgPath = actionableMetrics.length > 0 ? actionableMetrics.reduce((sum, metric) => sum + metric.pathLengthPx, 0) / actionableMetrics.length : 0
  if (avgPath < 4 && actionableMetrics.length >= 8) {
    riskFlags.push('teleport_clicks')
  }

  const inputChainScore = clamp01(1 - zeroMoveRatio * 0.85 - (avgPath < 4 ? 0.2 : 0))

  const shadowRate = replay.shadowAi.aiMoveMatchRate
  const shadowAiScore = clamp01(1 - shadowRate)
  if (shadowRate > 0.96 && zeroMoveRatio > 0.7) {
    riskFlags.push('shadow_ai_bot_pattern')
  }

  const skippedActions = replay.skippedActions ?? 0
  const skippedRatio = actionableMetrics.length > 0 ? skippedActions / actionableMetrics.length : 0
  if (skippedRatio > 0.45 && skippedActions >= 12) {
    riskFlags.push('high_replay_skips')
  }

  const combined = inputChainScore * 0.55 + shadowAiScore * 0.45 - riskFlags.length * 0.06

  let decision: PolicyDecision['decision'] = 'rejected'
  if (combined >= ACCEPT_THRESHOLD) decision = 'accepted'
  else if (combined >= REVIEW_THRESHOLD) decision = 'review'

  if (decision === 'review') {
    riskFlags.push('manual_review')
  }

  return {
    decision,
    inputChainScore,
    shadowAiScore,
    riskFlags,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
