import { CELL_GAP, FONTS, GRID_PADDING } from '../ui/theme.ts';
import { computeEndlessBoardCellSize, computeGameStageLayout } from '../ui/game-stage-layout.ts';

interface ViewportSpec {
  w: number;
  h: number;
}

interface StateSpec {
  key: string;
  title: string;
  pressure?: number;
  urgent?: boolean;
  coveredRows?: number;
  spaceAvailable?: boolean;
  combo?: number;
  scorePop?: boolean;
  breakEvent?: boolean;
  gameOver?: boolean;
}

const VIEWPORTS: ViewportSpec[] = [
  { w: 360, h: 640 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1280, h: 900 },
  { w: 1920, h: 1080 },
];

const STATES: StateSpec[] = [
  { key: 'idle', title: 'Idle / Start' },
  { key: 'normal', title: 'Playing Normal', pressure: 0.24, combo: 3 },
  { key: 'warning', title: 'Pressure Warning', pressure: 0.64, coveredRows: 2, combo: 8 },
  { key: 'urgent', title: 'Pressure Urgent', pressure: 0.92, urgent: true, coveredRows: 3, combo: 12, spaceAvailable: true },
  { key: 'space', title: 'Space Available', pressure: 0.42, combo: 14, spaceAvailable: true },
  { key: 'combo', title: 'Combo Event', pressure: 0.3, combo: 24, scorePop: true },
  { key: 'break', title: 'Break Event', pressure: 0.78, urgent: true, coveredRows: 2, breakEvent: true },
  { key: 'gameover', title: 'Game Over', gameOver: true },
];

const BOARD_COLS = 9;
const BOARD_ROWS = 21;

function getBoardSize(viewport: ViewportSpec): { w: number; h: number } {
  const cell = computeEndlessBoardCellSize(BOARD_COLS, BOARD_ROWS, viewport.w, viewport.h, {
    min: 18,
    max: 36,
  });
  return {
    w: BOARD_COLS * cell + (BOARD_COLS - 1) * CELL_GAP + GRID_PADDING * 2,
    h: BOARD_ROWS * cell + (BOARD_ROWS - 1) * CELL_GAP + GRID_PADDING * 2,
  };
}

function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function roundRect(
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
  fill: string,
): void {
  roundRect(ctx, x, y, w, h, r);
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
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawMiniBoard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, state: StateSpec): void {
  ctx.fillStyle = 'rgba(8, 13, 24, 0.86)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.26)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 12);
  ctx.lineTo(x + 1, y + h - 12);
  ctx.moveTo(x + w - 1, y + 12);
  ctx.lineTo(x + w - 1, y + h - 12);
  ctx.stroke();

  const pad = 12;
  const cols = BOARD_COLS;
  const rows = BOARD_ROWS;
  const gap = 3;
  const cell = Math.max(7, Math.floor(Math.min((w - pad * 2 - gap * (cols - 1)) / cols, (h - pad * 2 - gap * (rows - 1)) / rows)));
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;
  const gx = x + (w - gridW) / 2;
  const gy = y + (h - gridH) / 2;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const revealed = row < 3 || (col + row) % 7 === 0;
      ctx.fillStyle = revealed ? '#0f1117' : '#27272a';
      ctx.fillRect(gx + col * (cell + gap), gy + row * (cell + gap), cell, cell);
    }
  }

  if (state.pressure !== undefined) {
    const coveredRows = Math.max(1, Math.min(rows, state.coveredRows ?? 1));
    const dangerH = cell * coveredRows + gap * (coveredRows - 1);
    const dangerY = gy + gridH - dangerH;
    const pulseColor = state.urgent ? 'rgba(239, 68, 68, 0.34)' : state.pressure > 0.58 ? 'rgba(245, 158, 11, 0.26)' : 'rgba(59, 130, 246, 0.18)';
    ctx.fillStyle = pulseColor;
    ctx.fillRect(gx - 2, dangerY - 2, gridW + 4, dangerH + 4);
    const lineW = Math.max(cell, gridW * Math.max(0.05, 1 - state.pressure));
    ctx.fillStyle = state.urgent ? '#fecaca' : state.pressure > 0.58 ? '#fbbf24' : '#60a5fa';
    ctx.fillRect(gx + (gridW - lineW) / 2, dangerY - 4, lineW, Math.max(2, cell * 0.16));
  }
}

function drawBottomEnergyRail(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof computeGameStageLayout>,
  state: StateSpec,
  viewport: ViewportSpec,
): void {
  const scale = layout.scale;
  const railRect = layout.bottomRailRect;
  const top = railRect.y;
  const bottom = railRect.y + railRect.h;
  const h = railRect.h;
  if (h <= 4 * scale) return;
  const progress = Math.max(0, Math.min(1, state.pressure ?? 0));
  const urgent = Boolean(state.urgent);
  const colorA = urgent ? '239, 68, 68' : progress > 0.66 ? '245, 158, 11' : '96, 165, 250';
  const colorB = urgent ? '251, 146, 60' : progress > 0.66 ? '250, 204, 21' : '168, 85, 247';
  const baseAlpha = urgent ? 0.42 : 0.14 + progress * 0.14;
  const railW = railRect.w;
  const x = railRect.x;
  const y = top + h * 0.52;

  const fade = ctx.createLinearGradient(0, top, 0, bottom);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.35, `rgba(${colorA}, ${baseAlpha * 0.18})`);
  fade.addColorStop(1, `rgba(${colorB}, ${baseAlpha * 0.08})`);
  ctx.fillStyle = fade;
  ctx.fillRect(0, top, viewport.w, h);

  const railGradient = ctx.createLinearGradient(x, 0, x + railW, 0);
  railGradient.addColorStop(0, `rgba(${colorA}, 0)`);
  railGradient.addColorStop(0.18, `rgba(${colorA}, ${baseAlpha})`);
  railGradient.addColorStop(0.5, `rgba(${colorB}, ${baseAlpha + 0.12})`);
  railGradient.addColorStop(0.82, `rgba(${colorA}, ${baseAlpha})`);
  railGradient.addColorStop(1, `rgba(${colorB}, 0)`);
  ctx.strokeStyle = railGradient;
  ctx.lineWidth = Math.max(1.2, 1.8 * scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + railW, y);
  ctx.stroke();
}

function drawHud(ctx: CanvasRenderingContext2D, state: StateSpec, viewport: ViewportSpec): void {
  const boardSize = getBoardSize(viewport);
  const layout = computeGameStageLayout(viewport.w, viewport.h, boardSize.w, boardSize.h);
  const scale = layout.scale;
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.32)';
  ctx.strokeRect(layout.stageX, layout.stageY, layout.stageW, layout.stageH);

  ctx.fillStyle = '#fafafa';
  ctx.font = `800 ${22 * scale}px ${FONTS.mono}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('01240', layout.scoreAnchor.x, layout.hudY + 22 * scale);
  const combo = state.combo ?? 0;
  if (combo > 1) {
    ctx.textAlign = 'center';
    ctx.fillStyle = combo >= 20 ? '#fb923c' : combo >= 10 ? '#facc15' : combo >= 5 ? '#4ade80' : '#93c5fd';
    ctx.font = `900 ${9 * scale}px ${FONTS.display}`;
    ctx.fillText('COMBO', layout.countdownAnchor.x, layout.hudY + 7 * scale);
    ctx.font = `900 ${25 * scale}px ${FONTS.mono}`;
    ctx.fillText(`x${combo}`, layout.countdownAnchor.x, layout.hudY + 21 * scale);
  }

  ctx.fillStyle = '#ef4444';
  ctx.font = `900 ${18 * scale}px ${FONTS.mono}`;
  ctx.textAlign = 'right';
  ctx.fillText('♥♥♥♡♡', layout.livesAnchor.x, layout.hudY + 31 * scale);

  drawMiniBoard(ctx, layout.boardX, layout.boardY, layout.boardW, layout.boardH, state);
  drawBottomEnergyRail(ctx, layout, state, viewport);

  if (state.spaceAvailable) {
    const hintW = (viewport.w < 560 ? 52 : 60) * scale;
    const hintH = (viewport.w < 560 ? 14 : 16) * scale;
    const coveredRows = Math.max(1, state.coveredRows ?? 1);
    const cell = computeEndlessBoardCellSize(BOARD_COLS, BOARD_ROWS, viewport.w, viewport.h, {
      min: 18,
      max: 36,
    });
    const dangerTop = layout.boardY + GRID_PADDING + (BOARD_ROWS - coveredRows) * (cell + CELL_GAP) - 2;
    const hintX = layout.boardX + layout.boardW / 2 - hintW / 2;
    const hintY = Math.max(layout.boardY + GRID_PADDING, dangerTop - hintH - 4 * scale);
    const flash = 0.32 + Math.sin(performance.now() / 520) * 0.32;
    const cx = hintX + hintW / 2;
    const cy = hintY + hintH / 2;
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.fillStyle = state.urgent ? '#fef08a' : '#cbd5e1';
    ctx.font = `600 ${Math.max(9, 10 * scale)}px ${FONTS.mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPACE', cx, cy);
    ctx.restore();
  }

  fillRound(ctx, layout.autoRect.x, layout.autoRect.y, layout.autoRect.w, layout.autoRect.h, 16 * scale, 'rgba(18, 20, 28, 0.68)');
  strokeRound(ctx, layout.autoRect.x + 0.5, layout.autoRect.y + 0.5, layout.autoRect.w - 1, layout.autoRect.h - 1, 16 * scale, 'rgba(148, 163, 184, 0.34)');
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `900 ${19 * scale}px ${FONTS.display}`;
  ctx.fillText('AI', layout.autoRect.x + layout.autoRect.w / 2, layout.autoRect.y + layout.autoRect.h / 2);

  if (state.scorePop) {
    ctx.fillStyle = '#fef08a';
    ctx.font = `900 ${24 * scale}px ${FONTS.mono}`;
    ctx.fillText('+90', layout.boardX + 20 * scale, layout.boardY - 12 * scale);
  }

  if (state.breakEvent) {
    ctx.fillStyle = '#fecaca';
    ctx.font = `900 ${26 * scale}px ${FONTS.display}`;
    ctx.fillText('BREAK x8', layout.stageX + layout.stageW / 2, layout.boardY - 8 * scale);
  }

  if (state.gameOver) {
    const panelW = Math.min(360 * scale, viewport.w - 40 * scale);
    const panelH = 120 * scale;
    fillRound(ctx, (viewport.w - panelW) / 2, layout.boardY + layout.boardH * 0.38, panelW, panelH, 14 * scale, 'rgba(44, 8, 10, 0.9)');
    strokeRound(ctx, (viewport.w - panelW) / 2 + 0.5, layout.boardY + layout.boardH * 0.38 + 0.5, panelW - 1, panelH - 1, 14 * scale, '#ef4444', 2);
    ctx.fillStyle = '#fecaca';
    ctx.font = `900 ${30 * scale}px ${FONTS.display}`;
    ctx.fillText('GAME OVER', viewport.w / 2, layout.boardY + layout.boardH * 0.38 + 48 * scale);
  }

  ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(layout.boardX, layout.boardY, layout.boardW, layout.boardH);
  ctx.setLineDash([]);
}

function drawMatrixCard(canvas: HTMLCanvasElement, viewport: ViewportSpec, state: StateSpec): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const previewScale = Math.min(1, 320 / viewport.w);
  const w = Math.round(viewport.w * previewScale);
  const h = Math.round(viewport.h * previewScale);
  fitCanvas(canvas, ctx, w, h);
  ctx.save();
  ctx.scale(previewScale, previewScale);
  ctx.fillStyle = '#05060b';
  ctx.fillRect(0, 0, viewport.w, viewport.h);
  drawHud(ctx, state, viewport);
  ctx.restore();
}

function createCard(viewport: ViewportSpec, state: StateSpec): HTMLElement {
  const card = document.createElement('article');
  card.className = 'responsive-card';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', `${viewport.w}x${viewport.h} ${state.title}`);
  const meta = document.createElement('p');
  meta.textContent = `${viewport.w}x${viewport.h} · ${state.title}`;
  card.append(canvas, meta);
  window.requestAnimationFrame(() => drawMatrixCard(canvas, viewport, state));
  return card;
}

export function mountResponsiveMatrix(root: HTMLElement): () => void {
  root.className = 'app app--ui-lab';
  root.replaceChildren();

  const page = document.createElement('main');
  page.className = 'responsive-matrix';
  const header = document.createElement('header');
  header.className = 'responsive-matrix__header';
  const title = document.createElement('h1');
  title.textContent = 'Responsive Matrix';
  const note = document.createElement('p');
  note.textContent = 'Reuses runtime stage layout to check HUD, board, Space, Auto, and feedback overlap at key sizes.';
  header.append(title, note);

  const grid = document.createElement('section');
  grid.className = 'responsive-matrix__grid';
  for (const state of STATES) {
    for (const viewport of VIEWPORTS) {
      grid.append(createCard(viewport, state));
    }
  }

  const checklist = document.createElement('section');
  checklist.className = 'responsive-matrix__checklist';
  checklist.innerHTML = `
    <h2>Manual Review Checklist</h2>
    <ul>
      <li>Score, Combo, and Lives do not collide at 360×640 and 390×844.</li>
      <li>Combo/score/break feedback does not cover more than one board row.</li>
      <li>Space appears only when available as a small key hint; AI tag stays secondary.</li>
      <li>Bottom pressure band and danger overlay show no seconds or row counts.</li>
      <li>Game Over panel does not block critical button hitboxes.</li>
    </ul>
  `;

  page.append(header, grid, checklist);
  root.append(page);
  return () => root.replaceChildren();
}
