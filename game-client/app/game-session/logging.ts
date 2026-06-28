import type { AiMove } from '@shared/core/ai/types.ts'
import { ENDLESS_VISIBLE_ROWS, getEndlessScrollProfile } from '@shared/core/modes/endless/index.ts'
import { MINES_PER_LIFE } from '@shared/core/modes/engine.ts'
import type { LifeLossReport, ModeSession } from '@shared/core/types.ts'

import { devLog } from './dev-log.ts'
import type { CanvasLogController, GameSessionRuntime, SessionApplyContext, SessionApplyDeps } from './types.ts'

export function formatCell(row: number, col: number): string {
  return `(${row},${col})`
}

export function createGameLog(runtime: GameSessionRuntime, repaint: () => void): CanvasLogController {
  return {
    append(text, kind = 'system') {
      runtime.recentLogLines.push({
        time: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        text,
        kind,
      })
      while (runtime.recentLogLines.length > 80) {
        runtime.recentLogLines.shift()
      }
      repaint()
    },
    clear() {
      runtime.recentLogLines.length = 0
      repaint()
    },
  }
}

function logLifeLoss(gameLog: CanvasLogController, before: number, after: number, report?: LifeLossReport, context?: SessionApplyContext): void {
  const delta = before - after
  const positions = report && report.cells.length > 0 ? report.cells.map((c) => formatCell(c.screenRow, c.col)).join(' ') : '—'
  gameLog.append(`−${delta} life · ${after} left · ${positions}`, 'danger')
  if (context?.trigger) {
    devLog(`Life loss trigger: ${context.trigger}`)
  }
  if (report?.reason) {
    devLog(`Life loss reason: ${report.reason}`)
  }
  if (report?.boardChange) {
    devLog(`Life loss board: ${report.boardChange}`)
  }
}

export function logLifeChange(gameLog: CanvasLogController, before: number | undefined, after: number | undefined, report?: LifeLossReport, context?: SessionApplyContext): void {
  if (before === undefined || after === undefined || after >= before) return
  logLifeLoss(gameLog, before, after, report, context)
}

function debugCellSymbol(next: ModeSession, row: number, col: number, report?: LifeLossReport): string {
  const hit = report?.cells.some((c) => c.localRow === row && c.col === col) === true
  const cell = next.state.board.cells[row]?.[col]
  if (!cell) return ' '
  if (hit && cell.isMine) return 'X'
  if (hit) return '!'
  if (cell.mark === 'flag') return cell.isMine ? 'F' : 'f'
  if (cell.isMine) return '*'
  if (!cell.revealed) return '?'
  return cell.adjacentMines === 0 ? '.' : String(cell.adjacentMines)
}

function appendDeathDebug(
  gameLog: CanvasLogController,
  next: ModeSession,
  getScrollElapsedMs: () => number,
  beforeLives?: number,
  report?: LifeLossReport,
  context?: SessionApplyContext
): void {
  const elapsed = getScrollElapsedMs()
  const profile = getEndlessScrollProfile(elapsed)
  const depth = next.scrollRowCount ?? 0
  const seed = next.state.board.worldSeed ?? 'n/a'
  const interval = profile ? `${(profile.intervalMs / 1000).toFixed(1)}s` : 'n/a'
  const batch = profile ? `×${profile.batchRows}` : 'n/a'
  const before = beforeLives ?? 'n/a'
  const after = next.lives ?? 'n/a'

  devLog(`Death review: mode=${next.modeId} seed=${seed} ↑${depth} lives ${before}→${after} interval=${interval} batch=${batch} elapsed=${Math.round(elapsed / 1000)}s`)
  if (context?.trigger) {
    devLog(`Review trigger: ${context.trigger}`)
  }
  if (report && report.cells.length > 0) {
    const cells = report.cells.map((c) => `screen(${c.screenRow},${c.col}) local(${c.localRow},${c.col}) ${c.kind}`).join(' | ')
    devLog(`Review cells: ${cells}`)
  }

  const board = next.state.board
  const start = next.endlessViewStart ?? Math.max(0, board.rows - ENDLESS_VISIBLE_ROWS)
  const end = Math.min(board.rows, start + ENDLESS_VISIBLE_ROWS)
  devLog('Review board legend: X=trigger mine !=trigger safe *=mine F=correct flag f=wrong flag ?=hidden .=0')
  for (let row = start; row < end; row += 1) {
    const screenRow = row - start
    const cells = Array.from({ length: board.cols }, (_, col) => debugCellSymbol(next, row, col, report)).join(' ')
    devLog(`Review board r${String(screenRow).padStart(2, '0')} ${cells}`)
  }
}

export function logAiMove(gameLog: CanvasLogController, move: AiMove, screenRow: number, col: number): void {
  if (move.kind === 'heal') {
    gameLog.append(`AI heal · ${move.reason}`, 'ai')
    return
  }
  if (move.kind === 'scroll') {
    gameLog.append(`AI scroll · ${move.reason}`, 'ai')
    return
  }
  const prefix = move.confidence === 'guess' ? 'guess ' : ''
  const kind = move.kind === 'chord' ? 'Chord' : move.kind === 'flag' ? 'flag' : move.kind === 'unflag' ? 'unflag' : 'reveal'
  gameLog.append(`AI ${prefix}${kind} ${formatCell(screenRow, col)} · ${move.reason}`, 'ai')
}

export function logPlayerAction(gameLog: CanvasLogController, kind: 'reveal' | 'flag' | 'Chord', screenRow: number, col: number): void {
  gameLog.append(`Player ${kind} ${formatCell(screenRow, col)}`, 'player')
}

function logMinesDefusedChange(gameLog: CanvasLogController, before: number | undefined, after: number | undefined): void {
  const prev = before ?? 0
  const next = after ?? 0
  if (next <= prev) return
  gameLog.append(`Defused +${next - prev} · total ${next} (${MINES_PER_LIFE}→1 life)`, 'system')
}

function logAutoHeal(runtime: GameSessionRuntime, gameLog: CanvasLogController, next: ModeSession): boolean {
  const report = next.lastAutoHeal
  if (!report) return false

  if (report.scoreAdded > 0) {
    runtime.presentation.eventId += 1
    runtime.presentation.scoreEvent = {
      id: runtime.presentation.eventId,
      scoreAdded: report.scoreAdded,
      scoreAfter: next.score ?? 0,
      comboAfter: report.comboAfter,
    }
  }

  gameLog.append(`Defuse combo +${report.defusedAdded} · ×${report.comboAfter} · +${report.scoreAdded} pts · total ${next.score ?? 0}`, 'system')
  gameLog.append(`Defuse progress ${report.minesAfter}/${MINES_PER_LIFE}`, 'system')
  const spent = report.groupsSpent * MINES_PER_LIFE
  if (report.livesGained > 0) {
    gameLog.append(`Auto heal +${report.livesGained} life · −${spent} defused · now ${report.livesAfter} lives`, 'system')
  } else {
    gameLog.append(`Full lives auto settle · −${spent} defused · no stored heal group`, 'system')
  }
  return true
}

function logDefuseScore(runtime: GameSessionRuntime, gameLog: CanvasLogController, next: ModeSession): boolean {
  const report = next.lastDefuseScore
  if (!report) return false
  if (report.scoreAdded > 0) {
    runtime.presentation.eventId += 1
    runtime.presentation.scoreEvent = {
      id: runtime.presentation.eventId,
      scoreAdded: report.scoreAdded,
      scoreAfter: next.score ?? 0,
      comboAfter: report.comboAfter,
    }
  }
  gameLog.append(`Defuse combo +${report.defusedAdded} · ×${report.comboAfter} · +${report.scoreAdded} pts · total ${report.scoreAfter}`, 'system')
  gameLog.append(`Defuse progress ${next.minesDefused ?? 0}/${MINES_PER_LIFE}`, 'system')
  return true
}

function logDefuseBreak(runtime: GameSessionRuntime, gameLog: CanvasLogController, next: ModeSession): void {
  const report = next.lastDefuseBreak
  if (!report) return
  runtime.presentation.eventId += 1
  runtime.presentation.breakEvent = {
    id: runtime.presentation.eventId,
    comboCleared: report.comboCleared,
    minesCleared: report.minesCleared,
  }
  gameLog.append(`Mistake break · defused ${report.minesCleared}→0 · combo ×${report.comboCleared}→0`, 'danger')
}

function recordLifeLossPopup(runtime: GameSessionRuntime, next: ModeSession): void {
  const report = next.lastLifeLoss
  if (!report) return
  runtime.presentation.eventId += 1
  runtime.presentation.lifeLossEvent = {
    id: runtime.presentation.eventId,
    damage: report.damage,
    cause: report.cause,
    comboCleared: next.lastDefuseBreak?.comboCleared,
    minesCleared: next.lastDefuseBreak?.minesCleared,
  }
}

export function applySessionUpdate(deps: SessionApplyDeps, next: ModeSession, beforeLives?: number, context?: SessionApplyContext): void {
  const { runtime, gameLog, getScrollElapsedMs } = deps
  const prev = runtime.session

  if (!logAutoHeal(runtime, gameLog, next) && !logDefuseScore(runtime, gameLog, next)) {
    logMinesDefusedChange(gameLog, prev.minesDefused, next.minesDefused)
  }
  logDefuseBreak(runtime, gameLog, next)
  recordLifeLossPopup(runtime, next)
  logLifeChange(gameLog, beforeLives, next.lives, next.lastLifeLoss, context)
  if (prev.state.status !== 'lost' && next.state.status === 'lost') {
    appendDeathDebug(gameLog, next, getScrollElapsedMs, beforeLives, next.lastLifeLoss, context)
  }

  runtime.session = {
    ...next,
    lastLifeLoss: undefined,
    lastAutoHeal: undefined,
    lastDefuseScore: undefined,
    lastDefuseBreak: undefined,
  }
}
