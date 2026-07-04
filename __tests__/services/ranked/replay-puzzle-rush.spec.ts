import { derivePlayerActions } from '@/services/ranked/derive'
import { replayPuzzleRushRun } from '@/services/ranked/replay-puzzle-rush'
import type { LayoutSnapshot, RunInputEvent } from '@/services/ranked/types'

const layout: LayoutSnapshot = {
  w: 400,
  h: 600,
  ox: 0,
  oy: 80,
  rows: 7,
  cols: 7,
  previewRows: 0,
  gridOriginX: 8,
  gridOriginY: 96,
  cellSize: 48,
  cellStep: 50,
  cellGap: 2,
}

function cellCenter(col: number, row: number): { x: number; y: number } {
  const x = layout.ox + layout.gridOriginX + col * layout.cellStep + layout.cellSize / 2
  const y = layout.oy + layout.gridOriginY + row * layout.cellStep + layout.cellSize / 2
  return { x, y }
}

describe('services/ranked/replay-puzzle-rush', () => {
  it('replays a seeded puzzle rush run from act events', () => {
    const seed = 123456
    const center = cellCenter(3, 3)
    const events: RunInputEvent[] = [
      { t: 0, e: 'begin' },
      { t: 5, e: 'layout', layout },
      { t: 30, e: 'move', x: center.x, y: center.y },
      { t: 50, e: 'down', btn: 0, x: center.x, y: center.y, buttons: 1 },
      { t: 320, e: 'act', kind: 'reveal', row: 3, col: 3 },
    ]

    const derived = derivePlayerActions(events)
    expect(derived.actions).toHaveLength(1)

    const replay = replayPuzzleRushRun(seed, events)
    expect(replay.replayOk).toBe(true)
    expect(replay.sessionScore).toBeGreaterThanOrEqual(0)
    expect(replay.sessionDepth).toBeGreaterThanOrEqual(0)
  })

  it('rejects empty action timelines', () => {
    const replay = replayPuzzleRushRun(42, [{ t: 0, e: 'begin' }])
    expect(replay.replayOk).toBe(false)
    expect(replay.replayError).toMatch(/No player actions/)
  })
})
