# 游戏视觉 AI 提示词 — Endless 无尽扫雷（v3）

> **用途**：交给 Midjourney / DALL·E / Stable Diffusion / 即梦 / Figma AI 等专业工具，生成**可切图**的 production sheet。
> **对齐**：[`ENDLESS-AMBIENT-LIFE-PLAN.md`](./ENDLESS-AMBIENT-LIFE-PLAN.md) §13、[`src/ui/theme.ts`](../src/ui/theme.ts) 配色。
> **风格锚点（已定调）**：[`endless-static-states-v1.png`](./design-assets/generated/endless-static-states-v1.png) + [`endless-hud-popups-v1.png`](./design-assets/generated/endless-hud-popups-v1.png) — **Neon-Noir Tactical HUD**。
> **原则**：不再生成「一张漂亮概念总图」直接进游戏；只生成**固定网格 + 透明底 + 命名清晰**的 sheet，由 `npm run assets:all` 切图接入。

---

## 0. 生成顺序（推荐）

### 0A. 仅重生成 Production 资产（概念图 OK 时 — **当前情况**）

概念图 `generated/endless-static-states-v1.png` + `endless-hud-popups-v1.png` **保留**，作 `--sref` / 风格参考。
**不要**用现有 `production/*-v1.png`、`production/tile-runtime-v3*` 作参考（质量不理想，仅归档）。

| 步骤 | 做什么 | 产出文件名 | 验收后命令 |
|------|--------|------------|------------|
| **1** | 重生成棋盘 sheet | `tile-runtime-production-v4-512x640.png` | `npm run assets:tiles` → 开游戏看棋盘 |
| 2 | 重生成 cutout sheet | `core-cutouts-production-v2.png` | `npm run assets:production` |
| 3 | 重生成 FX sheet | `fx-additive-sprites-production-v2.png` | `npm run assets:production` |
| 4 | 重生成 UI sheet | `ui-panels-production-v2.png` | `npm run assets:production` |
| 5 | HUD icon sheet | `hud-icons-production-v2.png` | `npm run assets:hud`（脚本待扩展） |
| 6 | HUD 数字字模 | `hud-digits-atlas-v1.png` | 待扩展 |

**从步骤 1 开始。** 每条 prompt = §1.1 STYLE_BLOCK + §1.2 SHEET_RULES + 对应 §4–§9 正文 + §2 负面词；Sheet 1 额外附 §4.2 防 mockup 规则。`--sref` 挂两张概念图。

旧 production 可移到 `docs/design-assets/archive/production-v1/` 避免误用，**不必删**。

### 0B. 总览表

| 步骤 | 产物 | 文件名（保存到 `docs/design-assets/production/`） | 切图脚本 |
|------|------|---------------------------------------------------|----------|
| 0 | 风格定调（**已有概念图**） | `generated/endless-static-states-v1.png` + `endless-hud-popups-v1.png` | 作 `--sref`，不重生成 |
| 1 | 棋盘 + digit + 棋盘 cutout | `tile-runtime-production-v4-512x640.png` | `npm run assets:tiles` |
| 2 | HUD / 状态 cutout | `core-cutouts-production-v2.png` | `npm run assets:production` |
| 3 | 事件 FX 序列帧 | `fx-additive-sprites-production-v2.png` | `npm run assets:production` |
| 4 | UI 面板 / 按钮 / Chip | `ui-panels-production-v2.png` | `npm run assets:production` |
| 5 | HUD 线框 icon | `hud-icons-production-v2.png` | `npm run assets:hud`（待扩展） |
| 6 | HUD 数字字模 | `hud-digits-atlas-v1.png` | 待扩展 |

**每条 prompt 末尾都附上 §2 负面词 + §3 配色约束。**

---

## 1. 统一风格锁（Style Lock）

> **用法**：下面 `STYLE_BLOCK` 与 `SHEET_RULES` **复制粘贴到每一条生成 prompt 的开头**（或作为 Custom Instructions / Style Reference 固定前缀），保证 6 张 sheet 视觉一致。参考图只借视觉语言，不借版面构图。

### 1.1 STYLE_BLOCK（英文，直接粘贴）

```text
PROJECT: Endless vertical-scroll Minesweeper, mobile portrait, 9 columns × ~20 visible rows.
ART STYLE LOCK — "Neon-Noir Tactical HUD" (match reference sheets endless-static-states-v1 + endless-hud-popups-v1):

- Deep black-blue tactical canvas #060912; recessed glass/metal panels #0e1420 and elevated panels #151d2e.
- Faceted sci-fi HUD geometry: clipped octagonal corners, chamfered metal tiles, double-line borders, tiny corner brackets.
- Thin cyan edge light and inner glow; bright elements bloom, dark surfaces stay matte and readable.
- Premium mobile game asset language, like sliced runtime UI components, NOT a website, NOT a phone mockup, NOT a poster.
- Shape rhythm from the references: compact panels, centered icons, condensed uppercase labels, seven-segment score numerals.
- Controlled neon bloom only around semantic accents; no muddy gradients, no rainbow drift. Assets must still read at 24px.
- Semantic color language (STRICT — see palette §3):
  • Cyan #00b8ff = info / safe / primary UI / player flag / selected cell
  • Green #00e676 = success / heal / auto-on / safe-reveal / defused
  • Amber #ffb020 = warning / guess hint / countdown-normal / system log
  • Orange #ff7800 = urgent / combo-mid / scroll pressure
  • Red #ff3344 = danger / mine / life-lost / game-over / critical countdown
  • Purple #b44aff = chord / AI-advanced hint / safe-number badge
  • Magenta #e040fb = level-up / combo-high / epic tier
- Tiles: dark blue-gray metal chips #1a2233, orthographic top-down, bevel ring, subtle top highlight #243044.
- UI panels: dark glass fill, clipped/rounded 8–14px corners, dark outer stroke + bright inner semantic edge.
- Icons: simple readable silhouettes with neon rim light, not stickers, not emojis, not detailed illustrations.
- Typography feel: condensed uppercase HUD labels + digital/seven-segment numerals for scores (placeholder labels only).
- Mood: alive tactical display — assets support idle glow pulse in code, not static clipart.

AVOID ENTIRELY:
80s retro arcade cabinet, pixel 8-bit, CRT scanline spam, photorealistic 3D characters,
web SaaS dashboard, browser chrome, emoji mascots, watermark, random rainbow palette drift,
brown/beige casual palette, inconsistent hues between cells on the same sheet.
```

### 1.2 SHEET_RULES（英文，production sheet 必加）

```text
OUTPUT TYPE: Production-ready transparent PNG sprite SHEET — NOT a mockup, NOT a labeled poster.

STRICT FORMAT RULES:
- Fixed grid cells, exact pixel dimensions stated in each sheet prompt.
- Entire sheet background 100% transparent (alpha 0). Empty cell space is transparent.
- One asset per slot, centered, with safe padding; never touch cell edges.
- No phone frame, no full-screen layout, no gameplay screenshot, no poster composition.
- No explanatory captions outside assets, no grid numbers, no watermarks, no decorative borders between sheet cells.
- Orthographic asset rendering, no camera tilt, no perspective distortion.
- Do NOT bake dynamic gameplay values into art (no real scores, combo counts, countdown seconds, log lines).
- Placeholder labels are allowed only where the sheet explicitly requests UI components.
- Board digits must be standalone transparent glyphs, NOT printed on tile cells.
- FX frames must be additive-friendly: transparent edges, bright energy centers, no opaque black boxes.

QUALITY BAR:
- Every asset in the same sheet must share line weight, bevel depth, glow softness, and color temperature.
- Edges must be crisp enough for downscaling; avoid blurry AI mush and over-detailed microtexture.
- Keep silhouettes simple. Prefer icon-like clarity over cinematic illustration.
```

### 1.3 中文风格摘要（给美术对接）

| 维度 | 定调 |
|------|------|
| genre | 竖屏无尽扫雷 · Neon-Noir Tactical HUD（赛博战术面板） |
| 参考图 | `endless-static-states-v1`（状态语义）+ `endless-hud-popups-v1`（HUD/弹层） |
| 背景感 | 深海蓝黑 `#060912`，面板 `#0e1420`，**青色描边光晕** |
| 语义色 | 蓝=安全/info · 绿=成功 · 黄=警告 · 橙=紧迫 · 红=危险 · 紫=和弦/AI · 品红=高能 |
| 形体 | 暗金属格 + 霓虹边框 + 适度 bloom，**不要** 8-bit / 写实 3D / 网页 UI |
| 棋盘 | 正交俯视；格底与 digit **分层**（透明 glyph） |
| 禁止 | 手机壳、整屏示意图、写死分数/连击、同 sheet 内色相漂移 |

---

## 2. 全局负面提示词

**英文（推荐每条都附）：**

```text
--no full game screen, gameplay UI mockup, HUD bar, score display, mission panel, status module,
minesweeper board with many tiles, 10x10 grid, combined digit-on-tile, numbers inside cell squares,
dark opaque background, phone mockup, gameplay screenshot, labeled poster, UI dashboard,
80s arcade cabinet, pixel art, 8-bit, CRT scanlines, photorealistic 3D, glossy plastic toy,
web dashboard, browser UI, SaaS app, emoji mascot, watermark,
blurry, perspective warp, brown beige palette, inconsistent colors across assets,
baked score numbers, combo text, log paragraphs, grid labels, cell coordinates,
oversaturated rainbow (except intentional x99 tier FX), cartoon mascot, fantasy RPG icon set,
soft clay render, flat vector website icons, random gradients, illegible tiny labels
```

**中文对照：** 不要整屏游戏 UI、HUD 顶栏、大棋盘、数字格合成图、不透明背景、水印、写死分数。

### 2.1 常见失败 vs 正确产出（Sheet 1）

| ❌ 错误（你刚遇到的那种） | ✅ 正确（production sheet） |
|--------------------------|----------------------------|
| 一整屏 Minesweeper 界面 | 仅 **4 列 × 5 行 = 20 格** 素材 |
| 顶栏 SCORE / MINES / TIMER / COMBO | **没有任何 HUD 文字条** |
| 中间 10 列大棋盘连在一起 | **每格只有 1 个独立 sprite** |
| 数字画在格子里（digit+tile 合成） | digit 格：**只有数字 glyph，透明底** |
| 整张图深色不透明背景 | **画布背景 100% 透明** |
| 像「游戏截图」 | 像「sprite sheet / 图集」 |

> 概念图（`endless-hud-popups-v1`）是**风格参考**，不是让你再画一张概念图。Sheet 1 产出应像 **工具栏里的图标集**，不是 playable screen。

---

## 3. 统一色板 — Endless Neon-Noir v1

> **来源**：合并 `endless-static-states-v1` 右下角 Notes 语义色 + `endless-hud-popups-v1` HUD/棋盘用色。
> **代码同步**：[`src/ui/theme.ts`](../src/ui/theme.ts) `THEME` 对象。
> **规则**：同一语义全局同色；棋盘 digit、HUD chip、FX 能量必须使用下表 hex，**禁止**各 sheet 自行改色相。

### 3.1 背景与面板

| Token | Hex | 用途 |
|-------|-----|------|
| canvasBg | `#060912` | 页面 / 画布背景（深海蓝黑） |
| panelBg | `#0e1420` | 棋盘面板、HUD 窗口底 |
| panelElevated | `#151d2e` | Start / Game Over / Log 弹层 |
| panelBorder | `rgba(0, 184, 255, 0.22)` | 默认 UI 青色描边光晕 |
| hudText | `#e8f4ff` | 主文字（冷白） |
| hudMuted | `#6b8299` | 次要 / 日志 muted |

### 3.2 语义色（全游戏通用）

| 语义 | Token | Hex | 典型用途 |
|------|-------|-----|----------|
| 信息 / 安全 / 主 UI | info | `#00b8ff` | SPACE 启用、选中格、AI 日志、蓝旗、Start 边框 |
| 成功 / 治疗 | success | `#00e676` | Auto ON、消雷、+1 Life、Safe Reveal、Defused |
| 警告 | warning | `#ffb020` | Guess 提示、Countdown Normal、系统日志 |
| 紧迫 | urgent | `#ff7800` | Countdown Urgent、Combo 中断前、Scroll +N Rows |
| 危险 | danger | `#ff3344` | 雷、踩雷、Life Lost、Game Over、Countdown Critical |
| 高级 / 和弦 | chord | `#b44aff` | Chord Target、AI 高级提示、Safe Number Badge |
| 高能 / 升级 | epic | `#e040fb` | Level Up、Combo x30+、高分 tier |

### 3.3 棋盘格底

| Token | Hex | 用途 |
|-------|-----|------|
| cellHidden | `#1a2233` | 未翻开格（暗蓝灰金属） |
| cellHiddenHighlight | `#243044` | 未翻开顶缘高光 |
| cellHiddenBorder | `rgba(0, 184, 255, 0.12)` | 未翻开细描边 |
| cellRevealed | `#0a0e16` | 已翻开空格（更深、内凹） |
| cellRevealedBorder | `rgba(0, 184, 255, 0.06)` | 已翻开细描边 |

### 3.4 棋盘数字 1–8（digit glyph 严格用色）

与 `endless-hud-popups-v1` §10 对齐；**禁止**再用旧版 zinc-indie 粉/灰方案。

| # | Hex | 名称 | Ambient 个性 |
|---|-----|------|--------------|
| 1 | `#00b8ff` | cyan-blue | 最克制，微粒最少 |
| 2 | `#00e676` | green | 微上移 |
| 3 | `#ff4757` | red | 略快周期 |
| 4 | `#b44aff` | purple | 发光 +15% |
| 5 | `#00e5ff` | bright cyan | 缩放 ≤±4%，靠 glow |
| 6 | `#ffb020` | amber | 与 warning 语义一致 |
| 7 | `#e040fb` | magenta | 能量最强，微粒 2～3 |
| 8 | `#ffd740` | gold-yellow | 最亮，幅度 ±2% |

### 3.5 实体元素

| 元素 | Hex | 备注 |
|------|-----|------|
| flagPole | `#8899aa` | 旗杆 |
| flagCloth (player) | `#00b8ff` | 与 info 一致（概念图蓝旗） |
| flagDanger | `#ff3344` | AI 高危红旗 |
| mineBody | `#1a2233` | 雷壳 |
| mineCore | `#ff3344` | 雷芯发光 |
| heartFull | `#ff3344` + glow | 概念图红色发光心 |
| heartEmpty | `#4a5568` | 空心轮廓 |

### 3.6 日志 / 弹层色码（静态概念图一致）

| 日志类型 | 颜色 Token | Hex |
|----------|------------|-----|
| AI / Player / Reveal | info | `#00b8ff` |
| System / Scroll / Defuse | warning | `#ffb020` |
| Combo | urgent | `#ff7800` |
| Life Lost / Mine / Break | danger | `#ff3344` |
| Safe / Heal | success | `#00e676` |

### 3.7 Countdown 三环

| 状态 | 环色 | Hex |
|------|------|-----|
| Normal | warning + info 内圈 | `#ffb020` / `#00b8ff` |
| Urgent | urgent | `#ff7800` |
| Critical | danger + 粒子 | `#ff3344` |

### 3.8 概念图 ↔ Production 对照

| 概念图区域 | 主要色 | Production Sheet |
|------------|--------|------------------|
| static §1 AI Hint | 绿/蓝/橙/紫/黄 | Sheet 2 cutouts + Sheet 1 chord |
| static §2 Cell States | 蓝选中光晕 | Sheet 1 cell-hidden/revealed |
| static §4–5 Break/Heal | 橙/红/绿 | Sheet 3 FX + Sheet 4 chips |
| hud §1 HUD | 蓝框 + 红心 | Sheet 4 chips + Sheet 2 hearts |
| hud §10 Tiles | digit 色板 | Sheet 1 digit-1..8 |
| hud §11 FX | 红爆/紫升级/绿安全 | Sheet 3 FX rows |

---

## 4. Sheet 1 — 棋盘 Runtime（最高优先级）

**保存为：** `tile-runtime-production-v4-512x640.png`
**画布：** 512 × 640 px（4 列 × 5 行，每格 **128 × 128**）
**切图：** `scripts/optimize-tiles.py` → `public/assets/tiles/digit-*`、`cell-*` + `public/assets/game/cutouts/*`

### 4.0 工具设置（避免再出 mockup）

| 工具 | 建议 |
|------|------|
| **Midjourney** | 用 prompt 全文；`--sref` 只挂概念图；**不要**用「game screen / UI design」类 preset；可加 `--no game screen HUD mockup` |
| **SD / ComfyUI** | 工作流选 **sprite sheet / icon grid**；Checkpoint 避免「UI mockup」；输出后检查 alpha |
| **即梦 / DALL·E** | 关键词用 **「sprite sheet」「game asset atlas」「transparent PNG grid」**；**禁用**「游戏界面」「完整屏幕」 |
| **通用** | 若出整屏图 → **整批作废**，换 prompt 重跑；不要用 img2img 把 mockup 当底图 |

**风格参考用法：** `--sref` 只借 **颜色与光晕气质**；正文必须写死「4×5 grid、20 cells、transparent、NO HUD」。

### 4.1 完整 Prompt

```text
[Paste STYLE_BLOCK]
[Paste SHEET_RULES]

Create a production PNG sprite sheet: 512×640 pixels, 4 columns × 5 rows, each cell exactly 128×128.
Transparent sheet background. One asset per cell, centered with safe padding.

IMPORTANT — OUTPUT FORMAT:
- This is a SPRITE ATLAS for developers to slice, NOT a playable game screen.
- Do NOT draw HUD, score, mission, timer, combo bar, or a multi-row minesweeper board.
- Exactly 20 separate assets on transparent background. Empty space between cells is transparent.
- Think "Figma icon export grid" or "Unity sprite sheet", NOT "App Store screenshot".
- Use the reference images only for neon-noir material, clipped HUD corners, semantic colors, and glow discipline.

CELL LAYOUT — row by row, left to right:

Row 1:
1 cell-hidden — closed dark blue-gray metal tile #1a2233, clipped octagonal bevel, subtle top highlight #243044, thin cyan rim rgba(0,184,255,0.12).
2 cell-revealed — open recessed tile #0a0e16, inset shadow, faint inner cyan line, same outer size and corner profile as hidden.
3 digit-1 — TRANSPARENT GLYPH ONLY, bold condensed HUD numeral, color #00b8ff, soft cyan outer glow, NO tile background.
4 digit-2 — TRANSPARENT GLYPH ONLY, bold condensed HUD numeral, color #00e676, NO tile background.

Row 2:
5 digit-3 — transparent glyph #ff4757
6 digit-4 — transparent glyph #b44aff
7 digit-5 — transparent glyph #00e5ff
8 digit-6 — transparent glyph #ffb020

Row 3:
9 digit-7 — transparent glyph #e040fb, energetic magenta glow
10 digit-8 — transparent glyph #ffd740, gold-yellow
11 mine-standard — transparent mine, dark metal body #1a2233, glowing red core #ff3344, 8 short spikes, crisp circular silhouette.
12 mine-cracked — same silhouette with red crack highlights and small ember chips, still centered and readable.

Row 4:
13 flag-pole — transparent pole #8899aa, vertical, bottom-centered.
14 flag-cloth — transparent cloth only, cyan #00b8ff, NO pole.
15 flag-blue — complete flag: pole + cyan cloth #00b8ff, same proportions as reference blue flag.
16 chord-crosshair — transparent square/circular reticle hybrid, purple #b44aff + amber corner ticks, AI chord hint.

Row 5:
17 scan-strip — horizontal scan highlight, transparent, cyan #00b8ff soft glow.
18 spark-blue — tiny particle blob, #00b8ff glow.
19 spark-red — tiny particle blob, #ff3344 glow.
20 spark-amber — tiny particle blob, #ffb020 glow.

CRITICAL:
- Digits 1–8 must NOT include cell borders or revealed-tile backgrounds.
- Digit glyphs should occupy ~55–70% of cell width, bold readable stroke, slight outer glow compatible with code shadowBlur.
- All cutouts (mine, flag, sparks) on transparent RGBA cells.
- Keep visual style consistent across all 20 cells — same line weight, same bevel language.
- Reject if it looks like one complete minesweeper board or a phone screenshot.

[Paste negative prompt from §2]
```

### 4.2 Sheet 1 专用防 mockup 规则

```text
SHEET 1 HARD REJECTION RULES:
- Only a 4×5 grid of 20 isolated assets is valid.
- A full mobile game screen is invalid.
- A large minesweeper playfield with many connected tiles is invalid.
- HUD bars, SCORE / MINES / TIMER / COMBO labels, mission panels, status modules, and progress bars are invalid.
- Digits merged into tile squares are invalid; digit slots must be transparent glyphs only.
- A dark solid background behind the whole canvas is invalid.
```

### 4.3 一键复制 Prompt（Sheet 1 · 防 mockup 版）

> **整段复制**到 AI；`--sref` 挂两张概念图，**降低 sref 权重**（只借配色，不借布局）。仍出整屏则换工具或加强 `--no game screen`。

```text
PROJECT: Endless vertical-scroll Minesweeper, mobile portrait.
ART STYLE: Neon-Noir Tactical HUD — dark navy #060912, cyan glow #00b8ff, semantic colors strict.
Match reference images for clipped octagonal HUD corners, dark glass/metal materials, cyan inner rim lights, compact tactical spacing, and controlled glow ONLY.
Do NOT redraw either reference as a full game screen.

OUTPUT TYPE: Production sprite ATLAS — NOT a game screen, NOT a UI mockup, NOT a screenshot.

STRICT FORMAT:
- PNG 512×640 pixels, 4 columns × 5 rows, each cell 128×128.
- 100% transparent background outside the 20 assets.
- Exactly ONE isolated asset per cell, centered, 10–18px padding.
- NO HUD bars, NO score, NO mission text, NO timer, NO combo display, NO full minesweeper board grid.
- NO numbers printed on tile cells — digits are transparent glyphs ONLY in their own cells.
- NO phone frame, NO captions, NO watermarks.
- Style details: chamfered metal tiles, crisp rim light, condensed HUD numerals, icon-like silhouettes, consistent bevel depth.

CELL LAYOUT left-to-right, top-to-bottom:
Row1: cell-hidden #1a2233 | cell-revealed #0a0e16 | digit-1 glyph #00b8ff transparent | digit-2 glyph #00e676 transparent
Row2: digit-3 #ff4757 | digit-4 #b44aff | digit-5 #00e5ff | digit-6 #ffb020 (all transparent glyphs only)
Row3: digit-7 #e040fb | digit-8 #ffd740 | mine-standard #1a2233+#ff3344 core | mine-cracked
Row4: flag-pole #8899aa | flag-cloth #00b8ff | flag-blue complete | chord-crosshair #b44aff
Row5: scan-strip cyan glow | spark-blue | spark-red | spark-amber (all transparent)

--no full game screen, HUD mockup, gameplay screenshot, score display, mission panel, status bar,
minesweeper board with many tiles, combined digit-on-tile, opaque background, phone mockup,
pixel art, 8-bit, photorealistic 3D, web dashboard, watermark, grid labels
```

### 4.4 验收清单

- [ ] 画布精确 512×640，格线对齐 128 整数倍
- [ ] digit 格内无格框像素，仅 glyph
- [ ] hidden / revealed 外轮廓尺寸一致（便于 grid 对齐）
- [ ] 透明底，无整 sheet 灰底
- [ ] **不是**整屏 UI / 无 HUD 顶栏 / 无大棋盘
- [ ] 恰好 **20 格** 独立素材（4×5）

---

## 5. Sheet 2 — Core Cutouts（HUD / 状态图标）

**保存为：** `core-cutouts-production-v2.png`
**画布：** 1024 × 1024 px（4 × 4 格，每格 **256 × 256**）
**切图：** `scripts/slice-production-assets.py`

### 5.1 完整 Prompt

```text
[Paste STYLE_BLOCK]
[Paste SHEET_RULES]

Create a production PNG sprite sheet: 1024×1024 pixels, 4 columns × 4 rows, each cell 256×256.
Transparent background. Chroma-key friendly edges OK but prefer true alpha.
Icon silhouettes must match the reference sheets: compact, centered, faceted HUD cutouts with cyan/semantic rim glow.

CELL LAYOUT — row by row:

Row 1:
1 mine-standard — dark metal mine #1a2233, red core #ff3344, 8 short spikes, transparent.
2 mine-exploded — spent mine silhouette, broken dark fragments, red ember center, transparent.
3 mine-hit-flash — bright red-white flash disc with faint mine silhouette, transparent edges, overlay-friendly.
4 flag-blue — complete cyan flag #00b8ff cloth, silver pole, same proportions as reference.

Row 2:
5 flag-danger-red — red danger flag #ff3344 cloth, AI high-risk hint, no text.
6 flag-wrong-correction — flag with X mark, wrong-flag feedback, red accent sparks.
7 flag-pole — pole only #8899aa.
8 heart-full — glowing red heart #ff3344, soft bloom, 3D-ish game icon.

Row 3:
9 heart-empty — heart outline #4a5568, transparent fill.
10 heart-lost — cracked/dim heart, danger tint #ff3344.
11 heart-refill — heart with green #00e676 pulse/plus, heal feedback, radial glow.
12 warning-triangle — amber #ffb020 alert triangle, simple line icon, dark center.

Row 4:
13 danger-exclamation — red #ff3344 exclamation badge.
14 shield-safe-zone — green #00e676 shield, safe-zone hint, cyan inner ring.
15 chord-crosshair — purple #b44aff reticle (match Sheet 1), amber corner ticks.
16 spark-blue — larger cyan #00b8ff spark for HUD/particles.

Style: Neon-Noir Tactical HUD — same glow language as concept sheets. Icons ~65% cell, crisp at 32–64px.

[Paste negative prompt from §2]
```

---

## 6. Sheet 3 — FX Additive 序列帧

**保存为：** `fx-additive-sprites-production-v2.png`
**画布：** 1536 × 1024 px（8 列 × 8 行，每帧 **192 × 128**）
**切图：** `scripts/slice-production-assets.py`
**混合模式：** 运行时 `lighter`（additive）

### 6.1 完整 Prompt

```text
[Paste STYLE_BLOCK]

Create a production PNG additive FX sprite sheet: 1536×1024 pixels, 8 columns × 8 rows.
Each frame exactly 192×128 pixels. Transparent background outside energy shapes.

Each ROW is one animation, 8 frames left-to-right showing motion progression.
Energy colors on transparent/dark edges — designed for additive blending (screen/lighter).
Do not include labels or numbers. Each frame is a pure VFX overlay, not a UI badge.

ROW 1 — mine-explosion: radial shockwave, red core #ff3344, orange #ff7800 sparks, dark mine fragments.
ROW 2 — combo-burst: orange #ff7800 slash burst + magenta #e040fb rim streaks, no "x12" text.
ROW 3 — safe-reveal: cyan-green ripple #00b8ff / #00e676, expanding scan ring, clean transparent center.
ROW 4 — flag-pop: compact pop ring, cyan #00b8ff + white highlight, tiny cloth motion streak.
ROW 5 — wrong-flag-break: shatter wave, red #ff3344 fragments, broken flag slash, no text.
ROW 6 — heart-refill: green #00e676 heart-shaped glow pulse, ascending particles, positive/heal feel.
ROW 7 — level-up: magenta #e040fb lightning column, purple #b44aff ring, depth milestone energy.
ROW 8 — score-pop: amber #ffb020 + white flash, coinless score tick spark, no digits.

Rules:
- Frame 1 subtle, frames 3–5 peak, frame 8 nearly faded.
- Additive-friendly: transparent edges, bright centers, no opaque black boxes.
- Match endless-hud-popups-v1 FX colors (red explosion, purple level-up, green safe-reveal).
- Motion arc must be obvious across the 8 frames; each frame still usable as an isolated overlay.
- Controlled neon bloom — readable, not rainbow chaos, no smoke cloud filling the frame.

[Paste negative prompt from §2]
```

---

## 7. Sheet 4 — UI Panels / Chips / Buttons

**保存为：** `ui-panels-production-v2.png`
**画布：** 1024 × 1536 px（固定区域分组布局；组件按坐标切图，允许格内留白）
**切图：** `scripts/slice-production-assets.py`（v2 需更新 `UI_PANELS` 坐标）

### 7.1 完整 Prompt

```text
[Paste STYLE_BLOCK]
[Paste SHEET_RULES]

Create a production PNG UI component sheet for mobile endless Minesweeper HUD.
Canvas 1024×1536, transparent background.
Layout: fixed component regions grouped by function. Components are aligned for slicing, but this is not a decorative poster.
Use placeholder English labels ONLY where named below. Labels use condensed uppercase HUD type, cool white #e8f4ff or muted #6b8299.
Never include real gameplay numbers; value zones should be blank glass slots.

TOP ROW — bottom controls:
1 space-active — wide clipped-corner button, cyan glowing double border #00b8ff, dark fill #0e1420, label "SPACE".
2 space-disabled — same shape, desaturated #1a2233, muted label, no glow, disabled rim.
3 auto-off — compact clipped toggle, dark fill, amber/red accent #ff3344 hint, label "AUTO".
4 auto-on — compact clipped toggle, green fill/glow #00e676 active state, label "AUTO".

ROW 2 — modals:
5 start-panel — 360×240 dark glass panel #151d2e, cyan border glow #00b8ff, empty title zone + "START" button slot.
6 ready-panel — 300×240 dark glass panel, green accent #00e676, centered ready glow zone.
7 retry-button — 220×84 red #ff3344 CTA, skull icon socket, strong danger rim.
8 game-over-panel — 430×270 dark glass modal, red danger edge glow #ff3344, empty score/depth slots.

ROW 3 — log + chips:
9 log-panel — 480×280 dark glass panel, cyan thin border, header bar and empty log body, no sample log text.
10 score-chip — 300×132 HUD chip, cyan border #00b8ff, label "SCORE", empty digital value slot.
11 depth-chip — 250×132 HUD chip, label "DEPTH", up-arrow icon socket, empty value slot.
12 lives-chip — 340×132 HUD chip, heart sockets + "LIVES" label, no fixed heart count baked in.

ROW 4 — countdown + status:
13 countdown-yellow — 140×140 ring, amber #ffb020 normal state.
14 countdown-orange — ring, urgent orange #ff7800.
15 countdown-red — ring, critical red #ff3344 with spark hints.
16 defused-chip — 150×150 green #00e676 success badge, segmented-dot socket, no fixed "4/4" text.

ROW 5 — feedback:
17 heal-chip — green #00e676 vertical feedback chip, blank value zone.
18 break-chip — red #ff3344 vertical feedback chip, blank value zone.
19 full-life-panel — 380×140 golden/green celebration banner, heart sockets, no fixed text besides "FULL LIFE" if needed.
20 row-one-chip — 140×170 scroll warning badge, amber accent, empty number slot.
21 row-two-chip — scroll warning badge, orange #ff7800 accent, empty number slot.
22 row-five-chip — scroll warning badge, red #ff3344 accent, empty number slot.

ROW 6 — badges:
23 safe-number-badge — purple #b44aff.
24 flag-badge — cyan #00b8ff.
25 target-yellow-badge — amber #ffb020.
26 target-purple-badge — purple #b44aff.
27 warning-badge — red/amber danger.

All components: Neon-Noir double-line glowing borders, dark glass fill #0e1420–#151d2e.
Use clipped octagonal corners and inner corner brackets like the references.
Do NOT draw a full phone screen around them. Do NOT arrange components as a polished presentation poster.

[Paste negative prompt from §2]
```

> **注意：** 动态数值（分数、连击 `x12`、倒计时秒数）**不要**画死在图上；运行时由 Canvas glyph / 描边文字绘制（见 Ambient §13.6）。

---

## 8. Sheet 5 — HUD 线框 Icons

**保存为：** `hud-icons-production-v2.png`
**画布：** 256 × 320 px（4 列 × 5 行，每格 **64 × 64**；脚本输出 32×32）
**切图：** `scripts/slice-brief-hud.py`（需扩展为读 v2 sheet）

### 8.1 完整 Prompt

```text
[Paste STYLE_BLOCK]
[Paste SHEET_RULES]

Create a production PNG icon sheet: 256×320 pixels, 4 columns × 5 rows, each cell 64×64.
Transparent background. Monoline / duotone game UI icons, 2px stroke feel, rounded caps.

Icons centered, ~70% cell size, color #e8f4ff with cyan #00b8ff or semantic accent glow.
Use the same clipped-corner tactical HUD language as the reference images, but icons themselves stay simple and legible.

Row 1: play triangle | info circle | refresh arrows | flag
Row 2: wand / AI assist | timer ring | warning triangle | skull danger
Row 3: heart-full red glow #ff3344 | heart-empty outline #4a5568 | close X | shield safe-zone
Row 4: plus/heal #00e676 | crosshair/chord #b44aff | mine red core #ff3344 | scroll/down arrow #ff7800
Row 5: sparkle/score #ffb020 | lock/disabled muted | check/safe #00e676 | pause bars

Style: Neon-Noir tactical line icons — slight outer glow, NOT emoji, NOT Material filled icons.
Icons must read clearly at 12–24px display size.

[Paste negative prompt from §2]
```

**运行时当前使用的 8 个 icon：** play, info, refresh, flag, wand, timer, warning, skull（见 `src/ui/hud-sprites.ts`）。

---

## 9. Sheet 6 — HUD 数字字模 Atlas

**保存为：** `hud-digits-atlas-v1.png`
**画布：** 640 × 128 px（10 列 × 1 行，每格 **64 × 128**）
**用途：** Score / Combo `xN` / Countdown 数字（Ambient §13.6），替代裸 `fillText`

### 9.1 完整 Prompt

```text
[Paste STYLE_BLOCK]
[Paste SHEET_RULES]

Create a production PNG bitmap digit atlas: 640×128 pixels, 10 columns × 1 row, each cell 64×128.
Transparent background. Characters left to right:

0 1 2 3 4 5 6 7 8 9

Style: bold digital HUD numerals (seven-segment / tactical display feel),
primary color #e8f4ff with subtle cyan outer glow #00b8ff, compatible with code alpha pulse.
Slight bevel OK — match endless-hud-popups-v1 score boxes: tall condensed, squared terminals, crisp inner cuts.
Each digit centered, consistent cap height ~80% of cell height.
NO background pill, NO comma, NO decimal — digits only.

Optional second row (if tool allows 640×256): add "x", ":", "+", "-", and crown glyphs same style for combo/timer/score UI.

[Paste negative prompt from §2]
```

---

## 10. 风格定调（Step 0 — 概念图已定，**仅 Production 重出**）

**概念图保留，作所有 Production sheet 的风格锚点：**

| 文件 | 用途 |
|------|------|
| `docs/design-assets/generated/endless-static-states-v1.png` | 状态语义、Cell/Hint 色感 |
| `docs/design-assets/generated/endless-hud-popups-v1.png` | HUD/弹层/棋盘 digit/FX 整体 |

生成 Sheet 1–6 时：

- Midjourney：`--sref` 以上两图（权重约 100 / 100 或 50+50 blend）
- **不要** `--sref` 旧 `production/*-v1` 或 `tile-runtime-v3*`（避免继承不理想切图）
- 颜色与构图以 **§3 hex + §4–§9 网格 prompt** 为准；概念图只锁「Neon-Noir 气质」

色板以 **§3 Endless Neon-Noir v1** 为准；概念图与 §3 冲突时 **以 §3 hex 为准**。

---

## 11. 元素 ↔ 资产 ↔ 动效 速查

> 详表见 [`ENDLESS-AMBIENT-LIFE-PLAN.md`](./ENDLESS-AMBIENT-LIFE-PLAN.md) §10、§13.5。

| 元素 | 资产来源 Sheet | 动效层 |
|------|----------------|--------|
| cell-hidden / revealed | Sheet 1 | Ambient：格底亮度/高光 |
| digit-1..8 | Sheet 1 | Ambient：缩放+glow+微粒 |
| mine / flag / crosshair | Sheet 1 + Sheet 2 | Ambient：pivot/脉动 |
| spark-* / scan-strip | Sheet 1 | Ambient 粒子 / scan 线 |
| heart / warning icons | Sheet 2 + Sheet 5 | Ambient：心跳 / 脉冲 |
| safe-reveal … score-pop | Sheet 3 | Action FX 8 帧 |
| HUD chips / panels | Sheet 4 | Ambient：面板 glow / CTA scale |
| Score/Combo 数字 | Sheet 6 | Ambient 亮度 + Action score-pop |
| HUD icons | Sheet 5 | 静态（弹层/日志用） |

---

## 12. 交付规格

| 资产 | 尺寸 | 格式 | 备注 |
|------|------|------|------|
| Sheet 1 每格 | 128×128 | PNG RGBA | 512×640 总画布 |
| Sheet 2 每格 | 256×256 | PNG RGBA | 1024×1024 总画布 |
| Sheet 3 每帧 | 192×128 | PNG RGBA | 1536×1024，8 行动画 |
| Sheet 4 组件 | 见 §7 各 slot | PNG RGBA | 坐标切图 |
| Sheet 5 icon | 64→32 | PNG RGBA | 居中归一化 |
| Sheet 6 digit | 64×128 | PNG RGBA | 0–9 atlas |

**文件命名：** 严格使用上文文件名，放入 `docs/design-assets/production/`。
**切图命令：** `npm run assets:all`（或分步 `assets:tiles` / `assets:production` / `assets:hud`）。

---

## 13. 工具参数参考

### Midjourney

| 用途 | 建议 |
|------|------|
| Sheet 1–6 | `--ar` 按画布比例（如 512×640 → `--ar 4:5`） |
| 定调图 | `--ar 9:16 --stylize 80` |
| 一致性 | 定调图作 `--sref`，或固定 seed |

### Stable Diffusion / ComfyUI

- 正向：`flat game asset`, `sprite sheet`, `transparent background`, `orthographic`, `game UI sprite`
- 负向：§2 全文
- 输出后检查：Photoshop / Photoroom 抠图，或 `#FF00FF` 色键（项目脚本支持 chroma）

### 即梦 / Figma AI

- 强调：`production sprite sheet`, `fixed grid`, `each cell separate asset`, `transparent PNG`
- **不要**选「UI 设计稿」「APP 界面」模板 — 选「游戏素材 / 图标集」

---

## 14. 万能拼接模板

```text
[Paste STYLE_BLOCK]
[Paste SHEET_RULES]

[YOUR SHEET-SPECIFIC CONTENT: grid size, cell list, colors]

Color anchors — Endless Neon-Noir v1 (§3):
bg #060912, panel #0e1420, info #00b8ff, success #00e676,
warning #ffb020, urgent #ff7800, danger #ff3344, chord #b44aff, epic #e040fb.

[Paste negative prompt from §2]
```

---

## 15. 版本记录

| 版本 | 变更 |
|------|------|
| v3 | REVIEW 后 prompt 优化：参考图视觉语言拆解、通用 sheet 规则去 Sheet 1 专用化、增强防 mockup 约束、UI/FX/HUD atlas 防写死数值 |
| v2.1 | **Neon-Noir 色板锁定**：合并 `endless-static-states-v1` + `endless-hud-popups-v1`；§3 全表；Style Lock / 各 Sheet prompt 同步；`theme.ts` 对齐 |
| v2 | Style Lock + Sheet 1–6 + digit 分层 |
| v1 | Modern Dark zinc-indigo（已废弃，勿用于新出图） |

---

## 16. 归档与参考（不切 runtime）

| 路径 | 用途 |
|------|------|
| `docs/design-assets/generated/endless-*.png` | 概念方向参考 |
| `docs/design-assets/reference/endless-arcade-visual-target-v1.png` | 全屏布局参考 |
| `docs/design-assets/archive/unused-from-public/` | 旧 public 资产备份 |
| `docs/design-assets/sliced/` | 切图产物 + manifest 文档副本 |

---

*文档版本：2026-06-23 · v3 · Neon-Noir prompt 优化 · 锚点 endless-static-states-v1 + endless-hud-popups-v1*
