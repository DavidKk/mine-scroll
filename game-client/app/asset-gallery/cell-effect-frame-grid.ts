import { type TileSprites } from '../../ui/tile-sprites.ts'
import { createStaticFrameCanvas, finalizeFrameGrid } from './cell-effect-frames.ts'
import {
  BOARD_INTERACTION_V3_ACTION_MS,
  BREATH_CYCLE_MS,
  COMBO_BURST_V3_MS,
  DIGIT_PARTICLE_MS,
  type EffectPanelId,
  FLAG_PLACE_ACTION_MS,
  FLAG_WAVE_MS,
  HEART_REFILL_V3_ACTION_MS,
  HUD_ALERT_V3_MS,
  HUD_FEEDBACK_V3_MS,
  LIFE_LOSS_POPUP_V3_MS,
  MINE_EXPLOSION_MS,
  MINE_HIT_V3_ACTION_MS,
  PANEL_V3_MS,
  SCORE_POP_V3_MS,
  WRONG_FLAG_V3_ACTION_MS,
} from './cell-effect-panels.ts'
import {
  type CellMode,
  drawBoardV3InteractionScene,
  drawCellScene,
  drawComboBurstV3Scene,
  drawComboHudV3Scene,
  drawDigitScene,
  drawFlagPlaceScene,
  drawFlagScene,
  drawHeartRefillV3Scene,
  drawHeartStaticV3Scene,
  drawHudAlertV3Scene,
  drawLifeLossPopupV3Scene,
  drawMineHitV3Scene,
  drawMineScene,
  drawPanelV3Scene,
  drawScoreHudV3Scene,
  drawScorePopV3Scene,
  drawSpeedUpChevronFxScene,
  drawWrongFlagV3Scene,
  type HudAlertKind,
  type MineMode,
  type PanelConceptKind,
} from './cell-effect-scenes.ts'

function finishFrameGrid(frames: HTMLElement): HTMLElement {
  finalizeFrameGrid(frames)
  return frames
}

export function createEffectFrameGrid(id: EffectPanelId, sprites: TileSprites): HTMLElement {
  const frames = document.createElement('div')
  frames.className = 'asset-lab__frame-grid'

  if (id === 'cells') {
    const cellFrames: Array<{ label: string; mode: CellMode; t: number }> = [
      { label: 'Hidden', mode: 'hidden', t: 0 },
      { label: 'Breath peak', mode: 'breath', t: BREATH_CYCLE_MS * 0.25 },
      { label: 'Hover', mode: 'hover', t: 0 },
      { label: 'Open', mode: 'open', t: 0 },
    ]
    cellFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawCellScene(ctx, w, h, sprites, item.mode, item.t), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'board-interactions-v3') {
    const boardFrames = [
      { label: 'Hidden', t: 0 },
      { label: 'Hover', t: BOARD_INTERACTION_V3_ACTION_MS * 0.2 },
      { label: 'Press', t: BOARD_INTERACTION_V3_ACTION_MS * 0.32 },
      { label: 'Reveal flash', t: BOARD_INTERACTION_V3_ACTION_MS * 0.46 },
      { label: 'Digit pop', t: BOARD_INTERACTION_V3_ACTION_MS * 0.62 },
      { label: 'Hold', t: BOARD_INTERACTION_V3_ACTION_MS * 0.9 },
    ]
    boardFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawBoardV3InteractionScene(ctx, w, h, sprites, item.t, 3), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'digits') {
    const digitFrames = [
      { label: 'Start', digit: 0, t: 0 },
      { label: 'Expand', digit: 2, t: DIGIT_PARTICLE_MS * 0.33 },
      { label: 'Peak', digit: 4, t: DIGIT_PARTICLE_MS * 0.58 },
      { label: 'Settle', digit: 7, t: DIGIT_PARTICLE_MS * 0.82 },
    ]
    digitFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawDigitScene(ctx, w, h, sprites, item.digit, item.t), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'flag') {
    const flagFrames = [
      { label: 'Wind up', t: 0 },
      { label: 'Swing left', t: FLAG_WAVE_MS * 0.25 },
      { label: 'Lift', t: FLAG_WAVE_MS * 0.5 },
      { label: 'Swing back', t: FLAG_WAVE_MS * 0.75 },
    ]
    flagFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawFlagScene(ctx, w, h, sprites, item.t), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'flag-place-v3') {
    const flagPlaceFrames = [
      { label: 'Approach', t: 0 },
      { label: 'Plant', t: FLAG_PLACE_ACTION_MS * 0.42 },
      { label: 'Settle', t: FLAG_PLACE_ACTION_MS * 0.78 },
      { label: 'Hold', t: FLAG_PLACE_ACTION_MS },
    ]
    flagPlaceFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawFlagPlaceScene(ctx, w, h, sprites, item.t), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'wrong-flag-v3') {
    const wrongFlagFrames = [
      { label: 'Flagged', t: 0 },
      { label: 'Shake', t: WRONG_FLAG_V3_ACTION_MS * 0.18 },
      { label: 'Denied', t: WRONG_FLAG_V3_ACTION_MS * 0.36 },
      { label: 'Break sparks', t: WRONG_FLAG_V3_ACTION_MS * 0.58 },
      { label: 'Fade hold', t: WRONG_FLAG_V3_ACTION_MS * 0.9 },
    ]
    wrongFlagFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawWrongFlagV3Scene(ctx, w, h, sprites, item.t), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'mine-hit-v3') {
    const mineHitFrames = [
      { label: 'Armed', t: 0 },
      { label: 'Hit flash', t: MINE_HIT_V3_ACTION_MS * 0.16 },
      { label: 'Shock ring', t: MINE_HIT_V3_ACTION_MS * 0.34 },
      { label: 'Cracked', t: MINE_HIT_V3_ACTION_MS * 0.58 },
      { label: 'Smoke hold', t: MINE_HIT_V3_ACTION_MS * 0.92 },
    ]
    mineHitFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawMineHitV3Scene(ctx, w, h, sprites, item.t), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'heart-refill-v3') {
    const heartFrames = [
      { label: 'Empty', t: 0 },
      { label: 'Glow', t: HEART_REFILL_V3_ACTION_MS * 0.22 },
      { label: 'Pop', t: HEART_REFILL_V3_ACTION_MS * 0.42 },
      { label: 'Settle', t: HEART_REFILL_V3_ACTION_MS * 0.66 },
      { label: 'Hold', t: HEART_REFILL_V3_ACTION_MS },
    ]
    heartFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawHeartRefillV3Scene(ctx, w, h, item.t), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'heart-loss-v3') {
    ;[
      { label: 'Full', full: true },
      { label: 'Empty', full: false },
    ].forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawHeartStaticV3Scene(ctx, w, h, item.full), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'start-panel-v3' || id === 'game-over-panel-v3') {
    const kind: PanelConceptKind = id === 'start-panel-v3' ? 'start' : 'game-over'
    const panelFrames = [
      { label: 'Idle', t: 0, action: 0 },
      { label: 'Scan', t: PANEL_V3_MS * 0.32, action: 0 },
      { label: 'Pulse', t: PANEL_V3_MS * 0.62, action: 0 },
      { label: id === 'start-panel-v3' ? 'Start click' : 'Retry click', t: PANEL_V3_MS * 0.12, action: 0.28 },
      { label: 'Settle', t: PANEL_V3_MS * 0.86, action: 0.72 },
    ]
    panelFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawPanelV3Scene(ctx, w, h, kind, item.t, item.action), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'score-hud-v3') {
    frames.classList.add('asset-lab__frame-grid--wide')
    ;[
      { label: '4 digits', t: HUD_FEEDBACK_V3_MS * 0.45, score: '1280' },
      { label: '5 digits', t: HUD_FEEDBACK_V3_MS * 0.05, score: '39160' },
      { label: '7 digits', t: HUD_FEEDBACK_V3_MS * 0.28, score: '1284000' },
      { label: '9 digits', t: HUD_FEEDBACK_V3_MS * 0.72, score: '987654321' },
    ].forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawScoreHudV3Scene(ctx, w, h, item.t, item.score), item.label, index, { w: 176, h: 88, wide: true }))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'combo-hud-v3') {
    ;[
      { label: 'x3 cyan', t: 0, combo: 3 },
      { label: 'x10 gold', t: HUD_FEEDBACK_V3_MS * 0.08, combo: 10 },
      { label: 'x20 hot', t: HUD_FEEDBACK_V3_MS * 0.18, combo: 20 },
      { label: 'x50 overload', t: HUD_FEEDBACK_V3_MS * 0.28, combo: 50 },
      { label: 'x105 fever', t: HUD_FEEDBACK_V3_MS * 0.38, combo: 105 },
    ].forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawComboHudV3Scene(ctx, w, h, item.t, item.combo), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'score-pop-v3') {
    ;[
      { label: 'Source', t: 0 },
      { label: 'Flash', t: SCORE_POP_V3_MS * 0.16 },
      { label: 'Rise', t: SCORE_POP_V3_MS * 0.38 },
      { label: 'Dissolve', t: SCORE_POP_V3_MS * 0.76 },
    ].forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawScorePopV3Scene(ctx, w, h, item.t), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'combo-burst-v3') {
    ;[
      { label: 'x8', t: COMBO_BURST_V3_MS * 0.12, combo: 8 },
      { label: 'x10 impact', t: COMBO_BURST_V3_MS * 0.18, combo: 10 },
      { label: 'x20 shock', t: COMBO_BURST_V3_MS * 0.28, combo: 20 },
      { label: 'x50 overload', t: COMBO_BURST_V3_MS * 0.34, combo: 50 },
      { label: 'Dissolve', t: COMBO_BURST_V3_MS * 0.76, combo: 50 },
    ].forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawComboBurstV3Scene(ctx, w, h, item.t, item.combo), item.label, index))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'life-loss-popup-v3') {
    frames.classList.add('asset-lab__frame-grid--wide')
    ;[
      { label: 'Pop', t: LIFE_LOSS_POPUP_V3_MS * 0.08 },
      { label: 'Damage', t: LIFE_LOSS_POPUP_V3_MS * 0.22 },
      { label: 'Settle', t: LIFE_LOSS_POPUP_V3_MS * 0.48 },
      { label: 'Fade', t: LIFE_LOSS_POPUP_V3_MS * 0.78 },
    ].forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawLifeLossPopupV3Scene(ctx, w, h, item.t), item.label, index, { w: 176, h: 88, wide: true }))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'speed-up-chevron-v3') {
    frames.classList.add('asset-lab__frame-grid--wide')
    ;[
      { label: 'Streak A', t: HUD_ALERT_V3_MS * 0.12 },
      { label: 'Streak B', t: HUD_ALERT_V3_MS * 0.34 },
      { label: 'Streak C', t: HUD_ALERT_V3_MS * 0.58 },
      { label: 'Streak D', t: HUD_ALERT_V3_MS * 0.82 },
    ].forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawSpeedUpChevronFxScene(ctx, w, h, item.t), item.label, index, { w: 176, h: 88, wide: true }))
    })
    return finishFrameGrid(frames)
  }

  if (id === 'speed-up-alert-v3' || id === 'danger-rise-alert-v3') {
    frames.classList.add('asset-lab__frame-grid--wide')
    const kind: HudAlertKind = id === 'speed-up-alert-v3' ? 'speed-up' : 'danger-rise'
    ;[
      { label: 'Enter', t: HUD_ALERT_V3_MS * 0.08 },
      { label: 'Pulse', t: HUD_ALERT_V3_MS * 0.24 },
      { label: 'Scan', t: HUD_ALERT_V3_MS * 0.52 },
      { label: 'Fade', t: HUD_ALERT_V3_MS * 0.86 },
    ].forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawHudAlertV3Scene(ctx, w, h, kind, item.t), item.label, index, { w: 176, h: 88, wide: true }))
    })
    return finishFrameGrid(frames)
  }

  const mineFrames: Array<{ label: string; mode: MineMode; t: number; progress?: number }> = [
    { label: 'Armed', mode: 'armed', t: 0 },
    { label: 'Hit flash', mode: 'flash', t: 0 },
    { label: 'Exploding', mode: 'blast', t: MINE_EXPLOSION_MS * 0.42, progress: 0.42 },
    { label: 'Settled', mode: 'exploded', t: MINE_EXPLOSION_MS },
  ]
  mineFrames.forEach((item, index) => {
    frames.append(createStaticFrameCanvas((ctx, w, h) => drawMineScene(ctx, w, h, sprites, item.mode, item.t, item.progress ?? 0), item.label, index))
  })
  return finishFrameGrid(frames)
}
