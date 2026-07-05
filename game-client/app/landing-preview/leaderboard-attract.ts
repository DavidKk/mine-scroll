import type { LeaderboardSelfSnapshot } from '../../storage/ranked-local-store.ts'
import { createLeaderboardPanel, type LeaderboardEntryView, type LeaderboardPanel } from '../game-session/leaderboard-panel.ts'

/** Static attract-mode rows — never fetched from the live API. */
export const MOCK_LEADERBOARD_ENTRIES: LeaderboardEntryView[] = [
  { id: 'mock-1', name: 'NeonDrift', score: 18_420, depth: 47, submittedAt: 0 },
  { id: 'mock-2', name: 'ZeroFlag', score: 16_880, depth: 44, submittedAt: 0 },
  { id: 'mock-3', name: 'GridRunner', score: 15_260, depth: 41, submittedAt: 0 },
  { id: 'mock-4', name: 'CipherX', score: 14_120, depth: 38, submittedAt: 0 },
  { id: 'mock-5', name: 'DeepScan', score: 12_940, depth: 35, submittedAt: 0 },
  { id: 'mock-6', name: 'PulseWave', score: 11_700, depth: 32, submittedAt: 0 },
  { id: 'mock-7', name: 'ArcLight', score: 10_480, depth: 29, submittedAt: 0 },
  { id: 'mock-8', name: 'MineWalker', score: 9_860, depth: 27, submittedAt: 0 },
  { id: 'mock-9', name: 'StaticLine', score: 9_120, depth: 25, submittedAt: 0 },
  { id: 'mock-10', name: 'VoidHop', score: 8_640, depth: 23, submittedAt: 0 },
]

const MOCK_SELF_PLAYER_ID = 'landing-demo-self'

function createMockSelfSnapshot(score: number, depth: number): LeaderboardSelfSnapshot {
  return {
    id: MOCK_SELF_PLAYER_ID,
    name: 'Guest Operator',
    score,
    depth,
    rank: 38,
    submittedAt: Date.now() - 3_600_000,
  }
}

export interface LeaderboardAttractContext {
  score: number
  depth: number
}

export interface LeaderboardAttractHandle {
  show(context?: LeaderboardAttractContext): void
  hide(): void
  dispose(): void
}

export function mountLeaderboardAttract(parent: HTMLElement): LeaderboardAttractHandle {
  const attractData = {
    entries: MOCK_LEADERBOARD_ENTRIES,
    self: createMockSelfSnapshot(2_860, 12),
    subtitle: 'Ranked endless · verified top 100',
  }

  let panel!: LeaderboardPanel

  panel = createLeaderboardPanel(parent, {
    modeId: 'endless',
    isRankedMode: () => true,
    onClose: () => panel.setOpen(false),
    attractMode: attractData,
  })

  return {
    show(context) {
      if (context) {
        attractData.self = createMockSelfSnapshot(context.score, context.depth)
      }
      panel.setOpen(true)
    },
    hide() {
      panel.setOpen(false)
    },
    dispose() {
      panel.dispose()
    },
  }
}
