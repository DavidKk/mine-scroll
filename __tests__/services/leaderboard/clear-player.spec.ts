import { deleteJsonKv, getJsonKv, setJsonKv } from '@/services/kv/client'
import { clearPlayerLeaderboard } from '@/services/leaderboard/store'
import { LEADERBOARD_KV_KEY, LEADERBOARD_PLAYER_KEY_PREFIX, type LeaderboardEntry } from '@/services/leaderboard/types'

const PLAYER_ID = 'd2f02160-0000-4000-8000-000000000001'
const originalNodeEnv = process.env.NODE_ENV

function entry(score: number): LeaderboardEntry {
  return {
    id: PLAYER_ID,
    playerId: PLAYER_ID,
    name: 'Pilot',
    score,
    depth: 10,
    submittedAt: Date.now(),
  }
}

describe('services/leaderboard/clearPlayerLeaderboard', () => {
  beforeEach(async () => {
    process.env.NODE_ENV = 'development'
    await deleteJsonKv(LEADERBOARD_KV_KEY)
    await deleteJsonKv(`${LEADERBOARD_PLAYER_KEY_PREFIX}${PLAYER_ID}`)
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('removes player from board and personal best', async () => {
    await setJsonKv(LEADERBOARD_KV_KEY, { entries: [entry(500)], updatedAt: 1 })
    await setJsonKv(`${LEADERBOARD_PLAYER_KEY_PREFIX}${PLAYER_ID}`, entry(500))

    const result = await clearPlayerLeaderboard(PLAYER_ID)
    expect(result).toEqual({ removedFromBoard: true, removedBest: true })

    const board = await getJsonKv<{ entries: LeaderboardEntry[] }>(LEADERBOARD_KV_KEY)
    expect(board?.entries).toHaveLength(0)
    expect(await getJsonKv(`${LEADERBOARD_PLAYER_KEY_PREFIX}${PLAYER_ID}`)).toBeNull()
  })

  it('is idempotent when player has no records', async () => {
    const result = await clearPlayerLeaderboard(PLAYER_ID)
    expect(result).toEqual({ removedFromBoard: false, removedBest: false })
  })
})
