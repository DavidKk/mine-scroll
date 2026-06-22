# 无尽模式 · 全屏 Canvas 整体布局

> **单一事实来源**：改顶栏、棋盘、底栏、AI 按钮、绘制顺序时，以本文为准。  
> 预览行细则见 [`ENDLESS-TOP-PREVIEW-ROW.md`](./ENDLESS-TOP-PREVIEW-ROW.md)。  
> HUD 动效与反馈见 [`ENDLESS-HUD-FEEDBACK-UX-PLAN.md`](./ENDLESS-HUD-FEEDBACK-UX-PLAN.md)。

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
│ ③ 底栏能量轨（全宽，贴视口最底）                                                                │
│    卷轴压迫 / 倒数进度；`bottomRailRect` 锚定在 viewport 底部，不跟在棋盘后面                    │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ ④ DEV：AI 小按钮（右下，在 ③ 上方，不挡能量轨）                                                │
└────────────────────────────────────────── viewportH ──────────────────────────────────────────┘
```

### 各层「占满」含义

| 层 | 水平 | 竖向 |
|----|------|------|
| ① 顶栏 | **占满视口宽**：装饰线/分区从 `x=0` 到 `x=viewportW`，内容区左右 `safe` 内边距排 SCORE / LIVES | **贴顶**：`hudY = 0`（或最多 4px 呼吸），**不要**再下移一整段 `safe` 留黑边 |
| ② 棋盘 | 水平居中；格宽 **PC 由宽度决定** | **不**按高度撑满；slack 居中（PC） |
| ③ 底栏 | `bottomRailRect`：**x=0, w=viewportW** | 贴视口最底 |
| ④ AI | 右下角 `autoRect`，仅 `import.meta.env.DEV` | 在 `bottomRailRect` 上方 |

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
| `bottom` | 视口底留给底栏 | `bottomRailH(30) + bottomPad(6)` |
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

## 8. 底栏（③ 层）

- 函数：`drawBottomEnergyRail`  
- 矩形：**只用** `stageLayout.bottomRailRect`，禁止 `boardY + boardH + …` 推算  
- 玩局中 `progress` 来自 `getScrollPressure()`；无压迫时仍保留淡轨占位  

---

## 9. 代码落点速查

| 职责 | 文件 |
|------|------|
| 布局坐标、预留、格宽 | `src/ui/game-stage-layout.ts` |
| 绘制顺序、HUD、底栏、overlay | `src/ui/game-canvas.ts` |
| 棋盘格、预览带 | `src/ui/renderer.ts` |
| 会话 HUD 数据（无 defused） | `src/app/game-session.ts` → `getCanvasHudStats` |
| 视口格宽公式 | `src/ui/theme.ts` → `computeViewportCellSize` |
| 多分辨率预览 | `src/app/responsive-matrix.ts`（`?ui=responsive`） |

---

## 10. 改动检查清单（防「改 A 坏 B」）

动布局前过一遍：

- [ ] 格宽是否仍走 `computeEndlessBoardCellSize` + `getEndlessShellReserves`？  
- [ ] `boardY/boardX` 是否仍走 `computeGameStageLayout`？  
- [ ] 顶栏是否**贴顶 + 全宽**？  
- [ ] 底栏是否仍锚 `bottomRailRect` 贴视口底？  
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
        └── ENDLESS-RESPONSIVE-UX-AUDIT.md   历史问题与宽屏策略（实现以本文为准）
```

**冲突时**：整体分区与坐标以**本文**为准；预览行交互以预览行文档为准；动效细节以 HUD 计划为准。
