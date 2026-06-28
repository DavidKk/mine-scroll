import type { LayoutSnapshot, RunInputEvent } from './types.ts'

const MOVE_MIN_INTERVAL_MS = 40
const MOVE_MIN_DISTANCE_PX = 2

export interface RankedInputRecorderOptions {
  onEvent?: (event: RunInputEvent, events: RunInputEvent[]) => void
}

export interface RankedInputRecorder {
  isActive(): boolean
  start(): void
  stop(): void
  markBegin(): void
  recordLayout(layout: LayoutSnapshot): void
  recordMove(x: number, y: number): void
  recordDown(btn: 0 | 2, x: number, y: number, buttons?: number): void
  recordUp(btn: 0 | 2, x: number, y: number): void
  recordDoubleClick(x: number, y: number): void
  recordContextMenu(x: number, y: number): void
  recordSpace(): void
  drain(): RunInputEvent[]
  peek(): RunInputEvent[]
  elapsedMs(): number
}

export function createRankedInputRecorder(options: RankedInputRecorderOptions = {}): RankedInputRecorder {
  const { onEvent } = options
  let active = false
  let startedAt = 0
  const events: RunInputEvent[] = []
  let lastMove: Extract<RunInputEvent, { e: 'move' }> | null = null
  let lastLayoutKey = ''

  function nowT(): number {
    return startedAt > 0 ? Math.max(0, performance.now() - startedAt) : 0
  }

  function push(event: RunInputEvent): void {
    if (!active) return
    events.push(event)
    onEvent?.(event, events)
  }

  return {
    isActive() {
      return active
    },
    start() {
      active = true
      startedAt = performance.now()
      events.length = 0
      lastMove = null
      lastLayoutKey = ''
    },
    stop() {
      active = false
    },
    markBegin() {
      push({ t: nowT(), e: 'begin' })
    },
    recordLayout(layout) {
      const key = JSON.stringify(layout)
      if (key === lastLayoutKey) return
      lastLayoutKey = key
      push({ t: nowT(), e: 'layout', layout })
    },
    recordMove(x, y) {
      const t = nowT()
      if (lastMove) {
        const dt = t - lastMove.t
        const dist = Math.hypot(x - lastMove.x, y - lastMove.y)
        if (dt < MOVE_MIN_INTERVAL_MS && dist < MOVE_MIN_DISTANCE_PX) return
      }
      const move = { t, e: 'move' as const, x: Math.round(x), y: Math.round(y) }
      lastMove = move
      push(move)
    },
    recordDown(btn, x, y, buttons) {
      push({ t: nowT(), e: 'down', btn, x: Math.round(x), y: Math.round(y), buttons })
    },
    recordUp(btn, x, y) {
      push({ t: nowT(), e: 'up', btn, x: Math.round(x), y: Math.round(y) })
    },
    recordDoubleClick(x, y) {
      push({ t: nowT(), e: 'dbl', x: Math.round(x), y: Math.round(y) })
    },
    recordContextMenu(x, y) {
      push({ t: nowT(), e: 'ctx', x: Math.round(x), y: Math.round(y) })
    },
    recordSpace() {
      push({ t: nowT(), e: 'key', code: 'Space' })
    },
    drain() {
      const batch = events.splice(0, events.length)
      lastMove = null
      return batch
    },
    peek() {
      return [...events]
    },
    elapsedMs() {
      return nowT()
    },
  }
}
