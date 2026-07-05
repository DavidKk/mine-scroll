'use client'

import { useEffect, useState } from 'react'

import type { RankedLeaderboardModeId } from '@/services/leaderboard/mode'

import { LANDING_LB_VISIBLE_ROWS } from './landing-leaderboard.constants'
import { LandingLeaderboardView, type LeaderboardBoardState, type LeaderboardTabId } from './landing-leaderboard-view'

function idleBoard(): LeaderboardBoardState {
  return { entries: [], status: 'idle' }
}

async function fetchLeaderboard(modeId: RankedLeaderboardModeId) {
  const response = await fetch(`/api/leaderboard?mode=${encodeURIComponent(modeId)}`, { method: 'GET' })
  const body = (await response.json().catch(() => null)) as { error?: string; entries?: LeaderboardBoardState['entries'] } | null
  if (!response.ok) {
    throw new Error(body?.error ?? 'Failed to load leaderboard')
  }
  return body?.entries ?? []
}

export function LandingLeaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardTabId>('endless')
  const [boards, setBoards] = useState<Record<LeaderboardTabId, LeaderboardBoardState>>({
    endless: idleBoard(),
    'puzzle-rush': idleBoard(),
  })

  useEffect(() => {
    const modeId = activeTab
    let cancelled = false

    setBoards((prev) => {
      const current = prev[modeId]
      if (current.status === 'ready') return prev
      return {
        ...prev,
        [modeId]: { ...current, status: 'loading', error: undefined },
      }
    })

    void (async () => {
      try {
        const entries = await fetchLeaderboard(modeId)
        if (cancelled) return
        setBoards((prev) => ({
          ...prev,
          [modeId]: { entries: entries.slice(0, LANDING_LB_VISIBLE_ROWS), status: 'ready' },
        }))
      } catch (error) {
        if (cancelled) return
        setBoards((prev) => ({
          ...prev,
          [modeId]: {
            entries: [],
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to load leaderboard',
          },
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeTab])

  return <LandingLeaderboardView activeTab={activeTab} boards={boards} onTabChange={setActiveTab} />
}
