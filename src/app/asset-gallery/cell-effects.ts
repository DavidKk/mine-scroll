import { drawProceduralOrbitParticles, drawMineBurstSmoke, drawMineScorchMark, drawMineSettledSmoke, drawPanelV3ScanBeams } from '../../ui/cell-fx.ts';
import {
  drawFxSpriteFrame,
  drawImageContained,
  GAME_ASSET_TUNING,
  drawGameMineCutoutAtCenter,
  getGameCutout,
  getGameFxBlendMode,
  getGameFxFrames,
  getGameUiPanel,
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
  | 'heart-refill-v3'
  | 'heart-loss-v3'
  | 'start-panel-v3'
  | 'game-over-panel-v3'
  | 'score-hud-v3'
  | 'combo-hud-v3'
  | 'score-pop-v3'
  | 'combo-burst-v3'
  | 'life-loss-popup-v3'
  | 'speed-up-alert-v3'
  | 'speed-up-chevron-v3'
  | 'danger-rise-alert-v3';

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
const PANEL_V3_MS = 1480;
const PANEL_V3_ACTION_MS = 620;
const HUD_FEEDBACK_V3_MS = 1600;
const SCORE_POP_V3_MS = 760;
const COMBO_BURST_V3_MS = 900;
const LIFE_LOSS_POPUP_V3_MS = GAME_ASSET_TUNING.fx.break.durationMs;
const HUD_ALERT_V3_MS = 1260;
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

const panelConceptImages = {
  startPanel: createAssetImage('/assets/candidates/game-ui-v3/panels/runtime/start-panel-v3.png'),
  gameOverPanel: createAssetImage('/assets/candidates/game-ui-v3/panels/runtime/game-over-panel-v3.png'),
} as const;

const hudFeedbackImages = {
  scoreStrip: createAssetImage('/assets/candidates/hud-feedback-v3/runtime/score-energy-strip-v3.png'),
  scorePanelV6: createAssetImage('/assets/candidates/hud-feedback-v3/runtime/score-energy-panel-v6.png'),
  comboRail: createAssetImage('/assets/candidates/hud-feedback-v3/runtime/combo-energy-rail-v3.png'),
  scorePopBase: createAssetImage('/assets/candidates/hud-feedback-v3/runtime/score-pop-energy-base-v3.png'),
  comboBurstBase: createAssetImage('/assets/candidates/hud-feedback-v3/runtime/combo-burst-energy-base-v3.png'),
} as const;

const hudAlertImages = {
  speedUp: createAssetImage('/assets/candidates/hud-alerts-v3/runtime/speed-up-alert-v3.png'),
  dangerRise: createAssetImage('/assets/candidates/hud-alerts-v3/runtime/danger-rise-alert-v3.png'),
} as const;

const scoreDigitImages = Array.from({ length: 10 }, (_, digit) =>
  createAssetImage(`/assets/candidates/hud-feedback-v3/runtime/score-digits-v1/digit-${digit}.png`),
);

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
    description: 'Click-to-preview life refill: static empty heart, Canvas refill burst, then full v3 heart hold.',
    cycleMs: HEART_REFILL_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: false,
    interactive: true,
  },
  {
    id: 'heart-loss-v3',
    title: 'Heart loss v3',
    description: 'Click-to-preview damage state: full v3 heart switches directly to the empty-heart cutout.',
    cycleMs: 1,
    frameCount: 2,
    defaultFps: 1,
    loop: false,
    interactive: true,
  },
  {
    id: 'start-panel-v3',
    title: 'Start panel v3',
    description: 'Candidate animated start overlay: clean panel art plus Canvas scanline, edge spark, button press, and start pulse.',
    cycleMs: PANEL_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
    interactive: true,
  },
  {
    id: 'game-over-panel-v3',
    title: 'Game over panel v3',
    description: 'Candidate animated fail overlay: clean panel art plus Canvas red alert flash, shake, scanlines, and retry press feedback.',
    cycleMs: PANEL_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
    interactive: true,
  },
  {
    id: 'score-hud-v3',
    title: 'Score HUD v3',
    description: 'Candidate score data chip: compact metal base, cyan edge light, score pulse, and scan flash on gain.',
    cycleMs: HUD_FEEDBACK_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'combo-hud-v3',
    title: 'Combo HUD v3',
    description: 'Candidate combo chip with escalating cyan / gold / red energy states and impact pulse on combo gain.',
    cycleMs: HUD_FEEDBACK_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'score-pop-v3',
    title: 'Score pop v3',
    description: 'Candidate score gain popup: +score rises from the score chip, flashes, and dissolves into scan particles.',
    cycleMs: SCORE_POP_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'combo-burst-v3',
    title: 'Combo burst v3',
    description: 'Candidate high-impact combo popup with shock rings, tier colors, particles, and stronger x10/x20/x50 beats.',
    cycleMs: COMBO_BURST_V3_MS,
    frameCount: 6,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'life-loss-popup-v3',
    title: 'Life loss popup v3',
    description: 'Current in-game damage/break popup below combo: red flash, break chip, wrong-flag burst, and defuse reset text.',
    cycleMs: LIFE_LOSS_POPUP_V3_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'speed-up-alert-v3',
    title: 'Speed up alert v3',
    description: 'Full runtime SPEED UP alert: badge art, Canvas text, scan streaks, and chevron acceleration particles.',
    cycleMs: HUD_ALERT_V3_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'speed-up-chevron-v3',
    title: 'Speed up chevrons v3',
    description: 'Isolated Canvas chevron streaks from the runtime SPEED UP alert: paired rects that read as right-pointing triangles.',
    cycleMs: HUD_ALERT_V3_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'danger-rise-alert-v3',
    title: 'Danger rise alert v3',
    description: 'Candidate difficulty alert: danger-rise badge base plus Canvas text, warning pulse, and vertical pressure sparks.',
    cycleMs: HUD_ALERT_V3_MS,
    frameCount: 4,
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

function drawHeartStaticV3Scene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  full: boolean,
): void {
  paintStageBg(ctx, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const size = Math.min(w, h) * 0.58;
  const image = getCandidateHeartImage(full);

  ctx.save();
  ctx.fillStyle = 'rgba(7, 8, 15, 0.8)';
  ctx.beginPath();
  ctx.roundRect(cx - size * 0.72, cy - size * 0.58, size * 1.44, size * 1.16, size * 0.16);
  ctx.fill();
  ctx.restore();

  if (!image) return;
  ctx.save();
  ctx.shadowColor = full ? 'rgba(255, 213, 92, 0.38)' : 'rgba(45, 236, 255, 0.18)';
  ctx.shadowBlur = size * 0.08;
  drawCandidateHeart(ctx, image, cx, cy, size, full ? 1 : 0.98, full ? 1 : 0.78);
  ctx.restore();
}

type PanelConceptKind = 'start' | 'game-over';

function drawPanelConceptImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image || !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return null;
  const ratio = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight) * scale;
  const w = image.naturalWidth * ratio;
  const h = image.naturalHeight * ratio;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
  return { x, y, w, h };
}

function drawPanelV3CanvasFx(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  kind: PanelConceptKind,
  nowMs: number,
  actionProgress = 0,
): void {
  const color = kind === 'start' ? '45, 236, 255' : '255, 76, 86';
  const accent = kind === 'start' ? '255, 213, 92' : '251, 146, 60';
  const phase = (nowMs % PANEL_V3_MS) / PANEL_V3_MS;
  const pulse = 0.5 + Math.sin(phase * Math.PI * 2) * 0.5;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(
    bounds.x + bounds.w / 2,
    bounds.y + bounds.h / 2,
    bounds.w * 0.05,
    bounds.x + bounds.w / 2,
    bounds.y + bounds.h / 2,
    bounds.w * 0.62,
  );
  glow.addColorStop(0, `rgba(${color}, ${0.08 + pulse * 0.05})`);
  glow.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(bounds.x - bounds.w * 0.08, bounds.y - bounds.h * 0.12, bounds.w * 1.16, bounds.h * 1.24);

  drawPanelV3ScanBeams(ctx, bounds, color, phase, pulse);

  for (let i = 0; i < 8; i += 1) {
    const side = i % 4;
    const local = (phase + i * 0.137) % 1;
    const x = side === 0
      ? bounds.x + bounds.w * local
      : side === 1
        ? bounds.x + bounds.w
        : side === 2
          ? bounds.x + bounds.w * (1 - local)
          : bounds.x;
    const y = side === 0
      ? bounds.y
      : side === 1
        ? bounds.y + bounds.h * local
        : side === 2
          ? bounds.y + bounds.h
          : bounds.y + bounds.h * (1 - local);
    ctx.fillStyle = `rgba(${i % 3 === 0 ? accent : color}, ${0.26 + pulse * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.2, bounds.h * 0.008), 0, Math.PI * 2);
    ctx.fill();
  }

  if (kind === 'game-over') {
    ctx.globalAlpha = 0.22 + pulse * 0.08;
    ctx.strokeStyle = `rgba(${color}, 0.42)`;
    ctx.lineWidth = Math.max(1, bounds.h * 0.006);
    for (let i = 0; i < 6; i += 1) {
      const y = bounds.y + bounds.h * (0.2 + i * 0.11 + (phase * 0.05));
      ctx.beginPath();
      ctx.moveTo(bounds.x + bounds.w * 0.08, y);
      ctx.lineTo(bounds.x + bounds.w * 0.92, y);
      ctx.stroke();
    }
  }

  if (actionProgress > 0) {
    const t = clamp01(actionProgress);
    const fade = 1 - t;
    const centerY = bounds.y + bounds.h * (kind === 'start' ? 0.5 : 0.68);
    const burst = ctx.createRadialGradient(
      bounds.x + bounds.w / 2,
      centerY,
      bounds.h * (0.08 + t * 0.1),
      bounds.x + bounds.w / 2,
      centerY,
      bounds.h * (0.32 + t * 0.62),
    );
    burst.addColorStop(0, `rgba(${kind === 'start' ? color : accent}, ${0.42 * fade})`);
    burst.addColorStop(0.42, `rgba(${kind === 'start' ? color : accent}, ${0.18 * fade})`);
    burst.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = burst;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  }

  ctx.restore();
}

function drawPanelV3Scene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: PanelConceptKind,
  tMs: number,
  actionProgress = 0,
): void {
  paintStageBg(ctx, w, h);
  const image = kind === 'start' ? panelConceptImages.startPanel : panelConceptImages.gameOverPanel;
  const action = clamp01(actionProgress);
  const shake = kind === 'game-over' && action > 0 && action < 0.55
    ? Math.sin(action * Math.PI * 18) * (1 - action) * Math.min(w, h) * 0.012
    : 0;
  const pop = action > 0 ? 1 - Math.sin(action * Math.PI) * 0.025 : 1;
  const bounds = drawPanelConceptImage(ctx, image, w / 2 + shake, h / 2, w * 0.88, h * 0.72, pop);
  if (bounds) drawPanelV3CanvasFx(ctx, bounds, kind, tMs, action);
}

interface HudPalette {
  main: string;
  soft: string;
  text: string;
  hot: string;
}

function comboHudPalette(combo: number): HudPalette {
  if (combo >= 50) return { main: '255, 71, 120', soft: '168, 85, 247', text: '#ff4778', hot: '#fef08a' };
  if (combo >= 20) return { main: '251, 113, 36', soft: '239, 68, 68', text: '#fb923c', hot: '#fde047' };
  if (combo >= 10) return { main: '250, 204, 21', soft: '34, 211, 238', text: '#fde047', hot: '#f8fafc' };
  return { main: '45, 236, 255', soft: '96, 165, 250', text: '#67e8f9', hot: '#dbeafe' };
}

function comboRailFilter(combo: number): string {
  if (combo >= 50) return 'hue-rotate(145deg) saturate(1.55) brightness(1.08)';
  if (combo >= 20) return 'hue-rotate(-150deg) saturate(1.45) brightness(1.08)';
  if (combo >= 10) return 'hue-rotate(-118deg) saturate(1.45) brightness(1.08)';
  if (combo >= 5) return 'hue-rotate(-58deg) saturate(1.32) brightness(1.05)';
  return 'none';
}

function drawComboRailGlow(
  ctx: CanvasRenderingContext2D,
  asset: { x: number; y: number; w: number; h: number },
  palette: HudPalette,
  alpha: number,
): void {
  const cx = asset.x + asset.w / 2;
  const cy = asset.y + asset.h * 0.54;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, asset.w * 0.58);
  glow.addColorStop(0, `rgba(${palette.main}, ${alpha * 0.34})`);
  glow.addColorStop(0.42, `rgba(${palette.soft}, ${alpha * 0.14})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(asset.x, asset.y, asset.w, asset.h);
  ctx.restore();
}

function drawFeedbackAsset(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return null;
  const fit = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight) * scale;
  const w = image.naturalWidth * fit;
  const h = image.naturalHeight * fit;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
  return { x, y, w, h };
}

function drawFilteredFeedbackAsset(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  filter: string,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return null;
  const fit = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight) * scale;
  const w = image.naturalWidth * fit;
  const h = image.naturalHeight * fit;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = filter;
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
  return { x, y, w, h };
}

function drawHudText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  fontSize: number,
  fill: string,
  glow: string,
): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = fontSize;
  do {
    ctx.font = `1000 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    if (ctx.measureText(text).width <= maxW || size <= 14) break;
    size -= 1;
  } while (size > 14);
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.strokeStyle = 'rgba(3, 7, 18, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.shadowColor = glow;
  ctx.shadowBlur = size * 0.28;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawScoreDigits(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  cy: number,
  maxW: number,
  maxH: number,
): boolean {
  const digits = [...text].map((ch) => scoreDigitImages[Number(ch)]);
  if (digits.some((image) => !image || !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)) return false;

  const baseW = digits.reduce((sum, image) => sum + image.naturalWidth, 0);
  const baseH = Math.max(...digits.map((image) => image.naturalHeight));
  const gap = baseH * 0.015;
  const totalBaseW = baseW + gap * Math.max(0, digits.length - 1);
  const scale = Math.min(maxW / totalBaseW, maxH / baseH);
  let cursorX = x;

  ctx.save();
  for (const image of digits) {
    if (!image) continue;
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, cursorX, cy - h / 2, w, h);
    cursorX += w + gap * scale;
  }
  ctx.restore();
  return true;
}

function drawHudV3Chip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  palette: HudPalette,
  tMs: number,
  impact = 0,
): void {
  const phase = (tMs % HUD_FEEDBACK_V3_MS) / HUD_FEEDBACK_V3_MS;
  const pulse = 0.5 + Math.sin(phase * Math.PI * 2) * 0.5;
  const r = Math.min(10, h * 0.22);
  const pop = 1 + Math.sin(clamp01(impact) * Math.PI) * 0.045;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(pop, pop);
  ctx.translate(-w / 2, -h / 2);

  ctx.shadowColor = `rgba(${palette.main}, ${0.22 + pulse * 0.14 + impact * 0.32})`;
  ctx.shadowBlur = 10 + impact * 12;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, 'rgba(25, 31, 44, 0.94)');
  bg.addColorStop(0.5, 'rgba(8, 12, 22, 0.96)');
  bg.addColorStop(1, 'rgba(3, 7, 16, 0.92)');
  roundedRectPath(ctx, 0, 0, w, h, r);
  ctx.fillStyle = bg;
  ctx.fill();

  const border = ctx.createLinearGradient(0, 0, w, 0);
  border.addColorStop(0, `rgba(${palette.main}, 0.08)`);
  border.addColorStop(0.22, `rgba(${palette.main}, ${0.38 + impact * 0.22})`);
  border.addColorStop(0.72, `rgba(${palette.soft}, ${0.2 + pulse * 0.16})`);
  border.addColorStop(1, `rgba(${palette.main}, 0.08)`);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.4;
  roundedRectPath(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.stroke();

  ctx.globalCompositeOperation = 'lighter';
  const scanX = ((phase * 1.45) % 1) * w;
  const scan = ctx.createLinearGradient(scanX - w * 0.18, 0, scanX + w * 0.18, 0);
  scan.addColorStop(0, 'rgba(255,255,255,0)');
  scan.addColorStop(0.5, `rgba(${palette.main}, ${0.16 + impact * 0.24})`);
  scan.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = scan;
  roundedRectPath(ctx, 2, 2, w - 4, h - 4, r - 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${Math.max(8, h * 0.22)}px system-ui, sans-serif`;
  ctx.fillStyle = `rgba(${palette.main}, 0.82)`;
  ctx.fillText(label, w * 0.1, h * 0.16);
  ctx.font = `900 ${Math.max(18, h * 0.43)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = palette.text;
  ctx.shadowColor = `rgba(${palette.main}, 0.48)`;
  ctx.shadowBlur = 8 + impact * 10;
  ctx.fillText(value, w * 0.1, h * 0.45);

  ctx.restore();
}

function drawScoreHudV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number, score = '39160'): void {
  paintStageBg(ctx, w, h);
  const progress = (tMs % HUD_FEEDBACK_V3_MS) / HUD_FEEDBACK_V3_MS;
  const impact = progress < 0.28 ? 1 - easeOutCubic(progress / 0.28) : 0;
  const asset = drawFeedbackAsset(ctx, hudFeedbackImages.scorePanelV6, w / 2, h * 0.52, w * 0.96, h * 0.5, 1 + impact * 0.026);
  if (!asset) {
    const chipW = Math.min(w * 0.78, 260);
    const chipH = Math.min(h * 0.34, 74);
    drawHudV3Chip(ctx, (w - chipW) / 2, h * 0.34, chipW, chipH, 'SCORE', score, comboHudPalette(2), tMs, impact);
    return;
  }
  ctx.save();
  const drewDigits = drawScoreDigits(
    ctx,
    score,
    asset.x + asset.w * 0.34,
    asset.y + asset.h * 0.475,
    asset.w * 0.52,
    Math.min(asset.h * 0.16, h * 0.16),
  );
  if (!drewDigits) {
    drawHudText(
      ctx,
      score,
      asset.x + asset.w * 0.61,
      asset.y + asset.h * 0.52,
      asset.w * 0.48,
      Math.min(asset.h * 0.16, h * 0.18),
      '#d8fbff',
      'rgba(45, 236, 255, 0.72)',
    );
  }
  ctx.restore();
}

function drawComboHudV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number, combo = 18): void {
  paintStageBg(ctx, w, h);
  const palette = comboHudPalette(combo);
  const progress = (tMs % HUD_FEEDBACK_V3_MS) / HUD_FEEDBACK_V3_MS;
  const impact = progress < 0.34 ? 1 - easeOutCubic(progress / 0.34) : 0;
  const shake = impact * Math.sin(progress * Math.PI * 18) * Math.min(w, h) * 0.006;
  const text = `x${combo}`;
  const asset = drawFilteredFeedbackAsset(
    ctx,
    hudFeedbackImages.comboRail,
    w / 2 + shake,
    h * 0.52,
    w * 0.9,
    h * 0.25,
    comboRailFilter(combo),
    1 + impact * 0.025,
  );
  if (!asset) {
    const chipW = Math.min(w * 0.72, 240);
    const chipH = Math.min(h * 0.3, 66);
    drawHudV3Chip(ctx, (w - chipW) / 2 + shake, h * 0.36, chipW, chipH, 'COMBO', text, palette, tMs, impact);
    return;
  }
  drawComboRailGlow(ctx, asset, palette, 0.36 + impact * 0.22);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.max(8, asset.h * 0.11)}px system-ui, sans-serif`;
  ctx.fillStyle = `rgba(${palette.main}, 0.72)`;
  ctx.fillText('COMBO', w / 2, asset.y + asset.h * 0.33);
  drawHudText(ctx, text, w / 2, asset.y + asset.h * 0.56, asset.w * 0.66, asset.h * 0.23, palette.text, `rgba(${palette.main}, 0.86)`);
  ctx.restore();
}

function drawScorePopV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): void {
  paintStageBg(ctx, w, h);
  const t = (tMs % SCORE_POP_V3_MS) / SCORE_POP_V3_MS;
  const chipW = Math.min(w * 0.7, 230);
  const chipH = Math.min(h * 0.28, 60);
  const chipX = (w - chipW) / 2;
  const chipY = h * 0.56;
  const strip = drawFeedbackAsset(ctx, hudFeedbackImages.scoreStrip, w / 2, chipY + chipH / 2, chipW, chipH * 1.35, 1);
  if (!strip) drawHudV3Chip(ctx, chipX, chipY, chipW, chipH, 'SCORE', '012840', comboHudPalette(2), tMs, t < 0.2 ? 1 - t / 0.2 : 0);

  const rise = easeOutCubic(t);
  const alpha = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28;
  const cx = w / 2;
  const cy = chipY - h * (0.05 + rise * 0.34);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawFeedbackAsset(ctx, hudFeedbackImages.scorePopBase, cx, cy + h * 0.06, w * 0.62, h * 0.42, 0.88 + Math.sin(t * Math.PI) * 0.08, alpha);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.28);
  glow.addColorStop(0, `rgba(45, 236, 255, ${0.34 * alpha})`);
  glow.addColorStop(1, 'rgba(45, 236, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.min(48, w * 0.16)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.shadowColor = 'rgba(45, 236, 255, 0.82)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = `rgba(125, 249, 255, ${alpha})`;
  ctx.fillText('+320', cx, cy);

  for (let i = 0; i < 12; i += 1) {
    const p = clamp01((t - i * 0.025) / 0.72);
    const px = cx + (i - 5.5) * w * 0.025 + Math.sin(i * 1.9) * w * 0.02;
    const py = cy + p * h * 0.18;
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 213, 92, ${alpha * (1 - p)})` : `rgba(45, 236, 255, ${alpha * (1 - p)})`;
    ctx.fillRect(px, py, Math.max(1.2, w * 0.008), Math.max(1.2, h * 0.006));
  }
  ctx.restore();
}

function drawComboBurstV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number, combo = 24): void {
  paintStageBg(ctx, w, h);
  const palette = comboHudPalette(combo);
  const t = (tMs % COMBO_BURST_V3_MS) / COMBO_BURST_V3_MS;
  const hit = clamp01(t / 0.24);
  const fade = t < 0.78 ? 1 : 1 - (t - 0.78) / 0.22;
  const cx = w / 2;
  const cy = h / 2;
  const shake = combo >= 20 && t < 0.25 ? Math.sin(t * Math.PI * 32) * (1 - t / 0.25) * Math.min(w, h) * 0.012 : 0;

  ctx.save();
  ctx.translate(shake, 0);
  ctx.globalCompositeOperation = 'lighter';
  drawFeedbackAsset(
    ctx,
    hudFeedbackImages.comboBurstBase,
    cx,
    cy + h * 0.02,
    w * 0.92,
    h * 0.62,
    0.86 + easeOutBack(hit) * 0.12,
    fade,
  );
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.48);
  core.addColorStop(0, `rgba(${palette.main}, ${0.34 * fade})`);
  core.addColorStop(0.32, `rgba(${palette.soft}, ${0.22 * fade})`);
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < (combo >= 50 ? 3 : combo >= 20 ? 2 : 1); i += 1) {
    const ringT = clamp01((t - i * 0.1) / 0.62);
    if (ringT <= 0 || ringT >= 1) continue;
    ctx.strokeStyle = `rgba(${i % 2 ? palette.soft : palette.main}, ${(1 - ringT) * 0.78})`;
    ctx.lineWidth = lerp(5, 1.2, ringT);
    ctx.beginPath();
    ctx.arc(cx, cy, lerp(w * 0.12, w * 0.48, easeOutCubic(ringT)), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 30; i += 1) {
    const p = clamp01((t - (i % 6) * 0.018) / 0.72);
    const angle = (i / 30) * Math.PI * 2;
    const dist = lerp(w * 0.08, w * 0.44, easeOutCubic(p)) * (i % 2 ? 0.78 : 1);
    const alpha = fade * (1 - p);
    ctx.fillStyle = i % 4 === 0 ? `rgba(${palette.soft}, ${alpha})` : `rgba(${palette.main}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.78, lerp(3.6, 0.8, p), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  const scale = 0.82 + easeOutBack(hit) * 0.28;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(4, w * 0.018);
  ctx.strokeStyle = 'rgba(3, 7, 18, 0.92)';
  ctx.font = `1000 ${Math.min(78, w * 0.25)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.strokeText(`x${combo}`, 0, -4);
  ctx.shadowColor = `rgba(${palette.main}, 0.88)`;
  ctx.shadowBlur = 18;
  ctx.fillStyle = palette.text;
  ctx.fillText(`x${combo}`, 0, -4);
  ctx.font = `900 ${Math.min(18, w * 0.055)}px system-ui, sans-serif`;
  ctx.fillStyle = palette.hot;
  ctx.shadowBlur = 8;
  ctx.fillText(combo >= 50 ? 'OVERLOAD' : combo >= 20 ? 'CHAIN BREAKER' : combo >= 10 ? 'HIGH COMBO' : 'COMBO', 0, 48);
  ctx.restore();

  ctx.restore();
}

function drawLifeLossPopupV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): void {
  paintStageBg(ctx, w, h);
  const progress = (tMs % LIFE_LOSS_POPUP_V3_MS) / LIFE_LOSS_POPUP_V3_MS;
  const alpha = Math.max(0, 1 - progress);
  const impact = Math.sin(Math.min(1, progress * 2.3) * Math.PI);
  const uiScale = Math.min(w / 260, h / 150) * 0.96;
  const pop = 0.9 + impact * 0.18;

  ctx.save();
  ctx.globalAlpha = Math.min(GAME_ASSET_TUNING.fx.break.flashAlpha, alpha * GAME_ASSET_TUNING.fx.break.flashAlpha);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(w / 2, h * 0.54);
  ctx.scale(pop, pop);
  drawFxSpriteFrame(ctx, 'wrong-flag-break', progress, 0, 6 * uiScale, 190 * uiScale, 108 * uiScale, GAME_ASSET_TUNING.fx.break.spriteAlpha);

  const chip = getGameUiPanel('break-chip');
  if (chip) {
    drawImageContained(ctx, chip, -52 * uiScale, -42 * uiScale, 104 * uiScale, 32 * uiScale, 1);
  } else {
    ctx.beginPath();
    ctx.roundRect(-52 * uiScale, -42 * uiScale, 104 * uiScale, 32 * uiScale, 8 * uiScale);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
    ctx.lineWidth = Math.max(1, 1.6 * uiScale);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
  ctx.shadowBlur = 14 * uiScale;
  ctx.font = `900 ${28 * uiScale}px system-ui, sans-serif`;
  ctx.fillStyle = '#fecaca';
  ctx.fillText('BREAK x8', 0, -6 * uiScale);
  ctx.font = `900 ${13 * uiScale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = '#ff4d3d';
  ctx.fillText('DEFUSE 4->0', 0, 22 * uiScale);
  ctx.restore();
}

type HudAlertKind = 'speed-up' | 'danger-rise';

function drawSpeedUpChevronStreaks(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  progress: number,
  alpha: number,
  canvasW: number,
  canvasH: number,
): void {
  const main = '255, 190, 55';
  const soft = '45, 236, 255';

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 12; i += 1) {
    const p = (progress + i * 0.071) % 1;
    const px = bounds.x + bounds.w * (0.18 + p * 0.64);
    const py = bounds.y + bounds.h * (0.36 + Math.sin(i) * 0.12);
    ctx.fillStyle = i % 3 === 0 ? `rgba(${main}, ${alpha * (1 - p)})` : `rgba(${soft}, ${alpha * 0.72 * (1 - p)})`;
    ctx.fillRect(px, py, Math.max(1.2, canvasW * 0.004), Math.max(1.2, canvasH * 0.004));
    ctx.fillRect(px - canvasW * 0.018, py, canvasW * 0.016, Math.max(1, canvasH * 0.003));
  }
  ctx.restore();
}

function drawSpeedUpChevronFxScene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): void {
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, w, h);

  const progress = (tMs % HUD_ALERT_V3_MS) / HUD_ALERT_V3_MS;
  const lane = { x: w * 0.06, y: h * 0.34, w: w * 0.88, h: h * 0.32 };

  ctx.save();
  ctx.strokeStyle = 'rgba(45, 236, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.strokeRect(lane.x, lane.y, lane.w, lane.h);
  ctx.restore();

  drawSpeedUpChevronStreaks(ctx, lane, progress, 1, w, h);

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = 'rgba(255, 190, 55, 0.55)';
  ctx.lineWidth = Math.max(1, h * 0.006);
  ctx.beginPath();
  ctx.moveTo(lane.x + lane.w * 0.12, lane.y + lane.h * 0.72);
  ctx.lineTo(lane.x + lane.w * 0.88, lane.y + lane.h * 0.72);
  ctx.stroke();
  ctx.restore();
}

function drawHudAlertV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, kind: HudAlertKind, tMs: number): void {
  paintStageBg(ctx, w, h);
  const progress = (tMs % HUD_ALERT_V3_MS) / HUD_ALERT_V3_MS;
  const inT = clamp01(progress / 0.18);
  const outT = progress > 0.82 ? clamp01((progress - 0.82) / 0.18) : 0;
  const visible = easeOutCubic(inT) * (1 - easeOutCubic(outT));
  const impact = progress < 0.28 ? 1 - easeOutCubic(progress / 0.28) : 0;
  const image = kind === 'speed-up' ? hudAlertImages.speedUp : hudAlertImages.dangerRise;
  const label = kind === 'speed-up' ? 'SPEED UP' : 'DANGER RISE';
  const main = kind === 'speed-up' ? '255, 190, 55' : '255, 76, 86';
  const soft = kind === 'speed-up' ? '45, 236, 255' : '251, 113, 36';
  const text = kind === 'speed-up' ? '#fef3c7' : '#ffe4e6';
  const shake = kind === 'danger-rise' ? Math.sin(progress * Math.PI * 18) * impact * w * 0.004 : 0;
  const asset = drawFeedbackAsset(ctx, image, w / 2 + shake, h * 0.52, w * 0.9, h * 0.34, 0.94 + impact * 0.035, visible);
  if (!asset) return;

  ctx.save();
  ctx.globalAlpha = visible;
  ctx.globalCompositeOperation = 'lighter';
  const scanX = asset.x + ((progress * 1.35) % 1) * asset.w;
  const scan = ctx.createLinearGradient(scanX - asset.w * 0.12, 0, scanX + asset.w * 0.12, 0);
  scan.addColorStop(0, 'rgba(255,255,255,0)');
  scan.addColorStop(0.5, `rgba(${soft}, ${0.24 + impact * 0.18})`);
  scan.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = scan;
  ctx.fillRect(asset.x + asset.w * 0.08, asset.y + asset.h * 0.22, asset.w * 0.84, asset.h * 0.56);

  if (kind === 'speed-up') {
    drawSpeedUpChevronStreaks(ctx, asset, progress, visible, w, h);
  } else {
    for (let i = 0; i < 12; i += 1) {
      const p = (progress + i * 0.071) % 1;
      const px = asset.x + asset.w * (0.18 + p * 0.64);
      const py = asset.y + asset.h * (0.75 - p * 0.48);
      ctx.fillStyle = i % 3 === 0 ? `rgba(${main}, ${visible * (1 - p)})` : `rgba(${soft}, ${visible * 0.72 * (1 - p)})`;
      ctx.fillRect(px, py, Math.max(1.2, w * 0.004), Math.max(1.2, h * 0.004 + p * h * 0.02));
    }
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `1000 ${Math.min(32, asset.h * 0.31)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.lineWidth = Math.max(2, asset.h * 0.045);
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
  ctx.shadowColor = `rgba(${main}, ${0.72 + impact * 0.18})`;
  ctx.shadowBlur = asset.h * (0.12 + impact * 0.08);
  ctx.strokeText(label, asset.x + asset.w / 2, asset.y + asset.h * 0.52);
  ctx.fillStyle = text;
  ctx.fillText(label, asset.x + asset.w / 2, asset.y + asset.h * 0.52);
  ctx.restore();
}

function createStaticFrameCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  label: string,
  index: number,
  size: { w: number; h: number; wide?: boolean } = { w: 88, h: 88 },
): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'asset-lab__frame-cell';
  cell.title = label;

  const thumb = document.createElement('div');
  thumb.className = `asset-lab__frame-thumb asset-lab__checker${size.wide ? ' asset-lab__frame-thumb--wide' : ''}`;

  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__frame-canvas';
  canvas.width = size.w;
  canvas.height = size.h;
  canvas.style.width = `${size.w}px`;
  canvas.style.height = `${size.h}px`;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, size.w, size.h);
    const startedAt = performance.now();
    const redrawWhileAssetsLoad = (): void => {
      draw(ctx, size.w, size.h);
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
      { label: 'x99999 reserved', t: HUD_FEEDBACK_V3_MS * 0.42, combo: 99999 },
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
      { label: 'Impact', t: LIFE_LOSS_POPUP_V3_MS * 0.08 },
      { label: 'Break', t: LIFE_LOSS_POPUP_V3_MS * 0.22 },
      { label: 'Reset', t: LIFE_LOSS_POPUP_V3_MS * 0.48 },
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
        : spec.id === 'heart-refill-v3'
          ? 'Click the preview to play refill; it holds on the full heart.'
          : spec.id === 'heart-loss-v3'
            ? 'Click the preview to toggle full / empty heart states.'
            : spec.id === 'start-panel-v3' || spec.id === 'game-over-panel-v3'
              ? 'Click the preview to play the button press feedback.'
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
