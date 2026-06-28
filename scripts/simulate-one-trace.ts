import { getEndlessAiStepMs } from '../shared/core/ai/solver.ts'
import { createEndlessSession, endlessScrollTick, getEndlessScrollIntervalMsFromElapsed, getEndlessScrollProfile } from '../shared/core/modes/endless/index.ts'
import { applyAiMove, getAiAnalysis } from '../shared/core/modes/engine.ts'

const SIM_TICK_MS = 50
const MAX_ELAPSED = 120_000

let session = createEndlessSession()
session = {
  ...session,
  state: { ...session.state, board: { ...session.state.board, worldSeed: 2654435761 } },
}

let elapsed = 0
let nextAiAt = 0
let nextScrollAt = getEndlessScrollIntervalMsFromElapsed(0)
let steps = 0
let waits = 0
const t0 = Date.now()

while (session.state.status !== 'lost' && elapsed < MAX_ELAPSED) {
  const depth = session.scrollRowCount ?? 0
  if (depth >= 29) break

  while (elapsed >= nextAiAt) {
    const t1 = Date.now()
    const analysis = getAiAnalysis(session, elapsed)
    const dt = Date.now() - t1
    if (dt > 200) console.log(`slow analysis ${dt}ms depth=${depth}`)
    if (!analysis.move) waits += 1
    else {
      session = applyAiMove(session, analysis.move)
      steps += 1
      if (steps <= 20 || steps % 50 === 0) {
        console.log(`step ${steps} ${analysis.move.kind} ${analysis.move.reason} ↑${depth} 命${session.lives}`)
      }
    }
    nextAiAt += getEndlessAiStepMs(session, elapsed)
    if (session.state.status === 'lost') break
  }
  if (session.state.status === 'lost') break

  if (elapsed >= nextScrollAt) {
    const profile = getEndlessScrollProfile(elapsed)
    session = endlessScrollTick(session, profile.batchRows)
    console.log(`scroll ↑${session.scrollRowCount} 命${session.lives} batch=${profile.batchRows}`)
    nextScrollAt += profile.intervalMs
    if (session.state.status === 'lost') break
  }

  elapsed += SIM_TICK_MS
}

console.log(`done ${Date.now() - t0}ms steps=${steps} waits=${waits} ↑${session.scrollRowCount ?? 0} 命${session.lives} ${session.state.status}`)
