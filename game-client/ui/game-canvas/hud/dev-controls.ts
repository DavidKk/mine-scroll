import { fillRounded, strokeRounded } from '../../primitives/index.ts'
import { FONTS } from '../../theme.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'

export function drawDevChip(shellCtx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, border: string, fill: string): void {
  const r = Math.min(rect.h / 2, 5)
  fillRounded(shellCtx, rect.x, rect.y, rect.w, rect.h, r, fill)
  strokeRounded(shellCtx, rect.x, rect.y, rect.w, rect.h, r, border, 1)
}

export function drawDevAutoButton(
  _rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  active: boolean,
  scale: number
): void {
  const { x, y, w, h } = rect
  drawDevChip(shellCtx, rect, active ? 'rgba(74, 222, 128, 0.9)' : 'rgba(71, 85, 105, 0.7)', active ? 'rgba(22, 101, 52, 0.95)' : 'rgba(30, 41, 59, 0.88)')

  shellCtx.save()
  shellCtx.textAlign = 'center'
  shellCtx.textBaseline = 'middle'
  shellCtx.font = `800 ${Math.max(9, 10 * scale)}px ${FONTS.mono}`
  shellCtx.fillStyle = active ? '#bbf7d0' : '#64748b'
  shellCtx.fillText('AUTO', x + w / 2, y + h / 2 + 0.5 * scale)
  shellCtx.restore()
}

export function drawDevSpeedUpButton(
  _rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  enabled: boolean,
  scale: number
): void {
  const { x, y, w, h } = rect
  drawDevChip(shellCtx, rect, enabled ? 'rgba(251, 191, 36, 0.85)' : 'rgba(71, 85, 105, 0.45)', enabled ? 'rgba(69, 52, 8, 0.92)' : 'rgba(30, 41, 59, 0.55)')

  shellCtx.save()
  shellCtx.textAlign = 'center'
  shellCtx.textBaseline = 'middle'
  shellCtx.fillStyle = enabled ? '#fde68a' : '#475569'
  shellCtx.font = `900 ${Math.max(12, 13 * scale)}px ${FONTS.display}`
  shellCtx.fillText('↑', x + w / 2, y + h / 2 + 0.5 * scale)
  shellCtx.restore()
}
