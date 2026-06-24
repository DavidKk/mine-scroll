import {
  drawImageContained,
  getGameCutout,
  getGameFxBlendMode,
  getGameFxFrames,
} from '../../ui/game-assets.ts';
import { drawSpriteInCell, getTileSprites, type TileSprites } from '../../ui/tile-sprites.ts';

type CellMode = 'hidden' | 'hover' | 'open' | 'breath';
type MineMode = 'armed' | 'flash' | 'blast' | 'exploded';
type EffectId = 'cells' | 'digits' | 'flag' | 'mine';

interface CellEffectDrawOpts {
  scale?: number;
  lift?: number;
  brightness?: number;
  ringAlpha?: number;
  ringWidth?: number;
  innerGlow?: number;
}

interface EffectCardSpec {
  id: EffectId;
  title: string;
  description: string;
  frameTitle: string;
  liveTitle: string;
}

interface LivePreview {
  canvas: HTMLCanvasElement;
  dispose: () => void;
}

const BREATH_CYCLE_MS = 2400;
const FLAG_WAVE_MS = 1500;
const DIGIT_PARTICLE_MS = 1800;
const MINE_EXPLOSION_MS = 720;

const EFFECT_SPECS: EffectCardSpec[] = [
  {
    id: 'cells',
    title: '方格状态',
    description: '未开启、开启、Hover 过渡与 idle 呼吸都用 Canvas 绘制，保留游戏内触发手感。',
    frameTitle: '状态 / 过渡关键帧',
    liveTitle: '整合预览（Hover + 点击切换开启态）',
  },
  {
    id: 'digits',
    title: '数字粒子',
    description: '数字保留原切片，外圈加入程序粒子与脉冲辉光；不额外产出切图帧。',
    frameTitle: '粒子周期关键帧',
    liveTitle: '整合预览（循环 1-8 数字）',
  },
  {
    id: 'flag',
    title: '旗帜飘扬',
    description: '旗帜按竖向切片做波形偏移，叠加插旗弹出火花，形成单机游戏式飘扬感。',
    frameTitle: '飘扬关键帧',
    liveTitle: '整合预览（循环飘扬）',
  },
  {
    id: 'mine',
    title: '地雷爆炸',
    description: '点击先播放爆炸 FX，结束后落到爆炸后的炸弹状态，便于接入踩雷反馈。',
    frameTitle: '爆炸关键帧',
    liveTitle: '整合预览（点击引爆）',
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
  ctx.fillStyle = '#05060b';
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.48, Math.max(w, h) * 0.65);
  glow.addColorStop(0, 'rgba(30, 64, 175, 0.36)');
  glow.addColorStop(0.48, 'rgba(15, 23, 42, 0.18)');
  glow.addColorStop(1, 'rgba(5, 6, 11, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
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

function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): { w: number; h: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return { w, h };
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
  drawSpriteInCell(ctx, sprites.hidden, x, y, drawSize);
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
): void {
  const phase = (tMs % DIGIT_PARTICLE_MS) / DIGIT_PARTICLE_MS;
  for (let i = 0; i < 18; i += 1) {
    const spin = phase * Math.PI * 2 + seed * 0.3;
    const angle = i * 2.399 + spin * (i % 2 === 0 ? 0.42 : -0.28);
    const drift = Math.sin(spin + i * 1.7) * size * 0.035;
    const radius = size * (0.32 + (i % 5) * 0.034) + drift;
    const p = (phase + i * 0.071) % 1;
    const alpha = 0.2 + Math.sin(p * Math.PI) * 0.72;
    const dot = size * (0.018 + (i % 3) * 0.006);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.72;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = dot * 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, dot, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
  ctx.arc(cx, cy, cell.size * (0.43 + pop * 0.06), -0.45, Math.PI * 1.25);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(56, 189, 248, 0.75)';
  ctx.shadowBlur = cell.size * 0.1;
  const drawW = cell.size * 0.74;
  const drawH = cell.size * 0.74;
  drawWaveImage(ctx, flag, cx - drawW / 2, cy - drawH / 2, drawW, drawH, tMs, cell.size * 0.032);
  ctx.restore();

  drawDigitParticles(ctx, cx, cy, cell.size * 0.82, '#38bdf8', tMs, 3);
}

function drawFxFrames(
  ctx: CanvasRenderingContext2D,
  frames: HTMLImageElement[] | null,
  blendMode: GlobalCompositeOperation,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number,
): void {
  if (!frames || frames.length === 0) return;
  const frame = frames[Math.min(frames.length - 1, Math.floor(clamp01(progress) * frames.length))];
  ctx.save();
  ctx.globalCompositeOperation = blendMode;
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
  drawImageContained(ctx, img, cx - size / 2, cy - size / 2, size, size, scale);
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
    drawMineCutout(ctx, standard, cx, cy, cell.size, 0.72 + pulse * 0.035);
    return;
  }

  if (mode === 'flash') {
    drawMineCutout(ctx, flash, cx, cy, cell.size, 0.86);
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
    drawFxFrames(
      ctx,
      frames,
      blendMode,
      cx - cell.size * 0.95,
      cy - cell.size * 0.72,
      cell.size * 1.9,
      cell.size * 1.42,
      eased,
    );
    drawMineCutout(ctx, blastProgress > 0.55 ? exploded : flash, cx, cy, cell.size, 0.88 + eased * 0.08);
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.ellipse(cx, cy + cell.size * 0.12, cell.size * 0.33, cell.size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawFxFrames(ctx, frames, blendMode, cx - cell.size * 0.82, cy - cell.size * 0.64, cell.size * 1.64, cell.size * 1.26, 0.92);
  drawMineCutout(ctx, exploded, cx, cy, cell.size, 0.86);
}

function createStaticFrameCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  label: string,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'asset-gallery__frame';

  const canvas = document.createElement('canvas');
  canvas.className = 'asset-gallery__frame-canvas';
  canvas.width = 168;
  canvas.height = 168;
  canvas.style.width = '168px';
  canvas.style.height = '168px';

  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, 168, 168);
  }

  const cap = document.createElement('span');
  cap.className = 'asset-gallery__frame-label';
  cap.textContent = label;

  wrap.append(canvas, cap);
  return wrap;
}

function createCellLiveCanvas(sprites: TileSprites): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-gallery__live-canvas';
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let frame = 0;
  let hoverTarget = 0;
  let hoverProgress = 0;
  let pressed = false;
  let opened = false;
  let openStartedAt = 0;

  const draw = (): void => {
    const { w, h } = fitCanvas(canvas, ctx);
    const now = performance.now();
    hoverProgress += (hoverTarget - hoverProgress) * 0.16;
    paintStageBg(ctx, w, h);
    const cell = layoutCell(w, h, 0.55);
    if (opened) {
      const pulse = 1 - easeOutCubic((now - openStartedAt) / 460);
      drawOpenCell(ctx, sprites, cell.x, cell.y, cell.size, pulse);
      if (pulse > 0.02) {
        drawDigitParticles(ctx, cell.x + cell.size / 2, cell.y + cell.size / 2, cell.size, '#34d399', now, 7);
      }
      return;
    }
    const opts = mixOpts(breathPhase(now), hoverStateOpts(hoverProgress, pressed), hoverProgress);
    drawHiddenCellWithEffect(ctx, sprites, cell.x, cell.y, cell.size, opts);
  };

  const tick = (): void => {
    draw();
    frame = window.requestAnimationFrame(tick);
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
    openStartedAt = performance.now();
  };

  canvas.addEventListener('mouseenter', onEnter);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('click', onClick);
  frame = window.requestAnimationFrame(tick);

  return {
    canvas,
    dispose: () => {
      window.cancelAnimationFrame(frame);
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
): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-gallery__live-canvas';
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let frame = 0;
  const tick = (): void => {
    const { w, h } = fitCanvas(canvas, ctx);
    draw(ctx, w, h, performance.now());
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);

  return {
    canvas,
    dispose: () => window.cancelAnimationFrame(frame),
  };
}

function createMineLiveCanvas(sprites: TileSprites): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-gallery__live-canvas asset-gallery__live-canvas--action';
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let frame = 0;
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

  const tick = (): void => {
    const { w, h } = fitCanvas(canvas, ctx);
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
    frame = window.requestAnimationFrame(tick);
  };

  canvas.addEventListener('click', onClick);
  frame = window.requestAnimationFrame(tick);

  return {
    canvas,
    dispose: () => {
      window.cancelAnimationFrame(frame);
      canvas.removeEventListener('click', onClick);
    },
  };
}

function createFrames(id: EffectId, sprites: TileSprites): HTMLElement {
  const frames = document.createElement('div');
  frames.className = 'asset-gallery__frames';

  if (id === 'cells') {
    const cellFrames: Array<{ label: string; mode: CellMode; t: number }> = [
      { label: '未开启', mode: 'hidden', t: 0 },
      { label: '呼吸峰值', mode: 'breath', t: BREATH_CYCLE_MS * 0.25 },
      { label: 'Hover 完成', mode: 'hover', t: 0 },
      { label: '开启', mode: 'open', t: 0 },
    ];
    for (const item of cellFrames) {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawCellScene(ctx, w, h, sprites, item.mode, item.t), item.label));
    }
    return frames;
  }

  if (id === 'digits') {
    const digitFrames = [
      { label: '粒子初始', digit: 0, t: 0 },
      { label: '外扩', digit: 2, t: DIGIT_PARTICLE_MS * 0.33 },
      { label: '峰值', digit: 4, t: DIGIT_PARTICLE_MS * 0.58 },
      { label: '收束', digit: 7, t: DIGIT_PARTICLE_MS * 0.82 },
    ];
    for (const item of digitFrames) {
      frames.append(
        createStaticFrameCanvas((ctx, w, h) => drawDigitScene(ctx, w, h, sprites, item.digit, item.t), item.label),
      );
    }
    return frames;
  }

  if (id === 'flag') {
    const flagFrames = [
      { label: '起风', t: 0 },
      { label: '左摆', t: FLAG_WAVE_MS * 0.25 },
      { label: '扬起', t: FLAG_WAVE_MS * 0.5 },
      { label: '回摆', t: FLAG_WAVE_MS * 0.75 },
    ];
    for (const item of flagFrames) {
      frames.append(createStaticFrameCanvas((ctx, w, h) => drawFlagScene(ctx, w, h, sprites, item.t), item.label));
    }
    return frames;
  }

  const mineFrames: Array<{ label: string; mode: MineMode; t: number; progress?: number }> = [
    { label: '待触发', mode: 'armed', t: 0 },
    { label: '命中闪光', mode: 'flash', t: 0 },
    { label: '爆炸中', mode: 'blast', t: MINE_EXPLOSION_MS * 0.42, progress: 0.42 },
    { label: '爆炸后', mode: 'exploded', t: MINE_EXPLOSION_MS },
  ];
  for (const item of mineFrames) {
    frames.append(
      createStaticFrameCanvas(
        (ctx, w, h) => drawMineScene(ctx, w, h, sprites, item.mode, item.t, item.progress ?? 0),
        item.label,
      ),
    );
  }
  return frames;
}

function createLivePreview(id: EffectId, sprites: TileSprites): LivePreview | null {
  if (id === 'cells') return createCellLiveCanvas(sprites);
  if (id === 'digits') {
    return createLoopCanvas((ctx, w, h, now) => {
      const digit = Math.floor(now / 760) % sprites.numbers.length;
      drawDigitScene(ctx, w, h, sprites, digit, now);
    });
  }
  if (id === 'flag') {
    return createLoopCanvas((ctx, w, h, now) => drawFlagScene(ctx, w, h, sprites, now));
  }
  return createMineLiveCanvas(sprites);
}

function createEffectCard(spec: EffectCardSpec): HTMLElement | null {
  const sprites = getTileSprites();
  if (!sprites) return null;

  const card = document.createElement('article');
  card.className = 'asset-gallery__effect';
  card.id = `effect-${spec.id}`;

  const head = document.createElement('div');
  head.className = 'asset-gallery__effect-head';
  const title = document.createElement('h3');
  title.textContent = spec.title;
  const copy = document.createElement('p');
  copy.textContent = spec.description;
  head.append(title, copy);

  const body = document.createElement('div');
  body.className = 'asset-gallery__effect-body';

  const framesHead = document.createElement('p');
  framesHead.className = 'asset-gallery__effect-subhead';
  framesHead.textContent = spec.frameTitle;

  const liveHead = document.createElement('p');
  liveHead.className = 'asset-gallery__effect-subhead';
  liveHead.textContent = spec.liveTitle;

  const liveStage = document.createElement('div');
  liveStage.className = 'asset-gallery__live-stage';
  const live = createLivePreview(spec.id, sprites);
  if (live) {
    liveStage.append(live.canvas);
  }

  body.append(framesHead, createFrames(spec.id, sprites), liveHead, liveStage);
  card.append(head, body);

  card.addEventListener('gallery:dispose', () => {
    live?.dispose();
  });

  return card;
}

export function mountCellEffectSection(): { section: HTMLElement; dispose: () => void } {
  const section = document.createElement('section');
  section.className = 'asset-gallery__section';
  section.id = 'section-effects';

  const head = document.createElement('div');
  head.className = 'asset-gallery__section-head';
  const title = document.createElement('h2');
  title.textContent = '单机游戏动效';
  const copy = document.createElement('p');
  copy.textContent =
    '只生成数字、地雷、旗帜、方格相关内容：Canvas 程序动效 + 关键帧预览，后续可以直接接入主游戏渲染器。';
  head.append(title, copy);

  const grid = document.createElement('div');
  grid.className = 'asset-gallery__effects-grid';

  const cards: HTMLElement[] = [];
  for (const spec of EFFECT_SPECS) {
    const card = createEffectCard(spec);
    if (card) {
      grid.append(card);
      cards.push(card);
    }
  }

  section.append(head, grid);

  return {
    section,
    dispose: () => {
      for (const card of cards) {
        card.dispatchEvent(new CustomEvent('gallery:dispose'));
      }
    },
  };
}
