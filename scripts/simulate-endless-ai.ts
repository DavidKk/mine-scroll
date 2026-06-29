/**
 * Headless endless-mode AI simulation — measures survival to max scroll speed.
 * Run: pnpm simulate:ai [runs] [challenge|expert]
 */
import { getEndlessAiStepMs } from '../shared/core/ai/solver.ts'
import {
  createEndlessSessionWithSeed,
  type EndlessDifficultyPresetId,
  endlessScrollTick,
  getEndlessPresetForSession,
  getEndlessScrollIntervalMsFromElapsed,
  getEndlessScrollProfileForSession,
  getPresetMinIntervalMs,
} from '../shared/core/modes/endless/index.ts'
import { applyAiMove, getAiAnalysis } from '../shared/core/modes/engine.ts'
import type { ModeSession } from '../shared/core/types.ts'

const SIM_TICK_MS = 50
const MAX_SCROLL_TARGET = 40
const MAX_SIM_ELAPSED_MS = 240_000

function parsePresetArg(value: string | undefined): EndlessDifficultyPresetId {
  if (value === 'expert' || value === 'challenge') return value
  return 'challenge'
}

function maxSpeedAt(session: ModeSession, elapsedMs: number): boolean {
  const preset = getEndlessPresetForSession(session)
  return getEndlessScrollIntervalMsFromElapsed(elapsedMs, preset.id) <= getPresetMinIntervalMs(preset)
}

function bottomRowUnresolved(session: ModeSession): number {
  const board = session.state.board
  const bottom = board.rows - 1
  let n = 0
  for (let col = 0; col < board.cols; col += 1) {
    const c = board.cells[bottom]![col]!
    if (!c.revealed && c.mark !== 'flag') n += 1
  }
  return n
}

interface RunStats {
  seed: number
  scrollDepth: number
  lives: number
  revealed: number
  maxSpeedReached: boolean
  lost: boolean
  guessHits: number
  guessTotal: number
  waitTicks: number
  bottomPenalties: number
  reason: string
}

function simulateOne(seedIndex: number, presetId: EndlessDifficultyPresetId): RunStats {
  let session: ModeSession = createEndlessSessionWithSeed(((seedIndex + 1) * 2654435761) >>> 0, presetId)
  session = {
    ...session,
    state: { ...session.state, status: 'playing' },
  }

  let elapsed = 0
  let nextAiAt = 0
  let nextScrollAt = getEndlessScrollIntervalMsFromElapsed(0, presetId)
  let guessHits = 0
  let guessTotal = 0
  let waitTicks = 0
  let bottomPenalties = 0
  let lastMoveKind = ''

  while (session.state.status !== 'lost') {
    const depth = session.scrollRowCount ?? 0
    if (depth >= MAX_SCROLL_TARGET) break

    while (elapsed >= nextAiAt) {
      const beforeLives = session.lives
      const analysis = getAiAnalysis(session, elapsed)
      if (!analysis.move) {
        waitTicks += 1
      } else {
        if (analysis.move.confidence === 'guess') guessTotal += 1
        session = applyAiMove(session, analysis.move)
        if (analysis.move.confidence === 'guess' && (session.lives ?? 5) < (beforeLives ?? 5)) {
          guessHits += 1
        }
        lastMoveKind = analysis.move.reason
      }
      nextAiAt += getEndlessAiStepMs(session, elapsed)
      if (session.state.status === 'lost') break
    }

    if (session.state.status === 'lost') break

    if (elapsed >= nextScrollAt) {
      const livesBefore = session.lives ?? 5
      const unresolved = bottomRowUnresolved(session)
      const profile = getEndlessScrollProfileForSession(session, elapsed)
      session = endlessScrollTick(session, profile.batchRows)
      const livesAfter = session.lives ?? 0
      if (livesAfter < livesBefore) bottomPenalties += 1
      if (session.state.status === 'lost') break
      nextScrollAt += getEndlessScrollProfileForSession(session, elapsed).intervalMs
      if (unresolved > 0 && livesAfter < livesBefore) {
        lastMoveKind = `scroll penalty with ${unresolved} bottom cells`
      }
    }

    elapsed += SIM_TICK_MS
    if (elapsed > MAX_SIM_ELAPSED_MS) break
  }

  const depth = session.scrollRowCount ?? 0
  const maxSpeedReached = maxSpeedAt(session, elapsed) || depth >= 29

  return {
    seed: seedIndex,
    scrollDepth: depth,
    lives: session.lives ?? 0,
    revealed: session.revealedCount ?? 0,
    maxSpeedReached,
    lost: session.state.status === 'lost',
    guessHits,
    guessTotal,
    waitTicks,
    bottomPenalties,
    reason: lastMoveKind,
  }
}

function main(): void {
  const argRuns = process.argv[2]
  const argPreset = process.argv[3]
  const runs = Number(argRuns && !Number.isNaN(Number(argRuns)) ? argRuns : 20)
  const presetId = parsePresetArg(argPreset ?? (argRuns === 'challenge' || argRuns === 'expert' ? argRuns : undefined))
  const results: RunStats[] = []
  for (let i = 0; i < runs; i += 1) results.push(simulateOne(i, presetId))

  const reached = results.filter((r) => r.maxSpeedReached && !r.lost).length
  const avgDepth = results.reduce((s, r) => s + r.scrollDepth, 0) / results.length
  const avgPenalties = results.reduce((s, r) => s + r.bottomPenalties, 0) / results.length
  const avgWaits = results.reduce((s, r) => s + r.waitTicks, 0) / results.length
  const avgGuessHit =
    results.reduce((s, r) => s + r.guessHits, 0) /
    Math.max(
      1,
      results.reduce((s, r) => s + r.guessTotal, 0)
    )

  console.log(`\n=== Endless AI simulation (${runs} runs, preset=${presetId}) ===`)
  console.log(`Reached max scroll (depth >= 29): ${reached}/${runs}`)
  console.log(`Avg scroll depth: ${avgDepth.toFixed(1)}`)
  console.log(`Avg bottom-row penalties: ${avgPenalties.toFixed(2)}`)
  console.log(`Avg AI wait ticks: ${avgWaits.toFixed(1)}`)
  console.log(`Guess mine-hit rate: ${(avgGuessHit * 100).toFixed(1)}%`)
  console.log('\nWorst 5 runs:')
  for (const r of [...results].sort((a, b) => a.scrollDepth - b.scrollDepth).slice(0, 5)) {
    console.log(
      `  seed=${r.seed} depth=${r.scrollDepth} lives=${r.lives} penalties=${r.bottomPenalties} waits=${r.waitTicks} guesses=${r.guessTotal}/${r.guessHits} ${r.lost ? 'lost' : 'alive'}`
    )
  }
}

main()
