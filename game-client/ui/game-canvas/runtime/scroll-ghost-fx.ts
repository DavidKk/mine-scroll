import { drawFxSpriteFrame, drawImageContained, GAME_ASSET_TUNING, getGameCutout } from '../../game-assets.ts'
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

function drawScrollWrongFlagGhostReveal(effectCtx: CanvasRenderingContext2D, x: number, y: number, cellSize: number, t: number): void {
  const revealT = Math.min(1, t / 0.34)
  const shake = Math.sin(revealT * Math.PI * 10) * (1 - revealT) * 0.08
  const alpha = revealT < 0.82 ? 1 : 1 - (revealT - 0.82) / 0.18
  effectCtx.save()
  effectCtx.globalAlpha = alpha
  drawHiddenCellUnderlay(effectCtx, x, y, cellSize)
  const flag = getGameCutout('flag-danger-red') ?? getGameCutout('flag-blue')
  if (flag) {
    const cx = x + cellSize / 2
    const cy = y + cellSize / 2
    effectCtx.save()
    effectCtx.translate(cx, cy)
    effectCtx.rotate(shake)
    drawImageContained(effectCtx, flag, -cellSize / 2, -cellSize / 2, cellSize, cellSize, GAME_ASSET_TUNING.cutouts.flagScale * 1.04)
    effectCtx.restore()
  }
  const ringT = Math.max(0, Math.min(1, (revealT - 0.12) / 0.55))
  if (ringT > 0 && ringT < 1) {
    const cx = x + cellSize / 2
    const cy = y + cellSize / 2
    effectCtx.save()
    effectCtx.globalCompositeOperation = 'lighter'
    effectCtx.strokeStyle = `rgba(255, 65, 86, ${(1 - ringT) * 0.72})`
    effectCtx.lineWidth = Math.max(1.5, cellSize * 0.05)
    effectCtx.beginPath()
    effectCtx.arc(cx, cy, cellSize * (0.24 + ringT * 0.34), 0, Math.PI * 2)
    effectCtx.stroke()
    effectCtx.restore()
  }
  effectCtx.restore()
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
    drawImageContained(effectCtx, mine, x, y, cellSize, cellSize, GAME_ASSET_TUNING.cutouts.mineScale * pop)
  }
  effectCtx.restore()
}

export function drawScrollGhostEffects(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D, now: number): void {
  let hasGhost = false
  shellCtx.save()
  for (const fx of rt.state.cellEffects) {
    if (fx.pinShellX === undefined || fx.pinShellY === undefined || fx.cellSize === undefined) continue
    if (fx.kind !== 'scroll-mine-ghost' && fx.kind !== 'scroll-wrong-flag-ghost') continue
    hasGhost = true
    const age = now - fx.startedAt
    const t = Math.max(0, Math.min(1, age / fx.durationMs))
    const x = fx.pinShellX
    const y = fx.pinShellY
    const cellSize = fx.cellSize
    const cx = x + cellSize / 2
    const cy = y + cellSize / 2

    if (fx.kind === 'scroll-mine-ghost') {
      if (t < 0.34) {
        drawScrollMineGhostReveal(shellCtx, x, y, cellSize, t / 0.34)
      }
      if (t >= 0.16) {
        const blastT = Math.max(0, Math.min(1, (t - 0.16) / 0.84))
        drawMineExplosionVisual(rt, shellCtx, x, y, cellSize, blastT, { forceExplosionSprite: true })
      }
      continue
    }

    if (t < 0.34) {
      drawScrollWrongFlagGhostReveal(shellCtx, x, y, cellSize, t / 0.34)
    }
    if (t >= 0.2) {
      const breakT = Math.max(0, Math.min(1, (t - 0.2) / 0.8))
      const tuning = GAME_ASSET_TUNING.fx.break
      const fade = breakT < 0.88 ? 1 : 1 - (breakT - 0.88) / 0.12
      shellCtx.save()
      shellCtx.globalAlpha = tuning.spriteAlpha * fade
      drawFxSpriteFrame(shellCtx, 'wrong-flag-break', breakT, cx, cy, cellSize * 1.85, cellSize * 1.25, 1)
      shellCtx.restore()
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
  trimScrollGhostPool(rt)
  rt.scheduleAnimationFrame()
}

export function queueScrollWrongFlagGhosts(rt: GameCanvasRuntime, cells: { row: number; col: number }[]): void {
  if (cells.length === 0 || !rt.state.squareLayout) return
  const now = performance.now()
  const durationMs = GAME_ASSET_TUNING.fx.break.durationMs
  const { gridOriginX, gridOriginY, grid } = rt.state.squareLayout
  for (const cell of cells) {
    const { x, y } = cellPixelForFx(cell.row, cell.col, gridOriginX, gridOriginY, grid)
    rt.state.cellEffects.push({
      kind: 'scroll-wrong-flag-ghost',
      row: cell.row,
      col: cell.col,
      pinShellX: rt.state.boardOffsetX + x,
      pinShellY: rt.state.boardOffsetY + y,
      cellSize: grid.cellSize,
      startedAt: now,
      durationMs,
    })
  }
  trimScrollGhostPool(rt)
  rt.scheduleAnimationFrame()
}

function trimScrollGhostPool(rt: GameCanvasRuntime): void {
  while (rt.state.cellEffects.length > 48) {
    rt.state.cellEffects.shift()
  }
}

/** @deprecated use drawScrollGhostEffects */
export const drawScrollMineGhostEffects = drawScrollGhostEffects
