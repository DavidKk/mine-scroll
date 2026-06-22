# 无尽模式 · 全屏 Canvas 整体布局

> **单一事实来源**：改顶栏、棋盘、底栏、AI 按钮、绘制顺序时，以本文为准。  
> 预览行细则见 [`ENDLESS-TOP-PREVIEW-ROW.md`](./ENDLESS-TOP-PREVIEW-ROW.md)。  
> HUD 动效与反馈见 [`ENDLESS-HUD-FEEDBACK-UX-PLAN.md`](./ENDLESS-HUD-FEEDBACK-UX-PLAN.md)。  
> 元素待机生动感见 [`ENDLESS-AMBIENT-LIFE-PLAN.md`](./ENDLESS-AMBIENT-LIFE-PLAN.md)。

---

## 1. 设计目标

**Shell（顶栏 + 底栏）**：始终 **全宽贴边**（PC / 移动相同）。

**内容（棋盘）**：**宽度等比缩放**，不按高度撑满；格宽主要由可用宽度决定，棋盘高度随格宽自然得出，上下可留白。

两套自适应（分界 `viewportW >= 768` 为 PC）：

| | PC `desktop` | 移动 `mobile`（后续细调） |
|--|--|--|
| Shell 缩放 | `viewportW / 390` | `min(vw/390, vh/844)` contain |
| 棋盘格宽 | **宽度优先**，过高时再收紧 | `min(fromW, fromH)` contain |
| 棋盘竖向 | 在 ①～③ 之间 **垂直居中** | 略偏上（0.15 slack） |

所有坐标来自 **同一套** `GameStageLayout`。

---

## 2. 竖向分区（固定四层）

```
y = 0
┌────────────────────────────────────────── viewportW ──────────────────────────────────────────┐
│ ① 顶栏 HUD（全宽，贴顶）                                                                      │
│    SCORE 左对齐 · LIVES 右对齐 · COMBO 仅连击>1 时中间闪现（不常驻）                            │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                               │
│ ② 棋盘区（水平居中；PC：**宽度等比**，不纵向撑满）                                         │
│    · 21 行可玩 + 顶缘 0.5 行预览                                                           │
│    · `computeEndlessBoardCellSize`：PC 先算 fromW，仅过高时用 fromH 上限                      │
│    · 上下 slack 在 PC 上 **居中**分配，不强行贴满高度                                         │
│                                                                                               │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ ③ 底栏壳层（全宽，贴视口下方；**推荐**见 §8.1）                                                 │
│    · 上：`SPACE` 情境提示（仅可上移时显示，在压迫条**上方**）                                    │
│    · 下：`bottomRailRect` 能量轨 / 卷轴压迫进度（**贴视口最底缘**）                              │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ ④ DEV：AI 小按钮（右下，在 ③ 上方，不挡 SPACE / 能量轨）                                        │
└────────────────────────────────────────── viewportH ──────────────────────────────────────────┘
```

### 各层「占满」含义

| 层 | 水平 | 竖向 |
|----|------|------|
| ① 顶栏 | **占满视口宽**：装饰线/分区从 `x=0` 到 `x=viewportW`，内容区左右 `safe` 内边距排 SCORE / LIVES | **贴顶**：`hudY = 0`（或最多 4px 呼吸），**不要**再下移一整段 `safe` 留黑边 |
| ② 棋盘 | 水平居中；格宽 **PC 由宽度决定** | **不**按高度撑满；slack 居中（PC） |
| ③ 底栏壳层 | `bottomRailRect` 全宽贴底；`spaceHintRect` 在其**正上方**居中 | 见 §8.1 |
| ④ AI | 右下角 `autoRect`，仅 `import.meta.env.DEV` | 在 `spaceHintRect` 或 `bottomRailRect` 之上，右对齐 |

### 明确不画在 Canvas 上

- **消雷进度**：玩法在 `mines-defused.ts`（4 颗换 1 命），**无 Canvas / HUD / 经典顶栏胶囊展示代码**。
- 顶栏**常驻** COMBO 芯片：连击 >1 才用中间 burst，平时不占位。

---

## 3. 缩放

```ts
profile = viewportW >= 768 ? 'desktop' : 'mobile'

// Shell（HUD / 底栏 / 字体）
stageScale = profile === 'desktop'
  ? clamp(0.85, 1.35, viewportW / 390)
  : clamp(0.72, 1.18, min(viewportW / 390, viewportH / 844))
```

`stageX/stageW` 仅作宽屏参考框，**不**裁剪棋盘区域。

---

## 4. 预留区：格宽与位置必须同源

**唯一入口**：`getEndlessShellReserves(viewportW, viewportH)` → `game-stage-layout.ts`

| 字段 | 含义 | 基准（scale=1） |
|------|------|-----------------|
| `hudY` | 顶栏顶边 | **0**（贴顶） |
| `hudH` | 顶栏高度 | 56 |
| `top` | 棋盘区顶边 = `hudY + hudH + hudGap` | hudGap ≈ 8 |
| `bottom` | 视口底留给底栏壳层 | `spaceHintH(可选) + spaceGap + bottomRailH(30) + bottomPad(6)`（§8.1） |
| `side` | 格宽计算左右 safe | 16 |

**格宽**（`computeEndlessBoardCellSize`）：

```ts
// desktop
fromW = floor((availW + gap) / cols - gap)
cell  = clamp(min, max, fromW)
if (gridHeight(cell) > availH) cell = clamp(min, max, fromW, fromH)

// mobile（暂用 contain，后续可改为高度优先）
cell = min(fromW, fromH)
```

**棋盘位置**：

- `boardX = (viewportW - boardW) / 2`
- `boardY = top + slack * (profile === 'desktop' ? 0.5 : 0.15)`

---

## 5. 绘制顺序（禁止打乱）

`game-canvas.ts` → `paint()` 无尽全屏：

```
1. clearRect + drawModernBackground（全屏）
2. ctx.save(); translate(boardX, boardY)
3. renderBoardOnlyFrame（内含 clearRect，仅清棋盘局部坐标系）
4. drawCellEffects（仍在棋盘坐标系）
5. ctx.restore()
6. drawFullscreenOverlay（底栏能量轨、SPACE、Start/GameOver 蒙层、连击 burst…）
7. drawFullscreenHud（顶栏 SCORE/LIVES/COMBO + AI）  ← 必须在 overlay 之后
```

### 为何 7 必须在 6 之后

- `renderBoardOnlyFrame` 的 `clearRect` 会擦掉先画的 HUD。  
- Start 蒙层会盖住先画的 AI。  
- **改 HUD 位置时不要改 1～5 的顺序**；只能改 `GameStageLayout` 坐标或 6/7 画什么。

---

## 6. 顶栏具体规范（① 层）

| 元素 | 位置 | 行为 |
|------|------|------|
| SCORE | 左：`x = safe`，`y = hudY + 7*scale` | 标签 + 五位数字 |
| LIVES | 右：`x = viewportW - safe`，右对齐 | 心形行 |
| COMBO | 中：`x = viewportW/2` | **仅 `combo > 1`** 时 `drawComboHud` |
| 底部分割线 | 全宽渐变线：`barX=0, barW=viewportW`，`y = hudY + hudH` | 贴顶栏下沿 |

---

## 7. 棋盘（② 层）

| 常量 | 值 |
|------|-----|
| 可玩行 | `ENDLESS_VISIBLE_ROWS = 21` |
| 预览行高 | `ENDLESS_PREVIEW_ROWS = 0.5` |
| 列数 | 会话 `board.cols`（通常 9） |

命中、预览、渐变：只认 [`ENDLESS-TOP-PREVIEW-ROW.md`](./ENDLESS-TOP-PREVIEW-ROW.md)。

---

## 8. 底栏壳层（③ 层）

### 8.1 推荐：倒数条贴底 + SPACE 在条上方（**优于**浮在棋盘上）

**结论**：把卷轴压迫条保持在 **视口最下缘**，把 `SPACE` 收到 **压迫条正上方** 的底栏壳层里，比当前「SPACE 浮在棋盘危险行附近」更好。

```
（自上而下，屏幕下方区域）

  ② 棋盘底缘
  ─────────────────
  [  SPACE  ]       ← spaceHintRect：仅 playing 且可手动上移时出现；idle 闪烁
  ═══●═══════       ← bottomRailRect：压迫/倒数进度（始终贴 viewport 最底）
  · safe pad ·
```

| 优点 | 说明 |
|------|------|
| 不挡棋 | SPACE 不再压在可玩格/危险行上 |
| 因果紧邻 | 上看棋盘、下看「快卷了 → 按 SPACE 上移」一条竖线读完 |
| 拇指区 | 移动端底部横条 + 上方短标签，单手够得着 |
| 与反馈分层一致 | 底栏中段留给连击/得分 burst（`getBottomFeedbackSlots`），壳层底缘专管卷轴 |

**坐标约定（实现时）**：

```ts
// game-stage-layout.ts — 预留增高 bottom
const spaceHintH = ENDLESS_SPACE_HINT_H * scale; // 建议 20～24 * scale
const spaceGap = 4 * scale;

bottomRailRect = {
  y: viewportH - bottomPad - bottomRailH,
  h: bottomRailH,
  // x/w 全宽不变
};

spaceHintRect = {
  x: viewportW / 2 - hintW / 2,
  y: bottomRailRect.y - spaceGap - spaceHintH,
  w: hintW,
  h: spaceHintH,
};
```

- **禁止**用 `boardY + boardH` 或危险行 `dangerTop` 推算 SPACE（当前 `getSpaceHintRect` 做法，待改）。
- **禁止**把 SPACE 画到 `bottomRailRect` **下方**（会掉进 home indicator / 视口外）；「底部」指 **壳层区域靠下**，条最贴边，SPACE 在条**上面**。
- `getEndlessShellReserves().bottom` 在 playing 时应含 `spaceHintH + spaceGap`，避免棋盘与底栏重叠；**未显示 SPACE 时**可只用 rail 高度（或仍预留细缝，避免卷轴时布局跳变）。

### 8.2 能量轨（倒数条）

- 函数：`drawBottomEnergyRail`  
- 矩形：**只用** `stageLayout.bottomRailRect`  
- 玩局中 `progress` 来自 `getScrollPressure()`；无压迫时仍保留淡轨占位  

### 8.3 SPACE 提示

- 函数：`drawSpaceHint`；矩形：`spaceHintRect`（§8.1）  
- **仅** `spaceEnabled && playing` 时绘制；不可用时不占位（或保留透明命中区，二选一，实现时定）  
- urgent 时提高闪烁幅度（已有逻辑可保留）  
- 与 [`ENDLESS-HUD-FEEDBACK-UX-PLAN.md`](./ENDLESS-HUD-FEEDBACK-UX-PLAN.md)「情境提示、非常驻大按钮」一致  

### 8.4 与现状差异

| 项 | 现状（代码） | 目标 |
|----|--------------|------|
| SPACE 位置 | `getSpaceHintRect` 锚危险行 / 棋盘底 | 锚 `bottomRailRect` 上方 |
| 倒数条 | 已贴 `viewportH` 底 | 保持 |
| 底栏预留 | 仅 `railH + pad` | 增加 SPACE 槽位（§8.1） |

---

## 9. 代码落点速查

| 职责 | 文件 |
|------|------|
| 布局坐标、预留、格宽 | `src/ui/game-stage-layout.ts` |
| 绘制顺序、HUD、底栏、overlay | `src/ui/game-canvas/create.ts` |
| 棋盘格、预览带 | `src/ui/renderer/`（`board.ts`、`cells.ts`） |
| 会话 HUD 数据 | `src/app/game-session/mount.ts` → `getCanvasHudStats` |
| 视口格宽公式 | `src/ui/theme.ts` → `computeViewportCellSize` |
| 多分辨率预览 | `src/app/responsive-matrix.ts`（`?ui=responsive`） |

---

## 10. 改动检查清单（防「改 A 坏 B」）

动布局前过一遍：

- [ ] 格宽是否仍走 `computeEndlessBoardCellSize` + `getEndlessShellReserves`？  
- [ ] `boardY/boardX` 是否仍走 `computeGameStageLayout`？  
- [ ] 顶栏是否**贴顶 + 全宽**？  
- [ ] 底栏是否 **rail 贴底 + SPACE 在 rail 上方**（§8.1），而非 SPACE 浮在棋盘？  
- [ ] `paint()` 是否仍为 背景 → 棋盘 → overlay → **HUD 最后**？  
- [ ] 是否仍有消雷相关 UI 文案或 `hudDefused` / `defusedAnchor` 代码？（应为否）  
- [ ] 预览行行为是否仍符合预览行文档？  
- [ ] `npm test` 是否通过？  
- [ ] 至少目视 `390×844` 与 `1280×900` 两档截图？

---

## 11. 与其它文档关系

```
ENDLESS-FULLSCREEN-LAYOUT.md   ← 本文：整体分区、坐标、绘制顺序
        │
        ├── ENDLESS-TOP-PREVIEW-ROW.md   顶行 0.5 预览
        ├── ENDLESS-HUD-FEEDBACK-UX-PLAN.md   连击/得分飞入动效
        ├── ENDLESS-AMBIENT-LIFE-PLAN.md      待机生动感 ambient 动效
        └── ENDLESS-RESPONSIVE-UX-AUDIT.md   历史问题与宽屏策略（实现以本文为准）
```

**冲突时**：整体分区与坐标以**本文**为准；预览行交互以预览行文档为准；动效细节以 HUD 计划为准。
