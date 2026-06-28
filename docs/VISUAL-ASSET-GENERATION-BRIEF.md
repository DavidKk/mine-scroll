# 视觉资产生成总表（Agent 任务书）

> **读者**：负责重新出图 / 切图 / 图集的 Agent。  
> **目标**：在 **同一套视觉语言** 下，一次性规划并生成游戏中所有 **位图资产**（棋盘 + 非棋盘 UI），替换当前 v1 / v2 混用、风格割裂的切片。  
> **风格锚点（以此为准，三张概念稿）**：
>
> 1. `docs/design-assets/generated/endless-static-states-v1.png` — 格子 / 按钮 / 交互态
> 2. `docs/design-assets/generated/endless-fx-sprite-concept-v1.png` — 全部 additive FX 序列
> 3. `docs/design-assets/generated/endless-hud-popups-v1.png` — HUD、弹层、开始/失败、心形、倒计时  
>    **辅助全屏构图**：`docs/design-assets/reference/endless-arcade-visual-target-v1.png`（仅作布局参考，**色与框线以三张概念稿为准**）  
>    **运行时配色 fallback**：`src/ui/theme.ts`（生成时允许向概念稿电蓝 / 霓虹绿偏移，但 **全表统一**）  
>    **子集速查（仅主流程 HUD）**：[`NON-BOARD-UI-ASSET-INVENTORY.md`](./NON-BOARD-UI-ASSET-INVENTORY.md)

---

## 0. 当前风格 REVIEW（为何需要整包重生成）

| 问题                           | 表现                                                                                                       | 涉及资产                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **与目标风格相反**             | 当前 `tiles/` 偏 zinc 扁平；v2 为 `generate-gameplay-assets.py` 占位；**都不是**概念稿的 Cyber-Arcade 霓虹 | 需整包按 §2 重出                                |
| **v1 / v2 主稿共存**           | `public/assets/production/*-v1.png` 与 `*-v2.png` 同时存在，切片来源混乱                                   | production 目录                                 |
| **棋盘 cutout 已删、代码仍要** | manifest v2 仅 3 颗心；雷/旗 cutout 已从磁盘删除，运行时回退 tile 图，爆炸 FX 无图                         | `GAME_CUTOUT_NAMES` 中 mine/flag*               |
| **棋盘 FX 已删、代码仍要**     | `cell-breath` `mine-explosion` `safe-reveal` 等目录已从 `public/assets/game/fx` 移除，格子动效走程序或空载 | `GAME_FX_NAMES` 棋盘相关项                      |
| **HUD 心形双份**               | `public/assets/hud/heart-*.png`（旧 brief 切图）与 `game/cutouts/heart-*.png`（v2）并存，造型不一致        | lives 行                                        |
| **图标池未纳入 v2**            | 主流程 7+4 枚 v2 图标与 `hud/icons` 里 20+ 枚 v1 brief 线框图标混用                                        | `src/ui/hud-sprites.ts` `HUD_ICON_NAMES`        |
| **面板描边语言不一**           | START 偏蓝厚框；GAME OVER 偏红厚实体；AUTO chip 与 icon 线宽不同                                           | `ui/start-panel` · `game-over-panel` · `auto-*` |

**结论**：不要「只换 HUD 不换棋盘」或「只换棋盘不换 FX」。Agent 应按 **§2 统一风格** 整表重出，再跑切片脚本更新 `manifest.json`。

---

## 1. 明确不要生成（位图）

| 类别                           | 说明                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| **宇宙 / 视差背景**            | `src/ui/ambient-backdrop/` 程序绘制                                 |
| **SPACE 提示**                 | Canvas 文字闪烁，见 `ENDLESS-FULLSCREEN-LAYOUT.md` §8.1             |
| **分数 / 连击动态数字**        | 程序叠字（DM Sans / IBM Plex Mono）                                 |
| **底栏卷轴能量轨、全屏 scrim** | 程序渐变绘制                                                        |
| **音频**                       | `public/assets/game/audio/*.wav` 另管线维护（见 Asset Lab › Audio） |
| **日志弹层（暂缓）**           | `log-panel` 及日志行图标本轮不出                                    |

---

## 2. 统一视觉规范（= 三张概念稿风格）

### 2.1 定调：Cyber-Arcade / Sci-Fi Neon HUD

**无尽街机扫雷**：深海军蓝黑底 + **高对比霓虹发光**（bloom、粒子、细扫描线）。  
军事科幻 HUD：倒角 / 切角框、双线科技边框、全息玻璃面板。**不要** Win95 灰框、zinc 哑光扁平、8-bit 像素、厚重实体键帽。

| 概念稿                             | Agent 先看什么                                                             |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `endless-static-states-v1.png`     | 格子 hidden/hover/pressed/selected；START·RETRY 按钮；卷轴色带；BREAK/HEAL |
| `endless-fx-sprite-concept-v1.png` | 8 行 FX，每行 8 帧；发光强度、粒子形状、配色分工                           |
| `endless-hud-popups-v1.png`        | 顶栏模块、心形、倒计时环、START/READY、雷/旗/数字格、combo 字效            |

### 2.2 配色（语义分工，全表一致）

| 语义                     | 概念稿色                        | 用途                                                |
| ------------------------ | ------------------------------- | --------------------------------------------------- |
| 深底                     | 海军黑 `#030408`～`#09090b`     | 画布、未翻开格                                      |
| **信息 / 安全 / 主操作** | **电蓝** `#00A2FF`～`#00f0ff`   | HUD 框、safe-reveal、flag-pop、level-up、音量开     |
| **成功 / 连击**          | **霓虹绿** `#00FF42`～`#22c55e` | combo-burst、HEAL、安全提示                         |
| **危险 / 雷 / 失败**     | **亮红** `#FF0000`～`#ef4444`   | mine-explosion、wrong-flag-break、GAME OVER、静音关 |
| **警告 / START**         | **琥珀金** `#FF9900`～`#fbbf24` | 卷轴压迫、START 文案、score-pop                     |
| **高级 / 和弦 / AI**     | **紫** `#a78bfa`～`#c084fc`     | chord、高连击 tier（可选）                          |
| 数字 1–8                 | 蓝→绿→红→紫…（LED 感）          | 见 hud-popups 棋盘区，饱和霓虹                      |

**禁止**：混用 zinc 哑光与概念稿霓虹；禁止无发光的纯色块 UI。

### 2.3 造型语言

- **边框**：双线 / 切角科技框；面板带 scanline 或内发光。
- **按钮**：START = 宽框 + **金黄斜体大写**；RETRY = 红框 + 骷髅；hover = bloom 提亮。
- **格子**：隐藏格微倒角暗金属；选中 = **粗电蓝霓虹描边**；hover = 内发光。
- **图标**：粗线发光矢量；静音 = 电蓝开 / 红或灰关 + hover。
- **FX**：径向针刺、星芒、碎屑、同心波纹；各行 **同一发光语言**（见 FX 概念稿）。

### 2.4 FX 序列帧（对齐 `endless-fx-sprite-concept-v1.png`）

每行 **8 帧**，**192×128**，底 **纯黑 `#000000`**，运行时 `lighter` 叠加。行序与概念稿一致：

| 行  | 动效 ID            | 色彩    | 动作要点                             |
| --- | ------------------ | ------- | ------------------------------------ |
| 1   | `mine-explosion`   | 红橙    | 白芯 → 针刺星爆 → 余烬环 → 粒子散    |
| 2   | `combo-burst`      | 霓虹绿  | 连击环，针刺放射                     |
| 3   | `safe-reveal`      | 电蓝    | 闪光 → 方框描边 → sonar 涟漪         |
| 4   | `flag-pop`         | 电蓝    | 旗杆插下 → 底部脉冲环                |
| 5   | `wrong-flag-break` | 红      | 红旗+X → 碎裂闪电 / 碎片             |
| 6   | `heart-refill`     | 蓝→红绿 | 空心 → 充能 → 实心红心 + 治愈脉冲    |
| 7   | `level-up`         | 电蓝    | 向上光柱 + 地面波纹                  |
| 8   | `score-pop`        | 金      | 斜体发光字 + 金粒（**+数字程序叠**） |

循环类（static 概念稿）：`cell-breath` `cell-hover` `digit-particles` `flag-wave` — 同 FX 规格。

### 2.5 技术规格

| 类型      | 尺寸        | 背景        |
| --------- | ----------- | ----------- |
| 棋盘 tile | 128×128     | 透明        |
| Cutout    | 256×256     | 透明        |
| HUD 图标  | 128×128     | 透明        |
| UI 面板   | 见 §3.4     | 透明        |
| FX 帧     | 192×128 × 8 | **#000000** |

交互态：`-hover` `-pressed` `-active`；各态画布尺寸与重心一致。

### 2.6 Agent 出图提示（可粘贴）

```
Endless Arcade Minesweeper asset, Cyber-Arcade sci-fi neon HUD style.
Match: endless-static-states-v1 + endless-fx-sprite-concept-v1 + endless-hud-popups-v1.
Dark navy background, electric blue #00A2FF emissive borders, neon green combos,
hot red danger, golden score/START text, chamfered double-line tech frames,
heavy bloom and particles, NOT flat zinc, NOT pixel art, NOT photoreal 3D.
Transparent PNG / black #000000 FX frames, crisp game sprites.
```

---

## 3. 资产生成总表

图例：**磁盘** = `public/` 下是否有文件；**manifest** = `manifest.json` v2 是否登记；**接线** = 运行时是否读取。

### 3.1 棋盘 · Tile 图集（v1 在盘，待统一重出）

源参考：`endless-hud-popups-v1.png` §10/11 + `endless-static-states-v1.png` 格子区（**色与框线以概念稿为准，勿沿用** `tile-sprite-sheet-v1` 的 zinc 色）

| ID            | 路径                            | 版本 | 磁盘 | 接线  | 再生   |
| ------------- | ------------------------------- | ---- | ---- | ----- | ------ |
| cell-hidden   | `tiles/cell-hidden.png`         | v1   | ✓    | ✓     | **P0** |
| cell-revealed | `tiles/cell-revealed.png`       | v1   | ✓    | ✓     | **P0** |
| mine          | `tiles/mine.png`                | v1   | ✓    | ✓     | **P0** |
| flag          | `tiles/flag.png`                | v1   | ✓    | ✓     | **P0** |
| num-1 … num-8 | `tiles/num-1.png` … `num-8.png` | v1   | ✓    | 备用¹ | P1²    |

¹ 运行时 `crispDigits: true` 时数字用 Canvas 字，tile 数字为 fallback。  
² 若坚持全 Canvas 数字，可只出格底不出 num 切片。

**主稿**：`tile-sprite-sheet-v3.png`（128px 格；视觉对齐 hud-popups 棋盘区）

运行时：`public/assets/tiles/` · `src/ui/tile-sprites.ts`

---

### 3.2 棋盘 · Cutout 高精单体（v1 曾入库，磁盘已删，代码仍引用）

源参考：`core-cutouts-production-v1.png`（旧）→ 新出 `core-cutouts-production-v3.png`  
运行时：`public/assets/game/cutouts/` · `getGameCutout()` · `GAME_CUTOUT_NAMES`

| ID                    | 路径                                | 版本 | 磁盘 | manifest | 接线    | 再生   |
| --------------------- | ----------------------------------- | ---- | ---- | -------- | ------- | ------ |
| mine-standard         | `cutouts/mine-standard.png`         | v1   | ✗    | ✗        | ✓       | **P0** |
| mine-exploded         | `cutouts/mine-exploded.png`         | v1   | ✗    | ✗        | ✓       | **P0** |
| mine-cracked          | `cutouts/mine-cracked.png`          | v1   | ✗    | ✗        | ✓       | P1     |
| mine-hit-flash        | `cutouts/mine-hit-flash.png`        | v1   | ✗    | ✗        | ✓       | **P0** |
| flag-blue             | `cutouts/flag-blue.png`             | v1   | ✗    | ✗        | ✓       | **P0** |
| flag-danger-red       | `cutouts/flag-danger-red.png`       | v1   | ✗    | ✗        | 预留    | P2     |
| flag-wrong-correction | `cutouts/flag-wrong-correction.png` | v1   | ✗    | ✗        | 预留    | P2     |
| flag-pole             | `cutouts/flag-pole.png`             | v1   | ✗    | ✗        | 预留    | P2     |
| heart-full            | `cutouts/heart-full.png`            | v2   | ✓    | ✓        | ✓       | **P0** |
| heart-empty           | `cutouts/heart-empty.png`           | v2   | ✓    | ✓        | ✓       | **P0** |
| heart-refill          | `cutouts/heart-refill.png`          | v2   | ✓    | ✓        | ✓       | **P0** |
| heart-lost            | `cutouts/heart-lost.png`            | v1   | ✗    | ✗        | 未接    | P2     |
| warning-triangle      | `cutouts/warning-triangle.png`      | v1   | ✗    | ✗        | 预留    | P3     |
| danger-exclamation    | `cutouts/danger-exclamation.png`    | v1   | ✗    | ✗        | 预留    | P3     |
| shield-safe-zone      | `cutouts/shield-safe-zone.png`      | v1   | ✗    | ✗        | AI hint | P2     |
| chord-crosshair       | `cutouts/chord-crosshair.png`       | v1   | ✗    | ✗        | AI hint | P2     |

**废弃合并**：`public/assets/hud/heart-full.png` · `heart-empty.png` — 重生成后 **只保留** `game/cutouts/`，删除 hud 重复项并改 `hud-sprites.ts` fallback。

---

### 3.3 棋盘 · Additive FX 序列帧（v1 曾入库，部分已删）

源参考：`fx-additive-sprites-production-v1.png` → 新出 `fx-additive-sprites-production-v3.png`  
每动效：`fx/<name>/frame-01.png` … `frame-08.png`（192×128 黑底）

| ID               | 版本 | 磁盘 | manifest | 接线   | 再生   |
| ---------------- | ---- | ---- | -------- | ------ | ------ |
| safe-reveal      | v1   | ✗    | ✗        | ✓      | **P0** |
| mine-explosion   | v1   | ✗    | ✗        | ✓      | **P0** |
| flag-pop         | v1   | ✗    | ✗        | ✓      | **P0** |
| flag-wave        | v1   | ✗    | ✗        | ✓ 循环 | P1     |
| cell-breath      | v1   | ✗    | ✗        | ✓ 循环 | P1     |
| cell-hover       | v1   | ✗    | ✗        | ✓ 循环 | P1     |
| digit-particles  | v1   | ✗    | ✗        | ✓ 循环 | P1     |
| combo-burst      | v2   | ✓    | ✓        | ✓ HUD  | **P0** |
| score-pop        | v2   | ✓    | ✓        | ✓ HUD  | **P0** |
| wrong-flag-break | v2   | ✓    | ✓        | ✓ HUD  | **P0** |
| level-up         | v2   | ✓    | ✓        | ✓ HUD  | **P0** |
| heart-refill     | v2   | ✓    | ✓        | ✓ HUD  | **P0** |
| heart-lost       | —    | ✗    | ✗        | 未接   | P2     |

**要求**：棋盘 FX 与 HUD FX **同一发光语言**（线宽、粒子形状、核心亮度），仅构图不同。

---

### 3.4 非棋盘 · UI 面板（v2 在盘，程序占位质量）

源：`ui-panels-production-v2.png` → 建议 `ui-panels-production-v3.png`  
路径：`public/assets/game/ui/`

| ID              | 约略尺寸 | 版本 | 磁盘 | manifest | 接线   | 再生   |
| --------------- | -------- | ---- | ---- | -------- | ------ | ------ |
| start-panel     | 364×246  | v2   | ✓    | ✓        | ✓ idle | **P0** |
| game-over-panel | 430×269  | v2   | ✓    | ✓        | ✓ lost | **P0** |
| retry-button    | 218×84   | v2   | ✓    | ✓        | 可选³  | P0     |
| auto-off        | 113×117  | v2   | ✓    | ✓        | ✓      | P0     |
| auto-on         | 116×128  | v2   | ✓    | ✓        | ✓      | P0     |
| break-chip      | 144×48   | v2   | ✓    | ✓        | ✓      | P0     |
| heal-chip       | 144×48   | v2   | ✓    | ✓        | ✓      | P0     |

³ 若 `game-over-panel` 已烘焙 RETRY 区，可不单切 `retry-button`。

**暂缓（旧 v1 有图、主流程未接）**：`ready-panel` `log-panel` `score-chip` `lives-chip` `countdown-yellow/orange/red` `depth-chip` `defused-chip` `row-*-chip` `*-badge` `full-life-panel` — **本轮不出**，除非产品重新启用。

**程序绘制、不出图**：底栏轨、SPACE、顶栏 SCORE/COMBO 数字底（除非日后改接贴图）。

---

### 3.5 非棋盘 · HUD 图标

源：`hud-icons-production-v2.png` → `hud-icons-production-v3.png`  
路径：`public/assets/hud/icons/`（128×128）

#### 主流程（必须）

| ID               | 版本 | 磁盘 | manifest | 接线 | 再生   |
| ---------------- | ---- | ---- | -------- | ---- | ------ |
| play             | v2   | ✓    | ✓        | ✓    | **P0** |
| skull            | v2   | ✓    | ✓        | ✓    | **P0** |
| refresh          | v2   | ✓    | ✓        | ✓    | **P0** |
| volume-on        | v2   | ✓    | ✓        | ✓    | **P0** |
| volume-off       | v2   | ✓    | ✓        | ✓    | **P0** |
| volume-on-hover  | v2   | ✓    | ✓        | ✓    | **P0** |
| volume-off-hover | v2   | ✓    | ✓        | ✓    | **P0** |

#### 扩展池（v1 brief 切片，风格旧，按需重出）

| ID                        | 接线场景             | 再生  |
| ------------------------- | -------------------- | ----- |
| pause settings home help  | 未接主流程           | P3    |
| trophy medal target stats | 未接                 | P3    |
| undo shield heart plus    | heart 与 cutout 重复 | P3    |
| flag wand timer warning   | 日志 / 卷轴预留      | 暂缓⁴ |
| info                      | 日志标题             | 暂缓⁴ |
| scroll-up                 | 卷轴提示预留         | P3    |
| icon-extra-1 icon-extra-2 | 占位                 | P3    |

⁴ 日志 UI 暂缓时 **不要** 单出 info/wand/flag/timer/warning。

---

### 3.6 参考图（Agent 必读顺序）

| 优先级 | 文件                                            | 用途                                 |
| ------ | ----------------------------------------------- | ------------------------------------ |
| **1**  | `generated/endless-static-states-v1.png`        | **交互态 / 按钮 / 格子** — 风格真源  |
| **2**  | `generated/endless-fx-sprite-concept-v1.png`    | **FX 8×8 网格** — 风格真源           |
| **3**  | `generated/endless-hud-popups-v1.png`           | **HUD / 弹层 / 开始流程** — 风格真源 |
| 4      | `reference/endless-arcade-visual-target-v1.png` | 全屏构图辅助                         |
| —      | `reference/tile-sprite-sheet-v1.png`            | 旧 tile 布局（**色不要沿用**）       |
| —      | `reference/design-system-sheet-brief-v1.png`    | 旧 zinc 方向，**禁止混用**           |
| —      | `production/*-v1.png` · `*-v2.png`              | 待废弃，由 v3 取代                   |

运行时副本（可选）：`public/assets/generated/endless-*-v1.png`

---

## 4. 推荐生成顺序（Agent 工作流）

```
1. 精读三张概念稿（§3.6 优先级 1–3）+ §2.6 提示词
2. tile-sprite-sheet-v3 — 格子/雷/旗/数字，视觉对齐 static-states + hud-popups §10/11
3. core-cutouts-v3 — 雷/旗/心高精版，与 tile 同发光语言
4. fx-additive-sprites-v3 — 严格按 fx-sprite-concept 八行构图
5. ui-panels-v3 + hud-icons-v3 — 对齐 hud-popups（START 金字蓝框、RETRY 红框、静音电蓝）
6. 切片 → manifest → Asset Lab 自检
```

---

## 5. 生产主稿排版（v3 建议）

| 主稿文件                                | 内容                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `tile-sprite-sheet-v3.png`              | §3.1 全部 tile                                                          |
| `core-cutouts-production-v3.png`        | §3.2 全部 cutout（4×4 或列表排版）                                      |
| `fx-additive-sprites-production-v3.png` | §3.3 — **布局对齐** `endless-fx-sprite-concept-v1.png`（8 行 × 8 帧）   |
| `ui-panels-production-v3.png`           | §3.4 — 对齐 `endless-hud-popups-v1` + `endless-static-states-v1` 按钮区 |
| `hud-icons-production-v3.png`           | §3.5 主流程图标（扩展池可第二张）                                       |

副本同步：`public/assets/production/` 与 `docs/design-assets/production/`。

---

## 6. 切片与入库

```bash
# 主流程 UI 占位生成（当前 v2，重出后替换脚本或改用手工切片）
pnpm run assets:gameplay

# 全量 production 切片（tile / 旧 production 流程）
pnpm run assets:all
```

清单：`public/assets/game/manifest.json`（版本号递增，登记 **§3.2–3.5 全部接线项**）。

预览图：`preview-cutouts.png` · `preview-fx.png` · `preview-ui-panels.png`。

---

## 7. 验收清单

- [x] 与 **三张概念稿** 同屏对比无明显风格漂移（发光、框线、配色）
- [x] FX 主稿行序 / 动效气质对齐 `endless-fx-sprite-concept-v1.png`
- [x] 所有 cutout 同角色 **外轮廓尺寸一致**
- [x] 所有 FX：**8 帧、192×128、黑底、不跳帧**
- [x] 主流程 UI 面板 + 7+4 图标齐全；**无** SPACE / 日志 / 底栏轨贴图
- [x] `manifest.json` 与磁盘文件一致；Asset Lab 三区可浏览
- [x] 删除或合并重复资产（`hud/heart-*` vs `cutouts/heart-*`）
- [x] v1 主稿标记废弃或移入 `docs/design-assets/archive/`（人类可选）

---

## 8. 文件名速查（整包）

```
# Tiles (128×128 transparent)
tiles/cell-hidden.png
tiles/cell-revealed.png
tiles/mine.png
tiles/flag.png
tiles/num-1.png … tiles/num-8.png

# Cutouts (256×256 transparent)
cutouts/mine-standard.png
cutouts/mine-exploded.png
cutouts/mine-cracked.png
cutouts/mine-hit-flash.png
cutouts/flag-blue.png
cutouts/flag-danger-red.png
cutouts/flag-wrong-correction.png
cutouts/flag-pole.png
cutouts/heart-full.png
cutouts/heart-empty.png
cutouts/heart-refill.png
cutouts/heart-lost.png
cutouts/warning-triangle.png
cutouts/danger-exclamation.png
cutouts/shield-safe-zone.png
cutouts/chord-crosshair.png

# FX (each fx/<name>/frame-01.png … frame-08.png, 192×128 #000)
fx/safe-reveal/
fx/mine-explosion/
fx/flag-pop/
fx/flag-wave/
fx/cell-breath/
fx/cell-hover/
fx/digit-particles/
fx/combo-burst/
fx/score-pop/
fx/wrong-flag-break/
fx/level-up/
fx/heart-refill/
fx/heart-lost/

# UI panels
ui/start-panel.png
ui/game-over-panel.png
ui/retry-button.png
ui/auto-off.png
ui/auto-on.png
ui/break-chip.png
ui/heal-chip.png

# HUD icons (128×128) — 主流程
hud/icons/play.png
hud/icons/skull.png
hud/icons/refresh.png
hud/icons/volume-on.png
hud/icons/volume-off.png
hud/icons/volume-on-hover.png
hud/icons/volume-off-hover.png

# HUD icons — 扩展池（P3，可选）
hud/icons/pause.png
hud/icons/settings.png
…（见 §3.5）
```

---

## 9. 运行时索引（人类）

| 模块                   | 路径                                                         |
| ---------------------- | ------------------------------------------------------------ |
| Tile                   | `src/ui/tile-sprites.ts`                                     |
| Cutout / FX / UI panel | `src/ui/game-assets.ts`                                      |
| HUD 图标               | `src/ui/hud-sprites.ts`                                      |
| 格子绘制               | `src/ui/renderer/cells.ts` · `src/ui/cell-fx.ts`             |
| 全屏 HUD / 弹层        | `src/ui/game-canvas/create.ts`                               |
| 资产浏览               | `/assets/sprites` · `/assets/animations` · `/assets/game-ui` |
