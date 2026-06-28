import { clamp01 } from '../primitives/index.ts'

export function getCellIntroRippleDist(row: number, col: number, rows: number, cols: number): number {
  const centerRow = (rows - 1) / 2
  const centerCol = (cols - 1) / 2
  return Math.hypot(row - centerRow, col - centerCol)
}

export function getMaxCellIntroRippleDist(rows: number, cols: number): number {
  let maxDist = 0
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      maxDist = Math.max(maxDist, getCellIntroRippleDist(row, col, rows, cols))
    }
  }
  return maxDist
}

/** Intro reveal: linear alpha 0→1 as the front reaches each cell. */
export function getCellIntroRippleAlpha(reveal: number, dist: number, maxDist: number): number {
  if (reveal <= 0) return 0
  if (maxDist <= 0) return clamp01(reveal)
  const rippleBand = Math.max(2, maxDist * 0.42)
  const rippleFront = reveal * (maxDist + rippleBand)
  return clamp01((rippleFront - dist) / rippleBand)
}
