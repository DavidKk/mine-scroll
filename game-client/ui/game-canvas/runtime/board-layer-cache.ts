import type { AiHintDisplay } from '@shared/core/ai/types.ts'
import type { CellView, GameStatus } from '@shared/core/types.ts'

import { renderBoardStaticFrame, type RenderState } from '../../renderer/index.ts'
import type { GameCanvasRuntime } from './context.ts'

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

function mixHash(hash: number, value: number): number {
  return Math.imul(hash ^ value, FNV_PRIME)
}

function mixString(hash: number, value: string): number {
  let next = hash
  for (let i = 0; i < value.length; i += 1) {
    next = mixHash(next, value.charCodeAt(i))
  }
  return next
}

export function computeBoardLayerCacheKey(
  rt: GameCanvasRuntime,
  state: {
    views: CellView[]
    status: GameStatus
    flagCount: number
    rows: number
    previewRows?: number
    aiHint?: AiHintDisplay | null
  }
): string {
  const layout = rt.state.squareLayout
  let hash = FNV_OFFSET
  hash = mixString(hash, state.status)
  hash = mixHash(hash, state.flagCount)
  hash = mixHash(hash, state.rows)
  hash = mixHash(hash, state.previewRows ?? 0)
  hash = mixHash(hash, layout?.width ?? 0)
  hash = mixHash(hash, layout?.height ?? 0)
  hash = mixHash(hash, Math.round((layout?.grid.cellSize ?? 0) * 1000))

  for (const view of state.views) {
    hash = mixHash(hash, view.row)
    hash = mixHash(hash, view.col)
    let packed = 0
    if (view.preview) packed |= 1
    if (view.revealed) packed |= 2
    if (view.flagged) packed |= 4
    if (view.mineHit) packed |= 8
    hash = mixHash(hash, packed)
    hash = mixHash(hash, view.adjacentMines ?? -1)
    hash = mixHash(hash, view.isMine === true ? 1 : view.isMine === false ? 0 : -1)
  }

  if (state.aiHint) {
    hash = mixHash(hash, state.aiHint.row)
    hash = mixHash(hash, state.aiHint.col)
    hash = mixString(hash, state.aiHint.kind)
  }

  return String(hash >>> 0)
}

export function ensureBoardLayerCache(rt: GameCanvasRuntime, state: RenderState & { rows: number; cols: number }): void {
  const layout = rt.state.squareLayout!
  const key = computeBoardLayerCacheKey(rt, state)
  const dpr = window.devicePixelRatio || 1
  const cacheW = Math.round(layout.width * dpr)
  const cacheH = Math.round(layout.height * dpr)

  if (
    key !== rt.state.boardLayerCacheKey ||
    !rt.state.boardLayerCache ||
    rt.state.boardLayerCache.width !== cacheW ||
    rt.state.boardLayerCache.height !== cacheH ||
    rt.state.boardLayerCacheDpr !== dpr
  ) {
    rt.state.boardLayerCache = document.createElement('canvas')
    rt.state.boardLayerCache.width = cacheW
    rt.state.boardLayerCache.height = cacheH
    rt.state.boardLayerCacheCtx = rt.state.boardLayerCache.getContext('2d')
    rt.state.boardLayerCacheDpr = dpr
    rt.state.boardLayerCacheKey = ''
  }
  if (key === rt.state.boardLayerCacheKey && rt.state.boardLayerCache) return

  if (!rt.state.boardLayerCacheCtx) return

  rt.state.boardLayerCacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
  rt.state.boardLayerCacheCtx.imageSmoothingEnabled = false
  renderBoardStaticFrame(rt.state.boardLayerCacheCtx, layout, {
    ...state,
    nowMs: 0,
    pointer: null,
    scrollPressure: undefined,
  })
  rt.state.boardLayerCacheKey = key
}
