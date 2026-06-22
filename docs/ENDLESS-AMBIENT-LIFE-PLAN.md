# 无尽模式 · 待机生动感（Ambient Life）动效方案

> **目标**：对局等待、思考、卷轴间隙时，界面**不要纯静止**——数字、旗帜、地雷、格底等有克制的持续微动与微粒，让玩家感到场景「在线」。  
> **术语**：文中「呼吸 / ambient」均指 **待机生动感**（idle life），**不是**拟人式呼吸；核心是「可见元素在无事发生时仍有变化」。  
> **范围**：仅视觉与绘制层；**不改**玩法、AI、计分规则。  
> **关系**：布局与绘制顺序以 [`ENDLESS-FULLSCREEN-LAYOUT.md`](./ENDLESS-FULLSCREEN-LAYOUT.md) 为准；事件型反馈（连击 burst、得分飘字）以 [`ENDLESS-HUD-FEEDBACK-UX-PLAN.md`](./ENDLESS-HUD-FEEDBACK-UX-PLAN.md) 为准；**本文**定义持续循环的 ambient 层。

---

## 1. 设计原则

### 1.1 两层动效，不可混用

| 层级 | 英文名 | 触发 | 时长 | 示例 |
|------|--------|------|------|------|
| **环境层** | Ambient | 元素可见即循环 | 1.2～4.0s 周期 | 数字脉动、旗子轻摆、雷芯微光、格周微粒 |
| **动作层** | Action | 玩家/规则事件 | 300～760ms 单次 | safe-reveal、flag-pop、mine-explosion、combo-burst |

- Ambient **不替代** Action：开格仍播 sprite 序列；ambient 只在静态展示时叠加。
- Action 播放期间，对应格子的 ambient **暂停或减弱**（避免两套缩放打架）。

### 1.2 「待机生动感」的统一定义（非拟人呼吸）

等待/思考时，玩家应能感知界面在「运转」，而不是贴图冻住。实现上仍用**慢循环**（正弦或漂移），但语义是 **idle life**，不是胸腔起伏。

所有 ambient 循环优先用**正弦相位**，不用随机跳变：

```ts
// 共享时钟；t 为秒
const idleWave = (t: number, periodSec: number, phase = 0) =>
  Math.sin((t / periodSec) * Math.PI * 2 + phase);

// 映射到 [min, max]，例如缩放 0.97～1.03
const lerpIdle = (t, period, phase, min, max) =>
  min + (max - min) * (0.5 + 0.5 * idleWave(t, period, phase));
```

- **相位分散**：`phase = hash(cellKey) % TAU`，避免全盘同步「齐刷刷」。
- **幅度克制**：单元素缩放不超过 ±4%；旋转不超过 ±4°；透明度波动不超过 ±12%。
- **粒子点缀**：数字/雷等前景除 transform 外，可挂 **1～3 颗慢速微粒**（绕格心漂移、近零速度），强化「带电/待爆」感；低密度，不挡读数。
- **低连击 / 低压**：ambient 更弱；高连击 / 卷轴 urgent 时，允许全局 ambient 增益 +10～15%（「局势变热」）。
- **资产未就绪不阻塞**：digit 透明图未产出前，先保留 `num-N` 整格 sprite 分支；仅启用格底、旗、雷、HUD/面板 ambient。digit 分层通过 `sprites.digits?.length === 8` 之类的能力检测开启，避免 P0 被美术资产卡住。

### 1.3 可读性优先

- 数字 idle 时**不得**改变邻格可读性（不溢出格线、不加粗描边到糊成一团）。
- 未翻开格**不得**闪到像可点击高亮（避免误导 chord）。
- `prefers-reduced-motion: reduce` 时：**关闭** ambient，仅保留 Action 层（或 Action 时长减半）。

### 1.4 性能预算

- 全屏最多 **1 路** `requestAnimationFrame` 循环（与现有 `scheduleAnimationFrame` 合并）。
- 优先 `ctx.translate / rotate / scale`，避免每格每帧 `createRadialGradient`。
- 仅对**当前视口内**格子计算 ambient（21 行 + 0.5 预览 ≈ 200 格以内，可接受）。
- 背景、面板大图：**整块** idle 缩放/光晕，不按像素 shader。

---

## 2. 元素清单与动效规格

以下周期均为 `periodSec`；`amp` 为 idle 幅度半宽（sin 映射后的变化范围）。

### 2.1 棋盘 · 未翻开格（Hidden tile）

| 属性 | 规格 |
|------|------|
| 目标 | 石板轻微「起伏」，暗示底下有东西，但不诱人点击 |
| 动效 | 顶缘高光带透明度 `0.04～0.08` 往返；可选 1px 内阴影深度 `0.92～1.0` 缩放（整格） |
| 周期 | 3.2s |
| 相位 | 按 `(row,col)` |
| 落点 | `renderer/cells.ts` → `drawHiddenCell` 末尾 |
| 预览行 | 同上，整体 `globalAlpha *= 0.55`（已有预览淡化逻辑可复用） |

### 2.2 棋盘 · 已翻开空格（Revealed empty）

| 属性 | 规格 |
|------|------|
| 目标 | 「尘埃落定」的静谧感，与 hidden 区分 |
| 动效 | 底色亮度 `±3%`；无缩放 |
| 周期 | 4.5s（比 hidden 更慢） |
| 落点 | `drawRevealedCellBg` |

### 2.3 棋盘 · 数字 1～8（推荐：重切透明 digit + Canvas + 微粒）

| 属性 | 规格 |
|------|------|
| 目标 | 等待时数字像「带电指示器」——略脉动、微发光、偶有微粒掠过，**格底可独立慢动** |
| **资产（最佳效果）** | **重切** `digit-1`～`digit-8`：仅 glyph，透明底，输出到 `public/assets/tiles/digit-*`；**弃用**整格 `num-N` 作前景 |
| 动效组合 | ① 格底 `cell-revealed` 慢循环（亮度 ±3%）；② digit 缩放 `0.96～1.04` + `shadowBlur` 0～6；③ 🟡 **每格 0～3 颗**数字色微粒，绕 digit 慢 orbit（周期 2.5～4s，alpha 0.15～0.35） |
| 周期 | digit 1.8s；微粒与 digit **异相** |
| 按数字个性 | 见下表 |
| 落点 | `drawCell` 双层绘制 + `ambient/cell-idle-particles.ts`（新建） |

| 数字 | 色相倾向 | 额外 ambient |
|------|----------|--------------|
| 1 | 冷蓝 | 仅缩放；微粒最少（0～1） |
| 2 | 绿 | 微上移 0.5px |
| 3 | 粉 | 略快周期 ×0.95 |
| 4 | 黄 | 发光 +15%；微粒略多 |
| 5 | 橙 | 缩放保持 ≤±4%，用 glow/微粒强化 |
| 6 | 紫 | 微旋转 ±1.5° |
| 7 | 红 | 发光 + 周期 ×0.9；微粒 2～3 |
| 8 | 灰 | 最弱幅度 ±2% |

**为何重切 digit**：现有 `num-N` 与格框合成，格底无法单独「待机动」；要最佳层次，**透明 digit 是正确资产形态**（见 §11、§12）。

实现：`cell-revealed` → `drawImageContained(digit-N)` 包 `drawWithCellIdle` → 同格 `spawnCellIdleParticles(cellKey, digitColor)`。

### 2.4 棋盘 · 旗帜（Flag）

| 属性 | 规格 |
|------|------|
| 目标 | 布旗在风中轻摆，杆不动 |
| 动效 | 绕杆底 pivot 旋转 `-3°～+3°`；布面缩放 Y `0.98～1.02`；可选 cutout `flag-blue` 上叠 1px 高光条位移 |
| 周期 | 2.4s |
| 变体 | `flag-danger-red`：周期 ×0.85、幅度 +20%（AI 高危提示格，若未来接入） |
| 落点 | `drawCellMarksOverlay` |
| Action 冲突 | `flag-pop` 播放中冻结旋转 |

**Pivot**：杆底约在格内 `(cx, cy + cellSize*0.28)`，与 `GAME_ASSET_TUNING.cutouts.flagScale` 对齐。

### 2.5 棋盘 · 炸弹（Mine）

分状态：

#### A. 已翻开的标准雷（`mine-standard`）

| 属性 | 规格 |
|------|------|
| 目标 | 休眠中的危险物，芯在跳 |
| 动效 | ① 雷体整体缩放 `0.98～1.02`；② 核心红点 `mineCore` 发光 `0.5～1.0`；③ 8 根刺 **不**单独动（省成本） |
| 周期 | 1.6s |
| 落点 | `drawCell` mine 分支 / `drawMine` |

#### B. 踩雷 / 爆炸相关（`mine-exploded`、`mine-hit-flash`）

- 仅 Action 层；ambient **关闭**。

#### C. 裂痕雷（`mine-cracked`，若用于「邻雷已揭示」提示）

| 属性 | 规格 |
|------|------|
| 动效 | 在 A 基础上叠加裂纹高光闪烁，周期 0.8s，幅度弱 |
| 用途 | 可选 P2，非必须 |

### 2.6 棋盘 · 顶缘预览带（0.5 行）

| 属性 | 规格 |
|------|------|
| 目标 | 「下一屏将要上来」的扫描感 |
| 动效 | 横向 scan 线 `y` 在预览带内往返；透明度 `0.08～0.18` |
| 周期 | 2.8s |
| 落点 | `renderer/board.ts` 预览带绘制后 |
| 注意 | 不增加预览格交互暗示 |

### 2.7 顶栏 HUD

| 元素 | Ambient 规格 | 周期 |
|------|--------------|------|
| **SCORE 数字** |  idle：标签不动，分数位亮度 `±5%`；**变更时**走 Action `score-pop`（已有） | 3.0s |
| **LIVES 心** | 满命：依次延迟 0.15s 的微型心跳缩放 `1.0～1.06`；损命后空心不动；低命（≤1）整体淡红脉冲 | 1.2s / 心 |
| **COMBO 顶栏** | 已有 `pulse` 侧轨；补充：数字 `xN` 缩放 `0.98～1.02`，`N≥10` 时发光加强 | 1.4s |
| **顶栏底部分割线** | 渐变线 opacity `0.35～0.55` | 4.0s |

落点：`game-canvas/create.ts` → `drawFullscreenHud`、`drawComboHud`。

### 2.8 底栏与卷轴压迫

| 元素 | Ambient 规格 |
|------|--------------|
| **能量轨底色** | 空闲：轨道内 shimmer 左→右，周期 3.5s，alpha 很低 |
| **压迫进度条** | 已有 urgent 脉冲；补充：非 urgent 时进度条前端 2px 高亮 idle 脉动 |
| **底栏反馈槽** | 无 idle ambient（仅 Action：得分飘字、连击 burst） |

落点：`drawBottomEnergyRail`、`drawFullscreenScrollWarning`。

### 2.9 蒙层与面板（Start / Ready / Game Over）

| 元素 | Ambient 规格 | 周期 |
|------|--------------|------|
| **start-panel / ready-panel** | 面板整体缩放 `0.995～1.005` + 外缘光晕 `±10%`；主文案不动 | 2.6s |
| **retry-button** | CTA 缩放 `1.0～1.04` + 阴影深度 idle 脉动（引导点击） | 1.8s |
| **game-over-panel** | 极弱红色 vignette 脉动，幅度小于 Start | 3.2s |
| **蒙层 scrim** | 不 idle 动画（保持稳定对比度） |

落点：`drawFullscreenOverlay` 内 Start/GameOver 分支。

### 2.10 情境控件

| 元素 | Ambient 规格 |
|------|--------------|
| **SPACE 提示** | 出现时 Action pop-in 200ms；停留期间键帽 `translateY -1～1px` + 边框 glow | 1.5s |
| **DEV Auto** | 仅边框色 `±8%`；**禁止**缩放（避免像主按钮） |
| **日志面板** | 打开时无 ambient；新行写入时单行 flash 一次（Action，可选 P3） |

### 2.11 AI 提示高亮（Chord / 目标格）

| 属性 | 规格 |
|------|------|
| 目标 | 与格子 ambient 区分：AI 提示用 **方框描边** idle 脉动，不缩放格内数字 |
| 动效 | `chord-crosshair` / 描边 alpha `0.4～0.9`，周期 1.0s |
| 落点 | `renderer/scroll-ui.ts` → `drawAiHint` |

---

## 3. 技术架构

### 3.1 新增模块（建议）

```
src/ui/ambient/
  clock.ts                 # getAmbientTimeSec(), prefersReducedMotion()
  phase.ts                 # cellPhase(key), hudPhase(channel)
  tuning.ts                # AMBIENT_TUNING
  apply.ts                 # drawWithCellIdle() — transform 包装
  cell-idle-particles.ts   # 棋盘格待机微粒（与 game-canvas 事件粒子分离）
  index.ts
```

### 3.2 配置结构示例

```ts
export const AMBIENT_TUNING = {
  enabled: true,
  globalGain: 1,           // 连击/压迫时临时提到 1.15
  hiddenTile: { period: 3.2, highlight: [0.04, 0.08] },
  number: { period: 1.8, scale: [0.96, 1.04], glowBlur: [0, 6] },
  flag: { period: 2.4, rotateDeg: [-3, 3] },
  mine: { period: 1.6, scale: [0.98, 1.02], coreGlow: [0.5, 1] },
  heart: { period: 1.2, scale: [1, 1.06], stagger: 0.15 },
  // ...
} as const;
```

与 `GAME_ASSET_TUNING.fx` 并列：fx = 一次性；ambient = 循环。

### 3.3 RAF 合并策略

```
paint() 每帧
  ├─ 静态层：背景、棋盘格（带 ambient transform）
  ├─ drawCellEffects（Action）
  └─ overlay / HUD（带 ambient）

needAmbientFrame =
  !prefersReducedMotion &&
  (status === 'playing' || startOverlayOpen || gameOverOverlay) &&
  (anyVisibleAmbientElement || actionFxRunning)

若 needAmbientFrame → scheduleAnimationFrame()
```

- `status === 'idle'` 且 **Start/Ready 蒙层**打开时：仅面板/CTA idle，**不**跑全盘格微粒（省性能）。
- `status === 'playing'`：棋盘 digit/旗/雷 idle + 格级微粒全开。
- `matchMedia('(prefers-reduced-motion: reduce)')` 变化时触发一次重绘；从 reduce 切回 normal 后再恢复 ambient RAF。

### 3.4 绘制 API 约定

```ts
// 在格心应用 idle 缩放（命名统一用 Idle，不用 Breath）
export function drawWithCellIdle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellKey: string,
  channel: 'number' | 'flag' | 'mine',
  draw: () => void,
): void {
  if (prefersReducedMotion()) {
    draw();
    return;
  }
  const phase = cellPhase(cellKey);
  const t = getAmbientTimeSec();
  const scale = lerpIdle(t, tuning[channel].period, phase, ...tuning[channel].scale);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}
```

旗子旋转用 `translate(pivotX, pivotY) → rotate → translate(-pivotX, -pivotY)` 再 `drawImageContained`。

**粒子两套，勿混用**：

| 系统 | 文件 | 用途 |
|------|------|------|
| `ParticleFx` | `game-canvas/create.ts` | 事件型：连击飞散、踩雷火花（有起止） |
| `CellIdleParticle` | `ambient/cell-idle-particles.ts` | 待机型：数字格 orbit 微粒（循环、低密度） |

### 3.5 与现有 Action FX 协作

| 场景 | 行为 |
|------|------|
| 格子正在播 `cellEffects` | 该格 ambient 权重 ×0 |
| 刚 reveal 800ms 内 | 数字从 1.08 缩回 1.0（Action 收尾），再接入 ambient |
| 卷轴滚动 batch | 棋盘 ambient 不停；预览 scan 可加速 ×1.3 |

`cellEffects` 已有 `fxKey` 世界坐标去重（见 `ENDLESS-TOP-PREVIEW-ROW.md`），ambient 的 `cellKey` 应使用同一套 `fxKey`。

---

## 4. 分阶段实施

> 与 §10.5 一致；以本节为 checklist，§10.5 为速览。

### P0 · 资产 + 基础设施（约 1d）

- [ ] `ambient/` 模块：`clock`、`tuning`、`apply`（`drawWithCellIdle`）
- [ ] `prefers-reduced-motion`；UI Lab `?ui=lab&ambient=1`
- [ ] 合并 RAF（§3.3）
- [ ] `tile-sprites.ts` 预留 `digits[]` 能力检测；无 digit 资产时继续走 `num-N` 整格图
- [ ] **重切 `digit-1`～`digit-8`**（§12）→ `public/assets/tiles/digit-*.png`
- [ ] digit 资产可用后，`drawCell` 改为 `revealed` + `digit` 双层

### P1 · 棋盘 idle（约 1d）

- [ ] digit idle 波 + `cell-idle-particles`（§12.3）
- [ ] 旗帜 pivot 摆动
- [ ] 雷：`mine-standard` cutout idle + 雷芯微粒（**禁止**回退 `sprites.mine` 整图）

### P2 · 格底与预览（约 0.5d）

- [ ] Hidden / Revealed empty 底色 idle
- [ ] 预览带 scan 线

### P3 · HUD 与面板（约 1d）

- [ ] 心形错峰、低命警示；COMBO 顶栏 idle（**仅 `combo > 1` 时**，与 [`ENDLESS-FULLSCREEN-LAYOUT.md`](./ENDLESS-FULLSCREEN-LAYOUT.md) §6 一致）
- [ ] Start / Retry / SPACE idle

### P4 · 抛光与验收（约 0.5d）

- [ ] 连击 ≥10 / scroll urgent 时 `globalGain`
- [ ] Playwright：playing / Start 蒙层 / `prefers-reduced-motion`
- [ ] RAF 占比 < 8%（中端机）

### 4.1 可执行 TODO 拆分

> 建议按任务 ID 小步提交；`A-*` 可先落地，不等待 digit 新资产。

| ID | 任务 | 主要文件 | 验收 |
|----|------|----------|------|
| A-1 | 建立 ambient 基础模块：时钟、正弦映射、相位 hash、总开关 | `src/ui/ambient/clock.ts`、`phase.ts`、`tuning.ts`、`index.ts` | 可在绘制层读取统一 `getAmbientTimeSec()` 与稳定 `cellPhase()` |
| A-2 | 接入 `prefers-reduced-motion`，并监听系统设置变化触发重绘 | `src/ui/ambient/clock.ts`、`src/ui/game-canvas/create.ts` | reduce 时 ambient 停止；切回 normal 后恢复 |
| A-3 | 合并 ambient RAF 调度，不新增第二路动画循环 | `src/ui/game-canvas/create.ts` | playing / Start / GameOver 需要 idle 时持续重绘；关闭 ambient 后不空跑 |
| A-4 | 增加 `drawWithCellIdle()` / `drawWithPivotIdle()` 包装 | `src/ui/ambient/apply.ts` | 数字/旗/雷可复用同一套 transform 入口 |
| B-1 | `tile-sprites.ts` 预留 `digits[]` 加载与能力检测 | `src/ui/tile-sprites.ts` | `digit-*` 缺失时不导致整套 tile 加载失败 |
| B-2 | 扩展切图脚本输出透明 `digit-1`～`digit-8` | `scripts/optimize-tiles.py`、`public/assets/tiles/` | `npm run assets:tiles` 后产出 8 张 128×128 透明 digit |
| B-3 | 数字格改成 `cell-revealed` + `digit` 双层绘制 | `src/ui/renderer/cells.ts` | digit 资产存在时格底和数字可独立 idle；缺失时继续显示 `num-N` |
| C-1 | Hidden / revealed 格底 idle 高光与亮度 | `src/ui/renderer/cells.ts` | 格底微动不影响 hit-test，不像可点击提示 |
| C-2 | 数字 idle：缩放、glow、数字个性调参 | `src/ui/renderer/cells.ts`、`src/ui/ambient/tuning.ts` | 1～8 可读，缩放不超过 ±4% |
| C-3 | 新建格级 idle 微粒，优先无状态确定性绘制 | `src/ui/ambient/cell-idle-particles.ts`、`src/ui/renderer/board.ts` | 数字/雷格有低密度微粒，全视口粒子数有上限 |
| C-4 | 旗帜 pivot 摆动；Action 播放时冻结/减弱 | `src/ui/renderer/cells.ts`、`src/ui/game-canvas/create.ts` | flag-pop 与 idle 不双重缩放 |
| C-5 | 标准雷 cutout idle 与雷芯微光 | `src/ui/renderer/cells.ts` | `mine-standard` 分层动；不回退整格 `sprites.mine` 做 ambient |
| C-6 | 顶缘预览带 scan 线 | `src/ui/renderer/board.ts` | 预览带有扫描感但不增加交互暗示 |
| D-1 | HUD ambient：SCORE、LIVES、COMBO 分别接入 | `src/ui/game-canvas/create.ts` | COMBO 仍仅 `combo > 1` 可见时 idle |
| D-2 | 底栏能量轨 shimmer 与压迫条前端高亮 | `src/ui/game-canvas/create.ts` | urgent 逻辑不变，非 urgent 也有克制活性 |
| D-3 | Start / Ready / Game Over / Retry / SPACE idle | `src/ui/game-canvas/create.ts` | 蒙层 scrim 不动，CTA 有轻微引导 |
| E-1 | Action / Ambient 协作：同格 `cellEffects` 期间 ambient 权重归零 | `src/ui/game-canvas/create.ts`、`src/ui/ambient/` | 开格、插旗、爆炸期间不抖动 |
| E-2 | UI Lab 增加 ambient 开关与静态预览入口 | `src/app/ui-lab.ts` | `?ui=lab&ambient=1` 可观察调参效果 |
| E-3 | 自动化与手动验收：build/test、reduce、录屏或双帧 diff | `scripts/run-tests.ts`（如需新增）、Playwright/手测记录 | `npm test`、`npm run build` 通过；reduce 静止；3s 录屏可见微动 |

---

## 5. 验收标准

- [ ] 静止对局录屏 3s，或间隔 1s 的两帧截图像素 diff，能确认至少 **数字、旗、雷** 之一在动，且不刺眼。
- [ ] 全盘格子相位不同步，无「波浪墙」违和感。
- [ ] Action 与 Ambient 同时存在时不抖动、不双重放大。
- [ ] `prefers-reduced-motion` 下棋盘完全静止（除必要 Action）。
- [ ] 不改变命中区域与 chord 逻辑。
- [ ] digit 透明图缺失时可降级运行：数字仍显示为现有 `num-N`，其它 ambient 不受影响。
- [ ] `npm test` + `npm run build` 通过。

---

## 6. 非目标

- **不新增 FX 序列帧**（`fx/*/frame-*.png` 8 帧动画）；**允许**新增静态透明 `digit-*` cutout（§12）。
- 不做 3D 透视、物理布料模拟。
- 不做音效同步（后续单独立项）。
- 不改造 `mines-defused` 规则 UI。
- 不改变顶栏 COMBO **显隐规则**（仍 `combo > 1` 才画 `drawComboHud`）；仅在其可见时加 idle 脉动。

---

## 7. 代码落点速查

| 元素 | 文件 |
|------|------|
| 格底、数字、旗、雷 | `src/ui/renderer/cells.ts` |
| 预览带、AI 描边 | `src/ui/renderer/board.ts`、`scroll-ui.ts` |
| 顶栏、底栏、面板、SPACE | `src/ui/game-canvas/create.ts` |
| 配置 / 待机微粒 | `src/ui/ambient/`（新建） |
| 事件粒子 | `src/ui/game-canvas/create.ts` → `ParticleFx` |
| 常量与 cutout 名 | `src/ui/game-assets.ts` |
| 预览 / Lab | `src/app/ui-lab.ts`、`responsive-matrix.ts` |

---

## 8. 与其它文档关系

```
ENDLESS-FULLSCREEN-LAYOUT.md     分区、坐标、绘制顺序
        │
        ├── ENDLESS-HUD-FEEDBACK-UX-PLAN.md   事件型：连击 burst、得分飘字、压迫线
        ├── ENDLESS-AMBIENT-LIFE-PLAN.md      本文：待机生动感 ambient（§10 资产表 · §11 分层 · §12 digit）
        └── ENDLESS-TOP-PREVIEW-ROW.md        预览行、fxKey 去重
```

**冲突时**：坐标与 paint 顺序以布局文档为准；**同一元素**若 HUD 计划规定「仅 transient」则不做 persistent ambient（例如底栏得分飘字槽位）。

---

## 9. 参考节奏（给美术 / 调参）

整体节奏像 **慢循环 + 轻风**（非拟人呼吸）：

- 格底：3～4s（最慢）
- 面板：2.5s
- 数字 / 雷：1.6～1.8s
- 旗：2.4s（稍慢，显得有重量）
- 心：1.2s（最快，强调生命）

调参时先改 `AMBIENT_TUNING` 数字，避免在绘制函数里散落魔法数。

---

## 10. 资产 vs 粒子 / Canvas 对照表

### 10.0 执行摘要

| 问题 | 结论 |
|------|------|
| 「呼吸」是什么意思？ | **待机生动感**：等待时不纯静止；**不是**拟人呼吸。 |
| 追求最佳效果要不要新图？ | **数字建议重切**：`digit-1`～`digit-8` 透明 glyph（§12）。格底/旗/雷多数复用现有 + 代码。 |
| 数字 idle 怎么做得最好？ | **透明 digit + 格底分层 + 缩放/发光 + 2～3 颗慢微粒**（§2.3、§12.3）。 |
| 哪些用 Canvas？ | 格底明暗、digit 缩放/发光、旗旋转、雷芯光、HUD、面板、scan 线、压迫条。 |
| 哪些用粒子？ | **数字格周微粒**、连击（已有）、雷芯、消雷飘分、踩雷火花、urgent 底缘。 |
| 哪些用现有 FX 帧？ | 开格、插旗、爆炸、连击 burst、得分、断连、回血、升级。 |
| 数字是否与格底合成？ | **现状 tile 下是**；**目标态否**（重切 digit 后分层）。详见 §11。 |

**推荐实施顺序（最佳效果路径）**：重切 digit → 改 `drawCell` 双层 → ambient 代码 + 格级微粒 → 旗/雷/HUD → 验收后 optional 分层旗、电流 strip。

---

> **产品取向**：本文默认 **最佳视觉效果**，而非「零新图凑合」。Action 层仍复用已有 8 套 FX 序列帧；Ambient 层 **数字资产建议重生成**（透明 digit），其余以 Canvas + 粒子为主。

### 10.1 图例

| 标记 | 含义 |
|------|------|
| 🟢 **Canvas** | `translate/rotate/scale`、渐变、描边、`shadowBlur`、正弦透明度 |
| 🟡 **粒子** | 现有 `ParticleFx` 或轻量 spark（圆点 + 速度 + 衰减） |
| 🔵 **复用静图** | 已有 cutout / tile sprite / UI panel，代码驱动动效 |
| 🟣 **复用序列帧** | 已有 `fx/*` 8 帧，事件触发播放 |
| 🔴 **建议新图** | 需要美术出图或重切（非必须） |

---

### 10.2 Ambient 层（待机生动感）

| 元素 | 实现方式 | 现有资产 | 是否需新图 |
|------|----------|----------|------------|
| 未翻开格高光 | 🟢 Canvas 线性渐变 alpha 呼吸 | tile `hidden` | 否 |
| 已翻开空格底色 | 🟢 Canvas 填充色亮度 ±3% | tile `revealed` | 否 |
| 数字 1～8 | 🟢 digit 缩放/发光 + 🟡 格周慢微粒；🔵 **重切** `digit-1`～`digit-8` 透明图 | 替换整格 `num-N` | **是（推荐）** |
| 旗帜摆动 | 🟢 pivot 旋转 + scaleY；🔵 `flag-blue` 静图 | cutout `flag-blue` 等 | 否 |
| 旗面「布料褶皱」更真实 | 🔴 分层旗布序列帧或骨骼变形 | — | **可选**（Canvas 旋转已够） |
| 标准雷脉动 | 🟢 缩放 + 🟡 雷芯 2～4 个 radial 粒子；🔵 `mine-standard` | cutout + 矢量 `drawMine` | 否 |
| 裂痕雷闪烁 | 🟢 裂纹 cutout alpha 呼吸 | `mine-cracked` **已有** | 否 |
| 预览带 scan | 🟢 横向矩形 + alpha 往返 | 无 | 否 |
| SCORE 数字 idle | 🟢 文本 alpha/亮度 | 无 | 否 |
| 心形心跳 | 🟢 逐颗 scale 错峰；🔵 `heart-full/empty` | cutout 已有 | 否 |
| 低命警示 | 🟢 + 🟡 少量红色微粒绕顶栏 | 无 | 否 |
| COMBO 顶栏数字 | 🟢 缩放 + glow | 无（纯字） | 否 |
| COMBO 侧轨 glow | 🟢 已有 pulse，继续 Canvas | 无 | 否 |
| 顶栏分割线 | 🟢 渐变 stop alpha | 无 | 否 |
| 底栏能量轨 shimmer | 🟢 矩形渐变位移 | 无 | 否 |
| 压迫条前端高亮 | 🟢 2px 亮色条 + alpha | 无 | 否 |
| Start/Ready 面板 | 🟢 整图 scale + 外圈 radial alpha；🔵 `start-panel` `ready-panel` | UI panel **已有** | 否 |
| Retry 按钮 | 🟢 scale + shadow；🔵 `retry-button` | UI panel **已有** | 否 |
| Game Over vignette | 🟢 全屏 radial 红雾 alpha | `game-over-panel` 底图已有 | 否 |
| SPACE 键帽 | 🟢 translateY + 边框 glow；🔵 `space-active` | UI panel **已有** | 否 |
| DEV Auto | 🟢 边框色 alpha；🔵 `auto-on/off` | UI panel **已有** | 否 |
| AI chord 描边 | 🟢 描边 alpha 呼吸；🔵 `chord-crosshair` | cutout **已有** | 否 |
| 日志新行 flash | 🟢 单行背景色 flash 一次 | `log-panel` 静图 | 否 |

---

### 10.3 Action 层（事件型，已有序列帧）

| 事件 | 实现方式 | 现有 FX | 是否需新图 |
|------|----------|---------|------------|
| 安全开格 | 🟣 `safe-reveal` 8 帧 + 🟢 扩散环 | 已有 | 否 |
| 插旗/撤旗 | 🟣 `flag-pop` + 🟢 色环 | 已有 | 否 |
| 踩雷爆炸 | 🟣 `mine-explosion` + 🟢 光晕/射线 | 已有 | 否 |
| 连击爆发 | 🟣 `combo-burst` + 🟡 `spawnComboParticles` | 已有 | 否 |
| 得分飘字 | 🟣 `score-pop` + 🟢 上浮文字 | 已有 | 否 |
| 断连 BREAK | 🟣 `wrong-flag-break` + 🟢 全屏闪 | 已有 | 否 |
| 回血 | 🟣 `heart-refill`（若接入） | manifest 已有 | 否 |
| 升级/深度 | 🟣 `level-up`（若接入） | manifest 已有 | 否 |

**粒子（待机 + 事件，数字格为重点）**：

| 场景 | 粒子用途 |
|------|----------|
| **数字格 idle** | **推荐**：每格 0～3 颗，沿 digit 轮廓慢 orbit；颜色取 `THEME.numbers[n]`，速度近 0 |
| 连击升高 | 已有：径向飞散色点（`spawnComboParticles`） |
| 消雷入账 | 1～3 颗绿色微粒飘向顶栏 SCORE |
| 踩雷 | 爆炸帧外再叠 8～12 个火花粒子 |
| 开格（0 邻雷） | 极淡蓝色 dust 3～5 颗 |
| 卷轴 urgent | 底栏边缘向上飘的 amber 微粒 |
| 高连击 ambient 增益 | 棋盘底缘微量 glow 粒子（低密度） |
| 雷芯 idle | 2～4 颗红色微粒在 `mine-standard` 中心闪烁 |

---

### 10.4 建议新图 / 重切（最佳效果路径）

| 优先级 | 资产 | 原因 | 是否必须 |
|--------|------|------|----------|
| **P0 推荐** | **`digit-1`～`digit-8`** 透明 glyph | 与格底分层；digit 单独 idle + 微粒 | **是（最佳效果）** |
| P1 推荐 | 旗 **布**与杆分离 | `flag-pole` **已有**；从 `flag-blue` 拆出布面 `flag-cloth` 或分图层绘制 | 强烈建议 |
| P2 可选 | **hidden tile** 微光 2 帧 | 石板质感 | 否（Canvas 高光可替代） |
| P3 可选 | 底栏 **电流条 strip** | shimmer 更街机 | 否 |
| P3 可选 | digit **additive 发光版** ×8 | 高连击 tier 切换 | 否（Canvas glow 可先顶） |
| 低 | 预览 scan sprite、COMBO tier 底纹 | 风格统一 | 否 |

**明确不需要的**：

- 为 digit 做 **多帧动画序列**（idle 用代码 + 微粒，不用 8×N 张图）
- 重切 `mine-standard` / `flag-blue`（已有 cutout，代码即可 idle）

**可弃用/降级**（重切 digit 后）：

- `public/assets/tiles/num-1.png`～`num-8.png` 整格图 — 保留作归档，运行时不再作前景

---

### 10.5 实施优先级（速览）

与 **§4** 相同，不重复展开。要点：P0 = `ambient/` 基础设施 + digit 能力检测；digit 资产可用后再开启双层绘制；P1 = 棋盘 idle + 微粒。

---

## 11. 棋盘资产分层现状：数字 / 旗 / 雷能否与格底分离？

### 11.1 项目里有两套棋盘素材

| 管线 | 路径 | 用途 |
|------|------|------|
| **Tile 精灵** | `public/assets/tiles/*.png` | `loadTileSprites()` 加载；有图时 `drawCell` **优先走 sprite 分支** |
| **Production cutout** | `public/assets/game/cutouts/*.png` | `getGameCutout()`；透明底图标，叠在格底或 hidden 格上 |
| **矢量 fallback** | 无图时 `cells.ts` 内 Canvas 绘制 | 格底、字、旗、雷全部分层绘制 |

相关代码：`src/ui/tile-sprites.ts`、`src/ui/renderer/cells.ts`、`scripts/optimize-tiles.py`。

---

### 11.2 现状：哪些已经分层，哪些是「一整张」？

| 元素 | 当前是否合成一张 | 实际绘制（有 tile 时） | 能否只对前景做 idle |
|------|------------------|------------------------|-------------------|
| **未翻开格底** | 单图 `cell-hidden.png` | 整格 `drawSpriteInCell(hidden)` | 只能整格缩放/加高光；**不能**只动「格框不动内容」 |
| **已翻开格底** | 单图 `cell-revealed.png` | 空格：仅矢量 `drawRevealedCellBg`；有数字时 **往往不画这层** | 见下行 |
| **数字 1～8** | ⚠️ **与格框合成** | `drawSpriteInCell(num-N)` **一张铺满整格**，不先画 `revealed` | 整格一起动；**目标态**见 §12 |
| **旗帜** | ✅ **与格底分离** | 先 `hidden` 底，再 `drawCellMarksOverlay` → `flag-blue` cutout 或 `flag.png` | **可以** pivot 旋转旗，hidden 底单独呼吸 |
| **地雷** | ✅ **与格底分离**（cutout 路径） | 先 `cell-revealed`，再 `mine-standard` cutout | **可以** 只缩放/发光雷，格底微动或不动 |
| **地雷**（仅 tile、无 cutout） | ⚠️ 可能单图 | `sprites.mine` 整格图 | 同数字，整格一起动 |

**直接回答你的问题：**

1. **数字现在是不是跟方格合成同一张图？**  
   - **在 tile 模式下：是。** `num-1.png`～`num-8.png` 从精灵表数字行切出，归一化到与 `num-1` 相同的 128×128 画布（含格缘/暗角像素，`optimize-tiles.py` 里 `repair_num7_border` 即在修格框边）。运行时 **只画这一张**，不再画 `cell-revealed`。  
   - **在矢量 fallback 下：否。** 先 `drawRevealedCellBg`，再 `fillText` 画数字，天然两层。

2. **旗帜、数字、地雷能否与背景区分开？**  
   - **旗帜：可以**（已是 hidden 底 + 旗 overlay 两次绘制）。  
   - **地雷：可以**（`revealed` 底 + `mine-standard` cutout；生产环境 cutout 已接好）。  
   - **数字：tile 模式下暂不能**（整格合成）；要分离需 **改代码或改资产**（§11.4）。

---

### 11.3 当前与目标绘制顺序（无尽棋盘）

`renderer/board.ts` 目标顺序（含本方案新增层）：

```
1. drawCell()              → Layer 0 格底 + Layer 1 digit/mine
2. drawCellMarksOverlay()  → 未翻开旗
3. drawCellIdleParticles() → Layer 1.5 待机微粒（新建，棋盘坐标系）
4. drawCellEffects()       → Layer 2 Action FX（game-canvas，棋盘坐标系）
```

当前代码尚无 `drawCellIdleParticles`；实现时应放在 `renderBoardOnlyFrame` 末尾、**restore 棋盘 translate 之前**（与 `drawCellEffects` 同级或紧前）。

`drawCell` 内部分支（简化）：

```
有 tileSprites?
  未翻开 → cell-hidden（整图）
  已翻开 + 雷 → cell-revealed + mine-standard cutout（分层）或 mine 整图
  已翻开 + 数字 → num-N 整图（⚠️ 未先画 revealed）
  已翻开 + 空   → drawRevealedCellBg（仅矢量路径；有 sprite 时 n=0 才走到）

无 tileSprites?
  未翻开 → drawHiddenCell（Canvas）
  已翻开 → drawRevealedCellBg → 矢量数字 / cutout 雷
```

---

### 11.4 推荐目标分层（为 Ambient 服务）

理想 **三层**（格底、前景、特效）：

```
Layer 0  格底     cell-hidden | cell-revealed        ← 慢 idle（3～4s）
Layer 1  前景     digit | mine | flag-cloth          ← 快 idle（1.6～2.4s），独立 transform
Layer 1.5 待机微粒  cell idle particles（数字/雷格）  ← orbit，与 Layer 1 异相
Layer 2  动作特效  cellEffects + 事件 ParticleFx     ← 一次性 Action
```

可选：`flag-pole`（**已有 cutout**）静止 + `flag-cloth` 旋转（§10.4）。

---

### 11.5 数字资产：推荐重切透明 digit（最佳效果）

| 方案 | 做法 | 适用 |
|------|------|------|
| ~~A. 仅改绘制 + 矢量字~~ | 零新图 | 快速验证 / 原型 |
| **B. 重切 `digit-1`～`digit-8`（推荐）** | 精灵表数字行只留 glyph，透明 128×128；`cutouts` 或 `tiles/digit-*` | **追求最佳待机生动感** |
| C. production cutout 风格 | 8 张 `number-*` 与 `safe-number-badge` 同套 | 与 HUD 数字完全统一时 |

**目标绘制（方案 B）**：

```ts
drawSpriteInCell(ctx, sprites.revealed, x, y, g.cellSize);        // Layer 0 格底 idle
drawWithCellIdle(ctx, cx, cy, cellKey, 'number', () => {
  drawImageContained(ctx, digits[n - 1], x, y, g.cellSize, g.cellSize, 0.88);
});
spawnCellIdleParticles(cellKey, cx, cy, THEME.numbers[n]);      // Layer 1 微粒
```

**不建议**：为 idle 把 digit 做成多帧动画；**待机感 = 单张 digit + 代码脉动 + 慢微粒**。

切图：扩展 `scripts/optimize-tiles.py` 输出 `digit-*`（裁掉格框、背景变透明），或从 production sheet 新切一列登记 manifest。规格见 **§12**。

---

### 11.6 旗 / 雷：还要不要动资产？

| 元素 | 结论 |
|------|------|
| **旗** | 已分层；Ambient 用 pivot 旋转 `flag-blue` 即可。若要杆不动布动，再拆 `flag-pole` + 旗布（§10.4 可选）。 |
| **雷** | 已分层；确保运行时走 `mine-standard` cutout（勿退回 `sprites.mine` 整图）。Ambient 只动 cutout + 可选粒子雷芯。 |
| **格底** | `cell-hidden` / `cell-revealed` 保持静图；呼吸用 Canvas 高光/亮度，**不必**出第二帧，除非验收后要 §10.4 的 hidden 2 帧微光。 |

---

### 11.7 与 Ambient 实施阶段的对应

| 阶段 | 资产/代码动作 |
|------|----------------|
| **P0** | 建 `ambient/` 基础设施；`tile-sprites.ts` 预留 `digits[]`；digit 资产缺失时继续走 `num-N` |
| **P0+** | **重切 `digit-1`～`digit-8`**；资产可用后 `drawCell` 改为 revealed + digit 双层 |
| **P1** | digit idle 波 + **格级慢微粒**；旗、雷 idle |
| **P2** | 格底 Canvas idle、预览 scan |
| **P3+** | HUD、面板；可选分层旗 |

---

### 11.8 文档与代码索引

| 内容 | 位置 |
|------|------|
| Tile 文件列表 | `public/assets/tiles/`（12 张：hidden、revealed、mine、flag、num×8） |
| 切图脚本 | `scripts/optimize-tiles.py` |
| 绘制入口 | `src/ui/renderer/cells.ts` → `drawCell`、`drawCellMarksOverlay` |
| Cutout 名 | `src/ui/game-assets.ts` → `GAME_CUTOUT_NAMES` |
| 格子上层特效 | `src/ui/game-canvas/create.ts` → `drawCellEffects` |

---

## 12. 数字重切规格（`digit-1`～`digit-8`）

### 12.1 产出物

| 项 | 说明 |
|----|------|
| **资产路径（定案）** | 棋盘 digit 走 **`public/assets/tiles/digit-*.png`**，与 `cell-revealed` 同管线；**不**走 `game/cutouts`（cutouts 留给旗/雷/HUD 图标）。 |
| 弃用 | `num-1`～`num-8` 不再作为运行时前景（可留档） |
| 脚本 | `scripts/optimize-tiles.py` 新增 `digit-*` 输出；`npm run assets:tiles` |

### 12.2 美术要求

- **仅数字 glyph**，无格框、无 cell-revealed 暗角。
- 画布 **128×128 RGBA**，背景全透明；glyph 居中，约占格心 **55%～70%** 宽。
- 保留现有像素风描边与配色（与 `num-*` 数字本体一致，格框像素裁掉）。
- **单帧静图即可**；idle 动效全部由运行时完成（缩放、发光、微粒）。

### 12.3 待机生动感组合（digit + 粒子）

```
每帧绘制顺序（数字格）:
  1. cell-revealed          ← 慢 idle 波（亮度，周期 ~4s）
  2. digit-N cutout         ← 快 idle 波（缩放+发光，周期 ~1.8s）
  3. cell idle particles    ← 0～3 颗，orbit 半径 8～14px，周期 2.5～4s，与 digit 异相
```

微粒参数建议（`CellIdleParticle`）：

| 字段 | 值 |
|------|-----|
| 每格数量 | `n` 为 7 时 2～3，其余 0～2 |
| 速度 | 2～8 px/s，切向为主 |
| 半径 | `cellSize * 0.12`～`0.22` |
| alpha | 0.12～0.32 |
| 寿命 | 循环重生，不爆炸消失 |
| 与 Action | 该格 `cellEffects` 播放时 **清空** 该格 idle 微粒 |
| 性能上限 | 优先无状态确定性绘制；全视口粒子硬上限 160～220，低端/小格子时按比例降级 |

这样等待时数字「带电」，但 **不是** 整张图来回伸缩，也 **不是** 拟人呼吸。

### 12.4 切图脚本改动要点

在 `optimize-tiles.py` 中新增：

1. 从 `NUMBER_ROW_Y` 裁切后 **剔除** 与 `num-1` 格框一致的边缘像素（或以 `num-1` 与 `cell-revealed` diff 得 mask）。
2. 输出 `digit-{i}.png` 而非覆盖 `num-{i}.png`。
3. `tile-sprites.ts`：`digits: HTMLImageElement[]` 加载 `digit-*`；`numbers` 数组标记 **deprecated**，仅留档。

验收：同一格 **格底可 idle、digit 可 idle、微粒可 orbit**，三者相位不同步。

---

## 13. 文档审查与边界（2026-06）

### 13.1 已修正的问题

| 问题 | 处理 |
|------|------|
| §6「不新增位图」与 digit 重切矛盾 | 改为「不新增 **FX 序列帧**；允许静态 digit」 |
| API 命名 `Breath` / `Idle` 混用 | 统一 `drawWithCellIdle`、`lerpIdle` |
| §4 与 §10.5 实施阶段重复 | §10.5 改为指向 §4 |
| COMBO idle 与顶栏显隐 | 明确仅 `combo > 1` 时（对齐布局文档 §6） |
| `flag-pole` 写成待产出 | 注明 manifest **已有**，待拆的是布面 |
| digit 资产路径「tiles 或 cutouts」二义 | **定案** tiles 管线 |
| 待机微粒与 `ParticleFx` 未区分 | §3.4 增表；新建 `cell-idle-particles.ts` |
| 绘制顺序缺 Layer 1.5 | §11.3 / §11.4 补全 |
| RAF 仅在 `playing` | 修正为含 Start/GameOver 蒙层 |

### 13.2 与其它文档的边界

| 文档 | 分工 |
|------|------|
| `ENDLESS-FULLSCREEN-LAYOUT.md` | 坐标、分区、paint 顺序、COMBO 显隐 |
| `ENDLESS-HUD-FEEDBACK-UX-PLAN.md` | 得分飘字、连击 burst、压迫线等 **Action** |
| **本文** | 待机 **Ambient** + digit 资产 + 格级微粒 |

**冲突时**：坐标与 paint 顺序以布局文档为准；同一元素的 **Action** 细节以 HUD 计划为准；**idle 循环**以本文为准。

### 13.3 仍待实现时验证

- [ ] `optimize-tiles.py` 能否稳定从 `num-N` 减去 `cell-revealed` 得透明 digit（§12.4 算法待落地试切）
- [ ] 全屏 ~189 格 × 最多 3 微粒 ≈ 567 粒子时帧预算（P4 性能项）
- [ ] `ENDLESS-FULLSCREEN-LAYOUT.md` §9 代码路径已过时（`game-canvas.ts` → `game-canvas/create.ts`），实现 ambient 时顺带改正文档
