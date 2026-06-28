import { collectConstraints, type Constraint, type Deduction, isDirectSafe, key, parseKey, wouldViolateCluesIfFlagged } from './deduction.ts'
import type { SolverBoard } from './session-board.ts'

export const MAX_CSP_VARS = 16

export function frontierCells(board: SolverBoard, deduced: Deduction): string[] {
  const out = new Set<string>()

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (!board.inConstraints(row, col)) continue
      const cell = board.cell(row, col)
      if (!cell?.revealed || cell.adjacentMines === null || cell.adjacentMines === 0) continue

      for (const nb of board.neighbors(row, col)) {
        const nc = board.cell(nb.row, nb.col)
        if (!nc || nc.revealed) continue
        const k = key(nb.row, nb.col)
        if (deduced.safe.has(k) || deduced.mines.has(k)) continue
        out.add(k)
      }
    }
  }

  return [...out]
}

export function constraintComponents(frontier: string[], constraints: Constraint[]): string[][] {
  const parent = new Map<string, string>()
  for (const k of frontier) parent.set(k, k)

  function find(k: string): string {
    const p = parent.get(k)!
    if (p !== k) parent.set(k, find(p))
    return parent.get(k)!
  }

  function unite(a: string, b: string): void {
    parent.set(find(a), find(b))
  }

  const frontierSet = new Set(frontier)
  for (const c of constraints) {
    const touch = [...c.cells].filter((k) => frontierSet.has(k))
    for (let i = 1; i < touch.length; i += 1) unite(touch[0]!, touch[i]!)
  }

  const groups = new Map<string, string[]>()
  for (const k of frontier) {
    const root = find(k)
    const g = groups.get(root) ?? []
    g.push(k)
    groups.set(root, g)
  }

  return [...groups.values()]
}

export function enumerateMineProbabilities(vars: string[], constraints: Constraint[], deduced: Deduction): Map<string, number> | null {
  if (vars.length === 0 || vars.length > MAX_CSP_VARS) return null

  const varSet = new Set(vars)
  const relevant = constraints.filter((c) => [...c.cells].some((k) => varSet.has(k)))
  const n = vars.length
  const mineProb = new Map<string, number>()
  for (const k of vars) mineProb.set(k, 0)

  let total = 0

  for (let mask = 0; mask < 1 << n; mask += 1) {
    const assignment = new Map<string, boolean>()
    for (let i = 0; i < n; i += 1) {
      assignment.set(vars[i]!, ((mask >> i) & 1) === 1)
    }

    let ok = true
    for (const c of relevant) {
      let mineCount = 0
      for (const k of c.cells) {
        if (deduced.safe.has(k)) continue
        if (deduced.mines.has(k)) {
          mineCount += 1
          continue
        }
        if (!varSet.has(k)) continue
        if (assignment.get(k)) mineCount += 1
      }
      if (mineCount !== c.mines) {
        ok = false
        break
      }
    }

    if (!ok) continue
    total += 1
    for (const k of vars) {
      if (assignment.get(k)) mineProb.set(k, (mineProb.get(k) ?? 0) + 1)
    }
  }

  if (total === 0) return null
  for (const k of vars) mineProb.set(k, (mineProb.get(k) ?? 0) / total)
  return mineProb
}

export function componentProbabilities(board: SolverBoard, deduced: Deduction, vars?: string[]): Map<string, number> | null {
  const fullFrontier = frontierCells(board, deduced)
  const wanted = vars ? new Set(vars.filter((k) => fullFrontier.includes(k))) : null
  const frontier = fullFrontier
  if (frontier.length === 0 || (wanted && wanted.size === 0)) return new Map()

  const constraints = collectConstraints(board, deduced.safe, deduced.mines)
  const components = constraintComponents(frontier, constraints)
  const merged = new Map<string, number>()

  for (const comp of components) {
    if (wanted && !comp.some((k) => wanted.has(k))) continue
    if (comp.length > MAX_CSP_VARS) continue
    const probs = enumerateMineProbabilities(comp, constraints, deduced)
    if (!probs) return null
    for (const [k, p] of probs) {
      if (!wanted || wanted.has(k)) merged.set(k, p)
    }
  }

  return merged
}

export function mineProbability(board: SolverBoard, deduced: Deduction, row: number, col: number): number | null {
  const k = key(row, col)
  const probs = componentProbabilities(board, deduced)
  if (!probs) return null
  return probs.get(k) ?? null
}

export function isCertainSafe(board: SolverBoard, deduced: Deduction, row: number, col: number): boolean {
  const k = key(row, col)
  if (!deduced.safe.has(k)) return false
  const p = mineProbability(board, deduced, row, col)
  if (p !== null) return p <= 1e-9
  const onFrontier = frontierCells(board, deduced).includes(k)
  if (onFrontier) return false
  return isDirectSafe(board, row, col, deduced)
}

export function isCertainMine(board: SolverBoard, deduced: Deduction, row: number, col: number): boolean {
  const k = key(row, col)
  if (!deduced.mines.has(k)) return false
  if (wouldViolateCluesIfFlagged(board, row, col)) return false
  const p = mineProbability(board, deduced, row, col)
  return p !== null && p >= 1 - 1e-9
}

export function pickLowestProb(probs: Map<string, number>, board: SolverBoard, preferRow?: number): { row: number; col: number; prob: number } | null {
  let best: { row: number; col: number; prob: number } | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const [k, prob] of probs) {
    const { row, col } = parseKey(k)
    if (!board.canAct(row, col)) continue

    const rowBonus = preferRow !== undefined ? (preferRow === row ? -0.001 : 0) : 0
    const score = prob + rowBonus

    if (!best || score < bestScore - 1e-9) {
      best = { row, col, prob }
      bestScore = score
    }
  }

  return best
}
