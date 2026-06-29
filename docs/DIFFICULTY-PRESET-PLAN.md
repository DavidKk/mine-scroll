# 无尽模式难度预设技术方案

> 版本 v0.1 · 2026-06-29  
> 状态：待实施  
> 关联：`docs/MODES.md` § endless、`docs/TUTORIAL-PLAN.md`、`docs/LEADERBOARD-ANTI-CHEAT-PLAN.md`、`scripts/simulate-endless-ai.ts`

---

## 1. 概述

### 1.1 背景

无尽模式卷轴难度曲线 **硬编码** 于 `shared/core/modes/endless/constants.ts`：

| 参数                       | 当前值                                                      |
| -------------------------- | ----------------------------------------------------------- |
| `SCROLL_STEP_MS`           | 50 000（每 50s 升一档）                                     |
| `SCROLL_INTERVAL_TIERS_MS` | 11 档：9 000ms → **1 500ms**                                |
| `SCROLL_BATCH_TIERS`       | 1 → **5 行/次**                                             |
| 升档规则                   | 严格交替：偶数步加速、奇数步加批量（见 `scroll-timing.ts`） |

最高档 **1.5s 倒计时 + 一次上移 5 行（9 列）** 对真人操作压力过大，移动端更明显。该曲线适合 **专家/排位**，不宜作为全员默认。

### 1.2 目标

1. 抽离 **难度预设（Preset）**，支持 **3–4 档** 可选
2. **PC 与移动端不同默认档**（自动检测 layout profile）
3. **排位模式锁定专家档**，Start 面板不展示难度选择
4. 预设参数在 Core 层定义，UI 只读 preset id
5. 实现后用 `simulate-endless-ai.ts` 与内测 **校准** 初稿数值

### 1.3 设计结论（已定稿）

| 项          | 结论                                                 |
| ----------- | ---------------------------------------------------- |
| 档位数      | 4 档：`casual` / `standard` / `challenge` / `expert` |
| 默认        | mobile → `casual`；desktop → `standard`              |
| 排位        | 强制 `expert`，忽略用户选择                          |
| 教程 Step 5 | 使用 `casual` 单子档演示（12s ×1），非完整 preset    |
| 本地存储    | `localSettings.difficultyPresetId`                   |
| 样式        | Start 面板文字/tab 选择，**无新 panel 图**           |

### 1.4 非目标

- 不拆多个公开排行榜（排位仍仅 expert）
- 不改无尽核心规则（底行扣血、消雷回血、首击安全）
- 不为每档单独调雷密度曲线（MVP 共用现有 `getEndlessMineRatio`；后续可按档覆盖）

---

## 2. 档位定义

### 2.1 设计原则

人类可玩性粗算：

- 9 列 × `batchRows` 行 ≈ 每轮需扫视的格子数
- 熟练玩家约 **200–400ms/格** 决策
- `batchRows = 5` 且 `intervalMs = 1500` 时，远小于处理时间 → **不可持续**

因此高档只留给 **expert + 排位**；默认档限制 **最大批量** 与 **最短倒数**。

### 2.2 预设表（v0.1 初稿，待模拟校准）

| ID          | 显示名 | 默认平台 | 最高倒数 | 最高批量 | 升档间隔 | 目标体验                 |
| ----------- | ------ | -------- | -------- | -------- | -------- | ------------------------ |
| `casual`    | 休闲   | Mobile   | ~8.0s    | ×2       | 70s      | 新手友好，3–5 分钟可存活 |
| `standard`  | 标准   | Desktop  | ~5.0s    | ×3       | 55s      | 普通玩家主难度           |
| `challenge` | 挑战   | 可选     | ~3.0s    | ×4       | 50s      | 熟练玩家                 |
| `expert`    | 专家   | 排位     | **1.5s** | **×5**   | 50s      | 与当前全局曲线一致       |

### 2.3 具体参数

#### expert（= 当前生产曲线，排位专用）

```typescript
export const EXPERT_PRESET = {
  id: 'expert',
  scrollStepMs: 50_000,
  scrollIntervalTiersMs: [9000, 7500, 6300, 5300, 4500, 3800, 3200, 2700, 2300, 2000, 1500],
  scrollBatchTiers: [1, 2, 3, 4, 5],
  lives: 5,
} as const
```

#### challenge

```typescript
export const CHALLENGE_PRESET = {
  id: 'challenge',
  scrollStepMs: 50_000,
  scrollIntervalTiersMs: [9000, 7800, 6700, 5800, 5000, 4300, 3700, 3200, 2800, 3000],
  scrollBatchTiers: [1, 2, 3, 4, 4],
  lives: 5,
} as const
```

#### standard

```typescript
export const STANDARD_PRESET = {
  id: 'standard',
  scrollStepMs: 55_000,
  scrollIntervalTiersMs: [10000, 9000, 8000, 7200, 6500, 5800, 5200, 5000],
  scrollBatchTiers: [1, 2, 2, 3, 3],
  lives: 5,
} as const
```

#### casual

```typescript
export const CASUAL_PRESET = {
  id: 'casual',
  scrollStepMs: 70_000,
  scrollIntervalTiersMs: [12000, 11000, 10000, 9500, 9000, 8500, 8000],
  scrollBatchTiers: [1, 1, 2, 2, 2],
  lives: 5,
} as const
```

> **说明**：上表为初稿。合并前须跑 `scripts/simulate-endless-ai.ts --preset <id>` 对比 P50/P90 `scrollDepth`、存活时长，并参照排行榜分位微调。

### 2.4 教程专用慢速（非完整 preset）

`TUTORIAL-PLAN.md` Step 5 仅用：

```typescript
export const TUTORIAL_SCROLL_DEMO = {
  intervalMs: 12_000,
  batchRows: 1,
} as const
```

不接入 `getEndlessScrollProfile` 升档链。

---

## 3. Core API

### 3.1 类型

```typescript
/** shared/core/modes/endless/presets.ts */
export type EndlessDifficultyPresetId = 'casual' | 'standard' | 'challenge' | 'expert'

export interface EndlessDifficultyPreset {
  id: EndlessDifficultyPresetId
  label: string
  scrollStepMs: number
  scrollIntervalTiersMs: readonly number[]
  scrollBatchTiers: readonly number[]
  lives: number
}

export const ENDLESS_DIFFICULTY_PRESETS: Record<EndlessDifficultyPresetId, EndlessDifficultyPreset>
export const DEFAULT_PRESET_BY_PROFILE: Record<'mobile' | 'desktop', EndlessDifficultyPresetId>
export const RANKED_PRESET_ID: EndlessDifficultyPresetId = 'expert'
```

### 3.2 解析与查询

```typescript
export function getEndlessDifficultyPreset(id: EndlessDifficultyPresetId): EndlessDifficultyPreset
export function resolveDefaultPresetId(profile: 'mobile' | 'desktop'): EndlessDifficultyPresetId
export function resolveActivePresetId(options: { ranked: boolean; profile: 'mobile' | 'desktop'; storedId?: EndlessDifficultyPresetId | null }): EndlessDifficultyPresetId
```

`resolveActivePresetId` 规则：

1. `ranked === true` → 始终 `expert`
2. 否则 `storedId` 若合法 → 用之
3. 否则 `DEFAULT_PRESET_BY_PROFILE[profile]`

### 3.3 scroll-timing 改造

`getEndlessScrollProfile(elapsedMs, preset)` 签名变更：

```typescript
// 前
getEndlessScrollProfile(elapsedMs: number): EndlessScrollProfile

// 后
getEndlessScrollProfile(
  elapsedMs: number,
  preset: EndlessDifficultyPreset = getEndlessDifficultyPreset('expert')
): EndlessScrollProfile
```

内部读取 `preset.scrollStepMs`、`preset.scrollIntervalTiersMs`、`preset.scrollBatchTiers`，逻辑与现有一致：

```typescript
const step = Math.floor(elapsed / preset.scrollStepMs)
const speedTier = Math.min(preset.scrollIntervalTiersMs.length - 1, Math.floor((step + 1) / 2))
const batchTier = Math.min(preset.scrollBatchTiers.length - 1, Math.floor(step / 2))
```

### 3.4 Session 携带 preset

```typescript
// ModeSession 扩展（或 endless 子结构）
interface ModeSession {
  // ...
  endlessPresetId?: EndlessDifficultyPresetId
}
```

- `createEndlessSession({ presetId })` / `endlessBeginRun(session, presetId)`
- `session.lives` 初始化取自 `preset.lives`（MVP 均为 5）

### 3.5 向后兼容

- `constants.ts` 保留 `SCROLL_INTERVAL_TIERS_MS` 等 **deprecated 别名**，指向 `expert` preset，避免外部脚本瞬间断裂
- 一迭代后移除 deprecated（在 `MODULES.md` 标注）

---

## 4. Session 与 UI

### 4.1 local-settings

```typescript
// game-client/config/local-settings.ts
export interface LocalSettings {
  bgmMuted: boolean
  tutorialCompleted: boolean
  difficultyPresetId: EndlessDifficultyPresetId | null // null = 用平台默认
}
```

### 4.2 mount.ts

- 开局前：`const presetId = resolveActivePresetId({ ranked: rankedMode, profile, storedId })`
- `createEndlessSession({ presetId })` 或 run 开始时写入 session
- `getCanvasHudStats()` 的 `difficulty.speedTier/batchTier` 逻辑不变，数据源改为带 preset 的 profile
- HUD 可选显示 preset 短标签（如 `休闲 ↑08×2`），MVP 可仅 dev log

### 4.3 Start overlay（`event-overlay.ts`）

**非排位** idle 面板布局：

```
┌─────────────────────────────┐
│      [ 新手教程 ]            │  ← TUTORIAL-PLAN
│                             │
│  难度  休闲  标准  挑战       │  ← 横向 tab，命中检测
│                             │
│         [ START ]           │
└─────────────────────────────┘
```

- Mobile：默认高亮 `casual`；`challenge` 可选显示「较难」角标
- Desktop：默认高亮 `standard`
- 选中态：描边 + 文字色 `#fde047`；未选中 `#94a3b8`
- **不展示 `expert`**（仅排位）

Hit rect：`difficultyTabRects: Record<EndlessDifficultyPresetId, Rect>`（不含 expert）

**排位** idle：仅 START，无难度 tab；角标文案 `排位 · 专家`（可选）

### 4.4 卷屏 HUD

`formatEndlessScrollHud(profile)` 不变；玩家通过 `↑08×2` 感知当前压力，无需额外说明文案。

---

## 5. 排位与记分

| 模式                  | Preset                                | 本地纪录     | 公开排位 |
| --------------------- | ------------------------------------- | ------------ | -------- |
| 普通游玩              | 用户选择（casual/standard/challenge） | 可写本地高分 | 不上传   |
| 排位 `isRankedMode()` | 锁定 expert                           | 可写         | 上传验证 |
| 教程                  | —                                     | **不写**     | **不写** |

排位 run 创建时服务端应记录 `presetId: 'expert'`（若 API 扩展 metadata），便于审计。

---

## 6. 校准流程

### 6.1 脚本扩展

```bash
pnpm exec tsx scripts/simulate-endless-ai.ts --preset casual --runs 100
pnpm exec tsx scripts/simulate-endless-ai.ts --preset standard --runs 100
# ...
```

输出对比：P50/P90 `scrollDepth`、到达最高档时间、`lost` 比例。

### 6.2 目标区间（内测前验收参考）

| Preset    | P50 depth    | P50 存活时间 | 备注          |
| --------- | ------------ | ------------ | ------------- |
| casual    | 15–25        | 3–5 min      | AI 作上限参考 |
| standard  | 25–35        | 5–8 min      |               |
| challenge | 30–40        | 6–10 min     |               |
| expert    | 与现网榜对齐 | —            | 不削弱        |

### 6.3 人工试玩

- Desktop：标准键鼠，各档 3 局
- Mobile（390×844）：触摸，casual + standard 各 3 局
- 确认最高档下「能玩但紧张」，而非「不可能」

---

## 7. 文件变更清单

| 文件                                                  | 变更                                       |
| ----------------------------------------------------- | ------------------------------------------ |
| `shared/core/modes/endless/presets.ts`                | **新建** 预设表与解析                      |
| `shared/core/modes/endless/scroll-timing.ts`          | 接受 preset 参数                           |
| `shared/core/modes/endless/constants.ts`              | expert 别名 / deprecated                   |
| `shared/core/modes/endless/grid.ts`                   | `createEndlessSession` 选项                |
| `game-client/config/local-settings.ts`                | `difficultyPresetId`                       |
| `game-client/app/game-session/mount.ts`               | 解析 preset、传 scroll/AI                  |
| `game-client/app/game-session/scroll.ts`              | 持有 preset 引用                           |
| `game-client/ui/game-canvas/overlay/event-overlay.ts` | 难度 tab UI                                |
| `shared/core/ai/solver.ts`                            | `getEndlessScrollProfile(elapsed, preset)` |
| `scripts/simulate-endless-ai.ts`                      | `--preset` 参数                            |
| `__tests__/.../presets.spec.ts`                       | **新建** 档位边界单测                      |

---

## 8. 分阶段实施

### Phase P0 — 预设与默认（优先）

- [ ] `presets.ts` + `scroll-timing` 改造
- [ ] `localSettings.difficultyPresetId`
- [ ] mount 解析 + 非排位 Start 难度 tab
- [ ] 平台默认 casual / standard
- [ ] 排位锁 expert

### Phase P1 — 校准

- [ ] 模拟脚本分 preset 跑批
- [ ] 根据结果微调 §2.3 数组
- [ ] `docs/MODES.md` 版本表更新

### Phase P2 — 可选

- [ ] HUD 显示 preset 名称
- [ ] 按 preset 覆盖雷密度曲线

---

## 9. 验收标准

- [ ] 四档 preset 单测：tier 边界、升档交替逻辑与现 expert 行为一致
- [ ] 非排位可选 casual / standard / challenge；选择持久化
- [ ] Mobile 首次默认 casual；Desktop 首次默认 standard
- [ ] 排位始终 expert，UI 无难度选择
- [ ] 教程不计分（见 `TUTORIAL-PLAN.md`）
- [ ] `npm run build` + `npm test` 通过
- [ ] 无文件 > 800 行

---

## 10. 文档同步（实现后）

- [ ] `docs/MODES.md` § endless：难度预设表、排位锁定
- [ ] `docs/MODULES.md`：`presets.ts` 导出
- [ ] `docs/REVIEW-LOG.md`：Review 记录

---

## 11. 版本

| 版本 | 日期       | 说明                                       |
| ---- | ---------- | ------------------------------------------ |
| v0.1 | 2026-06-29 | 初稿：四档 preset、排位锁 expert、校准流程 |
