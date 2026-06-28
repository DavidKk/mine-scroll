#!/usr/bin/env python3
"""Generate v2 non-board runtime UI assets for Endless Minesweeper.

This generator follows docs/NON-BOARD-UI-ASSET-INVENTORY.md. It intentionally
does not create board tiles, log assets, SPACE hints, countdowns, or extended
HUD badge pools.
"""

from __future__ import annotations

import json
import math
import random
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
GAME_DIR = ROOT / 'game/public/assets/game'
HUD_ICON_DIR = ROOT / 'game/public/assets/hud/icons'
DOC_SLICED = ROOT / 'docs/design-assets/sliced'
PRODUCTION_DIR = ROOT / 'docs/design-assets/production'
PUBLIC_PRODUCTION_DIR = ROOT / 'game/public/assets/production'
MANIFEST = GAME_DIR / 'manifest.json'

FX_W = 192
FX_H = 128
CUTOUT = 256

CYAN = (0, 240, 255)
INDIGO = (99, 102, 241)
PANEL = (24, 24, 27)
PANEL_2 = (31, 31, 35)
GREEN = (34, 197, 94)
AMBER = (245, 158, 11)
RED = (239, 68, 68)
GOLD = (250, 204, 21)
PURPLE = (168, 85, 247)

UI_ITEMS = {
    'start-panel': (364, 246),
    'game-over-panel': (430, 269),
    'auto-off': (113, 117),
    'auto-on': (116, 128),
}

CUTOUT_ITEMS = ['heart-full', 'heart-empty', 'heart-refill']
FX_ITEMS = ['wrong-flag-break', 'level-up']
HUD_ICON_ITEMS = [
    'play',
    'skull',
    'refresh',
    'volume-on',
    'volume-off',
    'volume-on-hover',
    'volume-off-hover',
]


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        '/System/Library/Fonts/Supplemental/Arial Black.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/System/Library/Fonts/SFNS.ttf',
        '/Library/Fonts/Arial.ttf',
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def ensure_dirs() -> None:
    for path in [
        GAME_DIR / 'ui',
        GAME_DIR / 'cutouts',
        GAME_DIR / 'fx',
        DOC_SLICED / 'ui',
        DOC_SLICED / 'cutouts',
        DOC_SLICED / 'fx',
        HUD_ICON_DIR,
        PRODUCTION_DIR,
        PUBLIC_PRODUCTION_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def clean_generated_outputs() -> None:
    for folder in [
        GAME_DIR / 'ui',
        GAME_DIR / 'cutouts',
        GAME_DIR / 'fx',
        DOC_SLICED / 'ui',
        DOC_SLICED / 'cutouts',
        DOC_SLICED / 'fx',
    ]:
        if folder.exists():
            shutil.rmtree(folder)
        folder.mkdir(parents=True, exist_ok=True)

    for name in HUD_ICON_ITEMS:
        for path in [HUD_ICON_DIR / f'{name}.png']:
            if path.exists():
                path.unlink()


def save_pair(img: Image.Image, public_path: Path, doc_path: Path | None = None) -> str:
    public_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(public_path, optimize=True)
    if doc_path:
        doc_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(doc_path, optimize=True)
    print('wrote', public_path.relative_to(ROOT))
    return '/' + public_path.relative_to(ROOT / 'public').as_posix()


def save_production(img: Image.Image, filename: str) -> None:
    for base in [PRODUCTION_DIR, PUBLIC_PRODUCTION_DIR]:
        path = base / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        img.save(path, optimize=True)
        print('wrote', path.relative_to(ROOT))


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return color + (alpha,)


def ease_out(t: float) -> float:
    return 1 - (1 - t) ** 3


def ease_in_out(t: float) -> float:
    return 0.5 - math.cos(t * math.pi) * 0.5


def text_center(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    value: str,
    fill: tuple[int, int, int, int],
    size: int,
    stroke: tuple[int, int, int, int] | None = None,
    stroke_width: int = 0,
) -> None:
    fnt = font(size)
    box = draw.textbbox((0, 0), value, font=fnt, stroke_width=stroke_width)
    x = xy[0] - (box[2] - box[0]) / 2
    y = xy[1] - (box[3] - box[1]) / 2 - box[1] / 2
    draw.text((x, y), value, font=fnt, fill=fill, stroke_fill=stroke, stroke_width=stroke_width)


def add_mask_glow(img: Image.Image, mask: Image.Image, color: tuple[int, int, int], blur: int, alpha: int) -> None:
    glow = Image.new('RGBA', img.size, rgba(color, 0))
    glow.putalpha(mask.filter(ImageFilter.GaussianBlur(blur)).point(lambda p: min(alpha, p)))
    img.alpha_composite(glow)


def make_panel_base(w: int, h: int, accent: tuple[int, int, int] = CYAN, danger: bool = False) -> Image.Image:
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    mask = Image.new('L', (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((8, 8, w - 8, h - 8), radius=18, fill=255)
    add_mask_glow(img, mask, accent, 18, 150 if danger else 120)

    d = ImageDraw.Draw(img, 'RGBA')
    for y in range(8, h - 8):
        t = (y - 8) / max(1, h - 16)
        base = tuple(int(PANEL[i] * (1 - t) + PANEL_2[i] * t) for i in range(3))
        d.line((8, y, w - 8, y), fill=base + (226,))

    d.rounded_rectangle((8, 8, w - 8, h - 8), radius=18, outline=rgba(accent, 188), width=2)
    d.rounded_rectangle((18, 18, w - 18, h - 18), radius=12, outline=rgba(accent, 66), width=1)
    d.line((28, 34, w - 28, 34), fill=rgba((255, 255, 255), 24), width=1)
    d.line((28, h - 35, w - 28, h - 35), fill=rgba((0, 0, 0), 70), width=1)
    return img


def draw_play_symbol(d: ImageDraw.ImageDraw, cx: float, cy: float, size: float, fill: tuple[int, int, int, int]) -> None:
    d.polygon(
        [
            (cx - size * 0.28, cy - size * 0.38),
            (cx - size * 0.28, cy + size * 0.38),
            (cx + size * 0.43, cy),
        ],
        fill=fill,
    )


def draw_refresh_symbol(d: ImageDraw.ImageDraw, cx: float, cy: float, size: float, fill: tuple[int, int, int, int]) -> None:
    box = (cx - size * 0.34, cy - size * 0.34, cx + size * 0.34, cy + size * 0.34)
    d.arc(box, 35, 315, fill=fill, width=max(2, int(size * 0.12)))
    ang = math.radians(35)
    px = cx + math.cos(ang) * size * 0.34
    py = cy + math.sin(ang) * size * 0.34
    d.polygon([(px, py), (px - size * 0.2, py - size * 0.04), (px - size * 0.06, py + size * 0.18)], fill=fill)


def draw_start_panel() -> Image.Image:
    img = make_panel_base(364, 246, CYAN)
    d = ImageDraw.Draw(img, 'RGBA')
    d.rounded_rectangle((128, 36, 236, 90), radius=14, fill=rgba((8, 13, 28), 196), outline=rgba(CYAN, 110), width=1)
    d.ellipse((160, 47, 200, 87), fill=rgba(CYAN, 20), outline=rgba(CYAN, 190), width=2)
    draw_play_symbol(d, 182, 67, 22, rgba((255, 255, 255), 235))
    text_center(d, (182, 140), 'START', rgba(GOLD, 255), 48, stroke=rgba((0, 0, 0), 180), stroke_width=2)
    d.rounded_rectangle((84, 184, 280, 208), radius=10, fill=rgba(INDIGO, 36), outline=rgba(INDIGO, 130), width=1)
    return img


def draw_retry_button(w: int = 218, h: int = 84, hot: bool = False) -> Image.Image:
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    accent = RED if not hot else AMBER
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((6, 7, w - 6, h - 7), radius=14, fill=255)
    add_mask_glow(img, mask, accent, 12, 120)
    d = ImageDraw.Draw(img, 'RGBA')
    d.rounded_rectangle((6, 7, w - 6, h - 7), radius=14, fill=rgba((127, 29, 29), 226), outline=rgba(accent, 210), width=2)
    d.rounded_rectangle((14, 15, w - 14, h - 15), radius=10, outline=rgba((255, 255, 255), 46), width=1)
    draw_refresh_symbol(d, 56, h / 2, 28, rgba((255, 255, 255), 236))
    text_center(d, (126, h / 2), 'RETRY', rgba((255, 255, 255), 255), 26, stroke=rgba((0, 0, 0), 120), stroke_width=1)
    return img


def draw_skull_symbol(d: ImageDraw.ImageDraw, cx: float, cy: float, size: float, fill: tuple[int, int, int, int]) -> None:
    r = size / 2
    d.ellipse((cx - r * 0.72, cy - r, cx + r * 0.72, cy + r * 0.52), fill=fill)
    d.rounded_rectangle((cx - r * 0.42, cy + r * 0.22, cx + r * 0.42, cy + r * 0.86), radius=int(size * 0.08), fill=fill)
    eye = rgba((9, 9, 11), 240)
    d.ellipse((cx - r * 0.47, cy - r * 0.32, cx - r * 0.16, cy - r * 0.02), fill=eye)
    d.ellipse((cx + r * 0.16, cy - r * 0.32, cx + r * 0.47, cy - r * 0.02), fill=eye)
    d.polygon([(cx, cy + r * 0.04), (cx - r * 0.11, cy + r * 0.24), (cx + r * 0.11, cy + r * 0.24)], fill=eye)
    for x in [-0.24, 0, 0.24]:
        d.line((cx + r * x, cy + r * 0.42, cx + r * x, cy + r * 0.75), fill=eye, width=max(1, int(size * 0.04)))


def draw_game_over_panel() -> Image.Image:
    img = make_panel_base(430, 269, RED, danger=True)
    d = ImageDraw.Draw(img, 'RGBA')
    draw_skull_symbol(d, 215, 58, 44, rgba((255, 255, 255), 230))
    text_center(d, (215, 122), 'GAME OVER', rgba(RED, 255), 39, stroke=rgba((0, 0, 0), 180), stroke_width=2)
    d.rounded_rectangle((108, 151, 322, 178), radius=10, fill=rgba((10, 10, 12), 150), outline=rgba(RED, 74), width=1)
    img.alpha_composite(draw_retry_button(218, 72), (106, 188))
    return img


def draw_auto_panel(active: bool) -> Image.Image:
    w, h = UI_ITEMS['auto-on' if active else 'auto-off']
    accent = GREEN if active else INDIGO
    img = make_panel_base(w, h, accent)
    d = ImageDraw.Draw(img, 'RGBA')
    d.ellipse((w / 2 - 13, 27, w / 2 + 13, 53), fill=rgba(accent, 42), outline=rgba(accent, 220), width=2)
    d.ellipse((w / 2 - 5, 35, w / 2 + 5, 45), fill=rgba(accent, 255 if active else 140))
    text_center(d, (w / 2, 82), 'AUTO', rgba((255, 255, 255), 236), 19, stroke=rgba((0, 0, 0), 80), stroke_width=1)
    return img


def heart_points(cx: float, cy: float, scale: float) -> list[tuple[float, float]]:
    pts = []
    for i in range(160):
        t = math.tau * i / 160
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * scale, cy + y * scale))
    return pts


def draw_heart(kind: str) -> Image.Image:
    img = Image.new('RGBA', (CUTOUT, CUTOUT), (0, 0, 0, 0))
    pts = heart_points(CUTOUT / 2, CUTOUT / 2 + 8, 5.85)
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    color = RED if kind != 'heart-refill' else GREEN
    add_mask_glow(img, mask, color, 14, 120)
    d = ImageDraw.Draw(img, 'RGBA')
    if kind == 'heart-empty':
        d.line(pts + [pts[0]], fill=rgba((148, 163, 184), 210), width=10, joint='curve')
        d.line(pts + [pts[0]], fill=rgba(RED, 170), width=4, joint='curve')
    else:
        d.polygon(pts, fill=rgba(color, 235))
        d.line(pts + [pts[0]], fill=rgba((255, 255, 255), 132), width=5, joint='curve')
        d.arc((76, 72, 166, 154), 210, 330, fill=rgba((255, 255, 255), 82), width=8)
        if kind == 'heart-refill':
            d.ellipse((91, 85, 165, 159), outline=rgba((187, 247, 208), 196), width=5)
            d.line((128, 101, 128, 143), fill=rgba((255, 255, 255), 220), width=8)
            d.line((107, 122, 149, 122), fill=rgba((255, 255, 255), 220), width=8)
    return img


def make_icon_canvas(hover: bool = False) -> Image.Image:
    img = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    if hover:
        d = ImageDraw.Draw(img, 'RGBA')
        d.rounded_rectangle((15, 15, 113, 113), radius=26, fill=rgba(CYAN, 22), outline=rgba(CYAN, 110), width=2)
    return img


def draw_hud_icon(name: str) -> Image.Image:
    hover = name.endswith('-hover')
    base = name.replace('-hover', '')
    img = make_icon_canvas(hover)
    d = ImageDraw.Draw(img, 'RGBA')
    color = rgba((255, 255, 255), 244)
    accent = rgba(CYAN if hover else (148, 163, 184), 220)
    if base == 'play':
        d.ellipse((31, 27, 101, 101), outline=accent, width=6)
        draw_play_symbol(d, 67, 64, 42, color)
    elif base == 'refresh':
        draw_refresh_symbol(d, 64, 64, 72, color)
    elif base == 'skull':
        draw_skull_symbol(d, 64, 62, 62, color)
    elif base in {'volume-on', 'volume-off'}:
        d.polygon([(27, 52), (43, 52), (63, 35), (63, 93), (43, 76), (27, 76)], fill=color)
        if base == 'volume-on':
            d.arc((64, 43, 93, 85), -45, 45, fill=accent, width=6)
            d.arc((68, 31, 111, 97), -45, 45, fill=accent, width=5)
        else:
            d.line((78, 46, 103, 82), fill=rgba(RED, 242), width=8)
            d.line((103, 46, 78, 82), fill=rgba(RED, 242), width=8)
    return img


def draw_fx(name: str, frame: int) -> Image.Image:
    t = frame / 7
    img = Image.new('RGBA', (FX_W, FX_H), (0, 0, 0, 255))
    layer = Image.new('RGBA', (FX_W, FX_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, 'RGBA')
    cx, cy = FX_W / 2, FX_H / 2
    rng = random.Random(7000 + frame * 43 + len(name) * 97)

    if name == 'score-pop':
        radius = 12 + 54 * ease_out(t)
        alpha = int(210 * (1 - t))
        d.ellipse((cx - radius, cy - radius * 0.45, cx + radius, cy + radius * 0.45), outline=rgba(CYAN, alpha), width=4)
        for i in range(18):
            a = i * math.tau / 18
            dist = 10 + 54 * ease_out((t + i * 0.015) % 1)
            x = cx + math.cos(a) * dist
            y = cy + math.sin(a) * dist * 0.42 - 18 * t
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=rgba(GOLD if i % 3 == 0 else CYAN, max(0, alpha)))
    elif name == 'combo-burst':
        for i in range(24):
            a = i * math.tau / 24 + t * 0.35
            inner = 8 + 16 * t
            outer = inner + 18 + 48 * ease_out(t) * (0.55 + (i % 5) / 8)
            color = [GOLD, AMBER, PURPLE][i % 3]
            d.line(
                (cx + math.cos(a) * inner, cy + math.sin(a) * inner, cx + math.cos(a) * outer, cy + math.sin(a) * outer),
                fill=rgba(color, int(230 * (1 - t * 0.75))),
                width=3,
            )
        d.ellipse((cx - 22 - 18 * t, cy - 22 - 18 * t, cx + 22 + 18 * t, cy + 22 + 18 * t), outline=rgba(PURPLE, int(170 * (1 - t))), width=3)
    elif name == 'wrong-flag-break':
        shake = math.sin(t * math.tau * 2) * 5
        d.line((40 + shake, 25, 150 - shake, 100), fill=rgba(RED, int(235 * (1 - t * 0.45))), width=7)
        d.line((57 - shake, 95, 134 + shake, 31), fill=rgba(AMBER, int(170 * (1 - t * 0.55))), width=3)
        for i in range(14):
            x = cx + (rng.random() - 0.5) * 74 * ease_out(t)
            y = cy + (rng.random() - 0.5) * 52 * ease_out(t)
            s = 4 + rng.random() * 6
            d.polygon([(x, y - s), (x + s, y), (x, y + s), (x - s, y)], fill=rgba(RED, int(190 * (1 - t))))
    elif name == 'level-up':
        lift = 18 * t
        d.polygon([(cx, 22 - lift), (cx + 18, 58 - lift), (cx, 48 - lift), (cx - 18, 58 - lift)], fill=rgba(GOLD, int(230 * (1 - t * 0.45))))
        for r, color in [(24, GOLD), (42, AMBER), (62, PURPLE)]:
            rr = r + 28 * ease_out(t)
            d.ellipse((cx - rr, cy - rr * 0.38 - lift, cx + rr, cy + rr * 0.38 - lift), outline=rgba(color, int(180 * (1 - t))), width=3)
        for i in range(16):
            a = i * math.tau / 16
            y = cy + math.sin(a) * 24 - 48 * t
            x = cx + math.cos(a) * (20 + 50 * t)
            d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=rgba(GOLD if i % 2 else PURPLE, int(220 * (1 - t))))
    elif name == 'heart-refill':
        pulse = 0.75 + math.sin(t * math.pi) * 0.45
        pts = heart_points(cx, cy + 8, 2.5 * pulse)
        d.polygon(pts, fill=rgba(GREEN, int(180 * (1 - t * 0.25))))
        d.line(pts + [pts[0]], fill=rgba((255, 255, 255), int(150 * (1 - t * 0.2))), width=2)
        ring = 18 + 48 * ease_out(t)
        d.ellipse((cx - ring, cy - ring * 0.62, cx + ring, cy + ring * 0.62), outline=rgba(GREEN, int(190 * (1 - t))), width=4)
        for i in range(14):
            a = i * math.tau / 14 + t * math.tau
            x = cx + math.cos(a) * (22 + 38 * t)
            y = cy + math.sin(a) * (15 + 22 * t)
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=rgba((187, 247, 208), int(210 * (1 - t))))

    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(0.35)))
    return img


def generate_ui_assets() -> dict[str, object]:
    drawers = {
        'start-panel': draw_start_panel,
        'game-over-panel': draw_game_over_panel,
        'auto-off': lambda: draw_auto_panel(False),
        'auto-on': lambda: draw_auto_panel(True),
    }
    items: dict[str, object] = {}
    for name, drawer in drawers.items():
        img = drawer()
        src = save_pair(img, GAME_DIR / 'ui' / f'{name}.png', DOC_SLICED / 'ui' / f'{name}.png')
        items[name] = {'src': src, 'width': img.width, 'height': img.height}
    return items


def generate_cutouts() -> dict[str, str]:
    items: dict[str, str] = {}
    for name in CUTOUT_ITEMS:
        img = draw_heart(name)
        items[name] = save_pair(img, GAME_DIR / 'cutouts' / f'{name}.png', DOC_SLICED / 'cutouts' / f'{name}.png')
    return items


def generate_fx() -> dict[str, object]:
    effects: dict[str, object] = {}
    for name in FX_ITEMS:
        frames = []
        for i in range(8):
            img = draw_fx(name, i)
            filename = f'frame-{i + 1:02d}.png'
            frames.append(save_pair(img, GAME_DIR / 'fx' / name / filename, DOC_SLICED / 'fx' / name / filename))
        effects[name] = {
            'frameWidth': FX_W,
            'frameHeight': FX_H,
            'frameCount': 8,
            'blendMode': 'lighter',
            'frames': frames,
        }
    return effects


def generate_hud_icons() -> dict[str, object]:
    items: dict[str, object] = {}
    for name in HUD_ICON_ITEMS:
        img = draw_hud_icon(name)
        src = save_pair(img, HUD_ICON_DIR / f'{name}.png')
        items[name] = {'src': src, 'width': img.width, 'height': img.height}
    return items


def make_ui_sheet(ui_items: dict[str, object]) -> None:
    sheet = Image.new('RGBA', (1024, 560), (0, 0, 0, 0))
    placements = {
        'start-panel': (32, 32),
        'game-over-panel': (430, 32),
        'auto-off': (32, 324),
        'auto-on': (182, 316),
    }
    for name, (x, y) in placements.items():
        rel = ui_items[name]['src'].lstrip('/')  # type: ignore[index]
        sheet.alpha_composite(Image.open(ROOT / 'public' / rel).convert('RGBA'), (x, y))
    save_production(sheet, 'ui-panels-production-v2.png')


def make_cutout_sheet(cutouts: dict[str, str]) -> None:
    sheet = Image.new('RGBA', (CUTOUT * len(CUTOUT_ITEMS), CUTOUT), (0, 0, 0, 0))
    for i, name in enumerate(CUTOUT_ITEMS):
        sheet.alpha_composite(Image.open(ROOT / 'public' / cutouts[name].lstrip('/')).convert('RGBA'), (i * CUTOUT, 0))
    save_production(sheet, 'core-cutouts-production-v2.png')


def make_fx_sheet(effects: dict[str, object]) -> None:
    sheet = Image.new('RGBA', (FX_W * 8, FX_H * len(FX_ITEMS)), (0, 0, 0, 255))
    for row, name in enumerate(FX_ITEMS):
        frames = effects[name]['frames']  # type: ignore[index]
        for col, rel in enumerate(frames):
            sheet.alpha_composite(Image.open(ROOT / 'public' / rel.lstrip('/')).convert('RGBA'), (col * FX_W, row * FX_H))
    save_production(sheet, 'fx-additive-sprites-production-v2.png')


def make_icon_sheet(icons: dict[str, object]) -> None:
    sheet = Image.new('RGBA', (128 * len(HUD_ICON_ITEMS), 128), (0, 0, 0, 0))
    for i, name in enumerate(HUD_ICON_ITEMS):
        rel = icons[name]['src'].lstrip('/')  # type: ignore[index]
        sheet.alpha_composite(Image.open(ROOT / 'public' / rel).convert('RGBA'), (i * 128, 0))
    save_production(sheet, 'hud-icons-production-v2.png')


def make_previews(cutouts: dict[str, str], effects: dict[str, object], ui_items: dict[str, object]) -> dict[str, str]:
    cutout_preview = Image.new('RGBA', (96 * len(CUTOUT_ITEMS), 96), (8, 10, 18, 255))
    for i, name in enumerate(CUTOUT_ITEMS):
        img = Image.open(ROOT / 'public' / cutouts[name].lstrip('/')).convert('RGBA').resize((96, 96), Image.Resampling.LANCZOS)
        cutout_preview.alpha_composite(img, (i * 96, 0))
    cutout_src = save_pair(cutout_preview, GAME_DIR / 'preview-cutouts.png', DOC_SLICED / 'preview-cutouts.png')

    fx_preview = Image.new('RGBA', (FX_W * len(FX_ITEMS), FX_H), (0, 0, 0, 255))
    for i, name in enumerate(FX_ITEMS):
        frames = effects[name]['frames']  # type: ignore[index]
        img = Image.open(ROOT / 'public' / frames[4].lstrip('/')).convert('RGBA')
        fx_preview.alpha_composite(img, (i * FX_W, 0))
    fx_src = save_pair(fx_preview, GAME_DIR / 'preview-fx.png', DOC_SLICED / 'preview-fx.png')

    panel_preview = Image.new('RGBA', (920, 420), (8, 10, 18, 255))
    placements = [(20, 20), (420, 20), (20, 300), (280, 286), (430, 280), (590, 300), (735, 300)]
    for (name, item), (x, y) in zip(ui_items.items(), placements):
        img = Image.open(ROOT / 'public' / item['src'].lstrip('/')).convert('RGBA')  # type: ignore[index]
        panel_preview.alpha_composite(img, (x, y))
    ui_src = save_pair(panel_preview, GAME_DIR / 'preview-ui-panels.png', DOC_SLICED / 'preview-ui-panels.png')
    return {'cutouts': cutout_src, 'fx': fx_src, 'uiPanels': ui_src}


def validate_outputs(manifest: dict[str, object]) -> None:
    for src in manifest['cutouts']['items'].values():  # type: ignore[index,union-attr]
        img = Image.open(ROOT / 'public' / src.lstrip('/'))  # type: ignore[union-attr]
        if img.size != (CUTOUT, CUTOUT):
            raise SystemExit(f'invalid cutout size: {src} {img.size}')

    for name, effect in manifest['fx']['effects'].items():  # type: ignore[index,union-attr]
        frames = effect['frames']  # type: ignore[index]
        if len(frames) != 8:
            raise SystemExit(f'invalid frame count for {name}: {len(frames)}')
        for src in frames:
            img = Image.open(ROOT / 'public' / src.lstrip('/'))
            if img.size != (FX_W, FX_H):
                raise SystemExit(f'invalid FX size: {src} {img.size}')
            if img.getpixel((0, 0))[:3] != (0, 0, 0):
                raise SystemExit(f'FX frame is not black-backed: {src}')

    for name in HUD_ICON_ITEMS:
        img = Image.open(HUD_ICON_DIR / f'{name}.png')
        if img.size != (128, 128):
            raise SystemExit(f'invalid HUD icon size: {name} {img.size}')


def main() -> None:
    ensure_dirs()
    clean_generated_outputs()

    ui_items = generate_ui_assets()
    cutouts = generate_cutouts()
    effects = generate_fx()
    icons = generate_hud_icons()

    make_ui_sheet(ui_items)
    make_cutout_sheet(cutouts)
    make_fx_sheet(effects)
    make_icon_sheet(icons)
    previews = make_previews(cutouts, effects, ui_items)

    manifest: dict[str, object] = {
        'version': 2,
        'brief': 'docs/NON-BOARD-UI-ASSET-INVENTORY.md',
        'cutouts': {
            'source': 'docs/design-assets/production/core-cutouts-production-v2.png',
            'grid': {'rows': 1, 'cols': len(CUTOUT_ITEMS), 'sourceCell': CUTOUT, 'outputSize': CUTOUT},
            'items': cutouts,
        },
        'fx': {
            'source': 'docs/design-assets/production/fx-additive-sprites-production-v2.png',
            'grid': {'rows': len(FX_ITEMS), 'cols': 8, 'frameWidth': FX_W, 'frameHeight': FX_H},
            'effects': effects,
        },
        'uiPanels': {
            'source': 'docs/design-assets/production/ui-panels-production-v2.png',
            'items': ui_items,
        },
        'hudIcons': {
            'source': 'docs/design-assets/production/hud-icons-production-v2.png',
            'items': icons,
        },
        'previews': previews,
    }

    validate_outputs(manifest)
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (DOC_SLICED / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('wrote', MANIFEST.relative_to(ROOT))


if __name__ == '__main__':
    main()
