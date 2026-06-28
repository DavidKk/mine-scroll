export type RankedRunStatus = 'active' | 'pending' | 'accepted' | 'rejected'

export type RunInputEvent =
  | { t: number; e: 'move'; x: number; y: number }
  | { t: number; e: 'down'; btn: 0 | 2; x: number; y: number; buttons?: number }
  | { t: number; e: 'up'; btn: 0 | 2; x: number; y: number }
  | { t: number; e: 'dbl'; x: number; y: number }
  | { t: number; e: 'ctx'; x: number; y: number }
  | { t: number; e: 'key'; code: 'Space' }
  | { t: number; e: 'begin' }
  | { t: number; e: 'layout'; layout: LayoutSnapshot }

export interface LayoutSnapshot {
  w: number
  h: number
  ox: number
  oy: number
  rows: number
  cols: number
  previewRows: number
  gridOriginX: number
  gridOriginY: number
  cellSize: number
  cellStep: number
  cellGap: number
}

export interface RankedRunRecord {
  runId: string
  seed: number
  modeId: 'endless'
  coreVersion: string
  status: RankedRunStatus
  createdAt: number
  finishedAt?: number
  claimedScore?: number
  claimedDepth?: number
  displayName?: string
  verifiedScore?: number
  verifiedDepth?: number
  lastEventSeq: number
  eventCount: number
  riskFlags?: string[]
}

export type DerivedPlayerAction =
  | { t: number; kind: 'reveal'; screenRow: number; col: number }
  | { t: number; kind: 'flag'; screenRow: number; col: number }
  | { t: number; kind: 'chord'; screenRow: number; col: number }
  | { t: number; kind: 'scroll'; manual: true }

export interface InputChainMetrics {
  moveSamplesBeforeDown: number
  pathLengthPx: number
  straightLineRatio: number
}

export interface ShadowAiMetrics {
  comparedMoves: number
  aiMoveMatches: number
  aiMoveMatchRate: number
}

export interface ReplayResult {
  replayOk: boolean
  replayError?: string
  sessionScore: number
  sessionDepth: number
  inputMetrics: InputChainMetrics[]
  shadowAi: ShadowAiMetrics
}

export interface PolicyDecision {
  decision: 'accepted' | 'rejected' | 'review'
  inputChainScore: number
  shadowAiScore: number
  riskFlags: string[]
}

export interface RankedFinishResponse {
  status: RankedRunStatus
  /** Whether this player appears on the top-100 board after verification. */
  ranked?: boolean
  /** Whether this run updated the server leaderboard for the player. */
  saved?: boolean
  rank?: number
  score?: number
  depth?: number
  /** Anti-cheat rejected the run — client should clear local score history. */
  cheating?: boolean
}
