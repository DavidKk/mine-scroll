import { hitTestCellWithLayout } from './hit-test.ts'
import type { DerivedPlayerAction, InputChainMetrics, LayoutSnapshot, RunInputEvent } from './types.ts'

const MOVE_WINDOW_MS = 500
const MOVE_MIN_INTERVAL_MS = 40
const MOVE_MIN_DISTANCE_PX = 2

export function validateEventTimeline(events: RunInputEvent[]): string | null {
  let lastT = -1
  for (const event of events) {
    if (!Number.isFinite(event.t) || event.t < 0) return 'Invalid event timestamp'
    if (event.t < lastT) return 'Event timestamps must be monotonic'
    lastT = event.t
  }
  return null
}

function isBothButtons(buttons?: number): boolean {
  if (buttons === undefined) return false
  return (buttons & 1) !== 0 && (buttons & 2) !== 0
}

function metricsForDown(down: Extract<RunInputEvent, { e: 'down' }>, moves: Array<Extract<RunInputEvent, { e: 'move' }>>): InputChainMetrics {
  const windowMoves = moves.filter((move) => move.t >= down.t - MOVE_WINDOW_MS && move.t <= down.t)
  let pathLengthPx = 0
  for (let i = 1; i < windowMoves.length; i += 1) {
    const prev = windowMoves[i - 1]!
    const next = windowMoves[i]!
    pathLengthPx += Math.hypot(next.x - prev.x, next.y - prev.y)
  }
  const first = windowMoves[0]
  const last = windowMoves[windowMoves.length - 1]
  const straight = first && last ? Math.hypot(last.x - first.x, last.y - first.y) : 0
  const straightLineRatio = pathLengthPx > 0 ? straight / pathLengthPx : straight > 0 ? 1 : 0

  return {
    moveSamplesBeforeDown: windowMoves.length,
    pathLengthPx,
    straightLineRatio,
  }
}

export function derivePlayerActions(events: RunInputEvent[]): {
  actions: DerivedPlayerAction[]
  metrics: InputChainMetrics[]
  layout: LayoutSnapshot | null
  beginT: number
} {
  let layout: LayoutSnapshot | null = null
  let beginT = 0
  const moves: Array<Extract<RunInputEvent, { e: 'move' }>> = []
  const actions: DerivedPlayerAction[] = []
  const metrics: InputChainMetrics[] = []

  for (const event of events) {
    if (event.e === 'layout') {
      layout = event.layout
      continue
    }
    if (event.e === 'begin') {
      beginT = event.t
      continue
    }
    if (event.e === 'move') {
      const last = moves[moves.length - 1]
      if (last) {
        const dt = event.t - last.t
        const dist = Math.hypot(event.x - last.x, event.y - last.y)
        if (dt < MOVE_MIN_INTERVAL_MS && dist < MOVE_MIN_DISTANCE_PX) continue
      }
      moves.push(event)
      continue
    }
    if (!layout) continue

    if (event.e === 'key' && event.code === 'Space') {
      actions.push({ t: event.t, kind: 'scroll', manual: true })
      continue
    }

    const hitFrom = (x: number, y: number) => hitTestCellWithLayout(layout!, x, y)

    if (event.e === 'dbl') {
      const cell = hitFrom(event.x, event.y)
      if (cell) {
        actions.push({ t: event.t, kind: 'chord', screenRow: cell.row, col: cell.col })
      }
      continue
    }

    if (event.e === 'ctx') {
      const cell = hitFrom(event.x, event.y)
      if (cell) {
        actions.push({ t: event.t, kind: 'flag', screenRow: cell.row, col: cell.col })
      }
      continue
    }

    if (event.e === 'down') {
      const cell = hitFrom(event.x, event.y)
      if (!cell) continue
      metrics.push(metricsForDown(event, moves))

      if (isBothButtons(event.buttons)) {
        actions.push({ t: event.t, kind: 'chord', screenRow: cell.row, col: cell.col })
        continue
      }

      if (event.btn === 2) {
        actions.push({ t: event.t, kind: 'flag', screenRow: cell.row, col: cell.col })
        continue
      }

      if (event.btn === 0) {
        actions.push({ t: event.t, kind: 'reveal', screenRow: cell.row, col: cell.col })
      }
    }
  }

  return { actions, metrics, layout, beginT }
}
