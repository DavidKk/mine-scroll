import type { AutoHealReport, Board, DefuseBreakReport, DefuseScoreReport, ModeSession } from './types.ts'

/** Defused mines traded for +1 life (paired with ENDLESS_LIVES design). */
export const MINES_PER_LIFE = 4
/** Base score per defused mine; combo N pays BASE_MINE_SCORE × N. */
export const BASE_MINE_SCORE = 10

/** Matches endless ENDLESS_LIVES. */
export const ENDLESS_MAX_LIVES = 5

/** Unique mine cell key (world row in endless, local row in classic). */
export function mineDefuseKey(board: Board, localRow: number, col: number): string {
  if (board.topology === 'endless' && board.minRow !== undefined) {
    return `${board.minRow + localRow},${col}`
  }
  return `${localRow},${col}`
}

export function getMinesDefused(session: ModeSession): number {
  return session.minesDefused ?? 0
}

/** Correctly flagged mines on a leaving bottom row (not yet banked). */
export function countBankedMinesOnRow(board: Board, localRow: number): number {
  let count = 0
  for (let col = 0; col < board.cols; col += 1) {
    const cell = board.cells[localRow]?.[col]
    if (cell?.isMine && cell.mark === 'flag') count += 1
  }
  return count
}

/** Bottom row scroll-off: bank correctly flagged mines (each world cell once). */
export function applyMineDefuseOnRowScrollOff(
  session: ModeSession,
  board: Board,
  localRow: number
): Pick<ModeSession, 'minesDefused' | 'defusedMineKeys' | 'lives' | 'score' | 'defuseCombo' | 'lastAutoHeal' | 'lastDefuseScore'> | null {
  let added = 0
  const keys = new Set(session.defusedMineKeys ?? [])

  for (let col = 0; col < board.cols; col += 1) {
    const cell = board.cells[localRow]?.[col]
    if (!cell?.isMine || cell.mark !== 'flag') continue
    const mineKey = mineDefuseKey(board, localRow, col)
    if (keys.has(mineKey)) continue
    keys.add(mineKey)
    added += 1
  }

  if (added === 0) return null

  const comboBefore = session.defuseCombo ?? 0
  let comboAfter = comboBefore
  let scoreAdded = 0
  for (let i = 0; i < added; i += 1) {
    comboAfter += 1
    scoreAdded += BASE_MINE_SCORE * comboAfter
  }
  const scoreAfter = (session.score ?? 0) + scoreAdded
  const minesBefore = session.minesDefused ?? 0
  const total = minesBefore + added
  const groupsSpent = Math.floor(total / MINES_PER_LIFE)
  const minesAfter = total % MINES_PER_LIFE
  const livesBefore = session.lives ?? ENDLESS_MAX_LIVES
  const missingLives = Math.max(0, ENDLESS_MAX_LIVES - livesBefore)
  const livesGained = Math.min(groupsSpent, missingLives)
  const livesAfter = livesBefore + livesGained
  const lastAutoHeal: AutoHealReport | undefined =
    groupsSpent > 0
      ? {
          defusedAdded: added,
          groupsSpent,
          livesGained,
          minesBefore,
          minesAfter,
          livesBefore,
          livesAfter,
          scoreAdded,
          comboBefore,
          comboAfter,
        }
      : undefined
  const lastDefuseScore: DefuseScoreReport = {
    defusedAdded: added,
    scoreAdded,
    scoreAfter,
    comboBefore,
    comboAfter,
  }

  return {
    minesDefused: minesAfter,
    defusedMineKeys: [...keys],
    lives: livesAfter,
    score: scoreAfter,
    defuseCombo: comboAfter,
    lastAutoHeal,
    lastDefuseScore,
  }
}

export function clearDefuseStreakOnMistake(session: ModeSession): ModeSession {
  const minesCleared = session.minesDefused ?? 0
  const comboCleared = session.defuseCombo ?? 0
  if (minesCleared === 0 && comboCleared === 0) return session
  const lastDefuseBreak: DefuseBreakReport = {
    minesCleared,
    comboCleared,
  }
  return {
    ...session,
    minesDefused: 0,
    defuseCombo: 0,
    lastDefuseBreak,
  }
}

export function canExchangeHeal(session: ModeSession): boolean {
  if (session.modeId !== 'endless') return false
  if (session.state.status !== 'playing') return false
  return false
}

export function exchangeMinesForLife(session: ModeSession): ModeSession {
  if (!canExchangeHeal(session)) return session
  return {
    ...session,
    lives: (session.lives ?? ENDLESS_MAX_LIVES) + 1,
    minesDefused: getMinesDefused(session) - MINES_PER_LIFE,
  }
}

export function recordMineHitScrollExempt(session: ModeSession, board: Board, cells: Array<{ row: number; col: number }>): ModeSession {
  if (cells.length === 0) return session
  const keys = new Set(session.exemptScrollPenaltyKeys ?? [])
  let added = false
  for (const { row, col } of cells) {
    const mineKey = mineDefuseKey(board, row, col)
    if (keys.has(mineKey)) continue
    keys.add(mineKey)
    added = true
  }
  if (!added) return session
  return { ...session, exemptScrollPenaltyKeys: [...keys] }
}

export function isScrollPenaltyExempt(session: ModeSession, board: Board, localRow: number, col: number): boolean {
  const key = mineDefuseKey(board, localRow, col)
  return session.exemptScrollPenaltyKeys?.includes(key) ?? false
}
