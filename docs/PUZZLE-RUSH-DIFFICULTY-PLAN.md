# Puzzle Rush 动态难度技术方案

> 版本 v0.6 · 2026-07-05  
> 状态：**已实现（参数可后续微调）**  
> 关联：`docs/MODES.md` § puzzle-rush、`services/ranked/replay-puzzle-rush.ts`、`shared/core/modes/puzzle-rush/`

---

## 1. 概述

### 1.3 设计结论

| 项           | 结论                                                         |
| ------------ | ------------------------------------------------------------ |
| 难度维度     | 三条独立轨道：雷密度 / 盘面类型 / 会话掺杂配额               |
| **阶段时钟** | **有效时长** = `min(实际时长, 已清盘数 × 基准 pace)`（§3.0） |
| 掺杂上限     | 70%（≥30% 纯技术）                                           |
| 密度         | 只读 `boardIndex`，永不回退                                  |
| 保命         | M0 → M1 → M2 → **M3（仅 apex）**                             |
| 真正最高难度 | **有效时长 30 min+**（apex）；墙钟 35 min 备选见 §8.4        |
| 边界生效     | **下一盘首击前**判定（§2）                                   |
| 积分         | `100 + 速通奖`；连击、累计分 **不进** 难度                   |

---

## 2. 边界生效（下一盘才对齐）

阶段、配额、连击≥10、压力≥60，均在 **下一盘首击前** 用 `nowMs` + `boardIndex` 一次性判定。

清盘中跨过边界 → 当前盘不变；**下一盘首击**才用新规则。

ranked replay：每个 action 的 `t` 作 `nowMs`，同一锚点。

---

## 3. 有效时长（时间 × 盘数 双轴）

### 3.0 新手局（intro）

**前 3 盘**（`boardIndex` 0–2）固定为 **intro**，无论墙钟多长：

| 项          | intro 行为                                                              |
| ----------- | ----------------------------------------------------------------------- |
| 雷数 / 速通 | **5 → 6 → 7**（逐盘递增），60s                                          |
| 盘面        | **纯技术**（无掺杂）                                                    |
| 阶段 / 保命 | intro、M0                                                               |
| 硬升掺杂    | 不触发（连击 / 压力）                                                   |
| 进度        | **不计入**后续难度盘数（`progressBoardIndex = max(0, boardIndex − 3)`） |

第 4 盘起进入正常双轴梯度（warmup → …）。

### 3.1 动机

若阶段 **只看墙钟**，慢玩家可能在 **第 1 盘** 就因「已玩 30 min」进入 apex，不合理。

**对策**：阶段/保命/掺杂质检用的不是 `runElapsedMs`，而是 **有效时长**——慢刷会被 **盘数进度** 拖住。

### 3.2 公式

```
基准 pace：PACE_MS_PER_BOARD = 60_000（约 1 盘/分钟；10 min ≈ 10 盘）

paceCapMs = max(0, boardIndex − PUZZLE_INTRO_BOARD_COUNT) × PACE_MS_PER_BOARD
effectiveElapsedMs = min(runElapsedMs, paceCapMs)
```

- `boardIndex`：进入本盘前 **已清盘数**（第 1 盘 = 0）
- 快玩家：`effective ≈ runElapsed`（盘数跟上）
- 慢玩家：`effective` 被 `paceCap` 压住，阶段 **延后**

### 3.3 对照示例

| 场景     | 墙钟       | 已清盘数 | paceCap | **有效时长** | 阶段（主表）       |
| -------- | ---------- | -------- | ------- | ------------ | ------------------ |
| 正常     | 10 min     | 10       | 10 min  | **10 min**   | 爬升末 / 高压初    |
| **极慢** | **10 min** | **1**    | 1 min   | **1 min**    | **热身**           |
| 极慢     | 30 min     | 3        | 3 min   | **3 min**    | 热身               |
| 快刷     | 10 min     | 15       | 15 min  | **10 min**   | 高压（被墙钟限制） |
| 中等     | 30 min     | 28       | 28 min  | **28 min**   | 严峻               |
| 慢但坚持 | 60 min     | 12       | 12 min  | **12 min**   | 高压（非 apex）    |

→ **10 min 才清 1 盘** 的用户，有效时长只有 **1 min**，不会跳进后期。

### 3.3 整体难度梯度（双轴取慢）

阶段由 **时间轴** 与 **盘数轴** 共同决定，取 **较慢** 的一档（`min(时间阶段, 盘数阶段)`），保证每档至少 **5 盘**：

| 阶段     | **有效时长** `[左闭, 右开)` | **最少已清盘数** | 保命   | 掺杂     | 调度           |
| -------- | --------------------------- | ---------------- | ------ | -------- | -------------- |
| 热身     | 0 – 6 min                   | 0                | M0     | 0%       | —              |
| 爬升     | 6 – 12 min                  | 5                | M0     | ~25%     | 每 4 盘 1 掺杂 |
| 高压     | 12 – 18 min                 | 10               | M1     | ~45%     | 每 3 盘 1 掺杂 |
| 后期     | 18 – 24 min                 | 15               | M2     | ~58%     | 每 2 盘 1 掺杂 |
| 严峻     | 24 – 30 min                 | 20               | M2     | ~65%     | 3 盘 2 掺杂    |
| **apex** | **30 min+**                 | **25**           | **M3** | **~70%** | 10 盘 7 掺杂   |

- **快刷**：墙钟先到 → 时间轴领先，但盘数轴拖住 → 每档仍须清满 5 盘才进下一档
- **慢刷**：有效时长被 pace 压住 → 时间轴拖住；盘数轴也按上表推进
- **热身** 内不触发连击≥10 / 压力≥60 的硬升掺杂，避免首档被跳过
- 清完 **第 3 盘**（intro 结束）→ 下一盘切换时播放 **RAMP UP** HUD（与 endless SPEED UP 同款视觉 + 音效），提示难度即将提升

墙钟 30 min 且 `boardIndex ≥ 25` 时，才 **同时** 达到 apex 时间线与 11 雷密度档。

### 3.4 三轨道分工

| 轨道       | 输入                         | 慢玩家效果                     |
| ---------- | ---------------------------- | ------------------------------ |
| ① 雷密度   | `boardIndex`                 | 清得少 → 雷少                  |
| ② 盘面类型 | 有效时长 + 状态 + 配额       | 磨蹭 → 阶段低 → 掺杂少、保命久 |
| ③ 掺杂配额 | 有效时长 + `boardIndex` 调度 | 同上                           |

**密度与阶段解耦**：慢玩家 **雷数随盘数涨**，**掺杂/保命随有效时长涨**，不会「时间到了、盘还少、难度却封顶」。

### 3.5 保命 / 升掺杂（摘要）

**保命**：M0 全开 → M1 → M2 → M3（仅 apex）；规则同 v0.5。

**升掺杂**（下一盘；保命优先）：连击≥10、压力≥60、掺杂质检。

---

## 4. ① 雷密度（只跟 boardIndex）

| 已清盘序 | 雷数   | 速通窗口 |
| -------- | ------ | -------- |
| 1–5      | 8      | 60s      |
| 6–10     | 8      | 55s      |
| 11–15    | 9      | 50s      |
| 16–20    | 9      | 45s      |
| 21–25    | 10     | 40s      |
| 26–30    | 10     | 38s      |
| **31+**  | **11** | 35s→33s  |

11 雷 re-seed 失败 → 改掺杂，雷数不变。

---

## 5. 压力分

| 信号     | 计算                                            |
| -------- | ----------------------------------------------- |
| 连击     | `min(25, streak × 2.5)`                         |
| 清盘速度 | 上盘 elapsed                                    |
| **时长** | 线性至 35 min 饱和，用 **`effectiveElapsedMs`** |
| 已清盘数 | 线性至 30 盘饱和                                |

不用累计分。≥ 60 → 下一盘倾向掺杂。

---

## 6. 决策流程

**下一盘首击前**：

```
1. boardIndex → mines, timeBonusCapSec
2. effectiveElapsedMs = min(runElapsedMs, boardIndex × PACE_MS_PER_BOARD)
3. phase = min(时间阶段(effectiveElapsedMs), 盘数阶段(boardIndex)) → mercyLevel
4. shouldForceLogic → 纯技术
5. isQuotaDopedBoard(boardIndex, phase) → 掺杂
6. streak ≥ 10 → 掺杂（非热身）
7. pressure ≥ 60 → 掺杂（非热身；时长项用 effective）
8. 否则 → 纯技术
9. 布雷；re-seed 失败 → 改掺杂
```

---

## 7. 代码

```typescript
const PACE_MS_PER_BOARD = 60_000
const PHASE_BOUND_MS = [6, 12, 18, 24, 30].map((m) => m * 60_000)

function effectiveElapsedMs(runElapsedMs: number, boardIndex: number): number {
  return Math.min(runElapsedMs, boardIndex * PACE_MS_PER_BOARD)
}

function sessionPhase(effectiveMs: number): SessionPhase {
  if (effectiveMs < PHASE_BOUND_MS[0]) return 'warmup'
  if (effectiveMs < PHASE_BOUND_MS[1]) return 'climb'
  if (effectiveMs < PHASE_BOUND_MS[2]) return 'pressure'
  if (effectiveMs < PHASE_BOUND_MS[3]) return 'late'
  if (effectiveMs < PHASE_BOUND_MS[4]) return 'severe'
  return 'apex'
}

function resolveBoardDifficulty(session, nowMs) {
  const runElapsedMs = nowMs - session.runStartedAtMs
  const boardIndex = session.boardIndex
  const effectiveMs = effectiveElapsedMs(runElapsedMs, boardIndex)
  const phase = sessionPhase(effectiveMs)
  const mercy = mercyLevel(phase)
  // … 后续决策
}
```

### 7.1 备选：apex 墙钟上限（可选，默认不开）

若担心「极慢但盘数多」永不到 apex，可加 **双门槛**：进入 apex 需 `effectiveMs ≥ 30 min` **且** `boardIndex ≥ 20`。默认 **仅 effectiveMs** 一门槛。

### 7.2 备选：35 min apex 边界

`PHASE_BOUND_MS = [7,14,21,28,35].map(m => m * 60_000)`，判定仍用 **effectiveMs**。

---

## 8. 积分

```
每盘 = 100 + max(0, Tier窗口 − 实际秒) × 5
总局 = Σ 每盘
```

连击不计分。无时间硬结束。

---

## 9. 参数汇总

| 参数                | 值                   |
| ------------------- | -------------------- |
| `PACE_MS_PER_BOARD` | **60_000**（待校准） |
| apex（有效时长）    | **30 min+**          |
| 11 雷               | 第 29 盘+            |
| 边界生效            | 下一盘首击           |
| 硬结束              | 无                   |

### 9.1 代码落地

| 模块                   | 文件               |
| ---------------------- | ------------------ |
| 有效时长 / 阶段 / 配额 | `session-phase.ts` |
| 密度 8→11 雷           | `tier.ts`          |
| 盘面 M0–M3 / 压力分    | `board-profile.ts` |
| 单一积分               | `score.ts`         |
| re-seed 失败 → 掺杂    | `logic-solve.ts`   |

---

## 10. 待讨论

- [ ] `PACE_MS_PER_BOARD` 用 60s 还是 70s
- [ ] apex 是否加 `boardIndex ≥ N` 双门槛
- [ ] 35 min apex 边界是否采用
- [ ] 掺杂质检用全局 `boardIndex` 还是阶段内计数

---

## 11. 版本记录

| 版本      | 说明                                    |
| --------- | --------------------------------------- |
| v0.6      | **有效时长**双轴；慢刷阶段延后          |
| v0.6-code | 代码实现 landing                        |
| v0.5      | 严峻段；apex@30min；压力分改 boardIndex |
| v0.4      | 文档清理                                |
