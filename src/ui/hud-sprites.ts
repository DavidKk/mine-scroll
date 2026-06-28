import { getCachedImage } from './boot/asset-cache.ts';
import { HUD_BASE, HUD_ICON_BASE, HUD_ICON_NAMES } from './boot/asset-registry.ts';
import { drawImageContained, getGameCutout } from './game-assets.ts';

export { HUD_ICON_NAMES };

export type HudIconName = (typeof HUD_ICON_NAMES)[number];

export interface HudSprites {
  heartFull: HTMLImageElement;
  heartEmpty: HTMLImageElement;
  icons: Record<HudIconName, HTMLImageElement>;
}

let cached: HudSprites | null = null;

function imageOrNull(url: string): HTMLImageElement | null {
  return getCachedImage(url) ?? null;
}

function buildHudSpritesFromCache(): HudSprites | null {
  const heartFull = imageOrNull(`${HUD_BASE}/heart-full.png`);
  const heartEmpty = imageOrNull(`${HUD_BASE}/heart-empty.png`);
  if (!heartFull || !heartEmpty) return null;

  const icons = {} as Record<HudIconName, HTMLImageElement>;
  for (const name of HUD_ICON_NAMES) {
    const icon = imageOrNull(`${HUD_ICON_BASE}/${name}.png`);
    if (!icon) return null;
    icons[name] = icon;
  }

  return { heartFull, heartEmpty, icons };
}

export function loadHudSprites(): Promise<HudSprites | null> {
  if (cached) return Promise.resolve(cached);
  cached = buildHudSpritesFromCache();
  return Promise.resolve(cached);
}

export function getHudSprites(): HudSprites | null {
  return cached;
}

export function getHudIcon(name: HudIconName): HTMLImageElement | null {
  return cached?.icons[name] ?? null;
}

export interface DrawHudIconOptions {
  size?: number;
  alpha?: number;
  rotation?: number;
}

/** Draw a HUD icon; returns false if sprites unavailable. */
export function drawHudIcon(
  ctx: CanvasRenderingContext2D,
  name: HudIconName,
  x: number,
  y: number,
  options: DrawHudIconOptions = {},
): boolean {
  const img = getHudIcon(name);
  if (!img) return false;

  const size = options.size ?? 16;
  const alpha = options.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (options.rotation) {
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(options.rotation);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    ctx.drawImage(img, x, y, size, size);
  }
  ctx.restore();
  return true;
}

export interface LivesDisplay {
  current: number;
  max: number;
}

export function parseLivesDisplay(raw: string | undefined): LivesDisplay | null {
  if (!raw || !raw.includes('♥')) return null;
  const current = (raw.match(/♥/g) ?? []).length;
  const empty = (raw.match(/♡/g) ?? []).length;
  return { current, max: current + empty };
}

export function drawLivesRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lives: LivesDisplay,
  iconSize = 14,
  gap = 3,
): boolean {
  const full = getGameCutout('heart-full');
  const empty = getGameCutout('heart-empty');
  if (full && empty) {
    let cx = x;
    const cy = y - iconSize / 2;
    for (let i = 0; i < lives.max; i += 1) {
      drawImageContained(ctx, i < lives.current ? full : empty, cx, cy, iconSize, iconSize, 1.18);
      cx += iconSize + gap;
    }
    return true;
  }

  const sprites = getHudSprites();
  if (!sprites) return false;

  let cx = x;
  const cy = y - iconSize / 2;
  for (let i = 0; i < lives.max; i += 1) {
    const img = i < lives.current ? sprites.heartFull : sprites.heartEmpty;
    ctx.drawImage(img, cx, cy, iconSize, iconSize);
    cx += iconSize + gap;
  }
  return true;
}

/** Label row with optional leading icon (chip headers). */
export function drawChipLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  align: 'left' | 'center' | 'right',
  chipW: number,
  icon?: HudIconName,
): void {
  const iconSize = 11;
  const gap = 5;
  const textW = ctx.measureText(label).width;
  const blockW = icon ? iconSize + gap + textW : textW;

  let tx: number;
  if (align === 'left') {
    tx = x + 12;
    if (icon) drawHudIcon(ctx, icon, tx, y, { size: iconSize });
    tx += icon ? iconSize + gap : 0;
  } else if (align === 'right') {
    tx = x + chipW - 12 - blockW;
    if (icon) drawHudIcon(ctx, icon, tx, y, { size: iconSize });
    tx += icon ? iconSize + gap : 0;
  } else {
    tx = x + (chipW - blockW) / 2;
    if (icon) drawHudIcon(ctx, icon, tx, y, { size: iconSize });
    tx += icon ? iconSize + gap : 0;
  }

  ctx.fillText(label, tx, y);
}

/** Icon + text button content (Space / Auto / Retry). */
export function drawIconTextButton(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  icon: HudIconName,
  text: string,
  options: { iconSize?: number; font?: string; gap?: number; rotation?: number } = {},
): boolean {
  const iconSize = options.iconSize ?? 16;
  const gap = options.gap ?? 8;
  ctx.font = options.font ?? ctx.font;
  const textW = ctx.measureText(text).width;
  const totalW = iconSize + gap + textW;
  const startX = cx - totalW / 2;
  const iconY = cy - iconSize / 2;

  if (!drawHudIcon(ctx, icon, startX, iconY, { size: iconSize, rotation: options.rotation })) {
    return false;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, startX + iconSize + gap, cy);
  return true;
}
