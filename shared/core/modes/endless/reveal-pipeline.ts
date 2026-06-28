import { cloneBoard, type Coord } from '../../board.ts'
import type { Board, Cell, GameStatus, ModeSession } from '../../types.ts'
import { cellKey, isCellBlocked } from '../../types.ts'
import { ENDLESS_LIVES, ENDLESS_PENDING_REVEAL_LOOKAHEAD_ROWS, ENDLESS_PENDING_REVEAL_MAX_PER_SYNC, ENDLESS_PREVIEW_SOURCE_ROWS, ENDLESS_VISIBLE_ROWS } from './constants.ts'
import { compactAndBufferBoard, getLocalNeighbors, localRowFromWorld, parseWorldCellKey, recomputeAllAdjacent, visibleViewStart, worldCellKey } from './grid.ts'

export interface RevealBounds {
  startRow: number
  endRow: number
}

function visibleBounds(board: Board): RevealBounds {
  const startRow = visibleViewStart(board)
  return {
    startRow,
    endRow: Math.min(board.rows, startRow + ENDLESS_VISIBLE_ROWS),
  }
}

/** Player-actionable row range (includes top half-hidden preview row). */
export function actionableBounds(board: Board): RevealBounds {
  const startRow = visibleViewStart(board)
  const previewStart = Math.max(0, startRow - ENDLESS_PREVIEW_SOURCE_ROWS)
  return {
    startRow: startRow > 0 ? previewStart : startRow,
    endRow: Math.min(board.rows, startRow + ENDLESS_VISIBLE_ROWS),
  }
}

export function inRevealBounds(row: number, bounds?: RevealBounds): boolean {
  if (!bounds) return true
  return row >= bounds.startRow && row < bounds.endRow
}

export function toScreenRow(localRow: number, viewStart: number): number {
  return localRow - viewStart
}

function canAutoRevealCell(cell: Cell): boolean {
  return !cell.revealed && !isCellBlocked(cell) && !cell.isMine
}

function prunePendingRevealKeys(board: Board, keys: Iterable<string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const k of keys) {
    if (seen.has(k)) continue
    const parsed = parseWorldCellKey(k)
    if (!parsed) continue
    const localRow = localRowFromWorld(board, parsed.worldRow)
    if (localRow === null || parsed.col < 0 || parsed.col >= board.cols) continue
    const cell = board.cells[localRow]?.[parsed.col]
    if (!cell || cell.revealed || cell.isMine || isCellBlocked(cell)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

function floodReveal(board: Board, startRow: number, startCol: number, bounds?: RevealBounds): void {
  const queue: Coord[] = [{ row: startRow, col: startCol }]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { row, col } = queue.shift()!
    if (!inRevealBounds(row, bounds)) continue
    const key = cellKey(row, col)
    if (visited.has(key)) continue
    visited.add(key)

    const cell = board.cells[row]![col]!
    if (isCellBlocked(cell) || cell.revealed) continue

    cell.revealed = true
    if (cell.isMine) continue

    if (cell.adjacentMines === 0) {
      for (const neighbor of getLocalNeighbors(board, row, col)) {
        if (inRevealBounds(neighbor.row, bounds)) queue.push(neighbor)
      }
    }
  }
}

export function revealSingle(board: Board, row: number, col: number, bounds?: RevealBounds): 'mine' | 'safe' {
  if (!inRevealBounds(row, bounds)) return 'safe'
  const cell = board.cells[row]![col]!
  if (cell.revealed || isCellBlocked(cell)) return 'safe'

  if (cell.isMine) {
    cell.revealed = true
    return 'mine'
  }

  if (cell.adjacentMines === 0) {
    floodReveal(board, row, col, bounds)
  } else {
    cell.revealed = true
  }

  return 'safe'
}

export function countNewlyRevealed(before: Board, after: Board): number {
  let count = 0
  for (let row = 0; row < after.rows; row += 1) {
    for (let col = 0; col < after.cols; col += 1) {
      if (after.cells[row]![col]!.revealed && !before.cells[row]![col]!.revealed) {
        count += 1
      }
    }
  }
  return count
}

function revealAllMines(board: Board): void {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!
      if (cell.isMine) cell.revealed = true
    }
  }
}

export function applyLifeLoss(session: ModeSession, board: Board, damage: number, status: GameStatus = 'playing', lifeLoss?: import('../../types.ts').LifeLossReport): ModeSession {
  const lives = (session.lives ?? ENDLESS_LIVES) - damage
  const hitMineKeys = new Set(session.hitMineKeys ?? [])
  if (damage > 0 && lifeLoss) {
    for (const cell of lifeLoss.cells) {
      if (cell.kind === 'mine-hit') hitMineKeys.add(worldCellKey(board, cell.localRow, cell.col))
    }
  }
  if (lives <= 0) {
    revealAllMines(board)
    return {
      ...session,
      state: { ...session.state, board, status: 'lost' },
      lives: 0,
      hitMineKeys: [...hitMineKeys],
      lastLifeLoss: damage > 0 ? lifeLoss : undefined,
    }
  }
  return {
    ...session,
    state: { ...session.state, board, status },
    lives,
    hitMineKeys: [...hitMineKeys],
    lastLifeLoss: damage > 0 ? lifeLoss : undefined,
  }
}

function applyPendingReveals(board: Board, pendingKeys: Iterable<string>): { pendingRevealKeys: string[]; revealed: number } {
  const bounds = visibleBounds(board)
  const before = cloneBoard(board)
  const remaining: string[] = []

  for (const k of prunePendingRevealKeys(board, pendingKeys)) {
    const parsed = parseWorldCellKey(k)!
    const localRow = localRowFromWorld(board, parsed.worldRow)
    if (localRow === null) continue
    if (!inRevealBounds(localRow, bounds)) {
      remaining.push(k)
      continue
    }
    const cell = board.cells[localRow]?.[parsed.col]
    if (!cell || !canAutoRevealCell(cell)) continue
    revealSingle(board, localRow, parsed.col, bounds)
  }

  return {
    pendingRevealKeys: prunePendingRevealKeys(board, remaining),
    revealed: countNewlyRevealed(before, board),
  }
}

function collectPendingRevealsFromVisibleTop(board: Board, pendingKeys: Iterable<string>): string[] {
  const bounds = actionableBounds(board)
  const minPendingRow = Math.max(0, bounds.startRow - ENDLESS_PENDING_REVEAL_LOOKAHEAD_ROWS)
  const pending = new Set(prunePendingRevealKeys(board, pendingKeys))
  const queued = new Set<string>()
  const queue: Coord[] = []
  let added = 0

  function enqueue(row: number, col: number): void {
    if (row < minPendingRow || row >= bounds.startRow || col < 0 || col >= board.cols) return
    const cell = board.cells[row]?.[col]
    if (!cell || !canAutoRevealCell(cell)) return
    const k = cellKey(row, col)
    if (queued.has(k)) return
    queued.add(k)
    queue.push({ row, col })
  }

  for (let row = bounds.startRow; row < bounds.endRow; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]?.[col]
      if (!cell?.revealed || cell.isMine || cell.adjacentMines !== 0) continue
      for (const nb of getLocalNeighbors(board, row, col)) {
        enqueue(nb.row, nb.col)
      }
    }
  }

  queue.sort((a, b) => b.row - a.row || a.col - b.col)

  while (queue.length > 0 && added < ENDLESS_PENDING_REVEAL_MAX_PER_SYNC) {
    const { row, col } = queue.shift()!
    const cell = board.cells[row]?.[col]
    if (!cell || !canAutoRevealCell(cell)) continue
    const k = worldCellKey(board, row, col)
    if (!pending.has(k)) {
      pending.add(k)
      added += 1
    }
    if (cell.adjacentMines === 0) {
      for (const nb of getLocalNeighbors(board, row, col)) {
        enqueue(nb.row, nb.col)
      }
    }
  }

  return prunePendingRevealKeys(board, pending)
}

export function syncPendingReveals(session: ModeSession, board: Board): { pendingRevealKeys: string[]; revealed: number } {
  const applied = applyPendingReveals(board, session.pendingRevealKeys ?? [])
  return {
    pendingRevealKeys: collectPendingRevealsFromVisibleTop(board, applied.pendingRevealKeys),
    revealed: applied.revealed,
  }
}

export function finalizeBoard(session: ModeSession, board: Board, status?: GameStatus): { session: ModeSession; autoRevealed: number } {
  const compacted = compactAndBufferBoard(board, session.scrollRowCount ?? 0)
  recomputeAllAdjacent(compacted)
  const pending = syncPendingReveals(session, compacted)
  return {
    session: {
      ...session,
      state: {
        ...session.state,
        board: compacted,
        status: status ?? session.state.status,
      },
      endlessViewStart: visibleViewStart(compacted),
      pendingRevealKeys: pending.pendingRevealKeys,
    },
    autoRevealed: pending.revealed,
  }
}
