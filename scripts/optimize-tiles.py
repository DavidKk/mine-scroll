#!/usr/bin/env python3
"""Normalize sliced tiles and repair num-7 missing left border."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / 'docs/design-assets/tiles'
REF_SHEET = ROOT / 'docs/design-assets/reference/tile-sprite-sheet-v1.png'
OUT_DIR = ROOT / 'game/public/assets/tiles'
TARGET = 128
# Top icon row vs number strip (gap ~329–431 on 1024×682 sheet)
TOP_ROW_Y = (100, 335)
NUMBER_ROW_Y = (431, 558)


def content_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    arr = np.array(img.convert('RGBA'))
    mask = arr[:, :, 3] > 16
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def center_on_canvas(tile: Image.Image, target: int = TARGET) -> Image.Image:
    canvas = Image.new('RGBA', (target, target), (0, 0, 0, 0))
    tw, th = tile.size
    canvas.paste(tile, ((target - tw) // 2, (target - th) // 2), tile)
    return canvas


def place_without_stretch(tile: Image.Image, target: int = TARGET) -> Image.Image:
    """Trim to content bbox, shrink uniformly if needed, center — no ref-bbox stretch."""
    bb = content_bbox(tile)
    content = tile.crop(bb) if bb else tile
    cw, ch = content.size
    scale = min(1.0, target / cw, target / ch)
    if scale < 1.0:
        content = content.resize(
            (max(1, int(cw * scale)), max(1, int(ch * scale))),
            Image.Resampling.LANCZOS,
        )
    return center_on_canvas(content)


def repair_num7_border(num7: Image.Image, num1: Image.Image) -> Image.Image:
    """Copy num-1 left frame highlight onto num-7 dark border cells."""
    a = np.array(num7.convert('RGBA'), dtype=np.uint8)
    b = np.array(num1.convert('RGBA'), dtype=np.uint8)
    h = a.shape[0]
    # pink digit on num-7 is roughly R>120 and G<100
    for x in range(7):
        for y in range(h):
            r, g, bl, al = a[y, x]
            if al < 16:
                continue
            if r > 120 and g < 100 and bl > 80:
                continue
            br, bg, bb, bal = b[y, x]
            if bal > 16:
                a[y, x] = b[y, x]
    return Image.fromarray(a)


def reslice_from_sheet() -> dict[str, Image.Image]:
    """Re-slice source sheet with symmetric number padding."""
    img = Image.open(REF_SHEET).convert('RGBA')
    arr = np.array(img)
    h, w = arr.shape[:2]

    def is_bg(r: int, g: int, b: int, a: int = 255) -> bool:
        return a < 10 or (230 <= r <= 255 and 230 <= g <= 255 and 230 <= b <= 255)

    mask = np.zeros((h, w), dtype=bool)
    for y in range(h):
        for x in range(w):
            r, g, b, a = arr[y, x]
            mask[y, x] = not is_bg(r, g, b, a)

    tiles: dict[str, Image.Image] = {}
    top_names = ['cell-hidden', 'cell-revealed', 'mine', 'flag']
    top_segs = [(37, 254), (298, 512), (555, 764), (822, 976)]

    def tight_crop(x0: int, x1: int, y0: int, y1: int, pad: int = 6) -> Image.Image:
        sub = mask[y0:y1, x0:x1]
        ys, xs = np.where(sub)
        if len(xs) == 0:
            return img.crop((x0, y0, x1, y1))
        lx0, ly0 = max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad)
        lx1, ly1 = min(x1 - x0, int(xs.max()) + pad + 1), min(y1 - y0, int(ys.max()) + pad + 1)
        crop = img.crop((x0 + lx0, y0 + ly0, x0 + lx1, y0 + ly1))
        data = crop.convert('RGBA')
        px = data.load()
        cw, ch = data.size
        for yy in range(ch):
            for xx in range(cw):
                r, g, b, a = px[xx, yy]
                if is_bg(r, g, b, a):
                    px[xx, yy] = (r, g, b, 0)
        return data

    y0, y1 = NUMBER_ROW_Y
    top_y0, top_y1 = TOP_ROW_Y
    for name, (x0, x1) in zip(top_names, top_segs, strict=True):
        tiles[name] = tight_crop(x0, x1, top_y0, top_y1)

    x_start, x_end = 22, 1002
    cell_w = (x_end - x_start) / 8
    for i in range(8):
        cx0 = int(x_start + i * cell_w)
        cx1 = int(x_start + (i + 1) * cell_w)
        tiles[f'num-{i + 1}'] = tight_crop(cx0, cx1, y0, y1, pad=4)

    return tiles


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tiles = reslice_from_sheet() if REF_SHEET.exists() else {
        p.stem: Image.open(p) for p in SRC_DIR.glob('*.png')
    }

    for name, image in list(tiles.items()):
        tiles[name] = place_without_stretch(image)

    if 'num-7' in tiles and 'num-1' in tiles:
        tiles['num-7'] = repair_num7_border(tiles['num-7'], tiles['num-1'])

    for name, image in sorted(tiles.items()):
        out = OUT_DIR / f'{name}.png'
        image.save(out, optimize=True)
        print('wrote', out.relative_to(ROOT))

    # mirror to docs for designers
    doc_out = SRC_DIR
    for name, image in tiles.items():
        image.save(doc_out / f'{name}.png', optimize=True)

    print('done', len(tiles), 'tiles ->', OUT_DIR.relative_to(ROOT))


if __name__ == '__main__':
    main()
