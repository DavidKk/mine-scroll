#!/usr/bin/env python3
"""Rebuild game/public/assets/game/preview-*.png from manifest.json."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GAME_DIR = ROOT / 'game/public/assets/game'
MANIFEST = GAME_DIR / 'manifest.json'
FX_W, FX_H = 192, 128


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())

    cutout_names = [
        'mine-standard',
        'mine-exploded',
        'mine-cracked',
        'flag-blue',
        'heart-full',
        'heart-empty',
    ]
    cutouts = manifest['cutouts']['items']
    cutout_preview = Image.new('RGBA', (96 * len(cutout_names), 96), (8, 10, 18, 255))
    for i, name in enumerate(cutout_names):
        src = cutouts[name]
        img = Image.open(ROOT / 'public' / src.lstrip('/')).convert('RGBA')
        img = img.resize((96, 96), Image.Resampling.LANCZOS)
        cutout_preview.alpha_composite(img, (i * 96, 0))
    cutout_preview.save(GAME_DIR / 'preview-cutouts.png')

    effects = manifest['fx']['effects']
    fx_preview = Image.new('RGBA', (FX_W * len(effects), FX_H), (0, 0, 0, 255))
    for i, effect in enumerate(effects.values()):
        frames = effect['frames']
        mid = frames[min(4, len(frames) - 1)]
        img = Image.open(ROOT / 'public' / mid.lstrip('/')).convert('RGBA')
        fx_preview.alpha_composite(img, (i * FX_W, 0))
    fx_preview.save(GAME_DIR / 'preview-fx.png')

    ui_items = list(manifest['uiPanels']['items'].items())
    panel_preview = Image.new('RGBA', (920, 420), (8, 10, 18, 255))
    for idx, (_, item) in enumerate(ui_items):
        img = Image.open(ROOT / 'public' / item['src'].lstrip('/')).convert('RGBA')
        scale = min(280 / img.width, 180 / img.height, 1.0)
        if scale < 1:
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)
        panel_preview.alpha_composite(img, (20 + (idx % 2) * 420, 20 + (idx // 2) * 200))
    panel_preview.save(GAME_DIR / 'preview-ui-panels.png')

    print('Regenerated preview-cutouts.png, preview-fx.png, preview-ui-panels.png')


if __name__ == '__main__':
    main()
