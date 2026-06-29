import { parseLivesDisplay } from '../../hud-sprites.ts'
import { fillRounded, strokeRounded } from '../../primitives/index.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { hudHeartIconSize, hudHeartRowMetrics } from './lives-hud.ts'

export interface HudSideChipLayout {
  hitSize: number
  rectX: number
  topY: number
  iconSize: number
  isMobile: boolean
  scale: number
}

export type HudSideChipAccent = 'cyan' | 'gold' | 'rose'

/** Mobile pre-start side controls scale vs base HUD chip sizing. */
const MOBILE_SIDE_CHIP_SIZE_SCALE = 1.5
/** Desktop: compact chips — no mobile legibility boost. */
const DESKTOP_SIDE_CHIP_SIZE_SCALE = 1
/** Desktop: nudge volume / leaderboard stack below the lives row. */
const DESKTOP_SIDE_CHIP_Y_NUDGE = 24
/** Mobile: vertical gap between volume and leaderboard chips. */
const MOBILE_SIDE_CHIP_STACK_GAP = 32
/** Mobile idle: extra icon legibility vs grid backdrop. */
const MOBILE_SIDE_CHIP_ICON_BOOST = 1.1

function accentPalette(accent: HudSideChipAccent): { rgb: string; mid: string; glow: string } {
  if (accent === 'gold') return { rgb: '250, 204, 21', mid: '251, 191, 36', glow: 'rgba(250, 204, 21, 0.68)' }
  if (accent === 'rose') return { rgb: '255, 76, 86', mid: '251, 146, 60', glow: 'rgba(255, 76, 86, 0.72)' }
  return { rgb: '45, 236, 255', mid: '59, 130, 246', glow: 'rgba(96, 165, 250, 0.68)' }
}

/** Shared hit target geometry for mute / leaderboard chips under the lives HUD. */
export function getHudSideChipLayout(rt: GameCanvasRuntime, anchorX: number, hudY: number, livesRaw: string | undefined, scale: number): HudSideChipLayout {
  const lives = parseLivesDisplay(livesRaw)
  const isMobile = rt.state.stageLayout?.profile === 'mobile'
  const heartIconSize = hudHeartIconSize(rt, scale)
  const gridCellSize = rt.state.squareLayout?.grid.cellSize ?? 32 * scale
  const baseIconSize = isMobile ? Math.max(22, Math.min(30, gridCellSize * 0.68)) : Math.max(22, Math.min(32, gridCellSize * 0.72))
  const sizeScale = isMobile ? MOBILE_SIDE_CHIP_SIZE_SCALE : DESKTOP_SIDE_CHIP_SIZE_SCALE
  const iconBoost = isMobile ? MOBILE_SIDE_CHIP_ICON_BOOST : 1
  const iconSize = baseIconSize * sizeScale * iconBoost
  const hitPad = (isMobile ? Math.max(8, 9 * scale) : Math.max(8, 10 * scale)) * (isMobile ? MOBILE_SIDE_CHIP_SIZE_SCALE : 1)
  const hitSize = iconSize + hitPad
  const metrics =
    lives && !isMobile ? hudHeartRowMetrics(rt, anchorX, hudY, lives, scale) : { x: anchorX - hitSize, cy: hudY + 31 * scale, iconSize: heartIconSize, gap: 0, rowW: hitSize }

  return {
    hitSize,
    rectX: anchorX - hitSize,
    topY: isMobile ? hudY : metrics.cy + heartIconSize / 2 + 12 * scale + DESKTOP_SIDE_CHIP_Y_NUDGE * scale,
    iconSize,
    isMobile,
    scale,
  }
}

export function stackHudSideChipBelow(rect: { y: number; h: number }, layout: HudSideChipLayout): { x: number; y: number; w: number; h: number } {
  const gap = (layout.isMobile ? MOBILE_SIDE_CHIP_STACK_GAP : 6) * layout.scale
  return {
    x: layout.rectX,
    y: rect.y + rect.h + gap,
    w: layout.hitSize,
    h: layout.hitSize,
  }
}

/** Dark plate + outer halo — separates chips from the semi-transparent idle board. */
export function drawHudSideChipBackdrop(
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  scale: number,
  accent: HudSideChipAccent,
  emphasized: boolean
): void {
  const { rgb } = accentPalette(accent)
  const pad = (emphasized ? 11 : 8) * scale
  const x = rect.x - pad
  const y = rect.y - pad
  const w = rect.w + pad * 2
  const h = rect.h + pad * 2
  const cx = x + w / 2
  const cy = y + h / 2
  const radius = Math.min(h / 2, 18 * scale)

  shellCtx.save()
  const plate = shellCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.78)
  plate.addColorStop(0, emphasized ? 'rgba(2, 6, 23, 0.82)' : 'rgba(2, 6, 23, 0.66)')
  plate.addColorStop(0.5, emphasized ? 'rgba(2, 6, 23, 0.58)' : 'rgba(2, 6, 23, 0.42)')
  plate.addColorStop(1, 'rgba(2, 6, 23, 0)')
  fillRounded(shellCtx, x, y, w, h, radius, plate)

  shellCtx.globalCompositeOperation = 'lighter'
  shellCtx.globalAlpha = emphasized ? 0.42 : 0.26
  const halo = shellCtx.createRadialGradient(cx, cy, rect.w * 0.15, cx, cy, w * 0.68)
  halo.addColorStop(0, `rgba(${rgb}, ${emphasized ? 0.34 : 0.22})`)
  halo.addColorStop(0.55, `rgba(${rgb}, 0.08)`)
  halo.addColorStop(1, 'rgba(45, 236, 255, 0)')
  fillRounded(shellCtx, x, y, w, h, radius, halo)
  shellCtx.restore()
}

export function drawHudSideChipBackground(
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  scale: number,
  hovered: boolean,
  accent: HudSideChipAccent = 'cyan',
  emphasized = false
): void {
  const { x, y, w, h } = rect
  const radius = Math.min(h / 2, 12 * scale)
  const pulse = 0.5 + Math.sin(Date.now() / 900) * 0.5
  const cx = x + w / 2
  const cy = y + h / 2
  const { rgb, mid, glow } = accentPalette(accent)
  const inset = Math.max(2.5, 3 * scale)
  const idleBorder = emphasized ? 0.58 + pulse * 0.14 : 0.44 + pulse * 0.1
  const idleShadow = emphasized ? 0.34 + pulse * 0.16 : 0.22 + pulse * 0.1

  drawHudSideChipBackdrop(shellCtx, rect, scale, accent, emphasized)

  shellCtx.save()
  shellCtx.shadowColor = glow
  shellCtx.shadowBlur = (hovered ? 18 : emphasized ? 14 + pulse * 6 : 10 + pulse * 4) * scale

  const bg = shellCtx.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, emphasized ? 'rgba(15, 23, 42, 0.88)' : 'rgba(15, 23, 42, 0.78)')
  bg.addColorStop(0.45, emphasized ? 'rgba(3, 7, 18, 0.92)' : 'rgba(3, 7, 18, 0.84)')
  bg.addColorStop(1, emphasized ? 'rgba(2, 6, 23, 0.8)' : 'rgba(2, 6, 23, 0.72)')
  fillRounded(shellCtx, x, y, w, h, radius, bg)

  const border = shellCtx.createLinearGradient(x, y, x + w, y + h)
  border.addColorStop(0, `rgba(${rgb}, ${hovered ? 0.28 : 0.12})`)
  border.addColorStop(0.42, `rgba(${rgb}, ${hovered ? 0.92 : idleBorder})`)
  border.addColorStop(1, `rgba(${mid}, ${hovered ? 0.72 : 0.42 + pulse * 0.1})`)
  strokeRounded(shellCtx, x + 0.5, y + 0.5, w - 1, h - 1, radius, border, hovered ? 1.6 : emphasized ? 1.35 : 1.2)

  shellCtx.shadowBlur = 0
  shellCtx.globalAlpha = hovered ? 0.58 : 0.38 + pulse * 0.1
  strokeRounded(shellCtx, x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(4, radius - inset), `rgba(${rgb}, ${emphasized ? 0.48 : 0.38})`, 0.95)

  shellCtx.globalCompositeOperation = 'lighter'
  shellCtx.globalAlpha = hovered ? 0.5 : idleShadow
  const innerGlow = shellCtx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.62)
  innerGlow.addColorStop(0, `rgba(${rgb}, ${0.22 + pulse * 0.1})`)
  innerGlow.addColorStop(0.55, `rgba(${mid}, 0.08)`)
  innerGlow.addColorStop(1, 'rgba(45, 236, 255, 0)')
  fillRounded(shellCtx, x, y, w, h, radius, innerGlow)

  shellCtx.globalCompositeOperation = 'source-over'
  shellCtx.globalAlpha = hovered ? 0.42 : 0.24 + pulse * 0.06
  const sheen = shellCtx.createLinearGradient(x, y, x, y + h * 0.5)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.22)')
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)')
  fillRounded(shellCtx, x + 1, y + 1, w - 2, h * 0.46, radius, sheen)

  const scanPhase = (Date.now() % 2600) / 2600
  const scanY = y + h * (0.12 + scanPhase * 0.76)
  shellCtx.globalAlpha = hovered ? 0.26 : emphasized ? 0.14 + pulse * 0.06 : 0.1 + pulse * 0.04
  const scan = shellCtx.createLinearGradient(x, scanY - h * 0.1, x, scanY + h * 0.1)
  scan.addColorStop(0, 'rgba(255,255,255,0)')
  scan.addColorStop(0.5, `rgba(${rgb}, 0.42)`)
  scan.addColorStop(1, 'rgba(255,255,255,0)')
  shellCtx.fillStyle = scan
  shellCtx.fillRect(x + inset, scanY - h * 0.1, w - inset * 2, h * 0.2)

  shellCtx.restore()
}

export function drawHudSideChipIcon(
  shellCtx: CanvasRenderingContext2D,
  drawIcon: () => void,
  scale: number,
  accent: HudSideChipAccent,
  hovered: boolean,
  emphasized: boolean
): void {
  const { glow } = accentPalette(accent)
  shellCtx.save()
  shellCtx.globalAlpha = 1
  shellCtx.shadowColor = glow
  shellCtx.shadowBlur = (hovered ? 14 : emphasized ? 10 : 7) * scale
  drawIcon()
  shellCtx.shadowBlur = 0
  shellCtx.globalCompositeOperation = 'lighter'
  shellCtx.globalAlpha = hovered ? 0.35 : emphasized ? 0.22 : 0.14
  drawIcon()
  shellCtx.restore()
}

/** Desktop: icon-only chip — no plate/backdrop (pre-mobile styling). */
export function drawDesktopHudSideChipIcon(
  shellCtx: CanvasRenderingContext2D,
  drawIcon: () => void,
  rect: { x: number; y: number; w: number; h: number },
  iconSize: number,
  hovered: boolean,
  glowRgb = '45, 236, 255'
): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  shellCtx.save()
  if (hovered) {
    shellCtx.globalCompositeOperation = 'lighter'
    const glow = shellCtx.createRadialGradient(cx, cy, iconSize * 0.16, cx, cy, iconSize * 0.72)
    glow.addColorStop(0, `rgba(${glowRgb}, 0.22)`)
    glow.addColorStop(1, 'rgba(45, 236, 255, 0)')
    shellCtx.fillStyle = glow
    shellCtx.fillRect(rect.x - iconSize * 0.35, rect.y - iconSize * 0.35, rect.w + iconSize * 0.7, rect.h + iconSize * 0.7)
    shellCtx.globalCompositeOperation = 'source-over'
  }
  shellCtx.globalAlpha = hovered ? 1 : 0.9
  drawIcon()
  shellCtx.restore()
}
