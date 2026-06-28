export type { LeaderboardSelfSnapshot, LocalScoreRecord, RunTraceRecord } from '../storage/ranked-local-store.ts'
export {
  appendLocalScoreRecord,
  clearAllLocalScores,
  clearAllRankedAntiCheatData,
  clearLeaderboardUnseenUpdate,
  ensureDisplayName,
  ensurePlayerId,
  ensureRankedLocalStore,
  getCachedDisplayName,
  getCachedLeaderboardSelfSnapshot,
  getCachedLeaderboardUnseenUpdate,
  getCachedPlayerId,
  getCachedScoreHistory,
  isLeaderboardScoreBreakthrough,
  markLeaderboardUnseenUpdate,
  saveDisplayName,
  saveLeaderboardSelfSnapshot,
  syncLeaderboardSelfFromHistory,
} from '../storage/ranked-local-store.ts'

/** @deprecated Use ensurePlayerId() */
export { ensurePlayerId as resolvePlayerId } from '../storage/ranked-local-store.ts'
