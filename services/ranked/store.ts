import { sanitizeCountryCode } from '../geoip/request.ts'
import { getJsonKv, isKvConfigured, setJsonKv, setJsonKvEx } from '../kv/client.ts'
import { LeaderboardServiceError } from '../leaderboard/errors.ts'
import { normalizeLeaderboardEntries, sanitizeLeaderboardName, sanitizePlayerId, upsertPlayerBestEntry } from '../leaderboard/merge.ts'
import { LEADERBOARD_KV_KEY, type LeaderboardBoard } from '../leaderboard/types.ts'
import { RANKED_CORE_VERSION, RANKED_EVENTS_KEY_PREFIX, RANKED_RUN_KEY_PREFIX, RANKED_RUN_TTL_SECONDS, RANKED_UPLOAD_INTERVAL_MS } from './constants.ts'
import { logger, shortPlayerId, shortRunId } from './logger.ts'
import { evaluateRankedRun } from './policy.ts'
import { replayRankedRun } from './replay.ts'
import type { RankedFinishResponse, RankedRunRecord, RankedRunStatus, RunInputEvent } from './types.ts'

export function isRankedKvConfigured(): boolean {
  return isKvConfigured()
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
    throw new LeaderboardServiceError('Ranked storage is not configured. Link Vercel KV to this project.', 503)
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

  await setJsonKvEx(runKey(runId), record, RANKED_RUN_TTL_SECONDS)
  await setJsonKvEx(eventsKey(runId), [], RANKED_RUN_TTL_SECONDS)

  logger.ok('run created', { runId: shortRunId(runId), seed, modeId, coreVersion: RANKED_CORE_VERSION })

  return {
    runId,
    seed,
    coreVersion: RANKED_CORE_VERSION,
    uploadIntervalMs: RANKED_UPLOAD_INTERVAL_MS,
  }
}

export async function getRankedRun(runId: string): Promise<RankedRunRecord | null> {
  if (!isRankedKvConfigured()) return null
  return (await getJsonKv<RankedRunRecord>(runKey(runId))) ?? null
}

export async function appendRankedEvents(runId: string, seq: number, events: RunInputEvent[]): Promise<void> {
  if (!isRankedKvConfigured()) {
    throw new LeaderboardServiceError('Ranked storage is not configured. Link Vercel KV to this project.', 503)
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

  const existing = (await getJsonKv<RunInputEvent[]>(eventsKey(runId))) ?? []
  const merged = [...existing, ...events]
  const next: RankedRunRecord = {
    ...record,
    lastEventSeq: seq,
    eventCount: merged.length,
  }

  await setJsonKvEx(eventsKey(runId), merged, RANKED_RUN_TTL_SECONDS)
  await setJsonKvEx(runKey(runId), next, RANKED_RUN_TTL_SECONDS)

  logger.info('events appended', {
    runId: shortRunId(runId),
    seq,
    batch: events.length,
    total: merged.length,
  })
}

export async function finishRankedRun(
  runId: string,
  playerIdInput: unknown,
  displayName: string,
  claimedScore: unknown,
  claimedDepth: unknown,
  eventsFallback: RunInputEvent[] = [],
  countryCodeInput?: unknown
): Promise<RankedFinishResponse> {
  if (!isRankedKvConfigured()) {
    throw new LeaderboardServiceError('Ranked storage is not configured. Link Vercel KV to this project.', 503)
  }

  const record = await getRankedRun(runId)
  if (!record) {
    logger.warn('finish run not found', { runId: shortRunId(runId) })
    throw new LeaderboardServiceError('Run not found.', 404)
  }
  if (record.status !== 'active') {
    logger.info('finish skipped inactive run', { runId: shortRunId(runId), status: record.status })
    return {
      ...toPublicFinishResponse(record),
      cheating: record.status === 'rejected',
    }
  }

  const playerId = sanitizePlayerId(playerIdInput)
  if (!playerId) {
    throw new LeaderboardServiceError('Player id is required.', 400)
  }

  const cleanName = sanitizeLeaderboardName(displayName)
  if (!cleanName) {
    throw new LeaderboardServiceError('Display name is required.', 400)
  }

  const countryCode = sanitizeCountryCode(countryCodeInput)

  const score = sanitizeClaimedScore(claimedScore)
  const depth = sanitizeClaimedDepth(claimedDepth)
  if (score <= 0) {
    throw new LeaderboardServiceError('Score must be greater than zero.', 400)
  }

  const eventsFromKv = (await getJsonKv<RunInputEvent[]>(eventsKey(runId))) ?? []
  const events = eventsFromKv.length > 0 ? eventsFromKv : Array.isArray(eventsFallback) && eventsFallback.length > 0 ? eventsFallback : []

  if (eventsFromKv.length === 0 && events.length > 0) {
    await setJsonKvEx(eventsKey(runId), events, RANKED_RUN_TTL_SECONDS)
    logger.info('finish used client event fallback', { runId: shortRunId(runId), eventCount: events.length })
  }

  logger.info('finish started', {
    runId: shortRunId(runId),
    playerId: shortPlayerId(playerId),
    name: cleanName,
    claimedScore: score,
    claimedDepth: depth,
    eventCount: events.length,
  })

  const replay = replayRankedRun(record.seed, events)

  let status: RankedRunStatus = 'rejected'
  let riskFlags: string[] = ['replay_failed']
  let verifiedScore = replay.sessionScore
  let verifiedDepth = replay.sessionDepth
  const devBypass = process.env.NODE_ENV === 'development'

  if (devBypass) {
    status = 'accepted'
    verifiedScore = score
    verifiedDepth = depth
    riskFlags = replay.replayOk ? [] : ['dev_bypass_replay_failed']
    if (replay.replayOk && (replay.sessionScore !== score || replay.sessionDepth !== depth)) {
      riskFlags = ['dev_bypass_claimed_score']
    }
  } else if (replay.replayOk && replay.sessionScore === score && replay.sessionDepth === depth) {
    const policy = evaluateRankedRun(replay)
    riskFlags = policy.riskFlags
    status = policy.decision === 'accepted' ? 'accepted' : policy.decision === 'review' ? 'pending' : 'rejected'
  } else if (replay.replayOk) {
    riskFlags = ['score_mismatch']
  }

  logger.info('replay finished', {
    runId: shortRunId(runId),
    replayOk: replay.replayOk,
    verifiedScore: replay.sessionScore,
    verifiedDepth: replay.sessionDepth,
    replayError: replay.replayError,
    status,
    riskFlags,
  })

  const finished: RankedRunRecord = {
    ...record,
    status,
    finishedAt: Date.now(),
    displayName: cleanName,
    claimedScore: score,
    claimedDepth: depth,
    verifiedScore,
    verifiedDepth,
    riskFlags,
  }

  await setJsonKvEx(runKey(runId), finished, RANKED_RUN_TTL_SECONDS)

  let ranked = false
  let saved = false
  let rank: number | undefined

  if (status === 'accepted') {
    const board = (await getJsonKv<LeaderboardBoard>(LEADERBOARD_KV_KEY)) ?? { entries: [], updatedAt: 0 }
    const upsert = upsertPlayerBestEntry(normalizeLeaderboardEntries(board.entries), {
      id: playerId,
      playerId,
      name: cleanName,
      score: verifiedScore,
      depth: verifiedDepth,
      ...(countryCode ? { countryCode } : {}),
      submittedAt: finished.finishedAt!,
    })
    ranked = upsert.rank !== null
    rank = upsert.rank ?? undefined

    if (upsert.saved) {
      const persisted = await setJsonKv(LEADERBOARD_KV_KEY, { entries: upsert.entries, updatedAt: Date.now() })
      saved = persisted
      if (persisted) {
        logger.ok('leaderboard saved', {
          runId: shortRunId(runId),
          playerId: shortPlayerId(playerId),
          rank,
          score: verifiedScore,
          depth: verifiedDepth,
        })
      } else {
        logger.warn('leaderboard persist failed', {
          runId: shortRunId(runId),
          playerId: shortPlayerId(playerId),
          score: verifiedScore,
        })
      }
    } else {
      saved = false
      logger.info('leaderboard not updated', {
        runId: shortRunId(runId),
        playerId: shortPlayerId(playerId),
        score: verifiedScore,
        reason: ranked ? 'not_personal_best' : 'not_top_100',
      })
    }
  } else if (status === 'rejected') {
    logger.warn('run rejected', {
      runId: shortRunId(runId),
      playerId: shortPlayerId(playerId),
      riskFlags,
      cheating: true,
    })
  } else if (status === 'pending') {
    logger.warn('run pending review', {
      runId: shortRunId(runId),
      playerId: shortPlayerId(playerId),
      riskFlags,
    })
  }

  return {
    ...toPublicFinishResponse(finished),
    ranked,
    saved,
    rank,
    cheating: devBypass ? false : status === 'rejected',
  }
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
