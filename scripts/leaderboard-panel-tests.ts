import assert from 'node:assert/strict'

import { buildLeaderboardViewModel, type LeaderboardEntryView } from '../game-client/app/game-session/leaderboard-panel.ts'
import { isLeaderboardScoreBreakthrough } from '../game-client/storage/ranked-local-store.ts'

const playerId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee'

function entry(overrides: Partial<LeaderboardEntryView> & Pick<LeaderboardEntryView, 'id' | 'name' | 'score'>): LeaderboardEntryView {
  return {
    submittedAt: 1,
    ...overrides,
  }
}

export function testLeaderboardViewModelKeepsSelfInRankedList(): void {
  const self = {
    id: playerId,
    name: 'Pilot-d4mlnd',
    score: 6310,
    depth: 40,
    submittedAt: 2,
  }
  const entries = [entry({ id: playerId, playerId, name: 'Pilot-d4mlnd', score: 6310, depth: 40 }), entry({ id: 'other-1', name: 'Pilot', score: 42, depth: 3 })]

  const view = buildLeaderboardViewModel(entries, { selfSnapshot: self, playerId })

  assert.equal(view.pinned?.rank, 1)
  assert.equal(view.pinned?.entry.name, 'Pilot-d4mlnd')
  assert.equal(view.ranked.length, 2)
  assert.equal(view.ranked[0]?.rank, 1)
  assert.equal(view.ranked[0]?.isSelf, true)
  assert.equal(view.ranked[1]?.rank, 2)
}

export function testLeaderboardScoreBreakthroughWithEmptyHistory(): void {
  assert.equal(isLeaderboardScoreBreakthrough(200, 6), true)
}

export function testLeaderboardViewModelShowsSelfFromServerWithoutSnapshot(): void {
  const entries = [entry({ id: playerId, playerId, name: 'Pilot-d4mlnd', score: 6310, depth: 40 }), entry({ id: 'other-1', name: 'Pilot', score: 42, depth: 3 })]

  const view = buildLeaderboardViewModel(entries, { selfSnapshot: null, playerId })

  assert.equal(view.pinned?.rank, 1)
  assert.equal(view.pinned?.entry.score, 6310)
  assert.equal(view.ranked[0]?.isSelf, true)
}

export function testLeaderboardViewModelWithoutSelfSnapshotHasNoPinnedSelf(): void {
  const view = buildLeaderboardViewModel([entry({ id: 'other-1', name: 'Kiro_404', score: 128 })])

  assert.equal(view.pinned, null)
  assert.equal(view.ranked[0]?.rank, 1)
}

export function testLeaderboardViewModelUsesSnapshotRankWhenOffBoard(): void {
  const self = {
    id: playerId,
    name: 'Pilot-d4mlnd',
    score: 42,
    depth: 3,
    rank: 101,
    submittedAt: 2,
  }
  const entries = [entry({ id: 'other-1', name: 'Kiro_404', score: 128, depth: 18 })]

  const view = buildLeaderboardViewModel(entries, { selfSnapshot: self, playerId })

  assert.equal(view.pinned?.rank, 101)
  assert.equal(view.pinned?.entry.score, 42)
  assert.equal(
    view.ranked.some((row) => row.isSelf),
    false
  )
}
