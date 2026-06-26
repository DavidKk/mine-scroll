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
type BoardV3TileKey =
  | 'cell-hidden'
  | 'cell-revealed'
  | 'cell-hover'
  | 'cell-danger'
  | 'cell-pressed'
  | 'cell-safe'
  | 'cell-empty'
  | 'cell-disabled'
  | `num-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type EffectPanelId =
  | 'cells'
  | 'board-interactions-v3'
  | 'digits'
  | 'flag'
  | 'flag-place-v3'
  | 'wrong-flag-v3'
  | 'mine'
  | 'mine-hit-v3'
  | 'heart-refill-v3';

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
const BOARD_INTERACTION_V3_MS = 1680;
const BOARD_INTERACTION_V3_ACTION_MS = 1280;
const FLAG_WAVE_MS = 1500;
const FLAG_PLACE_MS = 1180;
const FLAG_PLACE_ACTION_MS = 430;
const WRONG_FLAG_V3_MS = 1180;
const WRONG_FLAG_V3_ACTION_MS = 520;
const DIGIT_PARTICLE_MS = 1800;
const MINE_EXPLOSION_MS = 720;
const MINE_HIT_V3_MS = 980;
const MINE_HIT_V3_ACTION_MS = 620;
const HEART_REFILL_V3_MS = 1180;
const HEART_REFILL_V3_ACTION_MS = 560;
const V3_CANDIDATE_FLAG_SRC = '/assets/candidates/game-ui-v3/cutouts/flag-standard.png';
const V3_CANDIDATE_MINE_STANDARD_SRC = '/assets/candidates/game-ui-v3/cutouts/mine-standard.png';
const V3_CANDIDATE_MINE_CRACKED_SRC = '/assets/candidates/game-ui-v3/cutouts/mine-cracked.png';
const V3_CANDIDATE_HEART_FULL_SRC = '/assets/candidates/game-ui-v3/cutouts/heart-full.png';
const V3_CANDIDATE_HEART_EMPTY_SRC = '/assets/candidates/game-ui-v3/cutouts/heart-empty.png';
const V3_BOARD_TILE_BASE = '/assets/candidates/board-v3-square/tiles';
/** Match in-game revealed mine scale so armed / blast / exploded stay the same size. */
const MINE_CUTOUT_SCALE = GAME_ASSET_TUNING.cutouts.mineScale;
const PREVIEW_PX = 200;

interface ImageBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const candidateFlagImage = new Image();
candidateFlagImage.src = V3_CANDIDATE_FLAG_SRC;
let candidateFlagBounds: ImageBounds | null = null;
candidateFlagImage.addEventListener('load', () => {
  candidateFlagBounds = readImageBounds(candidateFlagImage);
});

const candidateMineStandardImage = new Image();
candidateMineStandardImage.src = V3_CANDIDATE_MINE_STANDARD_SRC;
let candidateMineStandardBounds: ImageBounds | null = null;
candidateMineStandardImage.addEventListener('load', () => {
  candidateMineStandardBounds = readImageBounds(candidateMineStandardImage);
});

const candidateMineCrackedImage = new Image();
candidateMineCrackedImage.src = V3_CANDIDATE_MINE_CRACKED_SRC;
let candidateMineCrackedBounds: ImageBounds | null = null;
candidateMineCrackedImage.addEventListener('load', () => {
  candidateMineCrackedBounds = readImageBounds(candidateMineCrackedImage);
});

const candidateHeartFullImage = new Image();
candidateHeartFullImage.src = V3_CANDIDATE_HEART_FULL_SRC;
let candidateHeartFullBounds: ImageBounds | null = null;
candidateHeartFullImage.addEventListener('load', () => {
  candidateHeartFullBounds = readImageBounds(candidateHeartFullImage);
});

const candidateHeartEmptyImage = new Image();
candidateHeartEmptyImage.src = V3_CANDIDATE_HEART_EMPTY_SRC;
let candidateHeartEmptyBounds: ImageBounds | null = null;
candidateHeartEmptyImage.addEventListener('load', () => {
  candidateHeartEmptyBounds = readImageBounds(candidateHeartEmptyImage);
});

function createAssetImage(src: string): HTMLImageElement {
  const image = new Image();
  image.src = src;
  return image;
}

const v3BoardTileImages: Record<BoardV3TileKey, HTMLImageElement> = {
  'cell-hidden': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-hidden.png`),
  'cell-revealed': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-revealed.png`),
  'cell-hover': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-hover.png`),
  'cell-danger': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-danger.png`),
  'cell-pressed': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-pressed.png`),
  'cell-safe': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-safe.png`),
  'cell-empty': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-empty.png`),
  'cell-disabled': createAssetImage(`${V3_BOARD_TILE_BASE}/cell-disabled.png`),
  'num-1': createAssetImage(`${V3_BOARD_TILE_BASE}/num-1.png`),
  'num-2': createAssetImage(`${V3_BOARD_TILE_BASE}/num-2.png`),
  'num-3': createAssetImage(`${V3_BOARD_TILE_BASE}/num-3.png`),
  'num-4': createAssetImage(`${V3_BOARD_TILE_BASE}/num-4.png`),
  'num-5': createAssetImage(`${V3_BOARD_TILE_BASE}/num-5.png`),
  'num-6': createAssetImage(`${V3_BOARD_TILE_BASE}/num-6.png`),
  'num-7': createAssetImage(`${V3_BOARD_TILE_BASE}/num-7.png`),
  'num-8': createAssetImage(`${V3_BOARD_TILE_BASE}/num-8.png`),
};

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
    id: 'board-interactions-v3',
    title: 'Board interactions v3',
    description: 'Candidate v3 tile interaction: hover glow, press/reveal flash, and clue number pop-in driven by Canvas overlays.',
    cycleMs: BOARD_INTERACTION_V3_MS,
    frameCount: 6,
    defaultFps: 12,
    loop: true,
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
    title: 'Flag wave (current)',
    description: 'Current looping flag idle treatment: cloth wave deformation with additive spark trail.',
    cycleMs: FLAG_WAVE_MS,
    frameCount: 8,
    defaultFps: 10,
    loop: true,
  },
  {
    id: 'flag-place-v3',
    title: 'Flag place v3',
    description: 'Candidate interaction motion: static v3 flag cutout planted by Canvas transform, ring, and small impact sparks.',
    cycleMs: FLAG_PLACE_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'wrong-flag-v3',
    title: 'Wrong flag v3',
    description: 'Candidate error motion: v3 flag cutout with Canvas shake, red denial ring, X slash, and break sparks.',
    cycleMs: WRONG_FLAG_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'mine',
    title: 'Mine explosion (current)',
    description: 'Current one-shot blast sequence with smoke and settled cracked mine. Click preview to replay.',
    cycleMs: MINE_EXPLOSION_MS,
    frameCount: 8,
    defaultFps: 12,
    loop: false,
    interactive: true,
  },
  {
    id: 'mine-hit-v3',
    title: 'Mine hit v3',
    description: 'Candidate mine interaction using v3 static cutouts plus Canvas shake, red core flash, shock ring, and smoke.',
    cycleMs: MINE_HIT_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'heart-refill-v3',
    title: 'Heart refill v3',
    description: 'Candidate reward motion using v3 heart cutouts plus Canvas pop, gold/cyan rings, and light particles.',
    cycleMs: HEART_REFILL_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
];

const DIGIT_COLORS = [
  '#60a5fa',
  '#34d399',
  '#f87171',
  '#fbbf24',
  '#c084fc',
  '#22d3ee',
  '#ec4899',
  '#fb923c',
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(t: number): number {
  const p = clamp01(t);
  return 1 - (1 - p) ** 3;
}

function easeOutBack(t: number): number {
  const p = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function readImageBounds(image: HTMLImageElement): ImageBounds | null {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null;

  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        found = true;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
    }
  }

  if (!found) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
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

function getV3BoardTileImage(key: BoardV3TileKey): HTMLImageElement | null {
  const image = v3BoardTileImages[key];
  return image.complete && image.naturalWidth > 0 ? image : null;
}

function drawV3BoardTile(
  ctx: CanvasRenderingContext2D,
  key: BoardV3TileKey,
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  alpha = 1,
  scale = 1,
  filter = '',
): boolean {
  const image = getV3BoardTileImage(key);
  if (!image || alpha <= 0.01) return false;

  const drawW = boxW * scale;
  const drawH = boxH * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (filter) ctx.filter = filter;
  drawImageContained(ctx, image, cx - drawW / 2, cy - drawH / 2, drawW, drawH, 1);
  ctx.restore();
  return true;
}

function drawBoardV3RevealFx(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  progress: number,
): void {
  const reveal = clamp01((progress - 0.31) / 0.27);
  if (reveal > 0 && reveal < 1) {
    const fade = Math.sin(reveal * Math.PI);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * lerp(0.18, 0.68, reveal));
    bloom.addColorStop(0, `rgba(235, 255, 255, ${0.62 * fade})`);
    bloom.addColorStop(0.28, `rgba(45, 236, 255, ${0.46 * fade})`);
    bloom.addColorStop(1, 'rgba(45, 236, 255, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(45, 236, 255, ${0.74 * (1 - reveal)})`;
    ctx.lineWidth = lerp(4, 1, reveal);
    roundedRectPath(
      ctx,
      cx - size * lerp(0.22, 0.74, easeOutCubic(reveal)),
      cy - size * lerp(0.14, 0.42, easeOutCubic(reveal)),
      size * lerp(0.44, 1.48, easeOutCubic(reveal)),
      size * lerp(0.28, 0.84, easeOutCubic(reveal)),
      size * 0.08,
    );
    ctx.stroke();
    ctx.restore();
  }

  const sparks = clamp01((progress - 0.39) / 0.34);
  if (sparks <= 0 || sparks >= 1) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i += 1) {
    const angle = i * (Math.PI * 2 / 10) - Math.PI * 0.08;
    const dist = lerp(size * 0.12, size * 0.54, easeOutCubic(sparks)) * (i % 2 === 0 ? 1 : 0.72);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist * 0.58;
    const alpha = (1 - sparks) * 0.72;
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 211, 90, ${alpha})` : `rgba(45, 236, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, lerp(2.3, 0.7, sparks), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBoardV3HoverSweep(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  progress: number,
): void {
  const hover = clamp01(progress / 0.3);
  if (hover <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = hover * 0.46;
  const sweepX = lerp(cx - boxW * 0.62, cx + boxW * 0.62, clamp01((progress - 0.06) / 0.32));
  const gradient = ctx.createLinearGradient(sweepX - boxW * 0.18, cy - boxH * 0.5, sweepX + boxW * 0.18, cy + boxH * 0.5);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.62)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  roundedRectPath(ctx, cx - boxW * 0.44, cy - boxH * 0.34, boxW * 0.88, boxH * 0.68, boxH * 0.08);
  ctx.fill();

  ctx.globalAlpha = hover * 0.38;
  ctx.strokeStyle = '#2decff';
  ctx.lineWidth = 2;
  roundedRectPath(ctx, cx - boxW * 0.47, cy - boxH * 0.37, boxW * 0.94, boxH * 0.74, boxH * 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawBoardV3CanvasDigit(
  ctx: CanvasRenderingContext2D,
  digit: number,
  cx: number,
  cy: number,
  size: number,
  color: string,
  alpha: number,
  scale: number,
): void {
  const text = String(digit);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.18;
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
  ctx.lineWidth = size * 0.16;
  ctx.strokeText(text, 0, size * 0.03);

  ctx.shadowBlur = size * 0.08;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = size * 0.055;
  ctx.strokeText(text, 0, size * 0.01);

  const fill = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.58);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.2, color);
  fill.addColorStop(0.68, color);
  fill.addColorStop(1, 'rgba(3, 7, 18, 0.98)');
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);

  ctx.globalAlpha = alpha * 0.52;
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = `900 ${size * 0.94}px Arial, Helvetica, sans-serif`;
  ctx.fillText(text, -size * 0.035, -size * 0.08);
  ctx.restore();
}

function drawBoardV3InteractionScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  tMs: number,
  digit = 3,
): void {
  paintStageBg(ctx, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const size = Math.min(w, h);
  const boxSize = size * 0.68;
  const boxW = boxSize;
  const boxH = boxSize;
  const actionTime = tMs % BOARD_INTERACTION_V3_MS;
  const progress = clamp01(actionTime / BOARD_INTERACTION_V3_ACTION_MS);
  const hover = clamp01((progress - 0.04) / 0.23);
  const press = clamp01((progress - 0.24) / 0.16);
  const reveal = clamp01((progress - 0.34) / 0.24);
  const digitIn = clamp01((progress - 0.52) / 0.2);
  const digitSettle = clamp01((progress - 0.72) / 0.18);
  const hiddenAlpha = 1 - reveal;
  const hoverAlpha = Math.min(1 - reveal, hover);
  const pressedAlpha = press > 0 && press < 1 ? Math.sin(press * Math.PI) * (1 - reveal) : 0;
  const safeAlpha = reveal > 0 && reveal < 1 ? Math.sin(reveal * Math.PI) * 0.75 : 0;
  const revealedAlpha = easeOutCubic(reveal);
  const pressScale = press > 0 && press < 1 ? lerp(1, 0.955, Math.sin(press * Math.PI)) : 1;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.72)';
  ctx.shadowBlur = size * 0.08;
  if (!drawV3BoardTile(ctx, 'cell-hidden', cx, cy, boxW, boxH, hiddenAlpha, pressScale)) {
    const fallback = layoutCell(w, h, 0.55);
    drawHiddenCellWithEffect(ctx, sprites, fallback.x, fallback.y, fallback.size, hoverStateOpts(hover));
    ctx.restore();
    return;
  }
  drawV3BoardTile(ctx, 'cell-hover', cx, cy, boxW, boxH, hoverAlpha * (1 - pressedAlpha), lerp(1, 1.035, hover));
  drawV3BoardTile(ctx, 'cell-pressed', cx, cy, boxW, boxH, pressedAlpha, 0.965);
  drawV3BoardTile(ctx, 'cell-revealed', cx, cy, boxW, boxH, revealedAlpha, lerp(0.92, 1, easeOutBack(reveal)));
  drawV3BoardTile(ctx, 'cell-safe', cx, cy, boxW, boxH, safeAlpha, lerp(0.96, 1.02, safeAlpha));
  ctx.restore();

  drawBoardV3HoverSweep(ctx, cx, cy, boxW, boxH, progress);
  drawBoardV3RevealFx(ctx, cx, cy, size, progress);

  if (digitIn > 0) {
    const pop = digitSettle > 0
      ? lerp(1.08, 1, easeOutCubic(digitSettle))
      : lerp(0.82, 1.08, easeOutBack(digitIn));
    const alpha = clamp01(digitIn / 0.72);
    const color = DIGIT_COLORS[(digit - 1) % DIGIT_COLORS.length];
    drawV3BoardTile(ctx, `num-${Math.max(1, Math.min(8, digit))}` as BoardV3TileKey, cx, cy, size * 0.5, size * 0.5, alpha, pop);
    drawBoardV3CanvasDigit(ctx, digit, cx, cy + size * 0.005, size * 0.42, color, alpha, pop);
    drawDigitParticles(ctx, cx, cy, size * 0.64, color, tMs, digit, BOARD_INTERACTION_V3_MS);
  }
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

function getCandidateFlagImage(sprites: TileSprites): HTMLImageElement {
  return candidateFlagImage.complete && candidateFlagImage.naturalWidth > 0 ? candidateFlagImage : sprites.flag;
}

function drawCandidateFlagAnchored(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  baseX: number,
  baseY: number,
  height: number,
  alpha: number,
  rotation: number,
  scale: number,
): void {
  const bounds = image === candidateFlagImage
    ? candidateFlagBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
    : { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
  const drawH = height * scale;
  const drawW = drawH * (bounds.w / bounds.h);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(baseX, baseY);
  ctx.rotate(rotation);
  ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
}

function drawFlagPlaceImpact(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  cellSize: number,
  progress: number,
): void {
  const impact = clamp01((progress - 0.42) / 0.34);
  if (impact <= 0 || impact >= 1) return;

  const alpha = (1 - impact) * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(45, 236, 255, ${alpha})`;
  ctx.lineWidth = lerp(2.2, 0.8, impact);
  ctx.beginPath();
  ctx.ellipse(
    baseX,
    baseY + cellSize * 0.025,
    lerp(cellSize * 0.08, cellSize * 0.34, easeOutCubic(impact)),
    lerp(cellSize * 0.025, cellSize * 0.105, easeOutCubic(impact)),
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  for (let i = 0; i < 5; i += 1) {
    const angle = -Math.PI * 0.92 + i * (Math.PI * 0.84 / 4);
    const dist = lerp(cellSize * 0.04, cellSize * 0.23, easeOutCubic(impact));
    const x = baseX + Math.cos(angle) * dist;
    const y = baseY + Math.sin(angle) * dist * 0.32;
    ctx.fillStyle = i % 2 === 0 ? `rgba(255, 203, 74, ${alpha})` : `rgba(45, 236, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, lerp(2.4, 0.8, impact), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFlagPlaceScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  tMs: number,
): void {
  paintStageBg(ctx, w, h);
  const cell = layoutCell(w, h, 0.56);
  const cx = cell.x + cell.size / 2;
  const baseY = cell.y + cell.size * 0.82;
  const actionTime = tMs % FLAG_PLACE_MS;
  const progress = clamp01(actionTime / FLAG_PLACE_ACTION_MS);
  const land = easeOutBack(clamp01(progress / 0.78));
  const settle = easeOutCubic(clamp01((progress - 0.78) / 0.22));
  const flag = getCandidateFlagImage(sprites);

  drawHiddenCellWithEffect(
    ctx,
    sprites,
    cell.x,
    cell.y,
    cell.size,
    mixOpts(breathPhase(tMs), hoverStateOpts(0.18), 0.22),
  );

  drawFlagPlaceImpact(ctx, cx, baseY, cell.size, progress);

  const yOffset = settle > 0
    ? lerp(-cell.size * 0.035, 0, settle)
    : lerp(-cell.size * 0.42, -cell.size * 0.035, land);
  const rotation = settle > 0 ? lerp(0.025, 0, settle) : lerp(-0.055, 0.025, easeOutCubic(progress));
  const scale = settle > 0 ? lerp(1.015, 1, settle) : lerp(0.96, 1.015, land);
  const alpha = clamp01(progress / 0.16);
  const holdWave = Math.sin((actionTime / FLAG_PLACE_MS) * Math.PI * 2) * 0.006;

  ctx.save();
  ctx.shadowColor = 'rgba(38, 229, 255, 0.36)';
  ctx.shadowBlur = cell.size * 0.045;
  drawCandidateFlagAnchored(
    ctx,
    flag,
    cx,
    baseY + yOffset,
    cell.size * 1.04,
    alpha,
    rotation + (progress >= 1 ? holdWave : 0),
    scale,
  );
  ctx.restore();
}

function drawWrongFlagV3Effects(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  progress: number,
): void {
  const warn = clamp01((progress - 0.18) / 0.42);
  if (warn > 0 && warn < 1) {
    const alpha = (1 - warn) * 0.82;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 65, 86, ${alpha})`;
    ctx.lineWidth = lerp(4, 1, warn);
    ctx.beginPath();
    ctx.arc(cx, cy, lerp(cellSize * 0.2, cellSize * 0.68, easeOutCubic(warn)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const slash = clamp01((progress - 0.24) / 0.22);
  if (slash > 0 && slash < 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 76, 96, ${0.9 * (1 - Math.max(0, slash - 0.72) / 0.28)})`;
    ctx.lineWidth = cellSize * 0.07;
    ctx.lineCap = 'round';
    const len = cellSize * 0.34 * easeOutCubic(slash);
    ctx.beginPath();
    ctx.moveTo(cx - len, cy - len);
    ctx.lineTo(cx + len, cy + len);
    ctx.moveTo(cx + len, cy - len);
    ctx.lineTo(cx - len, cy + len);
    ctx.stroke();
    ctx.restore();
  }

  const bits = clamp01((progress - 0.34) / 0.44);
  if (bits <= 0 || bits >= 1) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI * 0.85 + i * (Math.PI * 1.7 / 9);
    const dist = lerp(cellSize * 0.08, cellSize * 0.52, easeOutCubic(bits)) * (i % 2 === 0 ? 1 : 0.7);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist * 0.72;
    const alpha = (1 - bits) * 0.78;
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 203, 74, ${alpha})` : `rgba(255, 65, 86, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, lerp(2.6, 0.8, bits), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWrongFlagV3Scene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  tMs: number,
): void {
  paintStageBg(ctx, w, h);
  const cell = layoutCell(w, h, 0.56);
  const cx = cell.x + cell.size / 2;
  const baseY = cell.y + cell.size * 0.82;
  const actionTime = tMs % WRONG_FLAG_V3_MS;
  const progress = clamp01(actionTime / WRONG_FLAG_V3_ACTION_MS);
  const flag = getCandidateFlagImage(sprites);

  drawHiddenCellWithEffect(
    ctx,
    sprites,
    cell.x,
    cell.y,
    cell.size,
    mixOpts(breathPhase(tMs), hoverStateOpts(0.12), 0.18),
  );

  const shakeWindow = clamp01((progress - 0.08) / 0.52);
  const shakeFade = 1 - clamp01((shakeWindow - 0.48) / 0.52);
  const shake = Math.sin(progress * Math.PI * 16) * Math.max(0, shakeFade);
  const rotation = shake * 0.13;
  const xOffset = shake * cell.size * 0.05;
  const sink = progress > 0.58 ? lerp(0, cell.size * 0.05, easeOutCubic((progress - 0.58) / 0.3)) : 0;
  const scale = progress > 0.58 ? lerp(1, 0.88, easeOutCubic((progress - 0.58) / 0.3)) : 1;
  const alpha = progress > 0.68 ? lerp(1, 0.72, easeOutCubic((progress - 0.68) / 0.24)) : 1;

  ctx.save();
  ctx.shadowColor = 'rgba(255, 65, 86, 0.42)';
  ctx.shadowBlur = cell.size * 0.075;
  drawCandidateFlagAnchored(ctx, flag, cx + xOffset, baseY + sink, cell.size * 1.04, alpha, rotation, scale);
  ctx.restore();

  drawWrongFlagV3Effects(ctx, cx, cell.y + cell.size * 0.52, cell.size, progress);
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

function getCandidateMineImage(cracked: boolean, sprites: TileSprites): HTMLImageElement {
  const img = cracked ? candidateMineCrackedImage : candidateMineStandardImage;
  return img.complete && img.naturalWidth > 0 ? img : sprites.mine;
}

function drawCandidateMineCutout(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  size: number,
  scale: number,
  alpha = 1,
): void {
  const bounds = image === candidateMineStandardImage
    ? candidateMineStandardBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
    : image === candidateMineCrackedImage
      ? candidateMineCrackedBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }
      : { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
  const drawSize = size * 0.84 * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize);
  ctx.restore();
}

function drawMineHitV3Shock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  progress: number,
): void {
  const ring = clamp01((progress - 0.16) / 0.38);
  if (ring > 0 && ring < 1) {
    const alpha = (1 - ring) * 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 69, 82, ${alpha})`;
    ctx.lineWidth = lerp(4, 1, ring);
    ctx.beginPath();
    ctx.arc(cx, cy, lerp(cellSize * 0.16, cellSize * 0.72, easeOutCubic(ring)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const sparks = clamp01((progress - 0.1) / 0.48);
  if (sparks <= 0 || sparks >= 1) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i += 1) {
    const angle = i * (Math.PI * 2 / 10) + 0.35;
    const spread = lerp(cellSize * 0.12, cellSize * 0.54, easeOutCubic(sparks));
    const x = cx + Math.cos(angle) * spread;
    const y = cy + Math.sin(angle) * spread;
    const alpha = (1 - sparks) * (i % 2 === 0 ? 0.85 : 0.55);
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 205, 82, ${alpha})` : `rgba(255, 66, 86, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, lerp(2.6, 0.8, sparks), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMineHitV3CoreBurst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  progress: number,
): void {
  const burst = clamp01((progress - 0.22) / 0.34);
  if (burst <= 0 || burst >= 1) return;

  const fade = Math.sin(burst * Math.PI);
  const radius = lerp(cellSize * 0.12, cellSize * 0.42, easeOutCubic(burst));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 11; i += 1) {
    const angle = i * (Math.PI * 2 / 11) + 0.22 + burst * 0.42;
    const width = cellSize * lerp(0.08, 0.03, burst) * (i % 3 === 0 ? 1.24 : 1);
    const inner = cellSize * lerp(0.04, 0.13, burst);
    const outer = cellSize * lerp(0.22, 0.62, easeOutCubic(burst)) * (i % 2 === 0 ? 1.08 : 0.82);
    const tipX = cx + Math.cos(angle) * outer;
    const tipY = cy + Math.sin(angle) * outer;
    const leftX = cx + Math.cos(angle - 0.5) * inner + Math.cos(angle + Math.PI / 2) * width;
    const leftY = cy + Math.sin(angle - 0.5) * inner + Math.sin(angle + Math.PI / 2) * width;
    const rightX = cx + Math.cos(angle + 0.5) * inner + Math.cos(angle - Math.PI / 2) * width;
    const rightY = cy + Math.sin(angle + 0.5) * inner + Math.sin(angle - Math.PI / 2) * width;
    const controlA = cellSize * lerp(0.2, 0.36, burst);
    const controlB = cellSize * lerp(0.16, 0.28, burst);
    const flame = ctx.createRadialGradient(cx, cy, cellSize * 0.02, tipX, tipY, outer * 0.42);
    flame.addColorStop(0, `rgba(255, 252, 218, ${0.84 * fade})`);
    flame.addColorStop(0.36, `rgba(255, 175, 48, ${0.75 * fade})`);
    flame.addColorStop(0.72, `rgba(255, 66, 38, ${0.48 * fade})`);
    flame.addColorStop(1, 'rgba(255, 66, 38, 0)');

    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(leftX, leftY);
    ctx.quadraticCurveTo(
      cx + Math.cos(angle - 0.18) * controlA,
      cy + Math.sin(angle - 0.18) * controlA,
      tipX,
      tipY,
    );
    ctx.quadraticCurveTo(
      cx + Math.cos(angle + 0.18) * controlB,
      cy + Math.sin(angle + 0.18) * controlB,
      rightX,
      rightY,
    );
    ctx.closePath();
    ctx.fill();
  }

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  core.addColorStop(0, `rgba(255, 255, 238, ${0.95 * fade})`);
  core.addColorStop(0.18, `rgba(255, 213, 92, ${0.88 * fade})`);
  core.addColorStop(0.5, `rgba(255, 71, 82, ${0.62 * fade})`);
  core.addColorStop(1, 'rgba(255, 71, 82, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 238, 184, ${0.68 * fade})`;
  ctx.lineWidth = lerp(3.2, 0.8, burst);
  for (let i = 0; i < 8; i += 1) {
    const angle = i * (Math.PI * 2 / 8) + burst * 0.55;
    const inner = cellSize * lerp(0.12, 0.22, burst);
    const outer = cellSize * lerp(0.22, 0.46, easeOutCubic(burst)) * (i % 2 === 0 ? 1 : 0.72);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMineHitV3Scene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: TileSprites,
  tMs: number,
): void {
  paintStageBg(ctx, w, h);
  const cell = layoutCell(w, h, 0.55);
  const cx = cell.x + cell.size / 2;
  const cy = cell.y + cell.size / 2;
  const actionTime = tMs % MINE_HIT_V3_MS;
  const progress = clamp01(actionTime / MINE_HIT_V3_ACTION_MS);
  const cracked = progress > 0.54;
  const mine = getCandidateMineImage(cracked, sprites);
  const shake = progress < 0.42 ? Math.sin(progress * Math.PI * 18) * (1 - progress / 0.42) : 0;
  const pop = progress < 0.42 ? 1 + Math.sin(progress * Math.PI) * 0.075 : lerp(1.03, 1, easeOutCubic((progress - 0.42) / 0.58));
  const flash = progress < 0.22 ? 1 - easeOutCubic(progress / 0.22) : 0;

  drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, 0.18);
  drawMineHitV3Shock(ctx, cx, cy, cell.size, progress);

  if (progress > 0.34 && progress < 0.88) {
    drawMineBurstSmoke(ctx, cx, cy, cell.size, clamp01((progress - 0.34) / 0.54), 0.42);
  }

  const dx = shake * cell.size * 0.045;
  const dy = Math.cos(progress * Math.PI * 15) * Math.abs(shake) * cell.size * 0.018;
  ctx.save();
  ctx.shadowColor = cracked ? 'rgba(255, 68, 86, 0.46)' : 'rgba(38, 229, 255, 0.28)';
  ctx.shadowBlur = cell.size * (cracked ? 0.08 : 0.045);
  drawCandidateMineCutout(ctx, mine, cx + dx, cy + dy, cell.size, pop);
  ctx.restore();

  drawMineHitV3CoreBurst(ctx, cx, cy, cell.size, progress);

  if (flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = flash * 0.62;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell.size * 0.45);
    g.addColorStop(0, 'rgba(255, 240, 210, 0.95)');
    g.addColorStop(0.28, 'rgba(255, 69, 82, 0.62)');
    g.addColorStop(1, 'rgba(255, 69, 82, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, cell.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (progress >= 0.9) {
    drawMineSettledSmoke(ctx, cx, cy, cell.size, tMs, 0.26);
  }
}

function getCandidateHeartImage(full: boolean): HTMLImageElement | null {
  const image = full ? candidateHeartFullImage : candidateHeartEmptyImage;
  return image.complete && image.naturalWidth > 0 ? image : null;
}

function getCandidateHeartBounds(image: HTMLImageElement): ImageBounds {
  if (image === candidateHeartFullImage) {
    return candidateHeartFullBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
  }
  if (image === candidateHeartEmptyImage) {
    return candidateHeartEmptyBounds ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
  }
  return { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
}

function drawCandidateHeart(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  size: number,
  scale: number,
  alpha: number,
): void {
  const bounds = getCandidateHeartBounds(image);
  const drawH = size * scale;
  const drawW = drawH * (bounds.w / bounds.h);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  ctx.restore();
}

function drawHeartRefillV3Effects(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  progress: number,
): void {
  const ring = clamp01((progress - 0.1) / 0.46);
  if (ring > 0 && ring < 1) {
    const alpha = (1 - ring) * 0.72;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 213, 92, ${alpha})`;
    ctx.lineWidth = lerp(4.5, 1, ring);
    ctx.beginPath();
    ctx.arc(cx, cy, lerp(size * 0.26, size * 0.76, easeOutCubic(ring)), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(45, 236, 255, ${alpha * 0.58})`;
    ctx.lineWidth = lerp(2.5, 0.7, ring);
    ctx.beginPath();
    ctx.arc(cx, cy, lerp(size * 0.18, size * 0.58, easeOutCubic(ring)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const bloom = clamp01((progress - 0.14) / 0.32);
  if (bloom > 0 && bloom < 1) {
    const fade = Math.sin(bloom * Math.PI);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * lerp(0.22, 0.7, bloom));
    g.addColorStop(0, `rgba(255, 246, 202, ${0.72 * fade})`);
    g.addColorStop(0.4, `rgba(255, 213, 92, ${0.42 * fade})`);
    g.addColorStop(1, 'rgba(45, 236, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const particles = clamp01((progress - 0.18) / 0.56);
  if (particles <= 0 || particles >= 1) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i += 1) {
    const angle = i * (Math.PI * 2 / 12) - Math.PI / 2;
    const lift = i % 2 === 0 ? 0.82 : 1.08;
    const dist = lerp(size * 0.18, size * 0.68, easeOutCubic(particles)) * lift;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist * 0.82;
    const alpha = (1 - particles) * 0.86;
    ctx.fillStyle = i % 3 === 0 ? `rgba(45, 236, 255, ${alpha})` : `rgba(255, 213, 92, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, lerp(2.8, 0.9, particles), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHeartRefillV3Scene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tMs: number,
): void {
  paintStageBg(ctx, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const size = Math.min(w, h) * 0.58;
  const actionTime = tMs % HEART_REFILL_V3_MS;
  const progress = clamp01(actionTime / HEART_REFILL_V3_ACTION_MS);
  const full = getCandidateHeartImage(true);
  const empty = getCandidateHeartImage(false);
  const popIn = clamp01((progress - 0.22) / 0.34);
  const settle = clamp01((progress - 0.56) / 0.22);
  const popScale = settle > 0 ? lerp(1.12, 1, easeOutCubic(settle)) : lerp(0.76, 1.12, easeOutBack(popIn));
  const fullAlpha = clamp01((progress - 0.18) / 0.22);

  ctx.save();
  ctx.fillStyle = 'rgba(7, 8, 15, 0.8)';
  ctx.beginPath();
  ctx.roundRect(cx - size * 0.72, cy - size * 0.58, size * 1.44, size * 1.16, size * 0.16);
  ctx.fill();
  ctx.restore();

  if (empty) {
    drawCandidateHeart(ctx, empty, cx, cy, size, 0.98, 0.5 + (1 - fullAlpha) * 0.35);
  }

  drawHeartRefillV3Effects(ctx, cx, cy, size, progress);

  if (full && fullAlpha > 0) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 213, 92, 0.52)';
    ctx.shadowBlur = size * 0.12;
    drawCandidateHeart(ctx, full, cx, cy, size, popScale, fullAlpha);
    ctx.restore();
  }
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
    const startedAt = performance.now();
    const redrawWhileAssetsLoad = (): void => {
      draw(ctx, 88, 88);
      if (performance.now() - startedAt < 2200) {
        window.requestAnimationFrame(redrawWhileAssetsLoad);
      }
    };
    window.requestAnimationFrame(redrawWhileAssetsLoad);
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
    return createLoopCanvas((ctx, w, h, now) => drawHeartRefillV3Scene(ctx, w, h, now), getFps, baseFps);
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
