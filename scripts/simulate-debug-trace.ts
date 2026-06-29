import { getEndlessAiStepMs } from '../shared/core/ai/solver.ts'
import {
  createEndlessSession,
  endlessScrollTick,
  getEndlessPresetForSession,
  getEndlessScrollIntervalMsFromElapsed,
  getEndlessScrollProfileForSession,
} from '../shared/core/modes/endless/index.ts'
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
let nextScrollAt = getEndlessScrollIntervalMsFromElapsed(0, getEndlessPresetForSession(session).id)
let steps = 0

function worldRow(localRow: number): number {
  return localRow + (session.endlessViewStart ?? 0)
}

while (session.state.status !== 'lost' && elapsed < MAX_ELAPSED) {
  const depth = session.scrollRowCount ?? 0
  if (depth >= 29) break

  while (elapsed >= nextAiAt) {
    const beforeLives = session.lives ?? 5
    const analysis = getAiAnalysis(session, elapsed)
    if (!analysis.move) {
      console.log(`wait depth=${depth} lives=${session.lives} elapsed=${elapsed}`)
    } else {
      const m = analysis.move
      const wr = worldRow(m.row)
      session = applyAiMove(session, analysis.move)
      steps += 1
      const afterLives = session.lives ?? 0
      const hit = afterLives < beforeLives ? ' ***mine hit***' : ''
      console.log(`step ${steps} ${m.kind} (${wr},${m.col}) screen(${m.row},${m.col}) ${m.reason} depth=${depth} lives=${beforeLives}->${afterLives}${hit}`)
      if (m.kind === 'reveal' || m.kind === 'chord') {
        const cell = session.state.board.cells[m.row]?.[m.col]
        if (cell?.revealed) {
          console.log(`  → revealed adj=${cell.adjacentMines} mine=${cell.isMine}`)
        }
      }
    }
    nextAiAt += getEndlessAiStepMs(session, elapsed)
    if (session.state.status === 'lost') break
  }
  if (session.state.status === 'lost') break

  if (elapsed >= nextScrollAt) {
    const profile = getEndlessScrollProfileForSession(session, elapsed)
    session = endlessScrollTick(session, profile.batchRows)
    console.log(`scroll depth=${session.scrollRowCount} lives=${session.lives}`)
    nextScrollAt += profile.intervalMs
    if (session.state.status === 'lost') break
  }

  elapsed += SIM_TICK_MS
}

console.log(`done steps=${steps} depth=${session.scrollRowCount ?? 0} ${session.state.status}`)
