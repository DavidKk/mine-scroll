import { drawProceduralOrbitParticles, drawMineBurstSmoke, drawMineScorchMark, drawMineSettledSmoke } from '../../ui/cell-fx.ts';
import {
  drawImageContained,
  GAME_ASSET_TUNING,
  drawGameMineCutoutAtCenter,
  getGameCutout,
  getGameFxBlendMode,
  getGameFxFrames,
} from '../../ui/game-assets.ts';
import { drawHiddenCellSprite, drawSpriteInCell, getTileSprites, type TileSprites } from '../../ui/tile-sprites.ts';
import { createFpsControl, createPanelHead, paintCheckerBg } from './editor-shell.ts';

type CellMode = 'hidden' | 'hover' | 'open' | 'breath';
type MineMode = 'armed' | 'flash' | 'blast' | 'exploded';
export type EffectPanelId = 'cells' | 'digits' | 'flag' | 'mine';

interface CellEffectDrawOpts {
  scale?: number;
  lift?: number;
  brightness?: number;
  ringAlpha?: number;
  ringWidth?: number;
  innerGlow?: number;
}

interface EffectCardSpec {
  id: EffectPanelId;
  title: string;
  description: string;
  cycleMs: number;
  frameCount: number;
  defaultFps: number;
  loop: boolean;
  interactive?: boolean;
}

interface LivePreview {
  canvas: HTMLCanvasElement;
  dispose: () => void;
}

const BREATH_CYCLE_MS = 2400;
const FLAG_WAVE_MS = 1500;
const DIGIT_PARTICLE_MS = 1800;
const MINE_EXPLOSION_MS = 720;
/** Match in-game revealed mine scale so armed / blast / exploded stay the same size. */
const MINE_CUTOUT_SCALE = GAME_ASSET_TUNING.cutouts.mineScale;
const PREVIEW_PX = 200;

function mineBlastPopScale(progress: number): number {
  if (progress <= 0 || progress >= 1) return 1;
  return 1 + Math.sin(progress * Math.PI) * 0.035;
}

const EFFECT_SPECS: EffectCardSpec[] = [
  {
    id: 'cells',
    title: 'Cell states',
    description: 'Procedural hover, breath, and reveal overlays rendered on the board cell sprites.',
    cycleMs: BREATH_CYCLE_MS,
    frameCount: 4,
    defaultFps: 8,
    loop: true,
    interactive: true,
  },
  {
    id: 'digits',
    title: 'Digit particles',
    description: 'Orbit particles around clue digits. Loops seamlessly at phase 0/1.',
    cycleMs: DIGIT_PARTICLE_MS,
    frameCount: 8,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'flag',
    title: 'Flag wave',
    description: 'Cloth wave deformation on the flag cutout with additive spark trail.',
    cycleMs: FLAG_WAVE_MS,
    frameCount: 8,
    defaultFps: 10,
    loop: true,
  },
  {
    id: 'mine',
    title: 'Mine explosion',
    description: 'One-shot blast sequence with smoke and settled cracked mine. Click preview to replay.',
    cycleMs: MINE_EXPLOSION_MS,
    frameCount: 8,
    defaultFps: 12,
    loop: false,
    interactive: true,
  },
];

const DIGIT_COLORS = [
  '#60a5fa',
  '#34d399',
  '#f87171',
  '#a78bfa',
  '#fb7185',
  '#22d3ee',
  '#facc15',
  '#f8fafc',
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(t: number): number {
  const p = clamp01(t);
  return 1 - (1 - p) ** 3;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function paintStageBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  paintCheckerBg(ctx, w, h);
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Live preview canvases are built before the panel enters the DOM — use a fixed layout size. */
function measurePreviewCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): { w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const parent = canvas.parentElement;
  let w = Math.floor(rect.width) || parent?.clientWidth || PREVIEW_PX;
  let h = Math.floor(rect.height) || parent?.clientHeight || PREVIEW_PX;
  if (w < 2) w = PREVIEW_PX;
  if (h < 2) h = PREVIEW_PX;
  const pw = Math.floor(w * dpr);
  const ph = Math.floor(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return { w, h };
}

function initPreviewCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  canvas.style.width = `${PREVIEW_PX}px`;
  canvas.style.height = `${PREVIEW_PX}px`;
  measurePreviewCanvas(canvas, ctx);
  return ctx;
}

function startPreviewLoop(canvas: HTMLCanvasElement, tick: () => void): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let frame = 0;
  let running = true;

  const loop = (): void => {
    if (!running) return;
    measurePreviewCanvas(canvas, ctx);
    tick();
    frame = window.requestAnimationFrame(loop);
  };

  loop();

  return () => {
    running = false;
    window.cancelAnimationFrame(frame);
  };
}

function layoutCell(canvasW: number, canvasH: number, ratio = 0.54): { x: number; y: number; size: number } {
  const size = Math.min(canvasW, canvasH) * ratio;
  return {
    x: (canvasW - size) / 2,
    y: (canvasH - size) / 2,
    size,
  };
}

function mixOpts(a: CellEffectDrawOpts, b: CellEffectDrawOpts, t: number): CellEffectDrawOpts {
  return {
    scale: lerp(a.scale ?? 1, b.scale ?? 1, t),
    lift: lerp(a.lift ?? 0, b.lift ?? 0, t),
    brightness: lerp(a.brightness ?? 0, b.brightness ?? 0, t),
    ringAlpha: lerp(a.ringAlpha ?? 0, b.ringAlpha ?? 0, t),
    ringWidth: lerp(a.ringWidth ?? 0, b.ringWidth ?? 0, t),
    innerGlow: lerp(a.innerGlow ?? 0, b.innerGlow ?? 0, t),
  };
}

function breathPhase(tMs: number): CellEffectDrawOpts {
  const phase = (tMs % BREATH_CYCLE_MS) / BREATH_CYCLE_MS;
  const wave = Math.sin(phase * Math.PI * 2);
  return {
    scale: 1 + wave * 0.026,
    lift: wave * -1.1,
    brightness: wave * 0.055,
    ringAlpha: 0.14 + (wave + 1) * 0.12,
    ringWidth: 1.7 + (wave + 1) * 0.55,
    innerGlow: 0.08 + (wave + 1) * 0.06,
  };
}

function hoverStateOpts(progress: number, pressed = false): CellEffectDrawOpts {
  const hover = {
    scale: pressed ? 0.97 : 1.046,
    lift: pressed ? 2 : -2.6,
    brightness: pressed ? -0.04 : 0.11,
    ringAlpha: pressed ? 0.28 : 0.56,
    ringWidth: pressed ? 1.8 : 2.5,
    innerGlow: pressed ? 0.1 : 0.24,
  };
  return mixOpts(
    { scale: 1, lift: 0, brightness: 0, ringAlpha: 0, ringWidth: 0, innerGlow: 0 },
    hover,
    easeOutCubic(progress),
  );
}

function drawHiddenCellWithEffect(
  ctx: CanvasRenderingContext2D,
  sprites: TileSprites,
  cellX: number,
  cellY: number,
  cellSize: number,
  opts: CellEffectDrawOpts = {},
): void {
  const scale = opts.scale ?? 1;
  const lift = opts.lift ?? 0;
  const brightness = opts.brightness ?? 0;
  const ringAlpha = opts.ringAlpha ?? 0;
  const ringWidth = opts.ringWidth ?? 2;
  const innerGlow = opts.innerGlow ?? 0;

  const cx = cellX + cellSize / 2;
  const cy = cellY + cellSize / 2 + lift;
  const drawSize = cellSize * scale;
  const x = cx - drawSize / 2;
  const y = cy - drawSize / 2;
  const corner = Math.max(6, drawSize * 0.08);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.shadowColor = 'rgba(15, 23, 42, 0.9)';
  ctx.shadowBlur = drawSize * 0.26;
  ctx.fillStyle = '#020617';
  roundedRectPath(ctx, x + drawSize * 0.08, y + drawSize * 0.12, drawSize * 0.84, drawSize * 0.88, corner);
  ctx.fill();
  ctx.restore();

  if (innerGlow > 0) {
    ctx.save();
    ctx.globalAlpha = innerGlow;
    const g = ctx.createRadialGradient(cx, cy - drawSize * 0.12, 0, cx, cy, drawSize * 0.75);
    g.addColorStop(0, 'rgba(125, 211, 252, 0.52)');
    g.addColorStop(0.58, 'rgba(99, 102, 241, 0.24)');
    g.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, drawSize * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (ringAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = '#7dd3fc';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
    ctx.shadowBlur = drawSize * 0.14;
    ctx.lineWidth = ringWidth;
    roundedRectPath(ctx, x - 2, y - 2, drawSize + 4, drawSize + 4, corner + 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  if (brightness !== 0) {
    ctx.filter = `brightness(${1 + brightness})`;
  }
  drawHiddenCellSprite(ctx, sprites, x, y, drawSize);
  ctx.restore();

  if (ringAlpha > 0.35) {
    ctx.save();
    ctx.globalAlpha = ringAlpha * 0.32;
    const hi = ctx.createLinearGradient(x, y, x, y + drawSize * 0.45);
    hi.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    hi.addColorStop(1, 'rgba(255, 255, 255, 0)');
    roundedRectPath(ctx, x + 4, y + 4, drawSize - 8, drawSize * 0.42, corner - 2);
    ctx.fillStyle = hi;
    ctx.fill();
    ctx.restore();
  }
}

function drawOpenCell(
  ctx: CanvasRenderingContext2D,
  sprites: TileSprites,
  x: number,
  y: number,
  size: number,
  pulse = 0,
): void {
  ctx.save();
  ctx.globalAlpha = 0.18 + pulse * 0.15;
  ctx.shadowColor = 'rgba(52, 211, 153, 0.62)';
  ctx.shadowBlur = size * 0.2;
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2;
  roundedRectPath(ctx, x - 3, y - 3, size + 6, size + 6, size * 0.1);
  ctx.stroke();
  ctx.restore();

  drawSpriteInCell(ctx, sprites.revealed, x, y, size);

  ctx.save();
  ctx.globalAlpha = 0.12 + pulse * 0.1;
  const hi = ctx.createLinearGradient(x, y, x + size, y + size);
  hi.addColorStop(0, 'rgba(255, 255, 255, 0)');
  hi.addColorStop(0.5, 'rgba(255, 255, 255, 0.42)');
  hi.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hi;
  roundedRectPath(ctx, x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84, size * 0.08);
  ctx.fill();
  ctx.restore();
}

function drawCellScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  mode: CellMode,
  tMs: number,
): void {
  paintStageBg(ctx, w, h);
  const cell = layoutCell(w, h, 0.56);
  if (mode === 'open') {
    drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, 0.5);
    return;
  }
  if (mode === 'hover') {
    drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size, hoverStateOpts(1));
    return;
  }
  if (mode === 'breath') {
    drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size, breathPhase(tMs));
    return;
  }
  drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size);
}

function drawDigitParticles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  tMs: number,
  seed = 0,
  cycleMs = DIGIT_PARTICLE_MS,
): void {
  const phase = (tMs % cycleMs) / cycleMs;
  drawProceduralOrbitParticles(ctx, cx, cy, size, color, phase, seed, 18, {
    radiusBase: 0.32,
    radiusStep: 0.034,
    dotBase: 0.018,
    dotStep: 0.006,
    alphaBase: 0.2,
    alphaPulse: 0.72,
    shadow: true,
  });
}

function drawDigitScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  digitIndex: number,
  tMs: number,
): void {
  paintStageBg(ctx, w, h);
  const cell = layoutCell(w, h, 0.56);
  const cx = cell.x + cell.size / 2;
  const cy = cell.y + cell.size / 2;
  const color = DIGIT_COLORS[digitIndex % DIGIT_COLORS.length];
  const wave = Math.sin((tMs / DIGIT_PARTICLE_MS) * Math.PI * 2);

  ctx.save();
  ctx.globalAlpha = 0.28 + (wave + 1) * 0.08;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell.size * 0.7);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, cell.size * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, 0.28);
  drawDigitParticles(ctx, cx, cy, cell.size, color, tMs, digitIndex);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = cell.size * 0.11;
  drawSpriteInCell(ctx, sprites.numbers[digitIndex], cell.x, cell.y, cell.size);
  ctx.restore();
}

function drawWaveImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  tMs: number,
  amplitude: number,
): void {
  const segments = 14;
  const phase = (tMs % FLAG_WAVE_MS) / FLAG_WAVE_MS;
  for (let i = 0; i < segments; i += 1) {
    const sx = (img.naturalWidth / segments) * i;
    const sw = img.naturalWidth / segments;
    const dx = x + (w / segments) * i;
    const dw = w / segments + 1;
    const local = i / Math.max(1, segments - 1);
    const wave = Math.sin(phase * Math.PI * 2 + local * Math.PI * 2.2);
    const dy = y + wave * amplitude * local;
    const dh = h * (1 + Math.cos(phase * Math.PI * 2 + local * Math.PI) * 0.025 * local);
    ctx.drawImage(img, sx, 0, sw, img.naturalHeight, dx, dy, dw, dh);
  }
}

function drawFlagScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  tMs: number,
): void {
  paintStageBg(ctx, w, h);
  const cell = layoutCell(w, h, 0.56);
  const cx = cell.x + cell.size / 2;
  const cy = cell.y + cell.size / 2;
  const flag = getGameCutout('flag-blue') ?? sprites.flag;
  const phase = (tMs % FLAG_WAVE_MS) / FLAG_WAVE_MS;
  const pop = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;

  drawHiddenCellWithEffect(
    ctx,
    sprites,
    cell.x,
    cell.y,
    cell.size,
    mixOpts(breathPhase(tMs), hoverStateOpts(0.35), 0.35),
  );

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.25 + pop * 0.25;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, cell.size * (0.43 + pop * 0.06), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(56, 189, 248, 0.75)';
  ctx.shadowBlur = cell.size * 0.1;
  const drawW = cell.size * 0.74;
  const drawH = cell.size * 0.74;
  drawWaveImage(ctx, flag, cx - drawW / 2, cy - drawH / 2, drawW, drawH, tMs, cell.size * 0.032);
  ctx.restore();

  drawDigitParticles(ctx, cx, cy, cell.size * 0.82, '#38bdf8', tMs, 3, FLAG_WAVE_MS);
}

function drawFxFramesOneShot(
  ctx: CanvasRenderingContext2D,
  frames: HTMLImageElement[] | null,
  blendMode: GlobalCompositeOperation,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number,
  alphaScale = 1,
): void {
  if (!frames || frames.length === 0 || alphaScale <= 0.01) return;
  const t = clamp01(progress);
  if (t <= 0) return;
  const index = Math.min(frames.length - 1, Math.floor(t * frames.length));
  const frame = frames[index];
  if (!frame) return;
  ctx.save();
  ctx.globalCompositeOperation = blendMode;
  ctx.globalAlpha = alphaScale;
  drawImageContained(ctx, frame, x, y, w, h, 1);
  ctx.restore();
}

function drawMineCutout(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  size: number,
  scale: number,
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(248, 113, 113, 0.72)';
  ctx.shadowBlur = size * 0.1;
  drawGameMineCutoutAtCenter(ctx, img, cx, cy, size, scale);
  ctx.restore();
}

function drawMineScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  mode: MineMode,
  tMs: number,
  blastProgress = 0,
): void {
  paintStageBg(ctx, w, h);
  const cell = layoutCell(w, h, 0.55);
  const cx = cell.x + cell.size / 2;
  const cy = cell.y + cell.size / 2;
  const standard = getGameCutout('mine-standard') ?? sprites.mine;
  const exploded = getGameCutout('mine-exploded') ?? standard;
  const flash = getGameCutout('mine-hit-flash') ?? standard;
  const frames = getGameFxFrames('mine-explosion');
  const blendMode = getGameFxBlendMode('mine-explosion');
  const pulse = Math.sin((tMs / 900) * Math.PI * 2) * 0.5 + 0.5;

  drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, mode === 'exploded' ? 0 : 0.35);

  if (mode === 'armed') {
    ctx.save();
    ctx.globalAlpha = 0.22 + pulse * 0.24;
    ctx.strokeStyle = '#fb7185';
    ctx.shadowColor = 'rgba(251, 113, 133, 0.68)';
    ctx.shadowBlur = cell.size * 0.14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cell.size * (0.35 + pulse * 0.035), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawMineCutout(ctx, standard, cx, cy, cell.size, MINE_CUTOUT_SCALE);
    return;
  }

  if (mode === 'flash') {
    drawMineCutout(ctx, flash, cx, cy, cell.size, MINE_CUTOUT_SCALE);
    ctx.save();
    ctx.globalAlpha = 0.46;
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath();
    ctx.arc(cx, cy, cell.size * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (mode === 'blast') {
    const eased = easeOutCubic(blastProgress);
    const fxAlpha = 1 - easeOutCubic(Math.max(0, (blastProgress - 0.42) / 0.58));
    drawFxFramesOneShot(
      ctx,
      frames,
      blendMode,
      cx - cell.size * 0.95,
      cy - cell.size * 0.72,
      cell.size * 1.9,
      cell.size * 1.42,
      eased,
      fxAlpha,
    );
    drawMineBurstSmoke(ctx, cx, cy, cell.size, blastProgress, 0.85 + blastProgress * 0.15);
    const mineImg = blastProgress > 0.55 ? exploded : flash;
    drawMineCutout(
      ctx,
      mineImg,
      cx,
      cy,
      cell.size,
      MINE_CUTOUT_SCALE * mineBlastPopScale(blastProgress),
    );
    return;
  }

  drawMineScorchMark(ctx, cx, cy, cell.size);
  drawMineSettledSmoke(ctx, cx, cy, cell.size, tMs, 0.9);
  drawMineCutout(ctx, exploded, cx, cy, cell.size, MINE_CUTOUT_SCALE);
}

function createStaticFrameCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  label: string,
  index: number,
): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'asset-lab__frame-cell';
  cell.title = label;

  const thumb = document.createElement('div');
  thumb.className = 'asset-lab__frame-thumb asset-lab__checker';

  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__frame-canvas';
  canvas.width = 88;
  canvas.height = 88;
  canvas.style.width = '88px';
  canvas.style.height = '88px';

  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, 88, 88);
  }

  thumb.append(canvas);

  const num = document.createElement('span');
  num.className = 'asset-lab__frame-num';
  num.textContent = String(index + 1).padStart(2, '0');
  thumb.append(num);

  const cap = document.createElement('span');
  cap.className = 'asset-lab__frame-caption';
  cap.textContent = label;

  cell.append(thumb, cap);
  return cell;
}

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
  if (id === 'digits') {
    return createLoopCanvas((ctx, w, h, now) => {
      const digit = Math.floor(now / 760) % sprites.numbers.length;
      drawDigitScene(ctx, w, h, sprites, digit, now);
    }, getFps, baseFps);
  }
  if (id === 'flag') {
    return createLoopCanvas((ctx, w, h, now) => drawFlagScene(ctx, w, h, sprites, now), getFps, baseFps);
  }
  return createMineLiveCanvas(sprites);
}

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
    hint.textContent =
      spec.id === 'mine'
        ? 'Click the preview to play the blast sequence.'
        : 'Hover and click the preview to test hover / open states.';
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
