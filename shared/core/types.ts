export type CellMark = 'none' | 'flag'

export interface Cell {
  isMine: boolean
  adjacentMines: number
  revealed: boolean
  mark: CellMark
}

export interface Board {
  rows: number
  cols: number
  mineCount: number
  cells: Cell[][]
  minesPlaced: boolean
  topology: 'endless'
  minRow: number
  maxRow: number
  worldSeed: number
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost'

export type GameModeId = 'endless'

export interface GameState {
  status: GameStatus
  board: Board
  modeId: GameModeId
}

export type LifeLossCause = 'mine-reveal' | 'chord-mine' | 'scroll-bottom'

export type LifeLossCellKind = 'mine-hit' | 'mine-unflagged' | 'wrong-flag' | 'unrevealed'

export interface LifeLossCell {
  localRow: number
  col: number
  screenRow: number
  kind: LifeLossCellKind
}

export interface LifeLossReport {
  cause: LifeLossCause
  damage: number
  cells: LifeLossCell[]
  boardChange: string
  reason: string
}

export interface AutoHealReport {
  defusedAdded: number
  groupsSpent: number
  livesGained: number
  minesBefore: number
  minesAfter: number
  livesBefore: number
  livesAfter: number
  scoreAdded: number
  comboBefore: number
  comboAfter: number
}

export interface DefuseScoreReport {
  defusedAdded: number
  scoreAdded: number
  scoreAfter: number
  comboBefore: number
  comboAfter: number
}

export interface DefuseBreakReport {
  minesCleared: number
  comboCleared: number
}

/** @deprecated Legacy settings-panel / game-config only; endless mode does not use it. */
export interface Difficulty {
  id: string
  rows: number
  cols: number
  mines: number
}

export interface CellView {
  row: number
  col: number
  revealed: boolean
  flagged: boolean
  adjacentMines: number | null
  isMine: boolean | null
  mineHit?: boolean
  preview?: boolean
  fxKey?: string
}

export interface ModeSession {
  modeId: GameModeId
  state: GameState
  endlessOriginMinRow?: number
  endlessViewStart?: number
  /** Playable screen rows (default desktop {@link ENDLESS_VISIBLE_ROWS}). */
  endlessVisibleRows?: number
  scrollRowCount?: number
  lives?: number
  revealedCount?: number
  minesDefused?: number
  score?: number
  defuseCombo?: number
  pendingRevealKeys?: string[]
  defusedMineKeys?: string[]
  exemptScrollPenaltyKeys?: string[]
  hitMineKeys?: string[]
  aiOscillationBlocked?: string[]
  aiContradictedFlags?: string[]
  lastLifeLoss?: LifeLossReport
  lastAutoHeal?: AutoHealReport
  lastDefuseScore?: DefuseScoreReport
  lastDefuseBreak?: DefuseBreakReport
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

export function isCellBlocked(cell: Cell): boolean {
  return cell.mark !== 'none'
}
