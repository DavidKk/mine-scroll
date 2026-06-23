#!/usr/bin/env python3
"""Slice generated production sheets into runtime game assets."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_DIR = ROOT / 'docs/design-assets/production'
OUT_DIR = ROOT / 'public/assets/game'
DOC_OUT_DIR = ROOT / 'docs/design-assets/sliced'

# Subset shipped in production build — keep in sync with src/ui/game-assets.ts
RUNTIME_CUTOUTS = frozenset({'mine-standard', 'flag-blue', 'heart-full', 'heart-empty'})
RUNTIME_FX = frozenset(
    {'mine-explosion', 'combo-burst', 'safe-reveal', 'flag-pop', 'wrong-flag-break', 'score-pop'}
)
RUNTIME_UI = frozenset({'start-panel', 'game-over-panel'})

CORE_SOURCES = [
    PRODUCTION_DIR / 'core-cutouts-production-v2.png',
    PRODUCTION_DIR / 'core-cutouts-production-v1.png',
]
FX_SOURCES = [
    PRODUCTION_DIR / 'fx-additive-sprites-production-v2.png',
    PRODUCTION_DIR / 'fx-additive-sprites-production-v1.png',
]
UI_SOURCES = [
    PRODUCTION_DIR / 'ui-panels-production-v2.png',
    PRODUCTION_DIR / 'ui-panels-production-v1.png',
]

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
    ('space-active', (12, 100, 328, 123)),
    ('space-disabled', (338, 100, 282, 123)),
    ('auto-off', (636, 104, 164, 116)),
    ('auto-on', (828, 104, 168, 116)),
    ('start-panel', (8, 252, 360, 348)),
    ('ready-panel', (370, 252, 254, 348)),
    ('retry-button', (672, 256, 296, 110)),
    ('game-over-panel', (622, 372, 396, 242)),
    ('log-panel', (8, 614, 432, 222)),
    ('score-chip', (444, 650, 178, 146)),
    ('depth-chip', (626, 650, 188, 146)),
    ('lives-chip', (814, 650, 188, 146)),
    ('countdown-yellow', (36, 838, 204, 214)),
    ('countdown-orange', (274, 838, 207, 214)),
    ('countdown-red', (516, 838, 207, 214)),
    ('defused-chip', (761, 839, 205, 212)),
    ('heal-chip', (10, 1070, 156, 146)),
    ('break-chip', (180, 1070, 154, 146)),
    ('full-life-panel', (342, 1070, 318, 146)),
    ('row-one-chip', (664, 1070, 112, 160)),
    ('row-two-chip', (775, 1070, 114, 160)),
    ('row-five-chip', (890, 1070, 116, 160)),
    ('safe-number-badge', (44, 1259, 166, 210)),
    ('flag-badge', (236, 1259, 166, 210)),
    ('target-yellow-badge', (426, 1259, 166, 210)),
    ('target-purple-badge', (611, 1259, 166, 210)),
    ('warning-badge', (804, 1260, 176, 210)),
]

CORE_TARGET = 256
CHROMA = np.array([255, 0, 255], dtype=np.int16)


def first_existing(paths: list[Path]) -> Path:
    for path in paths:
        if path.exists():
            return path
    return paths[0]


def ensure_dirs() -> None:
    for path in [
        OUT_DIR / 'cutouts',
        OUT_DIR / 'fx',
        OUT_DIR / 'ui',
        DOC_OUT_DIR / 'cutouts',
        DOC_OUT_DIR / 'fx',
        DOC_OUT_DIR / 'ui',
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


def save_outputs(img: Image.Image, public_path: Path | None, doc_path: Path) -> None:
    doc_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(doc_path, optimize=True)
    if public_path is not None:
        public_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(public_path, optimize=True)


def public_url(path: Path) -> str:
    return '/' + path.relative_to(ROOT / 'public').as_posix()


def design_url(path: Path) -> str:
    rel = path.relative_to(DOC_OUT_DIR)
    return f'/design-assets/sliced/{rel.as_posix()}'


def slice_core_cutouts(manifest: dict[str, object], runtime_manifest: dict[str, object]) -> None:
    core_src = first_existing(CORE_SOURCES)
    if not core_src.exists():
        raise SystemExit(f'missing core cutout sheet: {core_src}')

    img = Image.open(core_src).convert('RGBA')
    grid_size = min(img.width, img.height)
    cell = grid_size // 4
    clean_size = cell * 4
    left = (img.width - clean_size) // 2
    top = (img.height - clean_size) // 2
    img = img.crop((left, top, left + clean_size, top + clean_size))

    entries: dict[str, str] = {}
    runtime_entries: dict[str, str] = {}
    for index, name in enumerate(CORE_NAMES):
        row, col = divmod(index, 4)
        crop = img.crop((col * cell, row * cell, (col + 1) * cell, (row + 1) * cell))
        cutout = normalize_cutout(remove_chroma(crop))
        doc_path = DOC_OUT_DIR / 'cutouts' / f'{name}.png'
        public_path = OUT_DIR / 'cutouts' / f'{name}.png' if name in RUNTIME_CUTOUTS else None
        save_outputs(cutout, public_path, doc_path)
        entries[name] = design_url(doc_path)
        if public_path is not None:
            runtime_entries[name] = public_url(public_path)
            print('wrote runtime', public_path.relative_to(ROOT))
        print('wrote', doc_path.relative_to(ROOT))

    meta = {
        'source': str(core_src.relative_to(ROOT)),
        'grid': {'rows': 4, 'cols': 4, 'sourceCell': cell, 'outputSize': CORE_TARGET},
        'items': entries,
    }
    manifest['cutouts'] = meta
    runtime_manifest['cutouts'] = {**meta, 'items': runtime_entries}


def slice_fx_sprites(manifest: dict[str, object], runtime_manifest: dict[str, object]) -> None:
    fx_src = first_existing(FX_SOURCES)
    if not fx_src.exists():
        raise SystemExit(f'missing FX sprite sheet: {fx_src}')

    img = Image.open(fx_src).convert('RGBA')
    cols = 8
    rows = 8
    if img.width % cols != 0 or img.height % rows != 0:
        raise SystemExit(f'FX sheet is not divisible by {cols}x{rows}: {img.size}')

    frame_w = img.width // cols
    frame_h = img.height // rows
    effects: dict[str, object] = {}
    runtime_effects: dict[str, object] = {}
    for row, effect in enumerate(FX_ROWS):
        frames: list[str] = []
        runtime_frames: list[str] = []
        for col in range(cols):
            frame = img.crop((col * frame_w, row * frame_h, (col + 1) * frame_w, (row + 1) * frame_h))
            name = f'frame-{col + 1:02d}.png'
            doc_path = DOC_OUT_DIR / 'fx' / effect / name
            public_path = OUT_DIR / 'fx' / effect / name if effect in RUNTIME_FX else None
            save_outputs(frame, public_path, doc_path)
            frames.append(design_url(doc_path))
            if public_path is not None:
                runtime_frames.append(public_url(public_path))
                print('wrote runtime', public_path.relative_to(ROOT))
            print('wrote', doc_path.relative_to(ROOT))

        effect_meta = {
            'frameWidth': frame_w,
            'frameHeight': frame_h,
            'frameCount': cols,
            'blendMode': 'lighter',
            'frames': frames,
        }
        effects[effect] = effect_meta
        if effect in RUNTIME_FX:
            runtime_effects[effect] = {**effect_meta, 'frames': runtime_frames}

    fx_meta = {
        'source': str(fx_src.relative_to(ROOT)),
        'grid': {'rows': rows, 'cols': cols, 'frameWidth': frame_w, 'frameHeight': frame_h},
        'effects': effects,
    }
    manifest['fx'] = fx_meta
    runtime_manifest['fx'] = {**fx_meta, 'effects': runtime_effects}


def slice_ui_panels(manifest: dict[str, object], runtime_manifest: dict[str, object]) -> None:
    ui_src = first_existing(UI_SOURCES)
    if not ui_src.exists():
        raise SystemExit(f'missing UI panel sheet: {ui_src}')

    img = Image.open(ui_src).convert('RGBA')
    entries: dict[str, object] = {}
    runtime_entries: dict[str, object] = {}
    for name, (x, y, w, h) in UI_PANELS:
        crop = img.crop((x, y, x + w, y + h))
        doc_path = DOC_OUT_DIR / 'ui' / f'{name}.png'
        public_path = OUT_DIR / 'ui' / f'{name}.png' if name in RUNTIME_UI else None
        save_outputs(crop, public_path, doc_path)
        item = {
            'src': design_url(doc_path),
            'width': w,
            'height': h,
            'sourceRect': {'x': x, 'y': y, 'w': w, 'h': h},
        }
        entries[name] = item
        if public_path is not None:
            runtime_entries[name] = {**item, 'src': public_url(public_path)}
            print('wrote runtime', public_path.relative_to(ROOT))
        print('wrote', doc_path.relative_to(ROOT))

    ui_meta = {
        'source': str(ui_src.relative_to(ROOT)),
        'items': entries,
    }
    manifest['uiPanels'] = ui_meta
    runtime_manifest['uiPanels'] = {**ui_meta, 'items': runtime_entries}


def make_panel_preview(manifest: dict[str, object]) -> Path:
    panel_items = manifest['uiPanels']['items']  # type: ignore[index]
    panel_names = list(panel_items.keys())  # type: ignore[union-attr]
    cell_w = 300
    cell_h = 160
    cols = 3
    rows = (len(panel_names) + cols - 1) // cols
    preview = Image.new('RGBA', (cols * cell_w, rows * cell_h), (8, 10, 18, 255))

    for index, name in enumerate(panel_names):
        item = panel_items[name]  # type: ignore[index]
        src = item['src']  # type: ignore[index]
        rel = src.removeprefix('/design-assets/sliced/')
        img = Image.open(DOC_OUT_DIR / rel).convert('RGBA')
        max_w = cell_w - 22
        max_h = cell_h - 32
        scale = min(max_w / img.width, max_h / img.height, 1)
        fitted = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.Resampling.LANCZOS)
        x = (index % cols) * cell_w + (cell_w - fitted.width) // 2
        y = (index // cols) * cell_h + (cell_h - fitted.height) // 2
        preview.alpha_composite(fitted, (x, y))

    doc_panel_preview = DOC_OUT_DIR / 'preview-ui-panels.png'
    preview.save(doc_panel_preview, optimize=True)
    print('wrote', doc_panel_preview.relative_to(ROOT))
    return doc_panel_preview


def make_previews(manifest: dict[str, object]) -> None:
    cutout_items = manifest['cutouts']['items']  # type: ignore[index]
    cutout_names = sorted(cutout_items)
    thumb = 96
    cols = 8
    rows = (len(cutout_names) + cols - 1) // cols
    cutout_preview = Image.new('RGBA', (cols * thumb, rows * thumb), (8, 10, 18, 255))
    for index, name in enumerate(cutout_names):
        src = cutout_items[name]  # type: ignore[index]
        rel = src.removeprefix('/design-assets/sliced/')
        img = Image.open(DOC_OUT_DIR / rel).convert('RGBA')
        img = img.resize((thumb, thumb), Image.Resampling.LANCZOS)
        cutout_preview.alpha_composite(img, ((index % cols) * thumb, (index // cols) * thumb))

    doc_cutout_preview = DOC_OUT_DIR / 'preview-cutouts.png'
    cutout_preview.save(doc_cutout_preview, optimize=True)
    print('wrote', doc_cutout_preview.relative_to(ROOT))

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
        rel = frame.removeprefix('/design-assets/sliced/')
        img = Image.open(DOC_OUT_DIR / rel).convert('RGBA')
        fx_preview.alpha_composite(img, ((index % fx_cols) * frame_w, (index // fx_cols) * frame_h))

    doc_fx_preview = DOC_OUT_DIR / 'preview-fx.png'
    fx_preview.save(doc_fx_preview, optimize=True)
    print('wrote', doc_fx_preview.relative_to(ROOT))

    doc_panel_preview = make_panel_preview(manifest)

    manifest['previews'] = {
        'cutouts': design_url(doc_cutout_preview),
        'fx': design_url(doc_fx_preview),
        'uiPanels': design_url(doc_panel_preview),
    }


def main() -> None:
    ensure_dirs()
    manifest: dict[str, object] = {'version': 1}
    runtime_manifest: dict[str, object] = {'version': 1}
    slice_core_cutouts(manifest, runtime_manifest)
    slice_fx_sprites(manifest, runtime_manifest)
    slice_ui_panels(manifest, runtime_manifest)
    make_previews(manifest)

    runtime_path = OUT_DIR / 'manifest.json'
    runtime_path.write_text(json.dumps(runtime_manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    doc_manifest_path = DOC_OUT_DIR / 'manifest.json'
    doc_manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('wrote', runtime_path.relative_to(ROOT))
    print('wrote', doc_manifest_path.relative_to(ROOT))


if __name__ == '__main__':
    main()
