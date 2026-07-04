import { createSessionWithSeed } from '@shared/core/modes/engine.ts'
import { createPuzzleRushSession } from '@shared/core/modes/puzzle-rush/index.ts'

import type { RankedFinishResponse, RunInputEvent } from './types.ts'

export type RankedModeId = 'endless' | 'puzzle-rush'

export interface RankedRunStart {
  runId: string
  seed: number
  coreVersion: string
  uploadIntervalMs: number
}

export async function createRankedRunOnServer(modeId: RankedModeId = 'endless'): Promise<RankedRunStart> {
  const response = await fetch('/api/ranked/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modeId }),
  })
  const body = (await response.json().catch(() => null)) as RankedRunStart & { error?: string }
  if (!response.ok) {
    throw new Error(body?.error ?? 'Failed to create ranked run')
  }
  return body
}

export function createRankedSession(seed: number) {
  return createSessionWithSeed(seed, 'expert')
}

export function createPuzzleRushRankedSession(seed: number) {
  return createPuzzleRushSession(seed)
}

export async function finishRankedRunOnServer(
  runId: string,
  playerId: string,
  name: string,
  claimedScore: number,
  claimedDepth: number,
  events: RunInputEvent[] = []
): Promise<RankedFinishResponse & { entries?: Array<{ id: string; name: string; score: number; depth?: number; submittedAt: number }> }> {
  const response = await fetch(`/api/ranked/runs/${runId}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, name, claimedScore, claimedDepth, events }),
  })
  const body = (await response.json().catch(() => null)) as RankedFinishResponse & {
    error?: string
    entries?: Array<{ id: string; name: string; score: number; depth?: number; submittedAt: number }>
  }
  if (!response.ok) {
    throw new Error(body?.error ?? 'Failed to finish ranked run')
  }
  return body
}
