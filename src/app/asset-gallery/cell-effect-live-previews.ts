import { type TileSprites } from '../../ui/tile-sprites.ts';
import {
  BOARD_INTERACTION_V3_MS,
  COMBO_BURST_V3_MS,
  HEART_REFILL_V3_ACTION_MS,
  HUD_FEEDBACK_V3_MS,
  MINE_EXPLOSION_MS,
  PANEL_V3_ACTION_MS,
  type EffectPanelId,
} from './cell-effect-panels.ts';
import {
  breathPhase,
  drawBoardV3InteractionScene,
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
  type HudAlertKind,
  type LivePreview,
  type PanelConceptKind,
} from './cell-effect-scenes.ts';
import { easeOutCubic } from '../../ui/primitives/index.ts';
import { createLoopCanvas, scaledTime } from './cell-effect-preview-utils.ts';

export function createCellLiveCanvas(sprites: TileSprites, getFps: () => number, baseFps: number): LivePreview | null {
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

export function createMineLiveCanvas(sprites: TileSprites): LivePreview | null {
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

export function createHeartRefillLiveCanvas(getFps: () => number, baseFps: number): LivePreview | null {
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

export function createHeartLossLiveCanvas(): LivePreview | null {
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

export function createPanelV3LiveCanvas(kind: PanelConceptKind, getFps: () => number, baseFps: number): LivePreview | null {
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

export function createAnimPreview(
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
