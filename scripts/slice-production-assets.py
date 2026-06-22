#!/usr/bin/env python3
"""Slice generated production sheets into runtime game assets."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_DIR = ROOT / 'docs/design-assets/production'
PUBLIC_PRODUCTION_DIR = ROOT / 'public/assets/production'
OUT_DIR = ROOT / 'public/assets/game'
DOC_OUT_DIR = ROOT / 'docs/design-assets/sliced'

CORE_SRC = PRODUCTION_DIR / 'core-cutouts-production-v1.png'
FX_SRC = PRODUCTION_DIR / 'fx-additive-sprites-production-v1.png'
UI_SRC = PRODUCTION_DIR / 'ui-panels-production-v1.png'

CORE_NAMES = [
    'mine-standard',
    'mine-exploded',
    'mine-cracked',
    'mine-hit-flash',
    'flag-blue',
    'flag-danger-red',
    'flag-wrong-correction',
    'flag-pole',
    'heart-full',
    'heart-empty',
    'heart-lost',
    'heart-refill',
    'warning-triangle',
    'danger-exclamation',
    'shield-safe-zone',
    'chord-crosshair',
]

FX_ROWS = [
    'mine-explosion',
    'combo-burst',
    'safe-reveal',
    'flag-pop',
    'wrong-flag-break',
    'heart-refill',
    'level-up',
    'score-pop',
]

UI_PANELS = [
    ('space-active', (45, 55, 293, 111)),
    ('space-disabled', (383, 56, 276, 109)),
    ('auto-off', (712, 56, 113, 117)),
    ('auto-on', (861, 56, 116, 117)),
    ('start-panel', (45, 208, 364, 246)),
    ('ready-panel', (435, 210, 298, 244)),
    ('retry-button', (763, 369, 218, 84)),
    ('game-over-panel', (45, 492, 430, 269)),
    ('log-panel', (506, 486, 474, 280)),
    ('score-chip', (45, 798, 309, 132)),
    ('depth-chip', (372, 798, 251, 132)),
    ('lives-chip', (637, 798, 344, 132)),
    ('countdown-yellow', (47, 962, 143, 144)),
    ('countdown-orange', (220, 962, 143, 144)),
    ('countdown-red', (388, 962, 143, 144)),
    ('defused-chip', (562, 966, 150, 151)),
    ('heal-chip', (736, 966, 111, 151)),
    ('break-chip', (867, 966, 114, 151)),
    ('full-life-panel', (45, 1141, 379, 137)),
    ('row-one-chip', (470, 1121, 141, 170)),
    ('row-two-chip', (654, 1121, 141, 170)),
    ('row-five-chip', (837, 1121, 143, 170)),
    ('safe-number-badge', (45, 1328, 151, 150)),
    ('flag-badge', (237, 1328, 151, 150)),
    ('target-yellow-badge', (433, 1328, 151, 150)),
    ('target-purple-badge', (633, 1328, 151, 150)),
    ('warning-badge', (834, 1328, 151, 150)),
]

CORE_TARGET = 256
CHROMA = np.array([255, 0, 255], dtype=np.int16)


def ensure_dirs() -> None:
    for path in [
        OUT_DIR / 'cutouts',
        OUT_DIR / 'fx',
        OUT_DIR / 'ui',
        DOC_OUT_DIR / 'cutouts',
        DOC_OUT_DIR / 'fx',
        DOC_OUT_DIR / 'ui',
        PUBLIC_PRODUCTION_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def remove_chroma(img: Image.Image, threshold: int = 42) -> Image.Image:
    arr = np.array(img.convert('RGBA'), dtype=np.uint8)
    rgb = arr[:, :, :3].astype(np.int16)
    dist = np.abs(rgb - CHROMA).sum(axis=2)
    key = dist <= threshold
    arr[key, 3] = 0

    # soften near-key edge without eating bright red/orange effects
    near = (dist > threshold) & (dist <= threshold * 3)
    arr[near, 3] = np.minimum(arr[near, 3], ((dist[near] - threshold) * 255 // (threshold * 2)).astype(np.uint8))
    return Image.fromarray(arr, 'RGBA')


def content_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    arr = np.array(img.convert('RGBA'))
    alpha = arr[:, :, 3]
    mask = alpha > 18
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def normalize_cutout(img: Image.Image, target: int = CORE_TARGET) -> Image.Image:
    bbox = content_bbox(img)
    canvas = Image.new('RGBA', (target, target), (0, 0, 0, 0))
    if not bbox:
        return canvas

    crop = img.crop(bbox)
    max_size = target - 26
    scale = min(max_size / crop.width, max_size / crop.height, 1)
    fitted = crop.resize(
        (max(1, int(crop.width * scale)), max(1, int(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas.paste(fitted, ((target - fitted.width) // 2, (target - fitted.height) // 2), fitted)
    return canvas


def save_pair(img: Image.Image, public_path: Path, doc_path: Path) -> None:
    public_path.parent.mkdir(parents=True, exist_ok=True)
    doc_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(public_path, optimize=True)
    img.save(doc_path, optimize=True)


def slice_core_cutouts(manifest: dict[str, object]) -> None:
    if not CORE_SRC.exists():
        raise SystemExit(f'missing core cutout sheet: {CORE_SRC}')

    img = Image.open(CORE_SRC).convert('RGBA')
    # Source is 1254x1254, so crop to a clean 4x4 integer grid.
    grid_size = min(img.width, img.height)
    cell = grid_size // 4
    clean_size = cell * 4
    left = (img.width - clean_size) // 2
    top = (img.height - clean_size) // 2
    img = img.crop((left, top, left + clean_size, top + clean_size))

    entries: dict[str, str] = {}
    for index, name in enumerate(CORE_NAMES):
        row, col = divmod(index, 4)
        crop = img.crop((col * cell, row * cell, (col + 1) * cell, (row + 1) * cell))
        cutout = normalize_cutout(remove_chroma(crop))
        public_path = OUT_DIR / 'cutouts' / f'{name}.png'
        doc_path = DOC_OUT_DIR / 'cutouts' / f'{name}.png'
        save_pair(cutout, public_path, doc_path)
        entries[name] = '/' + public_path.relative_to(ROOT / 'public').as_posix()
        print('wrote', public_path.relative_to(ROOT))

    manifest['cutouts'] = {
        'source': str(CORE_SRC.relative_to(ROOT)),
        'grid': {'rows': 4, 'cols': 4, 'sourceCell': cell, 'outputSize': CORE_TARGET},
        'items': entries,
    }


def slice_fx_sprites(manifest: dict[str, object]) -> None:
    if not FX_SRC.exists():
        raise SystemExit(f'missing FX sprite sheet: {FX_SRC}')

    img = Image.open(FX_SRC).convert('RGBA')
    cols = 8
    rows = 8
    if img.width % cols != 0 or img.height % rows != 0:
        raise SystemExit(f'FX sheet is not divisible by {cols}x{rows}: {img.size}')

    frame_w = img.width // cols
    frame_h = img.height // rows
    effects: dict[str, object] = {}
    for row, effect in enumerate(FX_ROWS):
        frames: list[str] = []
        for col in range(cols):
            frame = img.crop((col * frame_w, row * frame_h, (col + 1) * frame_w, (row + 1) * frame_h))
            name = f'frame-{col + 1:02d}.png'
            public_path = OUT_DIR / 'fx' / effect / name
            doc_path = DOC_OUT_DIR / 'fx' / effect / name
            save_pair(frame, public_path, doc_path)
            frames.append('/' + public_path.relative_to(ROOT / 'public').as_posix())
            print('wrote', public_path.relative_to(ROOT))

        effects[effect] = {
            'frameWidth': frame_w,
            'frameHeight': frame_h,
            'frameCount': cols,
            'blendMode': 'lighter',
            'frames': frames,
        }

    manifest['fx'] = {
        'source': str(FX_SRC.relative_to(ROOT)),
        'grid': {'rows': rows, 'cols': cols, 'frameWidth': frame_w, 'frameHeight': frame_h},
        'effects': effects,
    }


def slice_ui_panels(manifest: dict[str, object]) -> None:
    if not UI_SRC.exists():
        raise SystemExit(f'missing UI panel sheet: {UI_SRC}')

    img = Image.open(UI_SRC).convert('RGBA')
    entries: dict[str, object] = {}
    for name, (x, y, w, h) in UI_PANELS:
        crop = img.crop((x, y, x + w, y + h))
        public_path = OUT_DIR / 'ui' / f'{name}.png'
        doc_path = DOC_OUT_DIR / 'ui' / f'{name}.png'
        save_pair(crop, public_path, doc_path)
        entries[name] = {
            'src': '/' + public_path.relative_to(ROOT / 'public').as_posix(),
            'width': w,
            'height': h,
            'sourceRect': {'x': x, 'y': y, 'w': w, 'h': h},
        }
        print('wrote', public_path.relative_to(ROOT))

    manifest['uiPanels'] = {
        'source': str(UI_SRC.relative_to(ROOT)),
        'items': entries,
    }


def make_panel_preview(manifest: dict[str, object]) -> tuple[Path, Path]:
    panel_items = manifest['uiPanels']['items']  # type: ignore[index]
    panel_names = list(panel_items.keys())  # type: ignore[union-attr]
    cell_w = 300
    cell_h = 160
    cols = 3
    rows = (len(panel_names) + cols - 1) // cols
    preview = Image.new('RGBA', (cols * cell_w, rows * cell_h), (8, 10, 18, 255))

    for index, name in enumerate(panel_names):
        item = panel_items[name]  # type: ignore[index]
        rel = item['src'].lstrip('/')  # type: ignore[index]
        img = Image.open(ROOT / 'public' / rel).convert('RGBA')
        max_w = cell_w - 22
        max_h = cell_h - 32
        scale = min(max_w / img.width, max_h / img.height, 1)
        fitted = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.Resampling.LANCZOS)
        x = (index % cols) * cell_w + (cell_w - fitted.width) // 2
        y = (index // cols) * cell_h + (cell_h - fitted.height) // 2
        preview.alpha_composite(fitted, (x, y))

    public_panel_preview = OUT_DIR / 'preview-ui-panels.png'
    doc_panel_preview = DOC_OUT_DIR / 'preview-ui-panels.png'
    save_pair(preview, public_panel_preview, doc_panel_preview)
    print('wrote', public_panel_preview.relative_to(ROOT))
    return public_panel_preview, doc_panel_preview


def make_previews(manifest: dict[str, object]) -> None:
    cutout_items = manifest['cutouts']['items']  # type: ignore[index]
    cutout_names = sorted(cutout_items)
    thumb = 96
    cols = 8
    rows = (len(cutout_names) + cols - 1) // cols
    cutout_preview = Image.new('RGBA', (cols * thumb, rows * thumb), (8, 10, 18, 255))
    for index, name in enumerate(cutout_names):
        rel = cutout_items[name].lstrip('/')  # type: ignore[index]
        img = Image.open(ROOT / 'public' / rel).convert('RGBA')
        img = img.resize((thumb, thumb), Image.Resampling.LANCZOS)
        cutout_preview.alpha_composite(img, ((index % cols) * thumb, (index // cols) * thumb))

    public_cutout_preview = OUT_DIR / 'preview-cutouts.png'
    doc_cutout_preview = DOC_OUT_DIR / 'preview-cutouts.png'
    save_pair(cutout_preview, public_cutout_preview, doc_cutout_preview)
    print('wrote', public_cutout_preview.relative_to(ROOT))

    effects = manifest['fx']['effects']  # type: ignore[index]
    effect_names = list(effects.keys())
    frame_w = manifest['fx']['grid']['frameWidth']  # type: ignore[index]
    frame_h = manifest['fx']['grid']['frameHeight']  # type: ignore[index]
    fx_cols = 4
    fx_rows = (len(effect_names) + fx_cols - 1) // fx_cols
    fx_preview = Image.new('RGBA', (fx_cols * frame_w, fx_rows * frame_h), (0, 0, 0, 255))
    for index, name in enumerate(effect_names):
        frames = effects[name]['frames']  # type: ignore[index]
        frame = frames[min(4, len(frames) - 1)]
        img = Image.open(ROOT / 'public' / frame.lstrip('/')).convert('RGBA')
        fx_preview.alpha_composite(img, ((index % fx_cols) * frame_w, (index // fx_cols) * frame_h))

    public_fx_preview = OUT_DIR / 'preview-fx.png'
    doc_fx_preview = DOC_OUT_DIR / 'preview-fx.png'
    save_pair(fx_preview, public_fx_preview, doc_fx_preview)
    print('wrote', public_fx_preview.relative_to(ROOT))

    public_panel_preview, _ = make_panel_preview(manifest)

    manifest['previews'] = {
        'cutouts': '/' + public_cutout_preview.relative_to(ROOT / 'public').as_posix(),
        'fx': '/' + public_fx_preview.relative_to(ROOT / 'public').as_posix(),
        'uiPanels': '/' + public_panel_preview.relative_to(ROOT / 'public').as_posix(),
    }


def main() -> None:
    ensure_dirs()
    manifest: dict[str, object] = {'version': 1}
    slice_core_cutouts(manifest)
    slice_fx_sprites(manifest)
    slice_ui_panels(manifest)
    make_previews(manifest)

    manifest_path = OUT_DIR / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (DOC_OUT_DIR / 'manifest.json').write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + '\n',
        encoding='utf-8',
    )
    print('wrote', manifest_path.relative_to(ROOT))


if __name__ == '__main__':
    main()
