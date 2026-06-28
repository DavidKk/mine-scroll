import { entryPlayerId, normalizeLeaderboardEntries } from './merge.ts'
import type { LeaderboardEntry } from './types.ts'

export const LEADERBOARD_DISPLAY_ROWS = 10

/** Low-score operators merged into sparse public boards — server only. */
const LEADERBOARD_FILLER_ENTRIES: LeaderboardEntry[] = [
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

/** Pad a sparse board to a full public display list, sorted like the real leaderboard. */
export function padLeaderboardDisplay(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const real = normalizeLeaderboardEntries(entries)
  if (real.length >= LEADERBOARD_DISPLAY_ROWS) {
    return real.slice(0, LEADERBOARD_DISPLAY_ROWS)
  }

  const fillers = LEADERBOARD_FILLER_ENTRIES.filter((filler) => !real.some((entry) => entry.id === filler.id || entryPlayerId(entry) === entryPlayerId(filler))).slice(
    0,
    LEADERBOARD_DISPLAY_ROWS - real.length
  )

  // Fillers only pad the count; merge + normalize applies the same sort rules as KV data.
  return normalizeLeaderboardEntries([...real, ...fillers]).slice(0, LEADERBOARD_DISPLAY_ROWS)
}
