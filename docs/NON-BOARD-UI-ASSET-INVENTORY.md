# Agent Brief：无尽扫雷 · 主流程游戏 UI（出图任务书）

> **读者**：负责出图 / 切图 / 图集的 Agent。  
> **完整资产生成总表**：[`VISUAL-ASSET-GENERATION-BRIEF.md`](./VISUAL-ASSET-GENERATION-BRIEF.md)（棋盘 + UI + FX，含 v1/v2 对照）  
> **本文范围**：仅 **开始游戏 → 对局 → 失败重试** 主流程非棋盘 UI。  
> **本轮不要生成**：棋盘格内资产、音频、宇宙背景、日志弹层及日志图标、SPACE 提示、程序绘制项；棋盘见总表 §3.1–3.3。

**风格锚点（以此为准）**：

1. `docs/design-assets/generated/endless-static-states-v1.png`
2. `docs/design-assets/generated/endless-fx-sprite-concept-v1.png`
3. `docs/design-assets/generated/endless-hud-popups-v1.png`

详见总表 [`VISUAL-ASSET-GENERATION-BRIEF.md`](./VISUAL-ASSET-GENERATION-BRIEF.md) §2（Cyber-Arcade 霓虹 HUD，**非** zinc 扁平）

---

## 0. 整体视觉风格

**定调**：与三张概念稿一致 — **Cyber-Arcade / Sci-Fi Neon**：深底、电蓝双线框、切角面板、**强 bloom**；START 金黄斜体、失败红框、连击/得分高亮粒子。

| 角色           | 色值                 | 用途                 |
| -------------- | -------------------- | -------------------- |
| 深底           | `#030408`～`#09090b` | 与深空融合           |
| **电蓝（主）** | `#00A2FF`～`#00f0ff` | HUD 框、安全、音量开 |
| **霓虹绿**     | `#00FF42`～`#22c55e` | 连击、HEAL           |
| **亮红**       | `#FF0000`～`#ef4444` | 失败、静音关、BREAK  |
| **琥珀金**     | `#FF9900`～`#fbbf24` | START、score-pop     |
| 连击高档       | 橙 → 紫              | level-up、高 tier    |

- **形体**：切角 / 双线科技框（见 `endless-hud-popups-v1`）；非厚重 keycap。
- **光效**：概念稿级 bloom + 粒子；连击/FX 可更亮，默认 HUD 仍须发光描边（**不是** 哑光 chip）。
- **文字**：动态分数/连击 **不烘焙**；面板可烘焙 `START`、`GAME OVER`、`RETRY`、`AUTO`。
- **`SPACE`**：程序 Canvas 闪烁文字，**禁止出图**。
- **FX 序列帧**：`192×128`、纯黑底 `#000000`、固定 **8 帧**、additive 叠色。

---

## 1. 主流程（你要服务的路径）

```
idle（开始遮罩）→ playing（顶栏 HUD + 底栏轨 + 对局 FX）→ lost（失败遮罩 + 重试）
```

| 阶段               | 屏幕表现                                                | 资产 or 程序                                                     |
| ------------------ | ------------------------------------------------------- | ---------------------------------------------------------------- |
| **idle**           | 棋盘上方中央 **START** 面板，点击开始                   | `start-panel` + `play` 图标                                      |
| **playing · 顶栏** | 左 SCORE、中 COMBO（>1 时）、右 5 颗心 **+ BGM 静音钮** | 心形 cutout + `volume-on` / `volume-off`；分数/连击 **程序叠字** |
| **playing · 底栏** | 全宽卷轴能量轨                                          | **程序绘制**，不出图                                             |
| **playing · 提示** | 底行可卷时 `SPACE` 闪烁                                 | **程序文字**，不出图                                             |
| **playing · 反馈** | 加分、连击、断裂、升级、补血                            | FX 序列帧 + 少量 chip                                            |
| **playing · 右下** | AUTO（开发/调试入口）                                   | `auto-off` / `auto-on`                                           |
| **lost**           | 暗 scrim + GAME OVER 面板 + RETRY                       | `game-over-panel` + `skull` / `refresh`                          |

---

## 2. 明确不要生成（本轮）

- 日志：`log-panel` 及 `info` / `wand` / `flag` / `timer` / `warning` 等日志行图标
- SPACE：`space-hint-*`、`space-active` 等一切贴图
- **未接入主流程的 HUD 装饰**：`score-chip`、`combo-hud-*`、`lives-chip`、`full-life-panel`、`hud-top-line`、`bottom-rail*`、`countdown-*`、`scroll-danger-band`、`overlay-scrim`、`ready-panel`
- **角标 / 扩展池**：`depth-chip`、`defused-chip`、`row-*-chip`、各类 `*-badge`、`pause` / `settings` / `home` 等扩展图标
- 棋盘内、音频、宇宙背景

以下由 **Canvas 程序绘制**，有 v1 贴图也不本轮重做：`drawScoreHud`、`drawComboHud`、`drawBottomEnergyRail`、`drawFullscreenScrollWarning`、全屏 `overlayScrim`。

---

## 3. 交付物

| 类别           | 落盘                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 设计主稿（v2） | `ui-panels-production-v2.png`、`fx-additive-sprites-production-v2.png`、`core-cutouts-production-v2.png`、`hud-icons-production-v2.png` |
| 切图           | `public/assets/game/ui/`、`cutouts/`、`fx/<名>/frame-01…08.png`                                                                         |
| 图标           | `public/assets/hud/icons/`（仅 §4 所列）                                                                                                |
| 清单           | 更新 `public/assets/game/manifest.json`                                                                                                 |

### 技术规则

| 类型         | 规格                                            |
| ------------ | ----------------------------------------------- |
| Cutout（心） | `256×256` 透明 PNG，full / empty **外轮廓一致** |
| UI 面板      | 单张 PNG；标注文案/按钮安全区                   |
| HUD 图标     | 源图 `128×128` 透明 PNG                         |
| FX           | 每帧 `192×128` 黑底，8 帧                       |

可点击控件建议：`default` + `-hover`（代码后续可接；**先出 default 即可上线**）。

---

## 4. 生成清单（仅主流程）

### 4.1 开始 / 失败（优先）

| 文件名                   | 说明                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `ui/start-panel.png`     | 中央开始面板；**烘焙** `START` + 播放图标位（或留图标区叠 `play`）                       |
| `ui/game-over-panel.png` | 失败面板；**烘焙** `GAME OVER` + **内嵌 RETRY 按钮区**（程序在面板下方叠 `SCORE xxxxx`） |
| `ui/retry-button.png`    | 独立重试钮（可选；若已画进 `game-over-panel` 可不单切）                                  |
| `hud/icons/play.png`     | 开始面板播放图标                                                                         |
| `hud/icons/skull.png`    | 失败面板标题装饰                                                                         |
| `hud/icons/refresh.png`  | 重试按钮图标                                                                             |

> **现状**：v1 已有 `start-panel`、`game-over-panel`、`retry-button`，风格偏旧；主流程仍大量走 Canvas fallback。**本轮重点是 v2 换皮对齐参考锚点。**

### 4.2 对局 HUD · 生命

| 文件名                    | 说明                     |
| ------------------------- | ------------------------ |
| `cutouts/heart-full.png`  | 满血心                   |
| `cutouts/heart-empty.png` | 空槽心（与 full 同尺寸） |

### 4.3 对局 HUD · BGM 静音（必出）

右上角生命行 **下方**，可点击切换 idle BGM 静音。运行时：`drawBgmMuteHud` → `volume-on` / `volume-off`（`src/ui/game-canvas/create.ts`）。

| 文件名                           | 说明                                   |
| -------------------------------- | -------------------------------------- |
| `hud/icons/volume-on.png`        | BGM **播放中**（扬声器 + 声波）        |
| `hud/icons/volume-off.png`       | BGM **已静音**（扬声器 + 斜杠/叉）     |
| `hud/icons/volume-on-hover.png`  | 播放态悬停（提亮或外发光；**建议出**） |
| `hud/icons/volume-off-hover.png` | 静音态悬停（**建议出**）               |

**布局要求**：两态图标 **同画布尺寸、同视觉重心**；线宽与 `play` / `skull` 等主流程图标一致。悬停时程序会叠半透明圆角底，图标本身仍需可辨的 hover 变体。

> **现状**：v1 仅有 `volume-on` / `volume-off`，无 hover 图；风格需 v2 对齐参考锚点。

### 4.4 对局 HUD · AUTO（开发入口）

| 文件名            | 说明                        |
| ----------------- | --------------------------- |
| `ui/auto-off.png` | 右下 AUTO 关闭              |
| `ui/auto-on.png`  | 右下 AUTO 开启（更亮/绿灯） |

### 4.5 对局反馈（FX + 小标签）

运行时已在 `src/ui/game-canvas/create.ts` 调用：

| 事件                | 文件名                                                                              | 类型        |
| ------------------- | ----------------------------------------------------------------------------------- | ----------- |
| 消雷加分            | `fx/score-pop/frame-01…08.png`                                                      | 8 帧        |
| 连击增加            | `fx/combo-burst/frame-01…08.png`                                                    | 8 帧        |
| 连击断裂            | `fx/wrong-flag-break/frame-01…08.png` + `ui/break-chip.png`                         | 8 帧 + 静态 |
| 连击里程碑 10/20/50 | `fx/level-up/frame-01…08.png`                                                       | 8 帧        |
| 补血                | `fx/heart-refill/frame-01…08.png` + `ui/heal-chip.png` + `cutouts/heart-refill.png` | 8 帧 + 静态 |

> **掉血**：暂无贴图动效接入（`heart-lost` 未接线）。**本轮可不生成**；若顺带出 `cutouts/heart-lost.png` + `fx/heart-lost/` 作预留即可。

---

## 5. 主稿排版

| 主稿                                    | 内容                                           |
| --------------------------------------- | ---------------------------------------------- |
| `ui-panels-production-v2.png`           | §4.1 开始/失败、§4.4 AUTO                      |
| `hud-icons-production-v2.png`           | §4.1 图标 + **§4.3 静音四态**                  |
| `fx-additive-sprites-production-v2.png` | §4.5 全部 FX，每行 8 格等分                    |
| `core-cutouts-production-v2.png`        | §4.2 心形 full / empty / refill（+ 可选 lost） |

**不要**在主稿里排日志、SPACE、score-chip、combo 光晕、底栏轨、角标扩展池。

---

## 6. 验收

- [x] §4 每个文件名有对应 PNG（retry-button、heart-lost 若标可选可跳过）
- [x] `start-panel`、`game-over-panel` 含烘焙文案与安全区；无 baked 动态分数/连击数
- [x] FX 8 帧、等尺寸、黑底、主体不跳帧
- [x] BGM 静音：`volume-on` / `volume-off` 及 hover 四张齐全、尺寸一致
- [x] 风格符合 §0，与 **三张概念稿** 一致（尤其 `endless-hud-popups-v1` + `endless-fx-sprite-concept-v1`）
- [x] 已更新 `manifest.json`
- [x] **未**产出日志、SPACE、扩展图标池、未接入 HUD 装饰

---

## 7. 文件名速查

```
# Cutouts
cutouts/heart-full.png
cutouts/heart-empty.png
cutouts/heart-refill.png

# FX (each: frame-01.png … frame-08.png)
fx/score-pop/
fx/combo-burst/
fx/wrong-flag-break/
fx/level-up/
fx/heart-refill/

# UI
ui/start-panel.png
ui/game-over-panel.png
ui/retry-button.png          # optional if baked into game-over-panel
ui/auto-off.png
ui/auto-on.png
ui/break-chip.png
ui/heal-chip.png

# Icons
hud/icons/play.png
hud/icons/skull.png
hud/icons/refresh.png
hud/icons/volume-on.png
hud/icons/volume-off.png
hud/icons/volume-on-hover.png
hud/icons/volume-off-hover.png
```

---

## 8. 参考（人类）

- 布局：`ENDLESS-FULLSCREEN-LAYOUT.md`（SPACE §8.1 为 Canvas 文字）
- 切片流程：`UI-PRODUCTION-ASSET-TODO.md`
- 运行时接线：`src/ui/game-canvas/create.ts`、`src/ui/hud-sprites.ts`
