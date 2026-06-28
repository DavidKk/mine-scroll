import { drawGameMineCutout, GAME_ASSET_TUNING, getGameCutout } from '../../game-assets.ts'
import type { LayoutMetrics } from '../../renderer/index.ts'
import { drawHiddenCellUnderlay } from '../../tile-sprites.ts'
import { drawMineExplosionVisual } from './cell-effects-runtime.ts'
import type { GameCanvasRuntime } from './context.ts'

export function cellPixelForFx(row: number, col: number, gridOriginX: number, gridOriginY: number, grid: LayoutMetrics['grid']): { x: number; y: number } {
  return {
    x: gridOriginX + col * grid.cellStep,
    y: gridOriginY + row * grid.cellStep,
  }
}

export function drawScrollMineGhostReveal(effectCtx: CanvasRenderingContext2D, x: number, y: number, cellSize: number, t: number): void {
  const revealT = Math.min(1, t / 0.3)
  const pop = 0.9 + Math.sin(revealT * Math.PI) * 0.12
  const alpha = revealT < 0.82 ? 1 : 1 - (revealT - 0.82) / 0.18
  effectCtx.save()
  effectCtx.globalAlpha = alpha
  drawHiddenCellUnderlay(effectCtx, x, y, cellSize)
  const mine = getGameCutout('mine-standard')
  if (mine) {
    drawGameMineCutout(effectCtx, mine, x, y, cellSize, GAME_ASSET_TUNING.cutouts.mineScale * pop)
  }
  effectCtx.restore()
}

export function drawScrollMineGhostEffects(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D, now: number): void {
  let hasGhost = false
  shellCtx.save()
  for (const fx of rt.state.cellEffects) {
    if (fx.kind !== 'scroll-mine-ghost') continue
    if (fx.pinShellX === undefined || fx.pinShellY === undefined || fx.cellSize === undefined) continue
    hasGhost = true
    const age = now - fx.startedAt
    const t = Math.max(0, Math.min(1, age / fx.durationMs))
    const x = fx.pinShellX
    const y = fx.pinShellY
    const cellSize = fx.cellSize

    if (t < 0.34) {
      drawScrollMineGhostReveal(shellCtx, x, y, cellSize, t / 0.34)
    }

    if (t >= 0.16) {
      const blastT = Math.max(0, Math.min(1, (t - 0.16) / 0.84))
      drawMineExplosionVisual(rt, shellCtx, x, y, cellSize, blastT, { forceExplosionSprite: true })
    }
  }
  shellCtx.restore()
  if (hasGhost) rt.scheduleAnimationFrame()
}

export function queueScrollMineGhosts(rt: GameCanvasRuntime, cells: { row: number; col: number }[]): void {
  if (cells.length === 0 || !rt.state.squareLayout) return
  const now = performance.now()
  const durationMs = GAME_ASSET_TUNING.fx.mineExplosion.durationMs
  const { gridOriginX, gridOriginY, grid } = rt.state.squareLayout
  for (const cell of cells) {
    const { x, y } = cellPixelForFx(cell.row, cell.col, gridOriginX, gridOriginY, grid)
    rt.state.cellEffects.push({
      kind: 'scroll-mine-ghost',
      row: cell.row,
      col: cell.col,
      pinShellX: rt.state.boardOffsetX + x,
      pinShellY: rt.state.boardOffsetY + y,
      cellSize: grid.cellSize,
      startedAt: now,
      durationMs,
    })
  }
  while (rt.state.cellEffects.length > 48) {
    rt.state.cellEffects.shift()
  }
  rt.scheduleAnimationFrame()
}
