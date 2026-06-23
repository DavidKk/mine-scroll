#!/usr/bin/env python3
"""Normalize sliced tiles and slice board runtime assets."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / 'docs/design-assets/tiles'
REF_SHEET = ROOT / 'docs/design-assets/reference/tile-sprite-sheet-v1.png'
RUNTIME_SHEETS = [
    ROOT / 'docs/design-assets/production/tile-runtime-production-v4-512x640.png',
    ROOT / 'docs/design-assets/production/tile-runtime-production-v3-512x640.png',
    ROOT / 'docs/design-assets/production/tile-runtime-production-v2-512x640.png',
]
OUT_DIR = ROOT / 'public/assets/tiles'
PUBLIC_CUTOUT_DIR = ROOT / 'public/assets/game/cutouts'
DOC_CUTOUT_DIR = ROOT / 'docs/design-assets/sliced/cutouts'
RUNTIME_MANIFEST = ROOT / 'public/assets/game/manifest.json'
DOC_MANIFEST = ROOT / 'docs/design-assets/sliced/manifest.json'
TARGET = 128
ICON_NAMES = ('cell-hidden', 'cell-revealed', 'mine', 'flag')
NUM_REF = 'num-1'
# Top icon row vs number strip (gap ~329–431 on 1024×682 sheet)
TOP_ROW_Y = (100, 335)
NUMBER_ROW_Y = (431, 558)

RUNTIME_TILE_NAMES = {
    'cell-hidden',
    'cell-revealed',
    *(f'digit-{i}' for i in range(1, 9)),
}

RUNTIME_CUTOUT_NAMES = {
    'mine-standard',
    'mine-cracked',
    'flag-pole',
    'flag-cloth',
    'flag-blue',
    'chord-crosshair',
    'scan-strip',
    'spark-blue',
    'spark-red',
    'spark-amber',
}

RUNTIME_SHEET_V2_CELLS = [
    'cell-hidden',
    'cell-revealed',
    'digit-1',
    'digit-2',
    'digit-3',
    'digit-4',
    'digit-5',
    'digit-6',
    'digit-7',
    'digit-8',
    'mine-standard',
    'mine-cracked',
    'flag-pole',
    'flag-cloth',
    'flag-blue',
    'chord-crosshair',
    'scan-strip',
    'spark-blue',
    'spark-red',
    'spark-amber',
]


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


def public_url(path: Path) -> str:
    return '/' + path.relative_to(ROOT / 'public').as_posix()


def design_url(path: Path) -> str:
    return '/design-assets/sliced/' + path.relative_to(ROOT / 'docs/design-assets/sliced').as_posix()


def read_manifest(path: Path) -> dict[str, object]:
    if not path.exists():
        return {'version': 1}
    return json.loads(path.read_text(encoding='utf-8'))


def write_manifest(path: Path, manifest: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def merge_cutout_manifest(runtime_entries: dict[str, str], doc_entries: dict[str, str]) -> None:
    runtime_manifest = read_manifest(RUNTIME_MANIFEST)
    runtime_cutouts = runtime_manifest.setdefault('cutouts', {})
    if isinstance(runtime_cutouts, dict):
        runtime_items = runtime_cutouts.setdefault('items', {})
        if isinstance(runtime_items, dict):
            runtime_items.update(runtime_entries)
        runtime_cutouts['source'] = str(get_runtime_sheet().relative_to(ROOT))
        runtime_cutouts['grid'] = {'rows': 5, 'cols': 4, 'sourceCell': TARGET, 'outputSize': TARGET}
    write_manifest(RUNTIME_MANIFEST, runtime_manifest)

    doc_manifest = read_manifest(DOC_MANIFEST)
    doc_cutouts = doc_manifest.setdefault('cutouts', {})
    if isinstance(doc_cutouts, dict):
        doc_items = doc_cutouts.setdefault('items', {})
        if isinstance(doc_items, dict):
            doc_items.update(doc_entries)
        doc_cutouts['source'] = str(get_runtime_sheet().relative_to(ROOT))
        doc_cutouts['grid'] = {'rows': 5, 'cols': 4, 'sourceCell': TARGET, 'outputSize': TARGET}
    write_manifest(DOC_MANIFEST, doc_manifest)


def get_runtime_sheet() -> Path:
    for sheet in RUNTIME_SHEETS:
        if sheet.exists():
            return sheet
    return RUNTIME_SHEETS[0]


def trim_generated_cell(crop: Image.Image, inset: int = 4) -> Image.Image:
    """Remove generated grid lines from a fixed cell and restore it to 128px."""
    inner = crop.crop((inset, inset, TARGET - inset, TARGET - inset))
    canvas = Image.new('RGBA', (TARGET, TARGET), (0, 0, 0, 0))
    fitted = inner.resize((TARGET - inset * 2, TARGET - inset * 2), Image.Resampling.LANCZOS)
    canvas.paste(fitted, (inset, inset), fitted)
    return canvas


def clear_cell_guides(img: Image.Image, edge: int = 20) -> Image.Image:
    arr = np.array(img.convert('RGBA'), dtype=np.uint8)
    arr[:edge, :, 3] = 0
    arr[-edge:, :, 3] = 0
    arr[:, :edge, 3] = 0
    arr[:, -edge:, 3] = 0
    return Image.fromarray(arr)


def normalize_generated_asset(img: Image.Image, max_ratio: float, clear_guides: bool = True) -> Image.Image:
    clean = clear_cell_guides(img) if clear_guides else img.convert('RGBA')
    bbox = content_bbox(clean)
    canvas = Image.new('RGBA', (TARGET, TARGET), (0, 0, 0, 0))
    if not bbox:
        return canvas
    crop = clean.crop(bbox)
    max_size = int(TARGET * max_ratio)
    scale = min(max_size / crop.width, max_size / crop.height, 1)
    fitted = crop.resize(
        (max(1, int(crop.width * scale)), max(1, int(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas.paste(fitted, ((TARGET - fitted.width) // 2, (TARGET - fitted.height) // 2), fitted)
    return canvas


def tint_asset(img: Image.Image, rgb: tuple[int, int, int], strength: float = 0.84) -> Image.Image:
    arr = np.array(img.convert('RGBA'), dtype=np.uint8)
    alpha = arr[:, :, 3].astype(np.float32) / 255
    lit = np.max(arr[:, :, :3], axis=2).astype(np.float32) / 255
    target = np.array(rgb, dtype=np.float32)
    shaded = target[None, None, :] * (0.45 + lit[:, :, None] * 0.75)
    arr[:, :, :3] = np.where(
        alpha[:, :, None] > 0,
        arr[:, :, :3].astype(np.float32) * (1 - strength) + shaded * strength,
        arr[:, :, :3],
    ).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def postprocess_runtime_cell(name: str, crop: Image.Image) -> Image.Image:
    if name in {'cell-hidden', 'cell-revealed'}:
        return normalize_generated_asset(crop, 0.96, clear_guides=False)
    if name.startswith('spark-'):
        return normalize_generated_asset(crop, 0.38)
    if name == 'scan-strip':
        return normalize_generated_asset(crop, 0.86)
    if name.startswith('digit-'):
        return normalize_generated_asset(crop, 0.84, clear_guides=False)
    if name in {'flag-pole', 'flag-cloth', 'flag-blue'}:
        return normalize_generated_asset(crop, 0.9, clear_guides=False)
    if name in {'mine-standard', 'mine-cracked'}:
        return normalize_generated_asset(crop, 0.88, clear_guides=False)
    return normalize_generated_asset(crop, 0.86)


def slice_runtime_sheet() -> dict[str, Image.Image]:
    sheet = get_runtime_sheet()
    img = Image.open(sheet).convert('RGBA')
    if img.size != (TARGET * 4, TARGET * 5):
        img = img.resize((TARGET * 4, TARGET * 5), Image.Resampling.LANCZOS)

    tiles: dict[str, Image.Image] = {}
    runtime_cutout_entries: dict[str, str] = {}
    doc_cutout_entries: dict[str, str] = {}
    PUBLIC_CUTOUT_DIR.mkdir(parents=True, exist_ok=True)
    DOC_CUTOUT_DIR.mkdir(parents=True, exist_ok=True)

    for index, name in enumerate(RUNTIME_SHEET_V2_CELLS):
        row, col = divmod(index, 4)
        crop = img.crop((col * TARGET, row * TARGET, (col + 1) * TARGET, (row + 1) * TARGET))
        crop = postprocess_runtime_cell(name, trim_generated_cell(crop))
        if name in RUNTIME_TILE_NAMES:
            tiles[name] = crop
            continue

        if name in RUNTIME_CUTOUT_NAMES:
            public_path = PUBLIC_CUTOUT_DIR / f'{name}.png'
            doc_path = DOC_CUTOUT_DIR / f'{name}.png'
            crop.save(public_path, optimize=True)
            crop.save(doc_path, optimize=True)
            runtime_cutout_entries[name] = public_url(public_path)
            doc_cutout_entries[name] = design_url(doc_path)
            print('wrote', public_path.relative_to(ROOT))
            print('wrote', doc_path.relative_to(ROOT))

    merge_cutout_manifest(runtime_cutout_entries, doc_cutout_entries)
    return tiles


def normalize_to_ref_bbox(tile: Image.Image, ref_bbox: tuple[int, int, int, int]) -> Image.Image:
    x0, y0, x1, y1 = ref_bbox
    tw, th = x1 - x0, y1 - y0
    fitted = tile.resize((tw, th), Image.Resampling.LANCZOS)
    return center_on_canvas(fitted)


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
    use_runtime_sheet = get_runtime_sheet().exists()
    tiles = slice_runtime_sheet() if use_runtime_sheet else reslice_from_sheet() if REF_SHEET.exists() else {
        p.stem: Image.open(p) for p in SRC_DIR.glob('*.png')
    }

    ref_bb = None
    if not use_runtime_sheet:
        ref = tiles.get(NUM_REF) or Image.open(SRC_DIR / f'{NUM_REF}.png')
        ref_bb = content_bbox(ref)
        if not ref_bb:
            raise SystemExit('missing num-1 reference bbox')

    if ref_bb:
        for name in ICON_NAMES:
            if name in tiles:
                tiles[name] = normalize_to_ref_bbox(tiles[name], ref_bb)

    for i in range(1, 9):
        key = f'num-{i}'
        if key in tiles:
            tiles[key] = center_on_canvas(tiles[key])

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
