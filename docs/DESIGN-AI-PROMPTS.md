# 游戏视觉 AI 提示词 — Endless 无尽扫雷

> 用于 Midjourney / DALL·E / Figma AI / 即梦 / Stable Diffusion 等设计 AI，生成可切图的游戏素材。  
> 对齐项目：**Endless 模式** · **9 列 × 20 行**竖长井 · **Modern Dark** 配色。

## 素材归档

| 文件                                         | 说明                                            | 用途                                           |
| -------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| `reference/tile-sprite-sheet-v1.png`         | §2 棋盘 tile 原图（隐藏/翻开/雷/旗 + 数字 1–8） | 切图源文件                                     |
| `reference/design-system-sheet-brief-v1.png` | §0 Brief 设计系统总览                           | 风格定调；**可切 ICON 网格**；其余复合组件见下 |
| `tiles/*.png`                                | 已从 tile sheet 切出 12 张 **128×128 透明 PNG** | 已接入 `renderer.ts`                           |
| `public/assets/hud/icons/*.png`              | 从 brief 切出 24 个线框 icon + scroll-up        | 已接入全屏 HUD / 弹层 / 日志                   |
| `public/assets/hud/heart-*.png`              | 生命心形（满/空）                               | 已接入顶栏 Lives                               |

### `tiles/` 切图清单

| 文件                      | 内容       |
| ------------------------- | ---------- |
| `cell-hidden.png`         | 未翻开格   |
| `cell-revealed.png`       | 已翻开空格 |
| `mine.png`                | 地雷       |
| `flag.png`                | 插旗       |
| `num-1.png` … `num-8.png` | 数字格     |

后续 AI 出图继续放入 `reference/`（参考稿）或 `tiles/`、`hud/`（可切图素材）。

---

## 0. 项目 Brief（第一条必发）

```
Design a complete visual asset kit for a mobile endless Minesweeper arcade game.

GAME CONTEXT:
- Vertical scrolling minefield, Tetris-like tall play well (9 columns × 20 visible rows)
- Board scrolls upward; player clears bottom rows before they leave screen
- Lives (5 hearts), score, combo multiplier, scroll countdown timer
- Dark modern indie mobile game, NOT a website dashboard

ART DIRECTION:
- Modern dark UI, zinc-950 background #09090b
- Primary accent indigo #6366f1
- Secondary: success #22c55e, warning #f59e0b, danger #ef4444
- Typography feel: DM Sans + IBM Plex Mono (clean, readable, contemporary)
- Soft 8–12px rounded corners, subtle borders, minimal glow
- Flat vector / clean game sprite style, game-ready assets

DELIVERABLE FORMAT:
- Transparent PNG sprites
- Consistent pixel/grid alignment for tileable cells
- Separate layers/components, NOT one blurry screenshot
- Provide a design system sheet + individual assets

AVOID:
neon cyberpunk arcade, 80s retro, pixel 8-bit, photorealistic 3D,
web SaaS dashboard, phone mockup bezel, watermark, embedded text in tiles
```

**说明**：竖长无尽扫雷 + 现代深色 + 可切图素材包，不是网页或霓虹街机。

---

## 1. 设计系统总览（一张定全套）

```
Complete UI design system sheet for endless vertical Minesweeper mobile game,
all components on one artboard, labeled sections:

A) Tile set: hidden cell, revealed cell, numbers 1-8, mine, flag
B) Vertical board frame 9×20 grid well with padding
C) Top HUD: Score chip, Combo chip, Scroll timer chip, Lives/status chip
D) Bottom bar: Space scroll button, Auto toggle button, defused mines counter area
E) Overlays: Start modal, Game Over modal, Combo popup badge, bottom danger row highlight
F) Full portrait screen mockup 9:16 showing layout

Colors: bg #09090b, panel #18181b, accent #6366f1, text #fafafa,
Modern dark indie game, flat vector, transparent PNG components,
design reference sheet for developers
```

---

## 2. 棋盘 Tile（核心，优先生成）

### 2.1 未翻开格

```
Single hidden minesweeper cell tile, 64×64px,
dark zinc #27272a, subtle top highlight, thin border rgba(255,255,255,0.07),
8px rounded corners, 3px gap spacing compatible,
flat modern game tile, transparent PNG, orthographic top-down
```

### 2.2 已翻开空格

```
Single revealed empty minesweeper cell tile, 64×64px,
darker fill #141416, inset subtle shadow, thin border rgba(255,255,255,0.05),
8px rounded corners, seamless tileable grid asset, transparent PNG
```

### 2.3 数字 1–8（sprite sheet）

```
Minesweeper number sprite sheet, 8 tiles in one horizontal row,
each 64×64px on revealed dark cell #141416,
centered bold monospace numbers 1-8 with distinct colors:
#60a5fa #4ade80 #f472b6 #fbbf24 #fb923c #a78bfa #f87171 #94a3b8,
modern flat game UI, crisp readable at small size, transparent PNG
```

### 2.4 地雷

```
Minimal flat mine icon for puzzle game, 64×64 cell,
dark round body #27272a, red core #ef4444, 8 short spikes,
readable at 24px scale, no explosion, transparent PNG centered
```

### 2.5 插旗

```
Minimal flat flag icon for minesweeper, 64×64 cell,
gray pole #a1a1aa, red flag cloth #ef4444, simple geometric,
transparent PNG centered
```

### 2.6 竖长棋盘外框（9×20）

```
Vertical minesweeper playfield frame, portrait tall rectangle,
9 columns × 20 rows empty grid slots inside,
outer panel #18181b, 12px corner radius,
subtle border rgba(255,255,255,0.1), inner indigo tint rgba(99,102,241,0.06),
Tetris-well proportions, mobile game board container, transparent PNG
```

---

## 3. HUD 组件

### 3.1 顶栏浮动面板

```
Mobile game HUD top floating bar, full width with side margins,
dark glass panel rgba(24,24,27,0.82), 14px rounded corners,
contains 4 stat chip slots left to right: Score, Combo, Scroll timer, Lives,
modern dark indie UI component, empty text placeholders ok,
transparent PNG, horizontal layout reference
```

### 3.2 Score / Combo / Status 小卡片

```
Small HUD stat chip component, 112×44px,
dark pill #27272a, border rgba(255,255,255,0.08), 10px radius,
label area on top (small muted text), value area below (large white text),
modern mobile game UI, transparent PNG, 3 variants same style
```

### 3.3 Scroll 倒计时卡片

```
HUD countdown chip, 128×44px,
amber warning theme background rgba(245,158,11,0.14),
border rgba(245,158,11,0.35), label "Scroll", large timer area,
modern game UI component, transparent PNG
```

### 3.4 生命心形 icon

```
Game life heart icons sprite sheet, 2 states:
filled heart (active life) and empty heart outline (lost life),
flat modern icon style, white/pink tint on dark UI,
32×32 each, transparent PNG horizontal strip
```

---

## 4. 底栏与操作

### 4.1 Space 上移按钮

```
Primary mobile game button, 280×44px,
ghost button style, indigo accent #6366f1,
soft fill rgba(99,102,241,0.14), border rgba(99,102,241,0.45),
10px rounded, label area for "Space · scroll up",
enabled and disabled states side by side, transparent PNG
```

### 4.2 Auto 按钮

```
Small secondary toggle button 88×36px,
inactive: dark pill #27272a; active: filled indigo #6366f1,
8px radius, label "Auto", mobile game UI, two states, transparent PNG
```

---

## 5. 状态 Overlay / 弹层

### 5.1 开始游戏

```
Start game modal card, 320×76px,
elevated panel #1f1f23, 14px radius, subtle border,
primary title area + subtitle area, dark scrim backdrop sample behind,
modern mobile game overlay, transparent PNG components
```

### 5.2 游戏结束

```
Game over modal card, 380×180px,
elevated dark panel, title area, score line, large red retry button #ef4444,
modern minimalist mobile game UI, transparent PNG
```

### 5.3 Combo 弹出

```
Combo multiplier popup badge, 200×82px,
rounded 12px, tier variants: green / amber / indigo intensity levels,
large "×12" number area + small "Combo" label,
subtle soft glow allowed but NOT neon arcade, transparent PNG 3 variants
```

### 5.4 底行危险高亮带

```
Horizontal danger zone overlay strip for bottom grid row,
translucent red rgba(239,68,68,0.3) with soft border,
spans full board width, 9 cells wide × 1 row tall proportion,
warning state for scrolling pressure, transparent PNG
```

### 5.5 对局日志面板

```
Game log modal panel, 720×560px portrait overlay,
elevated dark panel #1f1f23, 16px radius,
header area + scrollable monospace log lines area,
modern dark UI, transparent PNG
```

---

## 6. AI 提示高亮（4 态，可选）

```
Minesweeper AI hint cell highlight overlays, 64×64 each, 4 variants:
1) safe reveal hint - green tint rgba(34,197,94,0.28)
2) flag hint - red tint rgba(239,68,68,0.28)
3) chord hint - indigo tint rgba(99,102,241,0.28)
4) guess hint - amber tint rgba(245,158,11,0.28)
2px border matching color, transparent PNG sprite sheet 1×4
```

---

## 7. 全屏概念图（定稿用）

```
Full portrait mobile game screen concept, 9:16, endless vertical Minesweeper,
tall 9×20 minefield centered, top HUD bar, bottom space button,
dark zinc background #09090b, indigo accents,
some revealed numbered cells in lower third, one flagged cell,
bottom row red danger highlight, combo popup visible,
modern dark indie game like premium mobile puzzle titles,
flat vector illustration, design mockup NOT photo mockup
```

---

## 8. 背景

```
Seamless vertical game background for endless upward scrolling puzzle,
dark gradient #0c0c0e to #09090b,
very subtle indigo radial bloom top center rgba(99,102,241,0.08),
no grid, no objects, atmospheric minimal, tileable vertically 1080×1920
```

---

## 9. 负面提示词（每条都附上）

```
--no neon glow, cyberpunk, synthwave, 80s arcade, pixel art, 8-bit,
CRT scanlines, photorealistic, 3D render, glossy plastic, web dashboard,
browser UI, SaaS app, emoji, cartoon mascot, watermark, text watermark,
phone frame mockup, blurry, inconsistent lighting
```

---

## 10. 素材交付规格

| 资产       | 尺寸建议                      | 格式     | 备注              |
| ---------- | ----------------------------- | -------- | ----------------- |
| 单格 tile  | 64×64（@1x）或 128×128（@2x） | PNG 透明 | 3px 间距可无缝拼  |
| 数字 sheet | 512×64 或 1024×128            | PNG      | 8 格横排          |
| 心形       | 32×32 × 2 态                  | PNG      |                   |
| HUD chip   | 112×44                        | PNG      | 可九宫格拉伸      |
| Space 按钮 | 280×44                        | PNG      | normal + disabled |
| Auto 按钮  | 88×36                         | PNG      | inactive + active |
| 全屏参考   | 1080×1920                     | PNG      | 仅参考不切图      |
| 背景       | 1080×1920                     | PNG/JPG  | 可纵向 tile       |

---

## 11. 配色速查（与 `src/ui/theme.ts` 一致）

| Token         | 色值      | 用途            |
| ------------- | --------- | --------------- |
| canvasBg      | `#09090b` | 页面背景        |
| panelBg       | `#18181b` | 棋盘面板        |
| panelElevated | `#1f1f23` | 弹层            |
| accent        | `#6366f1` | 主强调          |
| success       | `#22c55e` | 成功 / 安全提示 |
| warning       | `#f59e0b` | 卷轴倒数        |
| danger        | `#ef4444` | 失败 / 危险行   |
| hudText       | `#fafafa` | 主文字          |
| hudMuted      | `#71717a` | 次要文字        |
| cellHidden    | `#27272a` | 未翻开格        |
| cellRevealed  | `#141416` | 已翻开格        |

数字 1–8：`#60a5fa` `#4ade80` `#f472b6` `#fbbf24` `#fb923c` `#a78bfa` `#f87171` `#94a3b8`

---

## 12. 推荐生成顺序

1. **§0 Brief + §7 全屏概念图** — 定整体风格
2. **§2 全部 Tile** — 可进游戏替换 renderer
3. **§3 §4 HUD / 按钮** — UI 换皮
4. **§5 Overlay** — 弹层统一
5. **§6 高亮 + §8 背景** — 锦上添花

---

## 13. 风格变体（替换 Brief 中的 ART DIRECTION）

### A. 现代克制（当前代码，推荐）

```
Modern dark zinc + indigo #6366f1, DM Sans feel, soft elevation,
minimal glow, contemporary mobile indie puzzle game
```

### B. 霓虹街机

```
Neon arcade STG game UI, cyan #00f0ff + magenta #ff00aa accents,
glowing edges, dark purple background, high energy combo effects,
vertical scroll shooter HUD aesthetic, flat game sprites
```

### C. 像素复古

```
16-bit pixel art game assets, 32×32 or 64×64 pixel grid,
limited 16-color palette, crisp pixels no anti-aliasing,
NES minesweeper inspired, retro handheld game style
```

---

## 14. 工具参数参考

### Midjourney

| 用途      | 参数                                  |
| --------- | ------------------------------------- |
| 单格 tile | `--ar 1:1 --stylize 50`               |
| 全屏概念  | `--ar 9:16 --stylize 100`             |
| 背景      | `--ar 9:16 --tile`（若支持纵向 tile） |

### Stable Diffusion

- 推荐：`flat game asset`, `sprite sheet`, `transparent background`
- 负面词：见 §9

### Figma AI / 即梦

- 强调：`transparent background`, `game UI component`, `separate layers`
- 先生成 §1 设计系统 sheet，再拆单元素

---

## 15. 万能模板

```
[元素描述], for endless vertical-scroll minesweeper mobile game (9 cols × 20 rows),
[具体尺寸], [具体颜色 hex],
Modern dark mobile game UI, zinc-950 #09090b, indigo accent #6366f1,
flat vector game asset, transparent PNG, isolated, no mockup, no watermark

Negative: neon glow, pixel art, 3D, photorealistic, web dashboard, text watermark
```

---

_文档版本：2026-06-21 · 对齐 Endless 9×20 竖长盘 + Modern Dark theme_
