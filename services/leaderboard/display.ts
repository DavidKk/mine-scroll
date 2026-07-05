import { entryPlayerId, normalizeLeaderboardEntries } from './merge.ts'
import type { RankedLeaderboardModeId } from './mode.ts'
import type { LeaderboardEntry } from './types.ts'

export const LEADERBOARD_DISPLAY_ROWS = 10

/** Low-score operators merged into sparse endless boards — server only. */
const ENDLESS_FILLER_ENTRIES: LeaderboardEntry[] = [
  {
    id: '8f2c4a91-6b3d-4e1a-9c20-1a4b6d8e0f12',
    playerId: '8f2c4a91-6b3d-4e1a-9c20-1a4b6d8e0f12',
    name: 'Kiro_404',
    score: 128,
    depth: 18,
    countryCode: 'US',
    submittedAt: 1_704_067_200_000,
  },
  {
    id: 'b71e3d84-2a9f-4c6b-8e15-3f9a2c7d4e61',
    playerId: 'b71e3d84-2a9f-4c6b-8e15-3f9a2c7d4e61',
    name: 'DustMite',
    score: 97,
    depth: 14,
    countryCode: 'JP',
    submittedAt: 1_703_980_800_000,
  },
  {
    id: 'c4a8f1e2-7d3b-4f9a-a6c8-2e5b9d1f7a43',
    playerId: 'c4a8f1e2-7d3b-4f9a-a6c8-2e5b9d1f7a43',
    name: 'MonoRail',
    score: 84,
    depth: 11,
    countryCode: 'DE',
    submittedAt: 1_703_894_400_000,
  },
  {
    id: 'd9e2b5f8-1c4a-4d7e-b3f6-8a1c5e9d2b74',
    playerId: 'd9e2b5f8-1c4a-4d7e-b3f6-8a1c5e9d2b74',
    name: 'ZipChip',
    score: 63,
    depth: 9,
    countryCode: 'GB',
    submittedAt: 1_703_808_000_000,
  },
  {
    id: 'e1f6c3a9-5b2d-4e8f-c7a4-9d3e6f1a8c85',
    playerId: 'e1f6c3a9-5b2d-4e8f-c7a4-9d3e6f1a8c85',
    name: 'FogLine',
    score: 41,
    depth: 7,
    countryCode: 'CN',
    submittedAt: 1_703_721_600_000,
  },
  {
    id: 'f3a7d2e5-6c4b-4f1a-d8b5-0e4f7a2c9d96',
    playerId: 'f3a7d2e5-6c4b-4f1a-d8b5-0e4f7a2c9d96',
    name: 'ZeroDay',
    score: 22,
    depth: 5,
    countryCode: 'FR',
    submittedAt: 1_703_635_200_000,
  },
  {
    id: 'a2b8e4f1-7d5c-4a9e-b6c7-1f5a8d3e0b07',
    playerId: 'a2b8e4f1-7d5c-4a9e-b6c7-1f5a8d3e0b07',
    name: 'NullPath',
    score: 19,
    depth: 4,
    countryCode: 'KR',
    submittedAt: 1_703_548_800_000,
  },
  {
    id: 'b3c9f5a2-8e6d-4b0f-c7d8-2a6b9e4f1c18',
    playerId: 'b3c9f5a2-8e6d-4b0f-c7d8-2a6b9e4f1c18',
    name: 'BitDrift',
    score: 15,
    depth: 3,
    countryCode: 'CA',
    submittedAt: 1_703_462_400_000,
  },
  {
    id: 'c4d0a6b3-9f7e-4c1a-d8e9-3b7c0f5a2d29',
    playerId: 'c4d0a6b3-9f7e-4c1a-d8e9-3b7c0f5a2d29',
    name: 'ColdBoot',
    score: 11,
    depth: 2,
    countryCode: 'AU',
    submittedAt: 1_703_376_000_000,
  },
  {
    id: 'd5e1b7c4-0a8f-4d2b-e9f0-4c8d1a6b3e30',
    playerId: 'd5e1b7c4-0a8f-4d2b-e9f0-4c8d1a6b3e30',
    name: 'StaticHum',
    score: 8,
    depth: 1,
    countryCode: 'SG',
    submittedAt: 1_703_289_600_000,
  },
]

/** Puzzle Rush filler roster — distinct names/scores from endless. */
const PUZZLE_RUSH_FILLER_ENTRIES: LeaderboardEntry[] = [
  {
    id: 'pr-01a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    playerId: 'pr-01a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    name: 'StreakAce',
    score: 4_820,
    depth: 26,
    countryCode: 'US',
    submittedAt: 1_704_067_200_000,
  },
  {
    id: 'pr-02b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
    playerId: 'pr-02b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
    name: 'ComboFlux',
    score: 4_360,
    depth: 23,
    countryCode: 'JP',
    submittedAt: 1_703_980_800_000,
  },
  {
    id: 'pr-03c4d5e6-f7a8-4b9c-0d1e-2f3a4b5c6d7e',
    playerId: 'pr-03c4d5e6-f7a8-4b9c-0d1e-2f3a4b5c6d7e',
    name: 'BoardBlitz',
    score: 3_940,
    depth: 21,
    countryCode: 'DE',
    submittedAt: 1_703_894_400_000,
  },
  {
    id: 'pr-04d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f',
    playerId: 'pr-04d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f',
    name: 'ChainMind',
    score: 3_510,
    depth: 19,
    countryCode: 'GB',
    submittedAt: 1_703_808_000_000,
  },
  {
    id: 'pr-05e6f7a8-b9c0-4d1e-2f3a-4b5c6d7e8f9a',
    playerId: 'pr-05e6f7a8-b9c0-4d1e-2f3a-4b5c6d7e8f9a',
    name: 'FlashClear',
    score: 3_080,
    depth: 17,
    countryCode: 'CN',
    submittedAt: 1_703_721_600_000,
  },
  {
    id: 'pr-06f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b',
    playerId: 'pr-06f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b',
    name: 'RushPilot',
    score: 2_640,
    depth: 15,
    countryCode: 'FR',
    submittedAt: 1_703_635_200_000,
  },
  {
    id: 'pr-07a8b9c0-d1e2-4f3a-4b5c-6d7e8f9a0b1c',
    playerId: 'pr-07a8b9c0-d1e2-4f3a-4b5c-6d7e8f9a0b1c',
    name: 'SnapSolve',
    score: 2_210,
    depth: 13,
    countryCode: 'KR',
    submittedAt: 1_703_548_800_000,
  },
  {
    id: 'pr-08b9c0d1-e2f3-4a4b-5c6d-7e8f9a0b1c2d',
    playerId: 'pr-08b9c0d1-e2f3-4a4b-5c6d-7e8f9a0b1c2d',
    name: 'TurboGrid',
    score: 1_780,
    depth: 11,
    countryCode: 'CA',
    submittedAt: 1_703_462_400_000,
  },
  {
    id: 'pr-09c0d1e2-f3a4-4b5c-6d7e-8f9a0b1c2d3e',
    playerId: 'pr-09c0d1e2-f3a4-4b5c-6d7e-8f9a0b1c2d3e',
    name: 'VoltRun',
    score: 1_350,
    depth: 9,
    countryCode: 'AU',
    submittedAt: 1_703_376_000_000,
  },
  {
    id: 'pr-0ad1e2f3-a4b5-4c6d-7e8f-9a0b1c2d3e4f',
    playerId: 'pr-0ad1e2f3-a4b5-4c6d-7e8f-9a0b1c2d3e4f',
    name: 'QuickChord',
    score: 920,
    depth: 7,
    countryCode: 'SG',
    submittedAt: 1_703_289_600_000,
  },
]

function fillerEntriesForMode(modeId: RankedLeaderboardModeId): LeaderboardEntry[] {
  return modeId === 'puzzle-rush' ? PUZZLE_RUSH_FILLER_ENTRIES : ENDLESS_FILLER_ENTRIES
}

/** Pad a sparse board to a full public display list, sorted like the real leaderboard. */
export function padLeaderboardDisplay(entries: LeaderboardEntry[], modeId: RankedLeaderboardModeId = 'endless'): LeaderboardEntry[] {
  const real = normalizeLeaderboardEntries(entries)
  if (real.length >= LEADERBOARD_DISPLAY_ROWS) {
    return real.slice(0, LEADERBOARD_DISPLAY_ROWS)
  }

  const fillers = fillerEntriesForMode(modeId)
    .filter((filler) => !real.some((entry) => entry.id === filler.id || entryPlayerId(entry) === entryPlayerId(filler)))
    .slice(0, LEADERBOARD_DISPLAY_ROWS - real.length)

  // Fillers only pad the count; merge + normalize applies the same sort rules as KV data.
  return normalizeLeaderboardEntries([...real, ...fillers]).slice(0, LEADERBOARD_DISPLAY_ROWS)
}
