#!/usr/bin/env python3
"""Generate modern gameplay tile/cutout/FX assets for the asset gallery and runtime."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_TILES = ROOT / 'public/assets/tiles'
DOC_TILES = ROOT / 'docs/design-assets/tiles'
GAME_DIR = ROOT / 'public/assets/game'
DOC_SLICED = ROOT / 'docs/design-assets/sliced'
MANIFEST = GAME_DIR / 'manifest.json'

TILE = 128
CUTOUT = 256
FX_W = 192
FX_H = 128

DIGIT_COLORS = {
    1: (96, 165, 250, 255),
    2: (52, 211, 153, 255),
    3: (248, 113, 113, 255),
    4: (167, 139, 250, 255),
    5: (251, 113, 133, 255),
    6: (34, 211, 238, 255),
    7: (250, 204, 21, 255),
    8: (248, 250, 252, 255),
}

SEGMENTS = {
    1: 'bc',
    2: 'abged',
    3: 'abgcd',
    4: 'fgbc',
    5: 'afgcd',
    6: 'afgecd',
    7: 'abc',
    8: 'abcdefg',
}


def ensure_dirs() -> None:
    for path in [
        PUBLIC_TILES,
        DOC_TILES,
        GAME_DIR / 'cutouts',
        GAME_DIR / 'fx',
        DOC_SLICED / 'cutouts',
        DOC_SLICED / 'fx',
    ]:
        path.mkdir(parents=True, exist_ok=True)


def save_pair(img: Image.Image, public_path: Path, doc_path: Path | None = None) -> None:
    public_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(public_path, optimize=True)
    if doc_path:
        doc_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(doc_path, optimize=True)
    print('wrote', public_path.relative_to(ROOT))


def rounded_rect_mask(size: int, rect: tuple[int, int, int, int], radius: int) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(rect, radius=radius, fill=255)
    return mask


def vertical_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        color = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        for x in range(size):
            px[x, y] = color
    return img


def alpha_glow(src: Image.Image, color: tuple[int, int, int], blur: int, alpha: int) -> Image.Image:
    mask = src.getchannel('A').filter(ImageFilter.GaussianBlur(blur))
    glow = Image.new('RGBA', src.size, color + (0,))
    glow.putalpha(mask.point(lambda p: min(alpha, p)))
    return glow


def draw_hidden_cell(size: int = TILE) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    rect = (7, 7, size - 7, size - 7)
    mask = rounded_rect_mask(size, rect, 15)
    base = vertical_gradient(size, (44, 70, 132), (9, 18, 40))
    img.alpha_composite(alpha_glow(Image.merge('RGBA', (*base.split()[:3], mask)), (56, 189, 248), 10, 120))
    img.paste(base, (0, 0), mask)

    d = ImageDraw.Draw(img, 'RGBA')
    d.rounded_rectangle(rect, radius=15, outline=(125, 211, 252, 130), width=2)
    d.rounded_rectangle((13, 13, size - 13, size - 54), radius=10, fill=(255, 255, 255, 18))
    d.rounded_rectangle((18, 18, size - 18, size - 18), radius=11, outline=(255, 255, 255, 22), width=1)
    d.line((16, size - 20, size - 17, size - 20), fill=(0, 0, 0, 64), width=2)
    return img


def draw_revealed_cell(size: int = TILE) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    rect = (8, 8, size - 8, size - 8)
    mask = rounded_rect_mask(size, rect, 14)
    base = vertical_gradient(size, (29, 42, 69), (11, 18, 31))
    img.paste(base, (0, 0), mask)

    d = ImageDraw.Draw(img, 'RGBA')
    d.rounded_rectangle(rect, radius=14, outline=(148, 163, 184, 88), width=2)
    d.rounded_rectangle((17, 17, size - 17, size - 17), radius=9, outline=(0, 0, 0, 62), width=2)
    for i in range(3):
        off = 29 + i * 23
        d.line((off, 22, off, size - 22), fill=(255, 255, 255, 10), width=1)
        d.line((22, off, size - 22, off), fill=(255, 255, 255, 10), width=1)
    return img


def segment_rects(size: int) -> dict[str, tuple[int, int, int, int]]:
    x0, x1 = 35, size - 35
    y0, y1, y2 = 25, 57, 89
    thick = 13
    return {
        'a': (x0, y0, x1, y0 + thick),
        'g': (x0, y1, x1, y1 + thick),
        'd': (x0, y2, x1, y2 + thick),
        'f': (x0 - 8, y0 + 7, x0 + thick - 8, y1 + 9),
        'b': (x1 - thick + 8, y0 + 7, x1 + 8, y1 + 9),
        'e': (x0 - 8, y1 + 7, x0 + thick - 8, y2 + 9),
        'c': (x1 - thick + 8, y1 + 7, x1 + 8, y2 + 9),
    }


def draw_digit_tile(n: int) -> Image.Image:
    img = draw_revealed_cell()
    glyph = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(glyph, 'RGBA')
    color = DIGIT_COLORS[n]
    off_color = (color[0], color[1], color[2], 28)

    for name, rect in segment_rects(TILE).items():
        active = name in SEGMENTS[n]
        d.rounded_rectangle(rect, radius=7, fill=color if active else off_color)

    glow = alpha_glow(glyph, color[:3], 8, 150)
    img.alpha_composite(glow)
    img.alpha_composite(glyph)
    return img


def draw_flag_cutout(size: int = CUTOUT, phase: float = 0, danger: bool = False) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, 'RGBA')
    pole_x = size * 0.39
    top_y = size * 0.26
    bot_y = size * 0.76
    cloth_w = size * 0.36
    cloth_h = size * 0.28
    color = (248, 80, 112, 255) if danger else (56, 189, 248, 255)
    dark = (127, 29, 29, 255) if danger else (30, 64, 175, 255)

    pole_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(pole_layer, 'RGBA')
    pd.rounded_rectangle((pole_x - 6, top_y, pole_x + 6, bot_y), radius=5, fill=(226, 232, 240, 255))
    pd.rounded_rectangle((pole_x - 12, bot_y - 9, pole_x + 34, bot_y + 8), radius=7, fill=(148, 163, 184, 255))
    img.alpha_composite(alpha_glow(pole_layer, (148, 163, 184), 5, 70))
    img.alpha_composite(pole_layer)

    pts_top = []
    pts_bot = []
    steps = 8
    for i in range(steps + 1):
        t = i / steps
        x = pole_x + 4 + cloth_w * t
        wave = math.sin(phase * math.tau + t * math.pi * 1.35) * size * 0.025 * t
        pts_top.append((x, top_y + wave))
        pts_bot.append((x, top_y + cloth_h + wave + math.sin(t * math.pi) * size * 0.035))
    cloth_pts = pts_top + list(reversed(pts_bot))

    cloth_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(cloth_layer, 'RGBA')
    cd.polygon(cloth_pts, fill=color)
    cd.line(pts_top, fill=(255, 255, 255, 120), width=3, joint='curve')
    cd.line(pts_bot, fill=dark, width=4, joint='curve')
    cd.polygon([(pole_x + 5, top_y + 8), (pole_x + cloth_w * 0.42, top_y + cloth_h * 0.55), (pole_x + 5, top_y + cloth_h - 8)], fill=(255, 255, 255, 38))
    img.alpha_composite(alpha_glow(cloth_layer, color[:3], 10, 120))
    img.alpha_composite(cloth_layer)
    return img


def draw_mine_cutout(mode: str, size: int = CUTOUT) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, 'RGBA')
    cx, cy = size / 2, size / 2 + 8
    r = size * 0.23

    if mode in {'exploded', 'flash'}:
        glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow, 'RGBA')
        gd.ellipse((cx - r * 1.65, cy - r * 1.65, cx + r * 1.65, cy + r * 1.65), fill=(248, 113, 113, 145))
        img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))

    for i in range(10):
        angle = i * math.tau / 10
        p0 = (cx + math.cos(angle) * r * 0.88, cy + math.sin(angle) * r * 0.88)
        p1 = (cx + math.cos(angle) * r * 1.28, cy + math.sin(angle) * r * 1.28)
        d.line((p0, p1), fill=(15, 23, 42, 255), width=max(4, size // 34))
        d.ellipse((p1[0] - 5, p1[1] - 5, p1[0] + 5, p1[1] + 5), fill=(71, 85, 105, 255))

    body = Image.new('RGBA', img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(body, 'RGBA')
    fill = (14, 20, 34, 255) if mode != 'flash' else (255, 237, 213, 255)
    bd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill, outline=(148, 163, 184, 120), width=3)
    bd.ellipse((cx - r * 0.45, cy - r * 0.48, cx + r * 0.45, cy + r * 0.42), fill=(30, 41, 59, 255))
    bd.ellipse((cx - r * 0.18, cy - r * 0.2, cx + r * 0.18, cy + r * 0.16), fill=(125, 211, 252, 210))

    if mode == 'exploded':
        bd.line((cx - r * 0.48, cy - r * 0.62, cx - r * 0.08, cy - r * 0.08, cx - r * 0.34, cy + r * 0.56), fill=(248, 113, 113, 255), width=5)
        bd.line((cx + r * 0.08, cy - r * 0.54, cx + r * 0.44, cy, cx + r * 0.18, cy + r * 0.55), fill=(251, 146, 60, 230), width=4)
        bd.arc((cx - r * 1.28, cy - r * 1.12, cx + r * 1.28, cy + r * 1.35), 15, 172, fill=(251, 113, 133, 150), width=5)

    img.alpha_composite(alpha_glow(body, (248, 113, 113), 7, 85 if mode != 'standard' else 35))
    img.alpha_composite(body)
    return img


def paste_center(base: Image.Image, overlay: Image.Image, scale: float) -> Image.Image:
    w = max(1, int(base.width * scale))
    h = max(1, int(base.height * scale))
    fitted = overlay.resize((w, h), Image.Resampling.LANCZOS)
    base.alpha_composite(fitted, ((base.width - w) // 2, (base.height - h) // 2))
    return base


def draw_particle_fx(color: tuple[int, int, int], frame: int, frames: int, kind: str) -> Image.Image:
    rng = random.Random(9300 + frame * 17 + len(kind))
    img = Image.new('RGBA', (FX_W, FX_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, 'RGBA')
    t = frame / max(1, frames - 1)
    cx, cy = FX_W / 2, FX_H / 2

    if kind in {'mine-explosion', 'flag-pop', 'safe-reveal'}:
        radius = 10 + 70 * ease_out(t)
        alpha = int(210 * (1 - t))
        d.ellipse((cx - radius, cy - radius * 0.7, cx + radius, cy + radius * 0.7), outline=color + (max(20, alpha),), width=4)

    count = 22 if kind == 'mine-explosion' else 16
    for i in range(count):
        angle = i * math.tau / count + rng.random() * 0.18
        dist = (18 + rng.random() * 58) * ease_out(t)
        x = cx + math.cos(angle) * dist
        y = cy + math.sin(angle) * dist * 0.72
        dot = 2 + rng.random() * 4 + (1 - t) * 2
        a = int((1 - t) * (180 + rng.random() * 75))
        d.ellipse((x - dot, y - dot, x + dot, y + dot), fill=color + (max(0, a),))

    if kind == 'mine-explosion':
        flash = Image.new('RGBA', img.size, (0, 0, 0, 0))
        fd = ImageDraw.Draw(flash, 'RGBA')
        core = 22 + math.sin(t * math.pi) * 42
        fd.ellipse((cx - core, cy - core, cx + core, cy + core), fill=(255, 246, 196, int(190 * (1 - abs(t - 0.28)))))
        img.alpha_composite(flash.filter(ImageFilter.GaussianBlur(5)))

    return img.filter(ImageFilter.GaussianBlur(0.35))


def ease_out(t: float) -> float:
    return 1 - (1 - t) ** 3


def make_fx_frames(name: str, drawer) -> list[str]:
    public_dir = GAME_DIR / 'fx' / name
    doc_dir = DOC_SLICED / 'fx' / name
    paths: list[str] = []
    for i in range(8):
        frame = drawer(i, 8)
        filename = f'frame-{i + 1:02d}.png'
        public_path = public_dir / filename
        save_pair(frame, public_path, doc_dir / filename)
        paths.append('/' + public_path.relative_to(ROOT / 'public').as_posix())
    return paths


def generate_tiles() -> None:
    hidden = draw_hidden_cell()
    revealed = draw_revealed_cell()
    flag_tile = paste_center(Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0)), draw_flag_cutout(), 0.82)
    mine_tile = paste_center(draw_revealed_cell(), draw_mine_cutout('standard'), 0.78)

    tile_images = {
        'cell-hidden': hidden,
        'cell-revealed': revealed,
        'flag': flag_tile,
        'mine': mine_tile,
        **{f'num-{n}': draw_digit_tile(n) for n in range(1, 9)},
    }
    for name, img in tile_images.items():
        save_pair(img, PUBLIC_TILES / f'{name}.png', DOC_TILES / f'{name}.png')


def generate_cutouts() -> None:
    cutouts = {
        'flag-blue': draw_flag_cutout(),
        'flag-danger-red': draw_flag_cutout(danger=True),
        'flag-pole': draw_flag_cutout(),
        'mine-standard': draw_mine_cutout('standard'),
        'mine-exploded': draw_mine_cutout('exploded'),
        'mine-hit-flash': draw_mine_cutout('flash'),
        'mine-cracked': draw_mine_cutout('exploded'),
    }
    for name, img in cutouts.items():
        save_pair(img, GAME_DIR / 'cutouts' / f'{name}.png', DOC_SLICED / 'cutouts' / f'{name}.png')


def generate_effects() -> dict[str, object]:
    effects: dict[str, object] = {}

    effect_defs = {
        'mine-explosion': lambda i, n: draw_particle_fx((251, 113, 65), i, n, 'mine-explosion'),
        'flag-pop': lambda i, n: draw_particle_fx((56, 189, 248), i, n, 'flag-pop'),
        'safe-reveal': lambda i, n: draw_particle_fx((52, 211, 153), i, n, 'safe-reveal'),
        'digit-particles': lambda i, n: draw_particle_fx((125, 211, 252), i, n, 'digit-particles'),
        'cell-breath': lambda i, n: draw_particle_fx((129, 140, 248), i, n, 'cell-breath'),
        'cell-hover': lambda i, n: draw_particle_fx((56, 189, 248), i, n, 'cell-hover'),
        'flag-wave': lambda i, n: draw_flag_cutout(192, i / n).resize((FX_W, FX_H), Image.Resampling.LANCZOS),
    }

    for name, drawer in effect_defs.items():
        frame_paths = make_fx_frames(name, drawer)
        effects[name] = {
            'frameWidth': FX_W,
            'frameHeight': FX_H,
            'frameCount': 8,
            'blendMode': 'lighter',
            'frames': frame_paths,
        }

    return effects


def update_manifest(extra_effects: dict[str, object]) -> None:
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {'version': 1}
    cutouts = manifest.setdefault('cutouts', {}).setdefault('items', {})
    for name in ['flag-blue', 'flag-danger-red', 'flag-pole', 'mine-standard', 'mine-exploded', 'mine-hit-flash', 'mine-cracked']:
        cutouts[name] = f'/assets/game/cutouts/{name}.png'

    fx = manifest.setdefault('fx', {})
    fx.setdefault('grid', {'rows': 8, 'cols': 8, 'frameWidth': FX_W, 'frameHeight': FX_H})
    effects = fx.setdefault('effects', {})
    effects.update(extra_effects)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    (DOC_SLICED / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('wrote', MANIFEST.relative_to(ROOT))


def main() -> None:
    ensure_dirs()
    generate_tiles()
    generate_cutouts()
    effects = generate_effects()
    update_manifest(effects)


if __name__ == '__main__':
    main()
