# 移动端触摸输入技术方案

> 版本 v0.1 · 2026-06-28  
> 状态：已实现（P0 + P1；Playwright 自动化可选未做）
> 规则层不变；交互映射以本文档为准，实现后同步 `docs/SPEC.md` §3 平台扩展小节。

---

## 1. 概述

### 1.1 目标

在 **不改变 Core 游戏规则** 的前提下，为无尽模式（及后续 classic / hex fullscreen）提供可用的移动端触摸操作，覆盖桌面端的四种玩家输入：

| #   | 桌面操作                   | 语义                              |
| --- | -------------------------- | --------------------------------- |
| 1   | 左键单击                   | 开格（`onReveal`）                |
| 2   | 双击数字格 / 左右键同按    | Chord 双线（`onChord`）           |
| 3   | 右键                       | 插旗 / 取消插旗（`onToggleFlag`） |
| 4   | Space 键 / 屏幕 SPACE 提示 | 手动卷屏（`onManualScroll`）      |

### 1.2 设计结论（已定稿）

移动端 **保留** 单击开格与双击 Chord；**新增** 垂直滑动手势插旗；**卷屏** 使用专用按钮，不使用上划手势。

| 操作     | 移动端                                |
| -------- | ------------------------------------- |
| 开格     | 单击格子                              |
| Chord    | 双击已翻开且邻雷数 1–8 的数字格       |
| 插旗     | 按住格子 **上滑或下滑**（两方向等价） |
| 手动卷屏 | 点击 **卷屏按钮**（固定 UI，非手势）  |

### 1.3 非目标

- 不改 `src/core/` 布雷、flood fill、胜负、Chord 判定逻辑
- 不引入 React / 额外 DOM 层包裹棋盘（按钮仍画在 Canvas shell 上，与现有 HUD 一致）
- MVP 不做长按插旗、双指 Chord、模式切换工具栏
- 不在本文档范围：hex 模式触摸适配（可复用同一输入模块，单独验收）

---

## 2. 背景

### 2.1 现状

输入集中在 `src/ui/game-canvas/input/pointer-handlers.ts`，当前绑定：

```
mousedown   → onReveal（左键）/ UI hit-test
contextmenu → onToggleFlag
dblclick    → onChord
pointerdown → 仅 unlock 音频（touch 时 early return）
```

键盘 Space 在 `src/app/game-session/mount.ts` 的 `onKeyDown` 中调用 `scroll.performScrollTick(true)`。

屏幕 SPACE 提示由 `src/ui/game-canvas/overlay/space-hint.ts` 绘制，点击区域 `spaceHintRect` 在 `onMouseDown` 中处理——**触摸设备上 mouse 合成事件不稳定**，需统一到 Pointer Events。

### 2.2 布局基础

- 移动端 profile：`getEndlessLayoutProfile(viewportW)`，`viewportW < 768` → `'mobile'`（`src/ui/game-stage-layout.ts`）
- 已有 stage 缩放、bottom rail、contextual Space 提示锚点（`docs/ENDLESS-UX-IMPLEMENTATION-TODO.md`）
- 移动端卷屏按钮可复用 `bottomCenter` 锚点；与 contextual Space 提示合并为 **明确的可点击按钮**，文案/icon 不再写 `SPACE`

---

## 3. 操作映射详述

### 3.1 单击 → 开格

与桌面左键一致，调用 `GameCanvasCallbacks.onReveal(row, col)`。

**前置条件（由 session 层 callback 内已有逻辑保证）：**

- `status === 'idle' | 'playing'`
- 无尽模式：`isEndlessInteractiveScreenRow(row)` 为真
- covered 且未插旗 → 开格；已插旗 / 已翻开 → 无效果（SPEC §3.1）

### 3.2 双击 → Chord

与桌面 `dblclick` 一致，调用 `onChord(row, col)`。

**为何保留双击：**

- Chord 仅对已翻开数字格有意义，目标明确，误触低于「在 covered 格双击」
- 在 covered 格上的连点最多触发两次无效 reveal 尝试，可接受

**实现要求：**

- **禁止**依赖浏览器原生 `dblclick` 作为 touch 唯一路径；触屏上需 **自研 double-tap 检测**（见 §4.2）
- 桌面仍可同时保留 `dblclick` listener，或统一走 pointer 路径

### 3.3 垂直滑动 → 插旗

在 **同一格** 上 pointerdown 后，垂直位移超过阈值即触发 `onToggleFlag(row, col)`。

| 项         | 说明                                                            |
| ---------- | --------------------------------------------------------------- |
| 方向       | `\|dy\| > threshold` 即可，**上滑与下滑等价**                   |
| 目标格     | pointerdown 时 hit-test 锁定的格子；滑动过程中不切换格          |
| 有效格     | covered（含已插旗，用于取消插旗）；revealed → 无效果            |
| 与单击互斥 | 一旦判定为 swipe，**本 pointer 序列不再** 触发 tap / double-tap |

### 3.4 卷屏按钮 → 手动卷屏

点击 shell 上的 **卷屏按钮**，调用 `GameCanvasFullscreenOptions.onManualScroll()`，与 Space 键、`performScrollTick(true)` 同路。

| 项       | 说明                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| 显示策略 | **contextual**：仅在 `spaceEnabled` / scroll pressure 需要玩家决策时出现或高亮（沿用现有 `getScrollPressure` 逻辑） |
| 文案     | 移动端：`卷屏` 或 `↓` 图标；桌面可保留 `SPACE` 键盘提示                                                             |
| 位置     | stage `bottomCenter`；mobile profile 下保证 ≥ 44×44 CSS px 点击热区                                                 |
| 手势     | **不使用** 上划卷屏，避免与插旗滑动冲突                                                                             |

---

## 4. 手势判定规范

### 4.1 常量（建议初值，按 `cellSize` 缩放）

```ts
/** 垂直滑动认定为插旗的最小位移（逻辑 px，相对 pointerdown） */
SWIPE_THRESHOLD_Y = max(20, cellSize * 0.35)

/** 仍算作「点击」的最大位移（未达则参与 tap / double-tap） */
TAP_SLOP = max(10, cellSize * 0.18)

/** 双击窗口（ms） */
DOUBLE_TAP_MS = 300

/** 双击允许的最大位移 */
DOUBLE_TAP_SLOP = TAP_SLOP
```

### 4.2 Pointer 事件流

仅在 `pointerType !== 'mouse'`（或 `getEndlessLayoutProfile === 'mobile'`）时启用完整手势状态机；桌面 mouse 可继续走现有 `mousedown` / `contextmenu` / `dblclick` 路径，或逐步统一到 pointer（推荐最终统一，减少双轨）。

```
pointerdown (capture)
  ├─ hit UI（卷屏按钮、start、retry、bgm…）→ 走现有 UI 分支，不进入格手势
  ├─ hit 棋盘格 → 记录 session = { cell, x0, y0, t0, pointerId }
  └─ preventDefault(); setPointerCapture(pointerId)

pointermove
  ├─ 无 session → return
  ├─ |dy| > SWIPE_THRESHOLD_Y 且未 committed
  │     → session.mode = 'swipe-flag'
  │     → 可选：播放预览反馈（§6）
  └─ 更新 boardPointer 悬停（pressed=true）

pointerup / pointercancel
  ├─ mode === 'swipe-flag'
  │     → onToggleFlag(cell)（若格仍 covered）
  ├─ mode === 'tap' 且位移 < TAP_SLOP
  │     ├─ 距上次同格 tap < DOUBLE_TAP_MS → onChord(cell)（若 revealed 且 1≤adj≤8）
  │     └─ 否则 → 记录 pending tap；延迟 DOUBLE_TAP_MS 后若无第二次 → onReveal(cell)
  └─ release capture; clear session
```

**双击延迟 tap 说明：** 第一次 tap 后等待 `DOUBLE_TAP_MS` 再执行 reveal，若窗口内第二次 tap 同格则取消 reveal、改执行 chord。这是 touch 上常见的 double-tap 模式，避免「先开格再 chord」的竞态。

**Chord 前置校验（UI 层，与 core 一致）：**

- `status === 'playing'`
- 格已 `revealed` 且 `adjacentMines` 为 1–8

### 4.3 浏览器默认行为

Canvas 元素：

```css
touch-action: none; /* 禁止浏览器滚动/缩放接管 */
-webkit-touch-callout: none;
user-select: none;
```

`contextmenu`：继续 `preventDefault()`，避免长按弹出系统菜单（尤其 iOS）。

`pointerdown`：对棋盘区域 `preventDefault()`，减少 300ms 点击延迟与 ghost click（若仍观察到，可评估 `fastclick` 类 polyfill，通常不需要）。

---

## 5. 卷屏按钮 UI

### 5.1 与现有 SPACE 提示的关系

| 平台    | 表现                                                                    |
| ------- | ----------------------------------------------------------------------- |
| Desktop | 可保持现有 contextual `SPACE` 文字提示（键盘文化）                      |
| Mobile  | 同一 `spaceHintRect` 热区，绘制 **卷屏按钮**（icon + 可选 urgent 脉冲） |

实现上扩展 `drawSpaceHint` / 新增 `drawScrollButton`，由 `getEndlessLayoutProfile` 分支文案与样式，**hit-test 与 callback 不变**（`onManualScroll`）。

### 5.2 布局

- 锚点：`getSpaceHintRect(rt, scrollPressure)`（危险带上方，stage 相对坐标）
- Mobile：最小热区 44×44 CSS px；与 Auto dev 标签不重叠（见 `ENDLESS-RESPONSIVE-UX-AUDIT.md` §2）
- `spaceEnabled === false` 时不绘制、不可点

### 5.3 输入

卷屏按钮必须在 **Pointer Events** 路径可点：

- `pointerdown` + `pointerup` 于 `spaceHintRect` 内 → `onManualScroll()`
- 与 mouse 路径并存，直至完全统一

---

## 6. 视觉与触觉反馈（P1，可分期）

| 时机               | 反馈                                                     |
| ------------------ | -------------------------------------------------------- |
| pointerdown 按住格 | 现有 `boardPointer.pressed` 悬停高亮                     |
| 滑动超过阈值       | 格缘短箭头（↑↓）或旗子预览；可选 `navigator.vibrate(10)` |
| 插旗成功           | 沿用现有 `playFlagToggleAudio`                           |
| 卷屏按钮 urgent    | 沿用现有 sin 脉冲与 `#fef08a` 色                         |
| 双击 Chord         | 沿用 `chordAction` 音效                                  |

首版（P0）可只做 pressed 高亮 + 现有音效，箭头预览放 P1。

---

## 7. 架构与模块改动

### 7.1 分层原则

```
┌─────────────────────────────────────────┐
│  app/game-session/mount.ts              │  callbacks 不变
├─────────────────────────────────────────┤
│  ui/game-canvas/input/                  │
│    pointer-handlers.ts    ← 手势状态机 │
│    touch-gesture.ts       ← 新建：常量、session、判定 │
│    ui-hit-test.ts         ← 卷屏按钮 target 命名 │
├─────────────────────────────────────────┤
│  ui/game-canvas/overlay/space-hint.ts   │  mobile 卷屏按钮绘制
├─────────────────────────────────────────┤
│  ui/game-canvas/create.ts               │  注册 pointermove/up/cancel
├─────────────────────────────────────────┤
│  core/                                  │  无改动
└─────────────────────────────────────────┘
```

### 7.2 新建文件

**`src/ui/game-canvas/input/touch-gesture.ts`**

- 导出 `TouchGestureSession` 类型与 `createTouchGestureController(rt)`
- 封装 threshold 计算（依赖 `squareLayout.grid.cellSize`）
- 单元可测：`classifyPointerEnd(session, dx, dy, dt)` → `'swipe-flag' | 'tap' | 'cancel'`

### 7.3 修改文件

| 文件                        | 改动                                                                            |
| --------------------------- | ------------------------------------------------------------------------------- |
| `input/pointer-handlers.ts` | 扩展 `onPointerDown/Move/Up/Cancel`；mobile 格操作走 gesture controller         |
| `create.ts`                 | 绑定 `pointermove`, `pointerup`, `pointercancel`（window 级 up，防拖出 canvas） |
| `overlay/space-hint.ts`     | mobile 分支绘制卷屏按钮                                                         |
| `overlay/event-overlay.ts`  | 传递 profile 给 hint 绘制（若需要）                                             |
| `runtime/state.ts`          | 可选：`touchGestureSession` 字段                                                |
| `styles` / canvas class     | `touch-action: none` on `.game-canvas--fullscreen`                              |

### 7.4 平台检测

```ts
function useTouchGestureInput(viewportW: number, pointerType: string): boolean {
  return getEndlessLayoutProfile(viewportW) === 'mobile' || pointerType === 'touch'
}
```

viewport 变化时（旋转）不重置进行中的 pointer session；新手势以当前 profile 为准。

### 7.5 Callback 契约（不变）

```ts
interface GameCanvasCallbacks {
  onReveal(row: number, col: number): void
  onToggleFlag(row: number, col: number): void
  onChord(row: number, col: number): void
  onReset(): void
}
```

```ts
onManualScroll?: () => void;  // fullscreen shell，已实现
```

---

## 8. 边界情况

| 场景                                    | 行为                                                     |
| --------------------------------------- | -------------------------------------------------------- |
| pointerdown 在格 A，拖到格 B 后 release | 仍对格 A 判定；若 \|dy\| 达阈值 → toggle flag on A       |
| 插旗格上 swipe                          | 取消插旗（toggle）                                       |
| 插旗格上 tap                            | 无 reveal（SPEC）；tap 仍触发，callback 内 no-op         |
| revealed 格 swipe                       | 无 flag 效果；若 \|dy\| 大仍算 swipe 消耗序列，不 reveal |
| revealed 数字格 double-tap              | chord                                                    |
| revealed 空格（0）double-tap            | callback 内 chord 无效，无效果                           |
| playing 以外 status                     | 不进入格手势（与现 mouse 逻辑一致）                      |
| 无尽非交互行（preview / buffer）        | hit-test miss 或 callback 内拒绝                         |
| 多指                                    | 仅跟踪第一个 `pointerId`；第二指忽略直至第一指结束       |
| pointercancel（来电、系统手势）         | 清理 session，不触发任何 action                          |
| 快速 swipe 后误触 tap                   | swipe committed 后 suppress tap                          |
| 卷屏按钮与格滑动                        | UI hit-test 优先；点在按钮上不进入格 session             |

---

## 9. 验收标准

### 9.1 功能（P0）

- [x] 360×640、390×844 Portrait：单击 covered 格开格
- [x] 双击（或 double-tap）revealed 数字格触发 Chord，旗数匹配时展开邻格
- [x] 按住格上滑或下滑触发插旗/取消插旗
- [x] swipe 不触发同序列 reveal
- [x] scroll pressure 出现时卷屏按钮可点，触发 manual scroll
- [x] 卷屏按钮不可见时无法 manual scroll（与 desktop Space 行为一致）
- [x] 桌面 mouse：左/右/dblclick/Space 行为回归无变化

### 9.2 体验（P1）

- [x] 滑动阈值手感可调，无误触卷屏
- [x] 页面不因棋盘操作而滚动
- [x] 无长按系统菜单
- [x] 卷屏按钮与 Auto 不重叠（360×640）

### 9.3 自动化

- [x] `touch-gesture.ts` 单元测试：threshold、double-tap 窗口、swipe 互斥
- [x] Playwright：`responsive-matrix` 或新用例模拟 pointer 序列（可选 P1）

---

## 10. 实施阶段

| 阶段     | 内容                                                          | 预估     |
| -------- | ------------------------------------------------------------- | -------- |
| **P0-a** | `touch-gesture.ts` + pointer 事件绑定 + tap/swipe 接 callback | 核心     |
| **P0-b** | double-tap chord + 与 tap reveal 延迟互斥                     | 核心     |
| **P0-c** | 卷屏按钮 mobile 绘制 + pointer hit-test                       | 核心     |
| **P0-d** | `touch-action: none` + contextmenu 防护                       | 核心     |
| **P1**   | 滑动视觉反馈、vibrate、Vitest 覆盖                            | polish   |
| **P2**   | mouse 路径合并到 pointer，删除重复 listener                   | refactor |

每阶段完成后按项目节奏写入 `docs/REVIEW-LOG.md`，并在 `docs/PROJECT.md` 增加 TODO 项。

---

## 11. SPEC 同步计划（实现后）

在 `docs/SPEC.md` §3 增加 **§3.5 触摸（Mobile）**：

- 单击 = 左键
- Double-tap 数字格 = Chord
- 垂直滑动手势 = 右键插旗
- 卷屏按钮 = Space

桌面映射保持 §3.1–3.3 不变。

---

## 12. 相关文档与代码

| 资源             | 路径                                           |
| ---------------- | ---------------------------------------------- |
| 游戏规则         | `docs/SPEC.md`                                 |
| 架构分层         | `docs/ARCHITECTURE.md`                         |
| Stage 布局       | `src/ui/game-stage-layout.ts`                  |
| 输入处理         | `src/ui/game-canvas/input/pointer-handlers.ts` |
| SPACE / 卷屏提示 | `src/ui/game-canvas/overlay/space-hint.ts`     |
| Session 回调     | `src/app/game-session/mount.ts`                |
| 响应式审计       | `docs/ENDLESS-RESPONSIVE-UX-AUDIT.md`          |

---

## 变更日志

| 版本 | 日期       | 说明                                                                      |
| ---- | ---------- | ------------------------------------------------------------------------- |
| v0.1 | 2026-06-28 | 初稿：单击/双击保留，上下滑插旗，卷屏按钮                                 |
| v0.2 | 2026-06-28 | P0/P1 验收勾选完成；`touch-gesture.ts` + `scripts/touch-gesture-tests.ts` |
