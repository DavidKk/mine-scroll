import { FONTS } from '../ui/theme.ts';

type PreviewKind = 'tile' | 'flag' | 'explode' | 'combo' | 'scroll' | 'life' | 'gameover';

interface PreviewSpec {
  kind: PreviewKind;
  title: string;
  note: string;
}

const PREVIEWS: PreviewSpec[] = [
  { kind: 'tile', title: 'Tile Click', note: 'hidden -> reveal pop + blue spark' },
  { kind: 'flag', title: 'Flag Place', note: 'ring pulse + flag cloth pop' },
  { kind: 'explode', title: 'Mine Explosion', note: 'shockwave + sparks + red flash' },
  { kind: 'combo', title: 'Combo Burst', note: 'x99 scale pop + particles' },
  { kind: 'scroll', title: 'Batch Scroll', note: 'bottom N rows pressure band' },
  { kind: 'life', title: 'Life / Heal', note: 'heart loss + refill pulse' },
  { kind: 'gameover', title: 'Game Over', note: 'modal slam-in + retry button' },
];

const TARGET_IMAGE = '/assets/reference/endless-arcade-visual-target-v1.png';
const ASSET_SHEETS = [
  {
    title: 'Static States',
    note: 'AI hint, hover/pressed, batch scroll overlays, break/heal/start/log/button states.',
    src: '/assets/generated/endless-static-states-v1.png',
  },
  {
    title: 'FX Sprite Concept',
    note: 'Mine explosion, combo burst, safe reveal, flag pop, wrong flag, heart refill, level up, score pop.',
    src: '/assets/generated/endless-fx-sprite-concept-v1.png',
  },
  {
    title: 'HUD & Popups',
    note: 'HUD panels, countdown rings, bottom controls, start/game-over/log/defuse/combo-break components.',
    src: '/assets/generated/endless-hud-popups-v1.png',
  },
  {
    title: 'Production Cutouts',
    note: 'Core cutout sheet: mines, flags, hearts, warning/status icons. Needs grid normalization before slicing.',
    src: '/assets/production/core-cutouts-production-v1.png',
  },
  {
    title: 'Production FX',
    note: '8x8 additive sprite sheet. 1536x1024, clean 192x128 frames.',
    src: '/assets/production/fx-additive-sprites-production-v1.png',
  },
  {
    title: 'Production UI Panels',
    note: 'Crop candidates and Canvas reference for SPACE/AUTO/START/RETRY/Game Over/Log/HUD components.',
    src: '/assets/production/ui-panels-production-v1.png',
  },
  {
    title: 'Sliced Cutouts Preview',
    note: 'Generated from public/assets/game/cutouts, normalized 256x256 transparent PNG assets.',
    src: '/assets/game/preview-cutouts.png',
  },
  {
    title: 'Sliced FX Preview',
    note: 'Middle-frame preview from 8 additive FX animations, each sliced into 8 frames.',
    src: '/assets/game/preview-fx.png',
  },
  {
    title: 'Sliced UI Panel Preview',
    note: 'Cropped SPACE/AUTO/START/RETRY/Game Over/Log/HUD panel references from public/assets/game/ui.',
    src: '/assets/game/preview-ui-panels.png',
  },
] as const;

interface LabCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  kind: PreviewKind;
  startedAt: number;
}

function roundedPath(
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

function fillRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
): void {
  roundedPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke: string,
  lineWidth = 1,
): void {
  roundedPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  if (canvas.width === w * dpr && canvas.height === h * dpr) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, revealed = false): void {
  const bg = revealed ? '#101722' : '#252b3d';
  const hi = ctx.createLinearGradient(x, y, x, y + size);
  hi.addColorStop(0, revealed ? '#172235' : '#384052');
  hi.addColorStop(1, bg);
  fillRound(ctx, x, y, size, size, 8, hi);
  strokeRound(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 8, '#5a6b94', 1.2);
  strokeRound(ctx, x + 4, y + 4, size - 8, size - 8, 5, 'rgba(255,255,255,0.08)');
}

function drawFlag(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, color = '#4169ff'): void {
  ctx.strokeStyle = '#c7d2fe';
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 9 * scale, cy - 16 * scale);
  ctx.lineTo(cx - 9 * scale, cy + 18 * scale);
  ctx.stroke();

  const flag = ctx.createLinearGradient(cx - 7 * scale, cy - 15 * scale, cx + 18 * scale, cy + 5 * scale);
  flag.addColorStop(0, color);
  flag.addColorStop(1, color === '#4169ff' ? '#6ea8ff' : '#ff6b5f');
  ctx.fillStyle = flag;
  ctx.beginPath();
  ctx.moveTo(cx - 7 * scale, cy - 16 * scale);
  ctx.lineTo(cx + 18 * scale, cy - 9 * scale);
  ctx.lineTo(cx - 7 * scale, cy + 1 * scale);
  ctx.closePath();
  ctx.fill();
}

function drawMine(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, glow = false): void {
  if (glow) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 44 * scale);
    g.addColorStop(0, 'rgba(255, 74, 74, 0.62)');
    g.addColorStop(1, 'rgba(255, 74, 74, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 44 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#ffb4a8';
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI * 2 * i) / 10;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 14 * scale, cy + Math.sin(a) * 14 * scale);
    ctx.lineTo(cx + Math.cos(a) * 23 * scale, cy + Math.sin(a) * 23 * scale);
    ctx.stroke();
  }

  const body = ctx.createRadialGradient(cx - 5 * scale, cy - 5 * scale, 2, cx, cy, 18 * scale);
  body.addColorStop(0, '#555d72');
  body.addColorStop(0.45, '#171b25');
  body.addColorStop(1, '#03040a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, 16 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff3535';
  ctx.beginPath();
  ctx.arc(cx, cy, 7 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawPreviewFrame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#080b14');
  bg.addColorStop(1, '#03050a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#213055';
  for (let x = 0; x < w; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTilePreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const size = Math.min(52, Math.max(34, w / 7));
  const gap = 10;
  const totalW = size * 5 + gap * 4;
  const x = w / 2 - totalW / 2;
  const y = h / 2 - size / 2;
  const pop = t < 0.5 ? 1 + Math.sin(t * Math.PI * 2) * 0.08 : 1;
  ctx.save();
  drawTile(ctx, x, y, size, false);

  drawTile(ctx, x + (size + gap), y, size, true);
  fillRound(ctx, x + (size + gap) + 4, y + 4, size - 8, size - 8, 6, 'rgba(0,0,0,0.16)');

  drawTile(ctx, x + (size + gap) * 2, y, size, true);
  ctx.fillStyle = '#60a5fa';
  ctx.font = `800 ${Math.round(size * 0.5)}px ${FONTS.mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('2', x + (size + gap) * 2 + size / 2, y + size / 2 + 1);

  drawTile(ctx, x + (size + gap) * 3, y, size, false);
  ctx.save();
  ctx.translate(x + (size + gap) * 3 + size / 2, y + size / 2);
  ctx.scale(pop, pop);
  drawFlag(ctx, 0, 0, size / 70);
  ctx.restore();

  drawTile(ctx, x + (size + gap) * 4, y, size, true);
  drawMine(ctx, x + (size + gap) * 4 + size / 2, y + size / 2, size / 68, false);
  ctx.restore();

  const alpha = Math.max(0, 1 - t);
  strokeRound(ctx, x + size + gap - t * 10, y - t * 10, size + t * 20, size + t * 20, 10, `rgba(96,165,250,${alpha})`, 2);
}

function drawFlagPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const size = 70;
  drawTile(ctx, w / 2 - size / 2, h / 2 - size / 2, size);
  const ringAlpha = Math.max(0, 1 - t);
  ctx.strokeStyle = `rgba(80, 112, 255, ${ringAlpha})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 24 + t * 36, 0, Math.PI * 2);
  ctx.stroke();
  const s = Math.min(1, t / 0.28) * 0.92;
  drawFlag(ctx, w / 2, h / 2, s);
}

function drawExplosionPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  drawTile(ctx, w / 2 - 34, h / 2 - 34, 68, true);
  const radius = 20 + t * 84;
  const alpha = 1 - t;
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius);
  g.addColorStop(0, `rgba(255,255,255,${0.8 * alpha})`);
  g.addColorStop(0.18, `rgba(255,80,30,${0.62 * alpha})`);
  g.addColorStop(1, 'rgba(255,80,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
  ctx.fill();
  drawMine(ctx, w / 2, h / 2, 1.05, true);
}

function drawComboPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const scale = 0.92 + Math.sin(Math.min(1, t * 2.4) * Math.PI) * 0.22;
  const burst = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 130);
  burst.addColorStop(0, 'rgba(220,255,70,0.42)');
  burst.addColorStop(0.55, 'rgba(62,255,42,0.18)');
  burst.addColorStop(1, 'rgba(62,255,42,0)');
  ctx.fillStyle = burst;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 24px ${FONTS.display}`;
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#5b2300';
  ctx.fillStyle = '#ffe85a';
  ctx.strokeText('COMBO', 0, -28);
  ctx.fillText('COMBO', 0, -28);
  ctx.font = `900 58px ${FONTS.mono}`;
  ctx.strokeText('x99', 0, 22);
  ctx.fillStyle = '#ff7a18';
  ctx.fillText('x99', 0, 22);
  ctx.restore();
}

function drawScrollPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const cell = 28;
  const cols = 6;
  const rows = 5;
  const startX = w / 2 - (cols * cell + (cols - 1) * 4) / 2;
  const startY = h / 2 - (rows * cell + (rows - 1) * 4) / 2;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      drawTile(ctx, startX + col * (cell + 4), startY + row * (cell + 4), cell, row < 2);
    }
  }
  const bandH = cell * 2 + 4;
  const pulse = 0.35 + Math.sin(t * Math.PI * 2) * 0.18;
  fillRound(ctx, startX - 4, startY + 3 * (cell + 4) - 4, cols * (cell + 4), bandH + 8, 8, `rgba(245,158,11,${pulse})`);
  ctx.fillStyle = '#fde68a';
  ctx.font = `800 20px ${FONTS.mono}`;
  ctx.textAlign = 'center';
  ctx.fillText('x2 ROWS', w / 2, startY + rows * (cell + 4) + 24);
}

function drawLifePreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const max = 5;
  const beat = 1 + Math.sin(t * Math.PI * 2) * 0.08;
  for (let i = 0; i < max; i += 1) {
    const cx = w / 2 - 80 + i * 40;
    const cy = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(i === 3 ? beat : 1, i === 3 ? beat : 1);
    ctx.fillStyle = i < 4 ? '#ff4d4d' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.bezierCurveTo(-28, -6, -10, -28, 0, -12);
    ctx.bezierCurveTo(10, -28, 28, -6, 0, 15);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#4ade80';
  ctx.font = `900 26px ${FONTS.mono}`;
  ctx.textAlign = 'center';
  ctx.fillText('+1 LIFE', w / 2, h / 2 + 54);
}

function drawGameOverPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const y = h / 2 - 58 + (1 - Math.min(1, t * 2)) * -24;
  const alpha = Math.min(1, t * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  fillRound(ctx, w / 2 - 135, y, 270, 116, 12, 'rgba(44, 8, 10, 0.94)');
  strokeRound(ctx, w / 2 - 135, y, 270, 116, 12, '#ff4d4d', 2);
  ctx.fillStyle = '#ff5b4d';
  ctx.font = `900 28px ${FONTS.display}`;
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', w / 2, y + 44);
  fillRound(ctx, w / 2 - 70, y + 64, 140, 34, 7, '#b91c1c');
  ctx.fillStyle = '#fff';
  ctx.font = `800 16px ${FONTS.display}`;
  ctx.fillText('RETRY', w / 2, y + 87);
  ctx.restore();
}

function drawPreview(lab: LabCanvas): void {
  fitCanvas(lab.canvas, lab.ctx);
  const rect = lab.canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const elapsed = (performance.now() - lab.startedAt) % 1600;
  const t = elapsed / 1600;

  lab.ctx.clearRect(0, 0, w, h);
  drawPreviewFrame(lab.ctx, w, h);

  if (lab.kind === 'tile') drawTilePreview(lab.ctx, w, h, t);
  if (lab.kind === 'flag') drawFlagPreview(lab.ctx, w, h, t);
  if (lab.kind === 'explode') drawExplosionPreview(lab.ctx, w, h, t);
  if (lab.kind === 'combo') drawComboPreview(lab.ctx, w, h, t);
  if (lab.kind === 'scroll') drawScrollPreview(lab.ctx, w, h, t);
  if (lab.kind === 'life') drawLifePreview(lab.ctx, w, h, t);
  if (lab.kind === 'gameover') drawGameOverPreview(lab.ctx, w, h, t);
}

function createPreviewCard(spec: PreviewSpec): { el: HTMLElement; lab: LabCanvas } {
  const card = document.createElement('article');
  card.className = 'ui-lab-card';

  const canvas = document.createElement('canvas');
  canvas.className = 'ui-lab-card__canvas';
  canvas.setAttribute('aria-label', spec.title);

  const body = document.createElement('div');
  body.className = 'ui-lab-card__body';

  const title = document.createElement('h3');
  title.textContent = spec.title;

  const note = document.createElement('p');
  note.textContent = spec.note;

  body.append(title, note);
  card.append(canvas, body);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('UI Lab canvas context not available');
  return { el: card, lab: { canvas, ctx, kind: spec.kind, startedAt: performance.now() } };
}

export function mountUiLab(root: HTMLElement): () => void {
  root.className = 'app app--ui-lab';
  root.replaceChildren();

  const page = document.createElement('main');
  page.className = 'ui-lab';

  const header = document.createElement('header');
  header.className = 'ui-lab__header';

  const title = document.createElement('h1');
  title.textContent = 'Endless UI Lab';

  const subtitle = document.createElement('p');
  subtitle.textContent = '目标图、缺口清单、以及可循环预览的核心动效。用于先确认视觉，再同步到主游戏 Canvas。';

  const links = document.createElement('div');
  links.className = 'ui-lab__links';
  const gameLink = document.createElement('a');
  gameLink.href = '/';
  gameLink.textContent = 'Back to Game';
  const todoLink = document.createElement('a');
  todoLink.href = '/docs/UI-ASSET-TODO.md';
  todoLink.textContent = 'TODO Doc';
  const productionTodoLink = document.createElement('a');
  productionTodoLink.href = '/docs/UI-PRODUCTION-ASSET-TODO.md';
  productionTodoLink.textContent = 'Production TODO';
  const responsiveLink = document.createElement('a');
  responsiveLink.href = '/?ui=responsive';
  responsiveLink.textContent = 'Responsive Matrix';
  links.append(gameLink, todoLink, productionTodoLink, responsiveLink);
  header.append(title, subtitle, links);

  const target = document.createElement('section');
  target.className = 'ui-lab__target';
  const targetText = document.createElement('div');
  const targetTitle = document.createElement('h2');
  targetTitle.textContent = 'Visual Target';
  const targetCopy = document.createElement('p');
  targetCopy.textContent = '这张图作为主视觉基准。静态资产覆盖大部分元素；缺口主要在 AI 提示、批量上移覆盖、断连/回血、开始/日志状态，以及可交互动效。';
  targetText.append(targetTitle, targetCopy);

  const targetImg = document.createElement('img');
  targetImg.src = TARGET_IMAGE;
  targetImg.alt = 'Endless arcade minesweeper visual target';
  target.append(targetText, targetImg);

  const assets = document.createElement('section');
  assets.className = 'ui-lab__assets';
  const assetsHead = document.createElement('div');
  assetsHead.className = 'ui-lab__section-head';
  const assetsTitle = document.createElement('h2');
  assetsTitle.textContent = 'Generated UI Assets';
  const assetsCopy = document.createElement('p');
  assetsCopy.textContent = '按 TODO 生成的资产草案。先作为视觉资产池和切片候选，不直接强行替换游戏逻辑。';
  assetsHead.append(assetsTitle, assetsCopy);

  const assetsGrid = document.createElement('div');
  assetsGrid.className = 'ui-lab__asset-grid';
  for (const sheet of ASSET_SHEETS) {
    const card = document.createElement('article');
    card.className = 'ui-lab-asset';

    const image = document.createElement('img');
    image.src = sheet.src;
    image.alt = sheet.title;

    const body = document.createElement('div');
    body.className = 'ui-lab-asset__body';
    const h3 = document.createElement('h3');
    h3.textContent = sheet.title;
    const p = document.createElement('p');
    p.textContent = sheet.note;
    body.append(h3, p);
    card.append(image, body);
    assetsGrid.append(card);
  }
  assets.append(assetsHead, assetsGrid);

  const grid = document.createElement('section');
  grid.className = 'ui-lab__grid';
  const labs: LabCanvas[] = [];
  for (const spec of PREVIEWS) {
    const { el, lab } = createPreviewCard(spec);
    grid.append(el);
    labs.push(lab);
  }

  page.append(header, target, assets, grid);
  root.append(page);

  let frame = 0;
  const animate = (): void => {
    for (const lab of labs) drawPreview(lab);
    frame = window.requestAnimationFrame(animate);
  };
  frame = window.requestAnimationFrame(animate);

  return () => {
    window.cancelAnimationFrame(frame);
    root.replaceChildren();
  };
}
