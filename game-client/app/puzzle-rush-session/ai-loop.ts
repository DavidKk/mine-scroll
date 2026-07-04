import { aiPersistCellKey } from '@shared/core/ai/ai-blocked.ts'
import type { AiHintDisplay } from '@shared/core/ai/types.ts'
import { analyzePuzzleRushSession, applyPuzzleRushAiMove, getPuzzleRushAiStepMs, isPuzzleAiPersistBlocked, toPuzzleAiHintDisplay } from '@shared/core/modes/puzzle-rush/solver.ts'
import type { PuzzleRushSession } from '@shared/core/modes/puzzle-rush/types.ts'

import { devLog } from '../game-session/dev-log.ts'

export interface PuzzleAiRuntime {
  session: PuzzleRushSession
  aiAutoId: number | null
  aiAutoActive: boolean
  aiHint: AiHintDisplay | null
  aiWaitLogged: boolean
  aiOscillationCell: string | null
  aiOscillationCount: number
  boardAdvancePending: boolean
}

export interface PuzzleAiControllerDeps {
  runtime: PuzzleAiRuntime
  isBoardAdvanceActive: () => boolean
  onSessionChange(next: PuzzleRushSession, beforeLives?: number, beforeBoard?: PuzzleRushSession['state']['board']): void
  render(): void
}

export interface PuzzleAiController {
  stopAiAuto(): void
  scheduleAiStep(): void
  refreshAiHint(): void
  runAiStep(): boolean
  toggleAiAuto(startRun: () => void): void
}

function formatCell(row: number, col: number): string {
  return `(${row},${col})`
}

export function createPuzzleAiController(deps: PuzzleAiControllerDeps): PuzzleAiController {
  const { runtime, isBoardAdvanceActive, onSessionChange, render } = deps

  function stopAiAuto(): void {
    runtime.aiAutoActive = false
    runtime.aiHint = null
    if (runtime.aiAutoId !== null) {
      window.clearTimeout(runtime.aiAutoId)
      runtime.aiAutoId = null
    }
  }

  function refreshAiHint(): void {
    if (!runtime.aiAutoActive) {
      runtime.aiHint = null
      return
    }
    runtime.aiHint = toPuzzleAiHintDisplay(analyzePuzzleRushSession(runtime.session))
  }

  function canRunAiStep(): boolean {
    return !runtime.boardAdvancePending && !isBoardAdvanceActive()
  }

  function scheduleAiStep(): void {
    if (!runtime.aiAutoActive) return
    if (!canRunAiStep()) {
      runtime.aiAutoId = window.setTimeout(() => {
        runtime.aiAutoId = null
        scheduleAiStep()
      }, 120)
      return
    }

    runtime.aiAutoId = window.setTimeout(() => {
      runtime.aiAutoId = null
      if (!runtime.aiAutoActive) return
      if (!canRunAiStep()) {
        scheduleAiStep()
        return
      }
      if (!runAiStep()) {
        stopAiAuto()
        return
      }
      scheduleAiStep()
    }, getPuzzleRushAiStepMs(runtime.session))
  }

  function runAiStep(): boolean {
    if (!canRunAiStep()) return true
    if (runtime.session.state.status === 'lost') return false
    const beforeLives = runtime.session.lives

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const analysis = analyzePuzzleRushSession(runtime.session)
      if (!analysis.move) {
        if (!runtime.aiWaitLogged && attempt === 0) {
          devLog('Puzzle AI waiting: no move available')
          runtime.aiWaitLogged = true
        }
        refreshAiHint()
        render()
        return true
      }

      const move = analysis.move
      if (move.kind === 'heal' || move.kind === 'scroll') continue

      const cellKeyStr = aiPersistCellKey(runtime.session.state.board, move.row, move.col)

      if (move.kind === 'flag' || move.kind === 'unflag') {
        if (isPuzzleAiPersistBlocked(runtime.session, move.row, move.col)) continue
        if (runtime.aiOscillationCell === cellKeyStr) {
          runtime.aiOscillationCount += 1
        } else {
          runtime.aiOscillationCell = cellKeyStr
          runtime.aiOscillationCount = 1
        }
        if (runtime.aiOscillationCount >= 3) {
          const blocked = new Set(runtime.session.aiOscillationBlocked ?? [])
          if (!blocked.has(cellKeyStr)) {
            blocked.add(cellKeyStr)
            runtime.session = { ...runtime.session, aiOscillationBlocked: [...blocked] }
            devLog(`Puzzle AI skip oscillation ${formatCell(move.row, move.col)}`)
          }
          runtime.aiOscillationCell = null
          runtime.aiOscillationCount = 0
          continue
        }
      } else {
        runtime.aiOscillationCell = null
        runtime.aiOscillationCount = 0
      }

      runtime.aiWaitLogged = false
      const beforeBoard = runtime.session.state.board
      let next = applyPuzzleRushAiMove(runtime.session, move)
      if (move.kind === 'unflag' && (move.reason.includes('contradiction') || move.reason.includes('wrong flag'))) {
        const k = aiPersistCellKey(next.state.board, move.row, move.col)
        const contradicted = new Set(next.aiContradictedFlags ?? [])
        contradicted.add(k)
        next = { ...next, aiContradictedFlags: [...contradicted] }
      }

      onSessionChange(next, beforeLives, beforeBoard)
      return next.state.status === 'playing' || next.state.status === 'idle'
    }

    refreshAiHint()
    render()
    return true
  }

  function toggleAiAuto(startRun: () => void): void {
    if (runtime.aiAutoActive) {
      stopAiAuto()
      devLog('Puzzle AI auto stopped')
      render()
      return
    }
    runtime.aiAutoActive = true
    runtime.aiWaitLogged = false
    devLog('Puzzle AI auto started')
    if (runtime.session.state.status === 'idle') {
      startRun()
    }
    scheduleAiStep()
    render()
  }

  return {
    stopAiAuto,
    scheduleAiStep,
    refreshAiHint,
    runAiStep,
    toggleAiAuto,
  }
}
