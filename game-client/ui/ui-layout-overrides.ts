import type { GameStageLayout, Point, Rect } from './game-stage-layout.ts'

export type UiWidgetId = 'score' | 'combo' | 'lives' | 'side-controls' | 'board' | 'bottom-rail' | 'scroll-button' | 'auto' | 'dev-speed'

export interface UiWidgetTransform {
  dx: number
  dy: number
}

export type UiLayoutOverrides = Partial<Record<UiWidgetId, UiWidgetTransform>>

export const UI_WIDGET_LABELS: Record<UiWidgetId, string> = {
  score: 'Score',
  combo: 'Combo',
  lives: 'Lives',
  'side-controls': 'Volume / Leaderboard',
  board: 'Board',
  'bottom-rail': 'Bottom scroll rail',
  'scroll-button': 'Scroll button',
  auto: 'Auto (AI)',
  'dev-speed': 'Speed up',
}

export const UI_WIDGET_ORDER: UiWidgetId[] = ['score', 'combo', 'lives', 'side-controls', 'board', 'bottom-rail', 'scroll-button', 'auto', 'dev-speed']

/** Known layout constants in game-stage-layout.ts (for export hints). */
const MOBILE_BOARD_Y_NUDGE = 22
const MOBILE_LIVES_X_NUDGE = 14
const MOBILE_LIVES_Y_NUDGE = 16
const MOBILE_SIDE_CONTROLS_Y = 34

function shiftPoint(p: Point, t: UiWidgetTransform | undefined): Point {
  if (!t) return { ...p }
  return { x: p.x + t.dx, y: p.y + t.dy }
}

function shiftRect(r: Rect, t: UiWidgetTransform | undefined): Rect {
  if (!t) return { ...r }
  return { x: r.x + t.dx, y: r.y + t.dy, w: r.w, h: r.h }
}

export function applyUiLayoutOverrides(base: GameStageLayout, overrides: UiLayoutOverrides): GameStageLayout {
  const next: GameStageLayout = { ...base }
  next.scoreAnchor = shiftPoint(base.scoreAnchor, overrides.score)
  next.livesAnchor = shiftPoint(base.livesAnchor, overrides.lives)
  next.sideControlsAnchor = shiftPoint(base.sideControlsAnchor, overrides['side-controls'])
  next.comboHudAnchor = shiftPoint(base.comboHudAnchor, overrides.combo)
  next.countdownAnchor = shiftPoint(base.countdownAnchor, overrides.combo)
  next.boardX = base.boardX + (overrides.board?.dx ?? 0)
  next.boardY = base.boardY + (overrides.board?.dy ?? 0)
  next.bottomRailRect = shiftRect(base.bottomRailRect, overrides['bottom-rail'])
  next.spaceButtonRect = shiftRect(base.spaceButtonRect, overrides['scroll-button'])
  next.autoRect = shiftRect(base.autoRect, overrides.auto)
  next.devSpeedRect = shiftRect(base.devSpeedRect, overrides['dev-speed'])
  return next
}

export function hudContentY(layout: GameStageLayout): number {
  return layout.hudY + (layout.profile === 'mobile' ? 3 : 7) * layout.scale
}

export function getUiWidgetBounds(layout: GameStageLayout, id: UiWidgetId): Rect {
  const scale = layout.scale
  const hudY = hudContentY(layout)

  switch (id) {
    case 'score':
      return { x: layout.scoreAnchor.x, y: hudY, w: 150 * scale, h: 72 * scale }
    case 'combo': {
      const cx = layout.comboHudAnchor.x
      return { x: cx - 70 * scale, y: hudY, w: 140 * scale, h: 56 * scale }
    }
    case 'lives':
      return {
        x: layout.livesAnchor.x - (layout.profile === 'mobile' ? 0 : 120 * scale),
        y: hudY + 8 * scale,
        w: layout.profile === 'mobile' ? 180 * scale : 120 * scale,
        h: 48 * scale,
      }
    case 'side-controls':
      return {
        x: layout.sideControlsAnchor.x - 52 * scale,
        y: layout.sideControlsAnchor.y,
        w: 52 * scale,
        h: layout.profile === 'mobile' ? 110 * scale : 130 * scale,
      }
    case 'board':
      return { x: layout.boardX, y: layout.boardY, w: layout.boardW, h: layout.boardH }
    case 'bottom-rail':
      return { ...layout.bottomRailRect }
    case 'scroll-button':
      return { ...layout.spaceButtonRect }
    case 'auto':
      return { ...layout.autoRect }
    case 'dev-speed':
      return { ...layout.devSpeedRect }
  }
}

export function hitTestUiWidget(layout: GameStageLayout, x: number, y: number): UiWidgetId | null {
  for (let i = UI_WIDGET_ORDER.length - 1; i >= 0; i -= 1) {
    const id = UI_WIDGET_ORDER[i]
    const b = getUiWidgetBounds(layout, id)
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return id
  }
  return null
}

function fmtDelta(n: number): string {
  if (n === 0) return '0'
  return n > 0 ? `+${n}` : `${n}`
}

function hasAnyOverride(overrides: UiLayoutOverrides): boolean {
  return UI_WIDGET_ORDER.some((id) => {
    const t = overrides[id]
    return t && (t.dx !== 0 || t.dy !== 0)
  })
}

export function layoutEditorStorageKey(profile: string, viewportW: number, viewportH: number): string {
  return `chill-layout-editor/v1/${profile}/${viewportW}x${viewportH}`
}

export function loadLayoutOverrides(key: string): UiLayoutOverrides {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    return JSON.parse(raw) as UiLayoutOverrides
  } catch {
    return {}
  }
}

export function saveLayoutOverrides(key: string, overrides: UiLayoutOverrides): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(overrides))
}

export interface LayoutExportInput {
  profile: 'desktop' | 'mobile'
  viewportW: number
  viewportH: number
  overrides: UiLayoutOverrides
  baseLayout: GameStageLayout
  finalLayout: GameStageLayout
}

export function formatLayoutExport(input: LayoutExportInput): string {
  const { profile, viewportW, viewportH, overrides, baseLayout, finalLayout } = input
  const lines: string[] = ['# Layout tuning export', `Profile: ${profile}`, `Viewport: ${viewportW}×${viewportH}`, '']

  if (!hasAnyOverride(overrides)) {
    lines.push('(No offsets yet — drag widgets to generate copy-paste output here.)')
    return lines.join('\n')
  }

  lines.push('## Offsets (dx, dy) — relative to computeGameStageLayout defaults')
  for (const id of UI_WIDGET_ORDER) {
    const t = overrides[id]
    if (!t || (t.dx === 0 && t.dy === 0)) continue
    lines.push(`- ${UI_WIDGET_LABELS[id]} (${id}): dx=${fmtDelta(t.dx)}, dy=${fmtDelta(t.dy)}`)
  }

  lines.push('', '## Final coordinates (screen px)')
  lines.push(`- scoreAnchor: (${Math.round(finalLayout.scoreAnchor.x)}, ${Math.round(finalLayout.scoreAnchor.y)})`)
  lines.push(`- livesAnchor: (${Math.round(finalLayout.livesAnchor.x)}, ${Math.round(finalLayout.livesAnchor.y)})`)
  lines.push(`- board: x=${Math.round(finalLayout.boardX)}, y=${Math.round(finalLayout.boardY)}`)
  lines.push(`- autoRect: x=${Math.round(finalLayout.autoRect.x)}, y=${Math.round(finalLayout.autoRect.y)}`)
  lines.push(`- scrollButton: x=${Math.round(finalLayout.spaceButtonRect.x)}, y=${Math.round(finalLayout.spaceButtonRect.y)}`)

  lines.push('', '## JSON')
  lines.push('```json')
  lines.push(JSON.stringify({ profile, viewport: { w: viewportW, h: viewportH }, overrides }, null, 2))
  lines.push('```')

  lines.push('', '## For Agent (copy block below)')
  lines.push('```')
  lines.push(`Hard-code these offsets in game-stage-layout.ts for ${profile} (viewport ${viewportW}×${viewportH}):`)
  lines.push('')

  if (profile === 'mobile') {
    const boardDy = overrides.board?.dy ?? 0
    if (boardDy !== 0) {
      lines.push(`- MOBILE_BOARD_Y_NUDGE: ${MOBILE_BOARD_Y_NUDGE} → ${MOBILE_BOARD_Y_NUDGE + boardDy} (${fmtDelta(boardDy)})`)
    }
    const livesDx = overrides.lives?.dx ?? 0
    const livesDy = overrides.lives?.dy ?? 0
    if (livesDx !== 0) {
      lines.push(`- MOBILE_LIVES_X_NUDGE: ${MOBILE_LIVES_X_NUDGE} → ${MOBILE_LIVES_X_NUDGE + livesDx} (${fmtDelta(livesDx)})`)
    }
    if (livesDy !== 0) {
      lines.push(`- MOBILE_LIVES_Y_NUDGE: ${MOBILE_LIVES_Y_NUDGE} → ${MOBILE_LIVES_Y_NUDGE + livesDy} (${fmtDelta(livesDy)})`)
    }
    const sideDy = overrides['side-controls']?.dy ?? 0
    if (sideDy !== 0) {
      lines.push(`- MOBILE_SIDE_CONTROLS_Y: ${MOBILE_SIDE_CONTROLS_Y} → ${MOBILE_SIDE_CONTROLS_Y + sideDy} (${fmtDelta(sideDy)})`)
    }
  }

  for (const id of UI_WIDGET_ORDER) {
    const t = overrides[id]
    if (!t || (t.dx === 0 && t.dy === 0)) continue
    if (profile === 'mobile' && (id === 'board' || id === 'lives' || id === 'side-controls')) continue
    lines.push(`- ${id}: dx=${fmtDelta(t.dx)}, dy=${fmtDelta(t.dy)}`)
  }

  lines.push('')
  lines.push('Baseline anchors (before):')
  lines.push(`- scoreAnchor: (${Math.round(baseLayout.scoreAnchor.x)}, ${Math.round(baseLayout.scoreAnchor.y)})`)
  lines.push(`- boardY: ${Math.round(baseLayout.boardY)}`)
  lines.push('```')

  return lines.join('\n')
}
