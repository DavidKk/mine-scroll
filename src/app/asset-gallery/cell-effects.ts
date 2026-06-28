import { getTileSprites, type TileSprites } from '../../ui/tile-sprites.ts';
import { createFpsControl, createPanelHead } from './editor-shell.ts';
import {
  BOARD_INTERACTION_V3_ACTION_MS,
  BOARD_INTERACTION_V3_MS,
  BREATH_CYCLE_MS,
  COMBO_BURST_V3_MS,
  DIGIT_PARTICLE_MS,
  EFFECT_SPECS,
  FLAG_PLACE_ACTION_MS,
  FLAG_WAVE_MS,
  HEART_REFILL_V3_ACTION_MS,
  HUD_ALERT_V3_MS,
  HUD_FEEDBACK_V3_MS,
  LIFE_LOSS_POPUP_V3_MS,
  MINE_EXPLOSION_MS,
  MINE_HIT_V3_ACTION_MS,
  PANEL_V3_ACTION_MS,
  PANEL_V3_MS,
  SCORE_POP_V3_MS,
  WRONG_FLAG_V3_ACTION_MS,
  type EffectCardSpec,
  type EffectPanelId,
} from './cell-effect-panels.ts';
import {
  breathPhase,
  drawBoardV3InteractionScene,
  drawCellScene,
  drawComboBurstV3Scene,
  drawComboHudV3Scene,
  drawDigitParticles,
  drawDigitScene,
  drawFlagPlaceScene,
  drawFlagScene,
  drawHeartRefillV3Scene,
  drawHeartStaticV3Scene,
  drawHiddenCellWithEffect,
  drawHudAlertV3Scene,
  drawLifeLossPopupV3Scene,
  drawMineHitV3Scene,
  drawMineScene,
  drawOpenCell,
  drawPanelV3Scene,
  drawScoreHudV3Scene,
  drawScorePopV3Scene,
  drawSpeedUpChevronFxScene,
  drawWrongFlagV3Scene,
  hoverStateOpts,
  initPreviewCanvas,
  layoutCell,
  measurePreviewCanvas,
  mixOpts,
  paintStageBg,
  startPreviewLoop,
  type CellMode,
  type HudAlertKind,
  type LivePreview,
  type MineMode,
  type PanelConceptKind,
} from './cell-effect-scenes.ts';
import { easeOutCubic } from '../../ui/primitives/index.ts';
import { createStaticFrameCanvas } from './cell-effect-frames.ts';

export type { EffectPanelId } from './cell-effect-panels.ts';

function scaledTime(now: number, fps: number, baseFps: number): number {
  return now * (fps / baseFps);
}

function createCellLiveCanvas(sprites: TileSprites, getFps: () => number, baseFps: number): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__preview-canvas asset-lab__preview-canvas--interactive';
  const ctx = initPreviewCanvas(canvas);
  if (!ctx) return null;

  let hoverTarget = 0;
  let hoverProgress = 0;
  let pressed = false;
  let opened = false;
  let openStartedAt = 0;

  const draw = (): void => {
    const { w, h } = measurePreviewCanvas(canvas, ctx);
    const now = scaledTime(performance.now(), getFps(), baseFps);
    hoverProgress += (hoverTarget - hoverProgress) * 0.16;
    paintStageBg(ctx, w, h);
    const cell = layoutCell(w, h, 0.55);
    if (opened) {
      const pulse = 1 - easeOutCubic((now - openStartedAt) / 460);
      drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, Math.max(0, pulse));
      if (pulse > 0.02) {
        drawDigitParticles(ctx, cell.x + cell.size / 2, cell.y + cell.size / 2, cell.size, '#34d399', now, 7);
      }
      return;
    }
    const opts = mixOpts(breathPhase(now), hoverStateOpts(hoverProgress, pressed), hoverProgress);
    drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size, opts);
  };

  const onEnter = (): void => {
    hoverTarget = 1;
  };
  const onLeave = (): void => {
    hoverTarget = 0;
    pressed = false;
  };
  const onDown = (): void => {
    pressed = true;
  };
  const onUp = (): void => {
    pressed = false;
  };
  const onClick = (): void => {
    opened = !opened;
    openStartedAt = scaledTime(performance.now(), getFps(), baseFps);
  };

  canvas.addEventListener('mouseenter', onEnter);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('click', onClick);

  const stopLoop = startPreviewLoop(canvas, draw);

  return {
    canvas,
    dispose: () => {
      stopLoop();
      canvas.removeEventListener('mouseenter', onEnter);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('click', onClick);
    },
  };
}

function createLoopCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => void,
  getFps: () => number,
  baseFps: number,
): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__preview-canvas';
  const ctx = initPreviewCanvas(canvas);
  if (!ctx) return null;

  const stopLoop = startPreviewLoop(canvas, () => {
    const { w, h } = measurePreviewCanvas(canvas, ctx);
    const now = scaledTime(performance.now(), getFps(), baseFps);
    draw(ctx, w, h, now);
  });

  return {
    canvas,
    dispose: () => stopLoop(),
  };
}

function createMineLiveCanvas(sprites: TileSprites): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__preview-canvas asset-lab__preview-canvas--interactive';
  const ctx = initPreviewCanvas(canvas);
  if (!ctx) return null;

  let explosionStart: number | null = null;
  let settled = false;

  const onClick = (): void => {
    if (settled) {
      settled = false;
      explosionStart = null;
      return;
    }
    if (explosionStart === null) {
      explosionStart = performance.now();
    }
  };

  const stopLoop = startPreviewLoop(canvas, () => {
    const { w, h } = measurePreviewCanvas(canvas, ctx);
    const now = performance.now();
    if (settled) {
      drawMineScene(ctx, w, h, sprites, 'exploded', now);
    } else if (explosionStart !== null) {
      const progress = (now - explosionStart) / MINE_EXPLOSION_MS;
      if (progress >= 1) {
        settled = true;
        explosionStart = null;
        drawMineScene(ctx, w, h, sprites, 'exploded', now);
      } else {
        drawMineScene(ctx, w, h, sprites, 'blast', now, progress);
      }
    } else {
      drawMineScene(ctx, w, h, sprites, 'armed', now);
    }
  });

  canvas.addEventListener('click', onClick);

  return {
    canvas,
    dispose: () => {
      stopLoop();
      canvas.removeEventListener('click', onClick);
    },
  };
}

function createHeartRefillLiveCanvas(getFps: () => number, baseFps: number): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__preview-canvas asset-lab__preview-canvas--interactive';
  const ctx = initPreviewCanvas(canvas);
  if (!ctx) return null;

  let refillStart: number | null = null;
  let full = false;

  const onClick = (): void => {
    full = false;
    refillStart = scaledTime(performance.now(), getFps(), baseFps);
  };

  const stopLoop = startPreviewLoop(canvas, () => {
    const { w, h } = measurePreviewCanvas(canvas, ctx);
    const now = scaledTime(performance.now(), getFps(), baseFps);
    if (refillStart !== null) {
      const elapsed = now - refillStart;
      if (elapsed >= HEART_REFILL_V3_ACTION_MS) {
        refillStart = null;
        full = true;
        drawHeartStaticV3Scene(ctx, w, h, true);
        return;
      }
      drawHeartRefillV3Scene(ctx, w, h, elapsed);
      return;
    }
    drawHeartStaticV3Scene(ctx, w, h, full);
  });

  canvas.addEventListener('click', onClick);

  return {
    canvas,
    dispose: () => {
      stopLoop();
      canvas.removeEventListener('click', onClick);
    },
  };
}

function createHeartLossLiveCanvas(): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__preview-canvas asset-lab__preview-canvas--interactive';
  const ctx = initPreviewCanvas(canvas);
  if (!ctx) return null;

  let full = true;
  const onClick = (): void => {
    full = !full;
  };

  const stopLoop = startPreviewLoop(canvas, () => {
    const { w, h } = measurePreviewCanvas(canvas, ctx);
    drawHeartStaticV3Scene(ctx, w, h, full);
  });

  canvas.addEventListener('click', onClick);

  return {
    canvas,
    dispose: () => {
      stopLoop();
      canvas.removeEventListener('click', onClick);
    },
  };
}

function createPanelV3LiveCanvas(kind: PanelConceptKind, getFps: () => number, baseFps: number): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__preview-canvas asset-lab__preview-canvas--interactive';
  const ctx = initPreviewCanvas(canvas);
  if (!ctx) return null;

  let actionStart: number | null = null;
  const onClick = (): void => {
    actionStart = scaledTime(performance.now(), getFps(), baseFps);
  };

  const stopLoop = startPreviewLoop(canvas, () => {
    const { w, h } = measurePreviewCanvas(canvas, ctx);
    const now = scaledTime(performance.now(), getFps(), baseFps);
    let action = 0;
    if (actionStart !== null) {
      action = (now - actionStart) / PANEL_V3_ACTION_MS;
      if (action >= 1) {
        action = 0;
        actionStart = null;
      }
    }
    drawPanelV3Scene(ctx, w, h, kind, now, action);
  });

  canvas.addEventListener('click', onClick);

  return {
    canvas,
    dispose: () => {
      stopLoop();
      canvas.removeEventListener('click', onClick);
    },
  };
}

function createFrames(id: EffectPanelId, sprites: TileSprites): HTMLElement {
  const frames = document.createElement('div');
  frames.className = 'asset-lab__frame-grid';

  if (id === 'cells') {
    const cellFrames: Array<{ label: string; mode: CellMode; t: number }> = [
      { label: 'Hidden', mode: 'hidden', t: 0 },
      { label: 'Breath peak', mode: 'breath', t: BREATH_CYCLE_MS * 0.25 },
      { label: 'Hover', mode: 'hover', t: 0 },
      { label: 'Open', mode: 'open', t: 0 },
    ];
    cellFrames.forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawCellScene(ctx, w, h, sprites, item.mode, item.t), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'board-interactions-v3') {
    const boardFrames = [
      { label: 'Hidden', t: 0 },
      { label: 'Hover', t: BOARD_INTERACTION_V3_ACTION_MS * 0.2 },
      { label: 'Press', t: BOARD_INTERACTION_V3_ACTION_MS * 0.32 },
      { label: 'Reveal flash', t: BOARD_INTERACTION_V3_ACTION_MS * 0.46 },
      { label: 'Digit pop', t: BOARD_INTERACTION_V3_ACTION_MS * 0.62 },
      { label: 'Hold', t: BOARD_INTERACTION_V3_ACTION_MS * 0.9 },
    ];
    boardFrames.forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawBoardV3InteractionScene(ctx, w, h, sprites, item.t, 3), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'digits') {
    const digitFrames = [
      { label: 'Start', digit: 0, t: 0 },
      { label: 'Expand', digit: 2, t: DIGIT_PARTICLE_MS * 0.33 },
      { label: 'Peak', digit: 4, t: DIGIT_PARTICLE_MS * 0.58 },
      { label: 'Settle', digit: 7, t: DIGIT_PARTICLE_MS * 0.82 },
    ];
    digitFrames.forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawDigitScene(ctx, w, h, sprites, item.digit, item.t), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'flag') {
    const flagFrames = [
      { label: 'Wind up', t: 0 },
      { label: 'Swing left', t: FLAG_WAVE_MS * 0.25 },
      { label: 'Lift', t: FLAG_WAVE_MS * 0.5 },
      { label: 'Swing back', t: FLAG_WAVE_MS * 0.75 },
    ];
    flagFrames.forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawFlagScene(ctx, w, h, sprites, item.t), item.label, index));
    });
    return frames;
  }

  if (id === 'flag-place-v3') {
    const flagPlaceFrames = [
      { label: 'Approach', t: 0 },
      { label: 'Plant', t: FLAG_PLACE_ACTION_MS * 0.42 },
      { label: 'Settle', t: FLAG_PLACE_ACTION_MS * 0.78 },
      { label: 'Hold', t: FLAG_PLACE_ACTION_MS },
    ];
    flagPlaceFrames.forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawFlagPlaceScene(ctx, w, h, sprites, item.t), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'wrong-flag-v3') {
    const wrongFlagFrames = [
      { label: 'Flagged', t: 0 },
      { label: 'Shake', t: WRONG_FLAG_V3_ACTION_MS * 0.18 },
      { label: 'Denied', t: WRONG_FLAG_V3_ACTION_MS * 0.36 },
      { label: 'Break sparks', t: WRONG_FLAG_V3_ACTION_MS * 0.58 },
      { label: 'Fade hold', t: WRONG_FLAG_V3_ACTION_MS * 0.9 },
    ];
    wrongFlagFrames.forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawWrongFlagV3Scene(ctx, w, h, sprites, item.t), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'mine-hit-v3') {
    const mineHitFrames = [
      { label: 'Armed', t: 0 },
      { label: 'Hit flash', t: MINE_HIT_V3_ACTION_MS * 0.16 },
      { label: 'Shock ring', t: MINE_HIT_V3_ACTION_MS * 0.34 },
      { label: 'Cracked', t: MINE_HIT_V3_ACTION_MS * 0.58 },
      { label: 'Smoke hold', t: MINE_HIT_V3_ACTION_MS * 0.92 },
    ];
    mineHitFrames.forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawMineHitV3Scene(ctx, w, h, sprites, item.t), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'heart-refill-v3') {
    const heartFrames = [
      { label: 'Empty', t: 0 },
      { label: 'Glow', t: HEART_REFILL_V3_ACTION_MS * 0.22 },
      { label: 'Pop', t: HEART_REFILL_V3_ACTION_MS * 0.42 },
      { label: 'Settle', t: HEART_REFILL_V3_ACTION_MS * 0.66 },
      { label: 'Hold', t: HEART_REFILL_V3_ACTION_MS },
    ];
    heartFrames.forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawHeartRefillV3Scene(ctx, w, h, item.t), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'heart-loss-v3') {
    [
      { label: 'Full', full: true },
      { label: 'Empty', full: false },
    ].forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawHeartStaticV3Scene(ctx, w, h, item.full), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'start-panel-v3' || id === 'game-over-panel-v3') {
    const kind: PanelConceptKind = id === 'start-panel-v3' ? 'start' : 'game-over';
    const panelFrames = [
      { label: 'Idle', t: 0, action: 0 },
      { label: 'Scan', t: PANEL_V3_MS * 0.32, action: 0 },
      { label: 'Pulse', t: PANEL_V3_MS * 0.62, action: 0 },
      { label: id === 'start-panel-v3' ? 'Start click' : 'Retry click', t: PANEL_V3_MS * 0.12, action: 0.28 },
      { label: 'Settle', t: PANEL_V3_MS * 0.86, action: 0.72 },
    ];
    panelFrames.forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawPanelV3Scene(ctx, w, h, kind, item.t, item.action), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'score-hud-v3') {
    frames.classList.add('asset-lab__frame-grid--wide');
    [
      { label: '4 digits', t: HUD_FEEDBACK_V3_MS * 0.45, score: '1280' },
      { label: '5 digits', t: HUD_FEEDBACK_V3_MS * 0.05, score: '39160' },
      { label: '7 digits', t: HUD_FEEDBACK_V3_MS * 0.28, score: '1284000' },
      { label: '9 digits', t: HUD_FEEDBACK_V3_MS * 0.72, score: '987654321' },
    ].forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas(
          (ctx, w, h) => drawScoreHudV3Scene(ctx, w, h, item.t, item.score),
          item.label,
          index,
          { w: 176, h: 88, wide: true },
        ),
      );
    });
    return frames;
  }

  if (id === 'combo-hud-v3') {
    [
      { label: 'x3 cyan', t: 0, combo: 3 },
      { label: 'x10 gold', t: HUD_FEEDBACK_V3_MS * 0.08, combo: 10 },
      { label: 'x20 hot', t: HUD_FEEDBACK_V3_MS * 0.18, combo: 20 },
      { label: 'x50 overload', t: HUD_FEEDBACK_V3_MS * 0.28, combo: 50 },
    ].forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawComboHudV3Scene(ctx, w, h, item.t, item.combo), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'score-pop-v3') {
    [
      { label: 'Source', t: 0 },
      { label: 'Flash', t: SCORE_POP_V3_MS * 0.16 },
      { label: 'Rise', t: SCORE_POP_V3_MS * 0.38 },
      { label: 'Dissolve', t: SCORE_POP_V3_MS * 0.76 },
    ].forEach((item, index) => {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawScorePopV3Scene(ctx, w, h, item.t), item.label, index));
    });
    return frames;
  }

  if (id === 'combo-burst-v3') {
    [
      { label: 'x8', t: COMBO_BURST_V3_MS * 0.12, combo: 8 },
      { label: 'x10 impact', t: COMBO_BURST_V3_MS * 0.18, combo: 10 },
      { label: 'x20 shock', t: COMBO_BURST_V3_MS * 0.28, combo: 20 },
      { label: 'x50 overload', t: COMBO_BURST_V3_MS * 0.34, combo: 50 },
      { label: 'Dissolve', t: COMBO_BURST_V3_MS * 0.76, combo: 50 },
    ].forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawComboBurstV3Scene(ctx, w, h, item.t, item.combo), item.label, index),
      );
    });
    return frames;
  }

  if (id === 'life-loss-popup-v3') {
    frames.classList.add('asset-lab__frame-grid--wide');
    [
      { label: 'Pop', t: LIFE_LOSS_POPUP_V3_MS * 0.08 },
      { label: 'Damage', t: LIFE_LOSS_POPUP_V3_MS * 0.22 },
      { label: 'Settle', t: LIFE_LOSS_POPUP_V3_MS * 0.48 },
      { label: 'Fade', t: LIFE_LOSS_POPUP_V3_MS * 0.78 },
    ].forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas(
          (ctx, w, h) => drawLifeLossPopupV3Scene(ctx, w, h, item.t),
          item.label,
          index,
          { w: 176, h: 88, wide: true },
        ),
      );
    });
    return frames;
  }

  if (id === 'speed-up-chevron-v3') {
    frames.classList.add('asset-lab__frame-grid--wide');
    [
      { label: 'Streak A', t: HUD_ALERT_V3_MS * 0.12 },
      { label: 'Streak B', t: HUD_ALERT_V3_MS * 0.34 },
      { label: 'Streak C', t: HUD_ALERT_V3_MS * 0.58 },
      { label: 'Streak D', t: HUD_ALERT_V3_MS * 0.82 },
    ].forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas(
          (ctx, w, h) => drawSpeedUpChevronFxScene(ctx, w, h, item.t),
          item.label,
          index,
          { w: 176, h: 88, wide: true },
        ),
      );
    });
    return frames;
  }

  if (id === 'speed-up-alert-v3' || id === 'danger-rise-alert-v3') {
    frames.classList.add('asset-lab__frame-grid--wide');
    const kind: HudAlertKind = id === 'speed-up-alert-v3' ? 'speed-up' : 'danger-rise';
    [
      { label: 'Enter', t: HUD_ALERT_V3_MS * 0.08 },
      { label: 'Pulse', t: HUD_ALERT_V3_MS * 0.24 },
      { label: 'Scan', t: HUD_ALERT_V3_MS * 0.52 },
      { label: 'Fade', t: HUD_ALERT_V3_MS * 0.86 },
    ].forEach((item, index) => {
      frames.append(
        createStaticFrameCanvas(
          (ctx, w, h) => drawHudAlertV3Scene(ctx, w, h, kind, item.t),
          item.label,
          index,
          { w: 176, h: 88, wide: true },
        ),
      );
    });
    return frames;
  }

  const mineFrames: Array<{ label: string; mode: MineMode; t: number; progress?: number }> = [
    { label: 'Armed', mode: 'armed', t: 0 },
    { label: 'Hit flash', mode: 'flash', t: 0 },
    { label: 'Exploding', mode: 'blast', t: MINE_EXPLOSION_MS * 0.42, progress: 0.42 },
    { label: 'Settled', mode: 'exploded', t: MINE_EXPLOSION_MS },
  ];
  mineFrames.forEach((item, index) => {
    frames.append(
      createStaticFrameCanvas(
        (ctx, w, h) => drawMineScene(ctx, w, h, sprites, item.mode, item.t, item.progress ?? 0),
        item.label,
        index,
      ),
    );
  });
  return frames;
}

function createAnimPreview(
  id: EffectPanelId,
  sprites: TileSprites,
  getFps: () => number,
  baseFps: number,
): LivePreview | null {
  if (id === 'cells') return createCellLiveCanvas(sprites, getFps, baseFps);
  if (id === 'board-interactions-v3') {
    return createLoopCanvas((ctx, w, h, now) => {
      const digit = (Math.floor(now / BOARD_INTERACTION_V3_MS) % 8) + 1;
      drawBoardV3InteractionScene(ctx, w, h, sprites, now, digit);
    }, getFps, baseFps);
  }
  if (id === 'digits') {
    return createLoopCanvas((ctx, w, h, now) => {
      const digit = Math.floor(now / 760) % sprites.numbers.length;
      drawDigitScene(ctx, w, h, sprites, digit, now);
    }, getFps, baseFps);
  }
  if (id === 'flag') {
    return createLoopCanvas((ctx, w, h, now) => drawFlagScene(ctx, w, h, sprites, now), getFps, baseFps);
  }
  if (id === 'flag-place-v3') {
    return createLoopCanvas((ctx, w, h, now) => drawFlagPlaceScene(ctx, w, h, sprites, now), getFps, baseFps);
  }
  if (id === 'wrong-flag-v3') {
    return createLoopCanvas((ctx, w, h, now) => drawWrongFlagV3Scene(ctx, w, h, sprites, now), getFps, baseFps);
  }
  if (id === 'mine-hit-v3') {
    return createLoopCanvas((ctx, w, h, now) => drawMineHitV3Scene(ctx, w, h, sprites, now), getFps, baseFps);
  }
  if (id === 'heart-refill-v3') {
    return createHeartRefillLiveCanvas(getFps, baseFps);
  }
  if (id === 'heart-loss-v3') return createHeartLossLiveCanvas();
  if (id === 'start-panel-v3') return createPanelV3LiveCanvas('start', getFps, baseFps);
  if (id === 'game-over-panel-v3') return createPanelV3LiveCanvas('game-over', getFps, baseFps);
  if (id === 'score-hud-v3') {
    return createLoopCanvas((ctx, w, h, now) => {
      const scores = ['1280', '39160', '1284000', '987654321'];
      const score = scores[Math.floor(now / HUD_FEEDBACK_V3_MS) % scores.length] ?? scores[0];
      drawScoreHudV3Scene(ctx, w, h, now, score);
    }, getFps, baseFps);
  }
  if (id === 'combo-hud-v3') {
    return createLoopCanvas((ctx, w, h, now) => {
      const combos = [3, 10, 20, 50];
      const combo = combos[Math.floor(now / HUD_FEEDBACK_V3_MS) % combos.length] ?? 3;
      drawComboHudV3Scene(ctx, w, h, now, combo);
    }, getFps, baseFps);
  }
  if (id === 'score-pop-v3') {
    return createLoopCanvas((ctx, w, h, now) => drawScorePopV3Scene(ctx, w, h, now), getFps, baseFps);
  }
  if (id === 'combo-burst-v3') {
    return createLoopCanvas((ctx, w, h, now) => {
      const combos = [8, 10, 20, 50];
      const combo = combos[Math.floor(now / COMBO_BURST_V3_MS) % combos.length] ?? 8;
      drawComboBurstV3Scene(ctx, w, h, now, combo);
    }, getFps, baseFps);
  }
  if (id === 'life-loss-popup-v3') {
    return createLoopCanvas((ctx, w, h, now) => drawLifeLossPopupV3Scene(ctx, w, h, now), getFps, baseFps);
  }
  if (id === 'speed-up-chevron-v3') {
    return createLoopCanvas((ctx, w, h, now) => drawSpeedUpChevronFxScene(ctx, w, h, now), getFps, baseFps);
  }
  if (id === 'speed-up-alert-v3' || id === 'danger-rise-alert-v3') {
    const kind: HudAlertKind = id === 'speed-up-alert-v3' ? 'speed-up' : 'danger-rise';
    return createLoopCanvas((ctx, w, h, now) => drawHudAlertV3Scene(ctx, w, h, kind, now), getFps, baseFps);
  }
  return createMineLiveCanvas(sprites);
}

const INTERACTIVE_HINTS: Partial<Record<EffectPanelId, string>> = {
  mine: 'Click the preview to play the blast sequence.',
  'heart-refill-v3': 'Click the preview to play refill; it holds on the full heart.',
  'heart-loss-v3': 'Click the preview to toggle full / empty heart states.',
  'start-panel-v3': 'Click the preview to play the button press feedback.',
  'game-over-panel-v3': 'Click the preview to play the button press feedback.',
};

function createEffectPanel(spec: EffectCardSpec): { panel: HTMLElement; dispose: () => void } | null {
  const sprites = getTileSprites();
  if (!sprites) return null;

  let fps = spec.defaultFps;
  const getFps = (): number => fps;

  const panel = document.createElement('section');
  panel.className = 'asset-lab__panel';
  panel.dataset.panelId = spec.id;
  panel.append(createPanelHead(spec.title, spec.description));

  const workspace = document.createElement('div');
  workspace.className = 'asset-lab__anim-workspace';

  const previewWrap = document.createElement('div');
  previewWrap.className = 'asset-lab__anim-preview asset-lab__checker';
  const preview = createAnimPreview(spec.id, sprites, getFps, spec.defaultFps);
  if (preview) previewWrap.append(preview.canvas);

  const controls = document.createElement('div');
  controls.className = 'asset-lab__anim-controls';

  const meta = document.createElement('dl');
  meta.className = 'asset-lab__meta-list';
  meta.innerHTML = `
    <div><dt>Cycle</dt><dd>${spec.cycleMs} ms</dd></div>
    <div><dt>Frames</dt><dd>${spec.frameCount}</dd></div>
    <div><dt>Loop</dt><dd>${spec.loop ? 'yes' : 'one-shot'}</dd></div>
  `;

  controls.append(meta);

  if (spec.loop) {
    controls.append(createFpsControl(spec.defaultFps, (next) => {
      fps = next;
    }));
  }

  if (spec.interactive) {
    const hint = document.createElement('p');
    hint.className = 'asset-lab__field-hint';
    hint.textContent = INTERACTIVE_HINTS[spec.id] ?? 'Hover and click the preview to test hover / open states.';
    controls.append(hint);
  }

  workspace.append(previewWrap, controls);

  const framesSection = document.createElement('div');
  framesSection.className = 'asset-lab__frames-section';

  const framesHeader = document.createElement('div');
  framesHeader.className = 'asset-lab__frames-header';
  framesHeader.innerHTML = `<span>Keyframes</span><small>${spec.frameCount} samples</small>`;

  framesSection.append(framesHeader, createFrames(spec.id, sprites));
  panel.append(workspace, framesSection);

  return {
    panel,
    dispose: () => preview?.dispose(),
  };
}

export function mountEffectPanels(): { panels: Record<EffectPanelId, HTMLElement>; dispose: () => void } {
  const panels = {} as Record<EffectPanelId, HTMLElement>;
  const disposers: Array<() => void> = [];

  for (const spec of EFFECT_SPECS) {
    const built = createEffectPanel(spec);
    if (built) {
      panels[spec.id] = built.panel;
      disposers.push(built.dispose);
    }
  }

  return {
    panels,
    dispose: () => {
      for (const dispose of disposers) dispose();
    },
  };
}

