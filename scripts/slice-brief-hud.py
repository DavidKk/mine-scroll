#!/usr/bin/env python3
"""Slice HUD icons from design-system-sheet-brief-v1.png (4×6 icon grid)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BRIEF = ROOT / 'docs/design-assets/reference/design-system-sheet-brief-v1.png'
OUT_ICONS = ROOT / 'public/assets/hud/icons'
OUT_HEARTS = ROOT / 'public/assets/hud'
ICON_SIZE = 32

# 682×1024 brief sheet — right-side icon grid
GRID = dict(x0=468, y0=28, x1=668, y1=330, cols=4, rows=6, pad=6)
ICON_NAMES = [
    'play', 'pause', 'settings', 'home',
    'volume-on', 'volume-off', 'info', 'help',
    'trophy', 'medal', 'target', 'stats',
    'refresh', 'undo', 'flag', 'wand',
    'timer', 'shield', 'heart', 'plus',
    'warning', 'skull', 'icon-extra-1', 'icon-extra-2',
]


def is_bg(r: int, g: int, b: int, a: int = 255) -> bool:
    return a < 10 or (r > 235 and g > 235 and b > 235)


def trim_transparent(img: Image.Image, pad: int = 2) -> Image.Image:
    arr = np.array(img.convert('RGBA'))
    mask = arr[:, :, 3] > 16
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return img
    x0, y0 = max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad)
    x1, y1 = min(arr.shape[1], int(xs.max()) + pad + 1), min(arr.shape[0], int(ys.max()) + pad + 1)
    return img.crop((x0, y0, x1, y1))


def center_icon(img: Image.Image, size: int = ICON_SIZE) -> Image.Image:
    trimmed = trim_transparent(img)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    tw, th = trimmed.size
    scale = min((size - 4) / tw, (size - 4) / th)
    nw, nh = max(1, int(tw * scale)), max(1, int(th * scale))
    fitted = trimmed.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((size - nw) // 2, (size - nh) // 2), fitted)
    return canvas


def slice_hearts_from_brief(img: Image.Image, size: int = ICON_SIZE) -> tuple[Image.Image, Image.Image]:
    """Extract 3D red heart from brief ICONS row; derive empty outline from its alpha."""
    region = img.crop((555, 185, 625, 250))
    arr = np.array(region.convert('RGBA'))
    mask = (
        (arr[:, :, 0].astype(int) - np.maximum(arr[:, :, 1], arr[:, :, 2]) > 25)
        & (arr[:, :, 0] > 140)
        & (arr[:, :, 3] > 128)
    )
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise RuntimeError('red heart not found in brief sheet')

    heart = region.crop((
        max(0, int(xs.min()) - 1),
        max(0, int(ys.min()) - 1),
        min(region.size[0], int(xs.max()) + 2),
        min(region.size[1], int(ys.max()) + 2),
    ))
    ha = np.array(heart.convert('RGBA'))
    for y in range(ha.shape[0]):
        for x in range(ha.shape[1]):
            r, g, b, a = ha[y, x]
            if a < 10 or (r > 235 and g > 235 and b > 235):
                ha[y, x, 3] = 0
    heart_full = center_icon(Image.fromarray(ha), size)

    alpha = np.array(heart_full.convert('RGBA'))[:, :, 3]
    h, w = alpha.shape
    edge = np.zeros((h, w), bool)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if alpha[y, x] < 20:
                continue
            patch = alpha[y - 1 : y + 2, x - 1 : x + 2]
            if patch.min() < alpha[y, x] - 30:
                edge[y, x] = True
    edge_img = Image.fromarray((edge * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    ea = np.array(edge_img) > 0
    empty = np.zeros((h, w, 4), dtype=np.uint8)
    empty[ea] = (100, 100, 110, 210)
    inner = (alpha > 40) & (alpha < 180)
    empty[inner] = (70, 70, 78, 70)
    heart_empty = center_icon(Image.fromarray(empty), size)
    return heart_full, heart_empty


def make_scroll_up_icon(size: int = ICON_SIZE) -> Image.Image:
    """Up chevron for Space scroll button (matches brief mock)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2 + 1
    color = (228, 228, 231)
    d.polygon([(cx, cy - 8), (cx - 9, cy + 4), (cx + 9, cy + 4)], fill=color)
    d.polygon([(cx, cy - 2), (cx - 9, cy + 10), (cx + 9, cy + 10)], fill=color)
    return img


def slice_grid(img: Image.Image) -> dict[str, Image.Image]:
    g = GRID
    rw, rh = g['x1'] - g['x0'], g['y1'] - g['y0']
    cw, ch = rw / g['cols'], rh / g['rows']
    tiles: dict[str, Image.Image] = {}
    for r in range(g['rows']):
        for c in range(g['cols']):
            idx = r * g['cols'] + c
            name = ICON_NAMES[idx]
            cx0 = int(g['x0'] + c * cw + g['pad'])
            cx1 = int(g['x0'] + (c + 1) * cw - g['pad'])
            cy0 = int(g['y0'] + r * ch + g['pad'])
            cy1 = int(g['y0'] + (r + 1) * ch - g['pad'])
            crop = img.crop((cx0, cy0, cx1, cy1))
            data = crop.convert('RGBA')
            px = data.load()
            cw2, ch2 = data.size
            for yy in range(ch2):
                for xx in range(cw2):
                    r0, g0, b0, a0 = px[xx, yy]
                    if is_bg(r0, g0, b0, a0):
                        px[xx, yy] = (r0, g0, b0, 0)
            tiles[name] = center_icon(data)
    return tiles


def main() -> None:
    if not BRIEF.exists():
        raise SystemExit(f'missing brief sheet: {BRIEF}')

    img = Image.open(BRIEF).convert('RGBA')
    OUT_ICONS.mkdir(parents=True, exist_ok=True)
    tiles = slice_grid(img)

    for name, icon in sorted(tiles.items()):
        path = OUT_ICONS / f'{name}.png'
        icon.save(path, optimize=True)
        print('wrote', path.relative_to(ROOT))

    heart_full, heart_empty = slice_hearts_from_brief(img)
    heart_full.save(OUT_HEARTS / 'heart-full.png', optimize=True)
    heart_empty.save(OUT_HEARTS / 'heart-empty.png', optimize=True)
    heart_full.save(OUT_ICONS / 'heart.png', optimize=True)
    tiles['heart'] = heart_full
    make_scroll_up_icon().save(OUT_ICONS / 'scroll-up.png', optimize=True)
    print('wrote', (OUT_ICONS / 'scroll-up.png').relative_to(ROOT))
    doc_hud = ROOT / 'docs/design-assets/hud'
    doc_hud.mkdir(parents=True, exist_ok=True)
    heart_full.save(doc_hud / 'heart-full.png', optimize=True)
    heart_empty.save(doc_hud / 'heart-empty.png', optimize=True)
    print('done', len(tiles), 'icons + 2 hearts')


if __name__ == '__main__':
    main()
