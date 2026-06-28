import { kv } from '@vercel/kv'

import { LeaderboardServiceError } from '../leaderboard/errors.ts'
import { mergeLeaderboardEntry, sanitizeLeaderboardName } from '../leaderboard/merge.ts'
import { LEADERBOARD_KV_KEY, type LeaderboardBoard, type LeaderboardEntry } from '../leaderboard/types.ts'
import { RANKED_CORE_VERSION, RANKED_EVENTS_KEY_PREFIX, RANKED_RUN_KEY_PREFIX, RANKED_RUN_TTL_SECONDS, RANKED_UPLOAD_INTERVAL_MS } from './constants.ts'
import { evaluateRankedRun } from './policy.ts'
import { replayRankedRun } from './replay.ts'
import type { RankedFinishResponse, RankedRunRecord, RankedRunStatus, RunInputEvent } from './types.ts'

export function isRankedKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function runKey(runId: string): string {
  return `${RANKED_RUN_KEY_PREFIX}${runId}`
}

function eventsKey(runId: string): string {
  return `${RANKED_EVENTS_KEY_PREFIX}${runId}`
}

export async function createRankedRun(modeId: 'endless' = 'endless'): Promise<{
  runId: string
  seed: number
  coreVersion: string
  uploadIntervalMs: number
}> {
  if (!isRankedKvConfigured()) {
    throw new LeaderboardServiceError('Ranked storage is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.', 503)
  }
  if (modeId !== 'endless') {
    throw new LeaderboardServiceError('Only endless mode is supported.', 400)
  }

  const runId = crypto.randomUUID()
  const seed = (Math.random() * 0x1_0000_0000) >>> 0
  const record: RankedRunRecord = {
    runId,
    seed,
    modeId,
    coreVersion: RANKED_CORE_VERSION,
    status: 'active',
    createdAt: Date.now(),
    lastEventSeq: 0,
    eventCount: 0,
  }

  await kv.set(runKey(runId), record, { ex: RANKED_RUN_TTL_SECONDS })
  await kv.set(eventsKey(runId), [], { ex: RANKED_RUN_TTL_SECONDS })

  return {
    runId,
    seed,
    coreVersion: RANKED_CORE_VERSION,
    uploadIntervalMs: RANKED_UPLOAD_INTERVAL_MS,
  }
}

export async function getRankedRun(runId: string): Promise<RankedRunRecord | null> {
  if (!isRankedKvConfigured()) return null
  return (await kv.get<RankedRunRecord>(runKey(runId))) ?? null
}

export async function appendRankedEvents(runId: string, seq: number, events: RunInputEvent[]): Promise<void> {
  if (!isRankedKvConfigured()) {
    throw new LeaderboardServiceError('Ranked storage is not configured.', 503)
  }

  const record = await getRankedRun(runId)
  if (!record) {
    throw new LeaderboardServiceError('Run not found.', 404)
  }
  if (record.status !== 'active') {
    throw new LeaderboardServiceError('Run is no longer accepting events.', 409)
  }
  if (seq !== record.lastEventSeq + 1) {
    throw new LeaderboardServiceError('Invalid event sequence.', 409)
  }
  if (!Array.isArray(events) || events.length === 0) {
    throw new LeaderboardServiceError('Events batch is required.', 400)
  }

  const existing = (await kv.get<RunInputEvent[]>(eventsKey(runId))) ?? []
  const merged = [...existing, ...events]
  const next: RankedRunRecord = {
    ...record,
    lastEventSeq: seq,
    eventCount: merged.length,
  }

  await kv.set(eventsKey(runId), merged, { ex: RANKED_RUN_TTL_SECONDS })
  await kv.set(runKey(runId), next, { ex: RANKED_RUN_TTL_SECONDS })
}

export async function finishRankedRun(runId: string, displayName: string, claimedScore: unknown, claimedDepth: unknown): Promise<RankedFinishResponse> {
  if (!isRankedKvConfigured()) {
    throw new LeaderboardServiceError('Ranked storage is not configured.', 503)
  }

  const record = await getRankedRun(runId)
  if (!record) {
    throw new LeaderboardServiceError('Run not found.', 404)
  }
  if (record.status !== 'active') {
    return toPublicFinishResponse(record)
  }

  const cleanName = sanitizeLeaderboardName(displayName)
  if (!cleanName) {
    throw new LeaderboardServiceError('Display name is required.', 400)
  }

  const score = sanitizeClaimedScore(claimedScore)
  const depth = sanitizeClaimedDepth(claimedDepth)
  if (score <= 0) {
    throw new LeaderboardServiceError('Score must be greater than zero.', 400)
  }

  const events = (await kv.get<RunInputEvent[]>(eventsKey(runId))) ?? []
  const replay = replayRankedRun(record.seed, events)

  let status: RankedRunStatus = 'rejected'
  let riskFlags: string[] = ['replay_failed']

  if (replay.replayOk && replay.sessionScore === score && replay.sessionDepth === depth) {
    const policy = evaluateRankedRun(replay)
    riskFlags = policy.riskFlags
    status = policy.decision === 'accepted' ? 'accepted' : policy.decision === 'review' ? 'pending' : 'rejected'
  } else if (replay.replayOk) {
    riskFlags = ['score_mismatch']
  }

  const finished: RankedRunRecord = {
    ...record,
    status,
    finishedAt: Date.now(),
    displayName: cleanName,
    claimedScore: score,
    claimedDepth: depth,
    verifiedScore: replay.sessionScore,
    verifiedDepth: replay.sessionDepth,
    riskFlags,
  }

  await kv.set(runKey(runId), finished, { ex: RANKED_RUN_TTL_SECONDS })

  if (status === 'accepted') {
    await upsertVerifiedLeaderboardEntry({
      id: runId,
      name: cleanName,
      score: replay.sessionScore,
      depth: replay.sessionDepth,
      submittedAt: finished.finishedAt!,
    })
  }

  return toPublicFinishResponse(finished)
}

function sanitizeClaimedScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(99_999_999, Math.floor(n)))
}

function sanitizeClaimedDepth(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(99_999, Math.floor(n)))
}

async function upsertVerifiedLeaderboardEntry(entry: LeaderboardEntry & { depth: number }): Promise<void> {
  const board = (await kv.get<LeaderboardBoard>(LEADERBOARD_KV_KEY)) ?? { entries: [], updatedAt: 0 }
  const nextEntries = mergeLeaderboardEntry(
    board.entries.filter((item) => item.id !== entry.id),
    entry
  )
  await kv.set(LEADERBOARD_KV_KEY, { entries: nextEntries, updatedAt: Date.now() })
}

function toPublicFinishResponse(record: RankedRunRecord): RankedFinishResponse {
  return {
    status: record.status,
    score: record.verifiedScore ?? record.claimedScore,
    depth: record.verifiedDepth ?? record.claimedDepth,
  }
}

export function toPublicRunStatus(record: RankedRunRecord): RankedFinishResponse {
  return toPublicFinishResponse(record)
}
