import type { RunInputEvent } from '../ranked/types.ts'
import { IDB_STORES, idbClear, idbDelete, idbGet, idbGetAll, idbPut } from './idb.ts'

const META_KEYS = {
  playerId: 'playerId',
  displayName: 'displayName',
  anonName: 'anonName',
  selfSnapshot: 'selfSnapshot',
  leaderboardUnseenUpdate: 'leaderboardUnseenUpdate',
  migratedFromLocalStorage: 'migratedFromLocalStorage',
} as const

const LEGACY_LOCAL_STORAGE_KEYS = ['chill-player-id', 'chill-score-history', 'chill-leaderboard-name', 'chill-leaderboard-anon-id', 'chill-leaderboard-self'] as const

const MAX_HISTORY_ENTRIES = 200
const MAX_RUN_TRACES = 50

export interface LeaderboardSelfSnapshot {
  id: string
  name: string
  score: number
  depth?: number
  rank?: number
  countryCode?: string
  submittedAt: number
}

export interface LocalScoreRecord {
  runId: string
  score: number
  depth: number
  submittedAt: number
  status: 'accepted' | 'pending' | 'rejected'
  ranked: boolean
  rank?: number
}

export interface RunTraceRecord {
  runId: string
  seed?: number
  startedAt: number
  updatedAt: number
  finishedAt?: number
  events: RunInputEvent[]
  eventCount: number
  finishStatus?: 'accepted' | 'pending' | 'rejected' | 'active'
  claimedScore?: number
  claimedDepth?: number
  cheating?: boolean
}

interface MetaRow<T> {
  key: string
  value: T
}

const profileCache = {
  playerId: '',
  displayName: '',
  anonName: '',
  selfSnapshot: null as LeaderboardSelfSnapshot | null,
  leaderboardUnseenUpdate: false,
}

let historyCache: LocalScoreRecord[] = []
let initPromise: Promise<void> | null = null

async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await idbGet<MetaRow<T>>(IDB_STORES.meta, key)
  return row?.value
}

async function setMeta<T>(key: string, value: T): Promise<void> {
  await idbPut<MetaRow<T>>(IDB_STORES.meta, { key, value })
}

async function deleteMeta(key: string): Promise<void> {
  await idbDelete(IDB_STORES.meta, key)
}

function normalizeScoreRecord(item: Partial<LocalScoreRecord>): LocalScoreRecord | null {
  if (
    typeof item.runId !== 'string' ||
    typeof item.score !== 'number' ||
    !Number.isFinite(item.score) ||
    typeof item.depth !== 'number' ||
    !Number.isFinite(item.depth) ||
    typeof item.submittedAt !== 'number' ||
    (item.status !== 'accepted' && item.status !== 'pending' && item.status !== 'rejected')
  ) {
    return null
  }
  return {
    runId: item.runId,
    score: item.score,
    depth: item.depth,
    submittedAt: item.submittedAt,
    status: item.status,
    ranked: item.ranked === true,
    rank: typeof item.rank === 'number' ? item.rank : undefined,
  }
}

function normalizeSelfSnapshot(value: unknown): LeaderboardSelfSnapshot | null {
  const parsed = value as Partial<LeaderboardSelfSnapshot>
  if (!parsed?.id || !parsed.name || typeof parsed.score !== 'number') return null
  return {
    id: parsed.id,
    name: parsed.name,
    score: parsed.score,
    depth: typeof parsed.depth === 'number' ? parsed.depth : undefined,
    rank: typeof parsed.rank === 'number' && parsed.rank > 0 ? Math.floor(parsed.rank) : undefined,
    countryCode: typeof parsed.countryCode === 'string' && /^[A-Za-z]{2}$/.test(parsed.countryCode) ? parsed.countryCode.toUpperCase() : undefined,
    submittedAt: typeof parsed.submittedAt === 'number' ? parsed.submittedAt : 0,
  }
}

async function reloadCache(): Promise<void> {
  profileCache.playerId = (await getMeta<string>(META_KEYS.playerId))?.trim() ?? ''
  profileCache.displayName = (await getMeta<string>(META_KEYS.displayName))?.trim() ?? ''
  profileCache.anonName = (await getMeta<string>(META_KEYS.anonName))?.trim() ?? ''
  profileCache.selfSnapshot = normalizeSelfSnapshot(await getMeta<LeaderboardSelfSnapshot>(META_KEYS.selfSnapshot))
  profileCache.leaderboardUnseenUpdate = (await getMeta<boolean>(META_KEYS.leaderboardUnseenUpdate)) === true

  const rows = await idbGetAll<LocalScoreRecord>(IDB_STORES.scoreHistory)
  historyCache = rows
    .map((item) => normalizeScoreRecord(item))
    .filter((item): item is LocalScoreRecord => item !== null)
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, MAX_HISTORY_ENTRIES)
}

async function migrateFromLocalStorage(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  if (await getMeta<boolean>(META_KEYS.migratedFromLocalStorage)) return

  const legacyPlayerId = localStorage.getItem('chill-player-id')?.trim()
  if (legacyPlayerId) await setMeta(META_KEYS.playerId, legacyPlayerId)

  const legacyName = localStorage.getItem('chill-leaderboard-name')?.trim()
  if (legacyName) await setMeta(META_KEYS.displayName, legacyName)

  const legacyAnon = localStorage.getItem('chill-leaderboard-anon-id')?.trim()
  if (legacyAnon) await setMeta(META_KEYS.anonName, legacyAnon)

  const legacySelf = localStorage.getItem('chill-leaderboard-self')
  if (legacySelf) {
    try {
      const snapshot = normalizeSelfSnapshot(JSON.parse(legacySelf))
      if (snapshot) await setMeta(META_KEYS.selfSnapshot, snapshot)
    } catch {
      // ignore invalid legacy payload
    }
  }

  const legacyHistory = localStorage.getItem('chill-score-history')
  if (legacyHistory) {
    try {
      const parsed = JSON.parse(legacyHistory) as unknown
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const record = normalizeScoreRecord(item as Partial<LocalScoreRecord>)
          if (record) await idbPut(IDB_STORES.scoreHistory, record)
        }
      }
    } catch {
      // ignore invalid legacy payload
    }
  }

  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key)
  }
  await setMeta(META_KEYS.migratedFromLocalStorage, true)
}

export function ensureRankedLocalStore(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await migrateFromLocalStorage()
      await reloadCache()
    })()
  }
  return initPromise
}

export function getCachedPlayerId(): string {
  return profileCache.playerId
}

export function getCachedDisplayName(): string {
  return profileCache.displayName
}

export function getCachedLeaderboardSelfSnapshot(): LeaderboardSelfSnapshot | null {
  return profileCache.selfSnapshot
}

export function getCachedScoreHistory(): LocalScoreRecord[] {
  return historyCache
}

export async function ensurePlayerId(): Promise<string> {
  await ensureRankedLocalStore()
  if (profileCache.playerId) return profileCache.playerId

  const id = crypto.randomUUID()
  profileCache.playerId = id
  await setMeta(META_KEYS.playerId, id)
  return id
}

export async function ensureDisplayName(): Promise<string> {
  await ensureRankedLocalStore()
  if (profileCache.displayName) return profileCache.displayName

  if (!profileCache.anonName) {
    profileCache.anonName = `Pilot-${Math.random().toString(36).slice(2, 8)}`
    await setMeta(META_KEYS.anonName, profileCache.anonName)
  }
  return profileCache.anonName
}

export async function saveDisplayName(name: string): Promise<void> {
  await ensureRankedLocalStore()
  const trimmed = name.trim().slice(0, 24)
  profileCache.displayName = trimmed
  await setMeta(META_KEYS.displayName, trimmed)
}

export function getCachedLeaderboardUnseenUpdate(): boolean {
  return profileCache.leaderboardUnseenUpdate
}

export function getCachedBestScore(): number {
  if (profileCache.selfSnapshot) return profileCache.selfSnapshot.score
  if (historyCache.length === 0) return 0
  return [...historyCache].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.depth !== a.depth) return b.depth - a.depth
    return b.submittedAt - a.submittedAt
  })[0]!.score
}

export function getCachedBestDepth(): number {
  if (profileCache.selfSnapshot?.depth !== undefined) return profileCache.selfSnapshot.depth
  if (historyCache.length === 0) return 0
  return [...historyCache].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.depth !== a.depth) return b.depth - a.depth
    return b.submittedAt - a.submittedAt
  })[0]!.depth
}

export function isLeaderboardScoreBreakthrough(score: number, depth: number): boolean {
  const bestScore = getCachedBestScore()
  const bestDepth = getCachedBestDepth()
  if (score > bestScore) return true
  return score === bestScore && depth > bestDepth
}

export async function markLeaderboardUnseenUpdate(): Promise<void> {
  await ensureRankedLocalStore()
  profileCache.leaderboardUnseenUpdate = true
  await setMeta(META_KEYS.leaderboardUnseenUpdate, true)
}

export async function clearLeaderboardUnseenUpdate(): Promise<void> {
  await ensureRankedLocalStore()
  if (!profileCache.leaderboardUnseenUpdate) return
  profileCache.leaderboardUnseenUpdate = false
  await deleteMeta(META_KEYS.leaderboardUnseenUpdate)
}

export async function saveLeaderboardSelfSnapshot(snapshot: LeaderboardSelfSnapshot): Promise<void> {
  await ensureRankedLocalStore()
  profileCache.selfSnapshot = snapshot
  await setMeta(META_KEYS.selfSnapshot, snapshot)
}

export async function appendLocalScoreRecord(record: LocalScoreRecord): Promise<void> {
  await ensureRankedLocalStore()
  historyCache = [record, ...historyCache.filter((item) => item.runId !== record.runId)].slice(0, MAX_HISTORY_ENTRIES)
  await idbPut(IDB_STORES.scoreHistory, record)
}

async function pickBestLocalRecord(): Promise<LocalScoreRecord | null> {
  await ensureRankedLocalStore()
  const verified = historyCache.filter((item) => item.status === 'accepted' || item.status === 'pending')
  if (verified.length === 0) return null
  return [...verified].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.depth !== a.depth) return b.depth - a.depth
    return b.submittedAt - a.submittedAt
  })[0]!
}

export async function upsertLeaderboardSelfSnapshot(snapshot: LeaderboardSelfSnapshot): Promise<void> {
  await saveLeaderboardSelfSnapshot(snapshot)
}

export async function syncLeaderboardSelfFromHistory(playerId: string, name: string): Promise<void> {
  const best = await pickBestLocalRecord()
  if (!best) return
  await saveLeaderboardSelfSnapshot({
    id: playerId,
    name,
    score: best.score,
    depth: best.depth,
    rank: best.rank,
    submittedAt: best.submittedAt,
  })
}

export async function clearAllLocalScores(): Promise<void> {
  await ensureRankedLocalStore()
  historyCache = []
  profileCache.selfSnapshot = null
  profileCache.leaderboardUnseenUpdate = false
  await idbClear(IDB_STORES.scoreHistory)
  await deleteMeta(META_KEYS.selfSnapshot)
  await deleteMeta(META_KEYS.leaderboardUnseenUpdate)
}

export async function clearAllRankedAntiCheatData(): Promise<void> {
  await clearAllLocalScores()
  await idbClear(IDB_STORES.runTraces)
}

export async function createRunTrace(runId: string, seed: number): Promise<void> {
  await ensureRankedLocalStore()
  const now = Date.now()
  const trace: RunTraceRecord = {
    runId,
    seed,
    startedAt: now,
    updatedAt: now,
    events: [],
    eventCount: 0,
  }
  await idbPut(IDB_STORES.runTraces, trace)
  await trimRunTraces()
}

export async function persistRunTraceEvents(runId: string, events: RunInputEvent[]): Promise<void> {
  if (!runId || events.length === 0) return
  await ensureRankedLocalStore()

  const existing = await idbGet<RunTraceRecord>(IDB_STORES.runTraces, runId)
  const now = Date.now()
  const trace: RunTraceRecord = existing
    ? {
        ...existing,
        events,
        eventCount: events.length,
        updatedAt: now,
      }
    : {
        runId,
        startedAt: now,
        updatedAt: now,
        events,
        eventCount: events.length,
      }

  await idbPut(IDB_STORES.runTraces, trace)
}

export async function appendRunTraceEvents(runId: string, batch: RunInputEvent[]): Promise<void> {
  if (!runId || batch.length === 0) return
  await ensureRankedLocalStore()

  const existing = (await idbGet<RunTraceRecord>(IDB_STORES.runTraces, runId)) ?? {
    runId,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    events: [],
    eventCount: 0,
  }

  const events = [...existing.events, ...batch]
  await idbPut(IDB_STORES.runTraces, {
    ...existing,
    events,
    eventCount: events.length,
    updatedAt: Date.now(),
  })
}

export async function finalizeRunTrace(runId: string, patch: Pick<RunTraceRecord, 'finishStatus' | 'claimedScore' | 'claimedDepth' | 'cheating' | 'events'>): Promise<void> {
  await ensureRankedLocalStore()
  const existing = await idbGet<RunTraceRecord>(IDB_STORES.runTraces, runId)
  if (!existing) return

  await idbPut(IDB_STORES.runTraces, {
    ...existing,
    ...patch,
    eventCount: patch.events.length,
    updatedAt: Date.now(),
    finishedAt: Date.now(),
  })
}

async function trimRunTraces(): Promise<void> {
  const traces = await idbGetAll<RunTraceRecord>(IDB_STORES.runTraces)
  if (traces.length <= MAX_RUN_TRACES) return

  const sorted = [...traces].sort((a, b) => b.updatedAt - a.updatedAt)
  for (const trace of sorted.slice(MAX_RUN_TRACES)) {
    await idbDelete(IDB_STORES.runTraces, trace.runId)
  }
}
