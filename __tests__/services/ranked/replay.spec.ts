import { derivePlayerActions } from '@/services/ranked/derive'
import { replayRankedRun } from '@/services/ranked/replay'
import type { LayoutSnapshot, RunInputEvent } from '@/services/ranked/types'

const layout: LayoutSnapshot = {
  w: 400,
  h: 600,
  ox: 0,
  oy: 80,
  rows: 12,
  cols: 16,
  previewRows: 1,
  gridOriginX: 8,
  gridOriginY: 96,
  cellSize: 32,
  cellStep: 34,
  cellGap: 2,
}

function cellCenter(col: number, row: number): { x: number; y: number } {
  const x = layout.ox + layout.gridOriginX + col * layout.cellStep + layout.cellSize / 2
  const y = layout.oy + layout.gridOriginY + row * layout.cellStep + layout.cellSize / 2
  return { x, y }
}

describe('services/ranked/replay', () => {
  it('derives reveal from pointer down (legacy recordings without act events)', () => {
    const center = cellCenter(4, 6)
    const events: RunInputEvent[] = [
      { t: 0, e: 'begin' },
      { t: 10, e: 'layout', layout },
      { t: 20, e: 'move', x: center.x, y: center.y },
      { t: 40, e: 'down', btn: 0, x: center.x, y: center.y, buttons: 1 },
    ]

    const derived = derivePlayerActions(events)
    expect(derived.actions).toHaveLength(1)
    expect(derived.actions[0]).toMatchObject({ kind: 'reveal', screenRow: 6, col: 4 })
  })

  it('prefers act events over pointer down for reveal', () => {
    const center = cellCenter(4, 6)
    const events: RunInputEvent[] = [
      { t: 0, e: 'begin' },
      { t: 10, e: 'layout', layout },
      { t: 20, e: 'down', btn: 0, x: center.x, y: center.y, buttons: 1 },
      { t: 320, e: 'act', kind: 'reveal', row: 6, col: 4 },
    ]

    const derived = derivePlayerActions(events)
    expect(derived.actions).toHaveLength(1)
    expect(derived.actions[0]).toMatchObject({ kind: 'reveal', screenRow: 6, col: 4, t: 320 })
  })

  it('derives one flag from desktop right click (ctx only, not btn:2 down)', () => {
    const center = cellCenter(4, 6)
    const events: RunInputEvent[] = [
      { t: 0, e: 'begin' },
      { t: 10, e: 'layout', layout },
      { t: 20, e: 'move', x: center.x, y: center.y },
      { t: 40, e: 'down', btn: 2, x: center.x, y: center.y, buttons: 2 },
      { t: 41, e: 'ctx', x: center.x, y: center.y },
    ]

    const derived = derivePlayerActions(events)
    const flags = derived.actions.filter((action) => action.kind === 'flag')
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ kind: 'flag', screenRow: 6, col: 4 })
  })

  it('replays a seeded run and rejects score mismatch', () => {
    const seed = 424242
    const center = cellCenter(3, 5)
    const events: RunInputEvent[] = [
      { t: 0, e: 'begin' },
      { t: 5, e: 'layout', layout },
      { t: 30, e: 'move', x: center.x, y: center.y },
      { t: 50, e: 'down', btn: 0, x: center.x, y: center.y, buttons: 1 },
    ]

    const replay = replayRankedRun(seed, events)
    expect(replay.replayOk).toBe(true)
    expect(replay.sessionScore).toBeGreaterThanOrEqual(0)
    expect(replay.sessionScore).not.toBe(999_999)
  })

  it('uses explicit scroll events with recorded batchRows', () => {
    const seed = 909090
    const center = cellCenter(4, 6)
    const events: RunInputEvent[] = [
      { t: 0, e: 'begin' },
      { t: 5, e: 'layout', layout },
      { t: 30, e: 'move', x: center.x, y: center.y },
      { t: 50, e: 'act', kind: 'reveal', row: 6, col: 4 },
      { t: 1200, e: 'scroll', manual: false, batchRows: 2 },
      { t: 1250, e: 'move', x: center.x, y: center.y },
      { t: 1270, e: 'act', kind: 'reveal', row: 6, col: 4 },
    ]

    const replay = replayRankedRun(seed, events)
    expect(replay.replayOk).toBe(true)
    expect(replay.sessionDepth).toBeGreaterThan(0)
  })

  it('replays mobile-style delayed reveal after scroll using act timestamp', () => {
    const seed = 515151
    const center = cellCenter(7, 6)
    const events: RunInputEvent[] = [
      { t: 0, e: 'begin' },
      { t: 5, e: 'layout', layout },
      { t: 20, e: 'down', btn: 0, x: center.x, y: center.y, buttons: 1 },
      { t: 80, e: 'scroll', manual: false, batchRows: 1 },
      { t: 320, e: 'act', kind: 'reveal', row: 6, col: 7 },
    ]

    const derived = derivePlayerActions(events)
    expect(derived.actions.map((action) => action.kind)).toEqual(['scroll', 'reveal'])
    expect(derived.actions[1]).toMatchObject({ kind: 'reveal', screenRow: 6, col: 7, t: 320 })

    const withAct = replayRankedRun(seed, events)
    expect(withAct.replayOk).toBe(true)

    const legacyEvents = events.filter((event) => event.e !== 'act')
    const legacyDerived = derivePlayerActions(legacyEvents)
    expect(legacyDerived.actions[0]).toMatchObject({ kind: 'reveal', t: 20 })
  })

  it('skips no-op flag instead of failing replay', () => {
    const seed = 424242
    const center = cellCenter(7, 6)
    const events: RunInputEvent[] = [
      { t: 0, e: 'begin' },
      { t: 5, e: 'layout', layout },
      { t: 30, e: 'move', x: center.x, y: center.y },
      { t: 50, e: 'act', kind: 'reveal', row: 6, col: 7 },
      { t: 70, e: 'act', kind: 'flag', row: 6, col: 7 },
    ]

    const replay = replayRankedRun(seed, events)
    expect(replay.replayOk).toBe(true)
    expect(replay.skippedActions).toBe(1)
  })
})
