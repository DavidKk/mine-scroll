---
name: minesweeper
description: >-
  Shopline chill 扫雷 Web 游戏项目开发指南。修改代码、实现功能、修复 bug、
  重构或讨论架构时使用。先读 docs/PROJECT.md 的 Current Task 与 docs/REVIEW-LOG.md。
  硬性约束：src/**/*.ts 单文件 ≤800 行；core 无 DOM；规则只在 core。
---

# 扫雷 Web 游戏 — 项目 Skill

## 文档索引（按优先级）

1. `docs/PROJECT.md` — Current Task、TODO、迭代约定
2. `docs/REVIEW-LOG.md` — 最近 Review 结论
3. `docs/SPEC.md` — 经典规则（冲突时 SPEC 优先）
4. `docs/MODES.md` — classic / hex / endless 模式说明
5. `docs/ARCHITECTURE.md` — 技术栈与分层
6. `docs/MODULES.md` — 模块接口与导出
7. `docs/CODE-OPTIMIZATION-PLAN.md` — 模块化拆分方案与验收（重构时必读）

专项方案（按需）：

- `docs/MOBILE-TOUCH-INPUT-PLAN.md` — 移动端触摸映射
- `docs/ENDLESS-HUD-FEEDBACK-UX-PLAN.md` — HUD 视觉变更（与 refactor 分离）

### Admin 认证（`/admin/*`）

- 生产：Signet（`SIGNET_SDK_URL`）；本地 dev 可用 `ACCESS_USERNAME` / `ACCESS_PASSWORD`
- 必需 `JWT_SECRET`；环境变量见 `.env.example`
- 改 auth 时对齐 `vercel-web-scripts`：`services/auth/`、`app/auth/vercel-2fa/callback/`
- Admin 页 logout 用 `game-client/app/admin-chrome.ts`

---

## 开发节奏

每个 TODO 子项：

1. 只做 **Current Task** 一项
2. 实现 → **Review**（范围、SPEC 一致、边界 case、**行数与分层**）→ 优化
3. 写入 `docs/REVIEW-LOG.md`
4. 更新 `docs/PROJECT.md` 勾选与 Current Task
5. Review 通过后进入下一项

---

## 硬性约束

### 游戏规则与分层

- **Core 无 DOM**：`src/core/` 禁止 `document` / `window`
- **UI 无规则**：布雷、flood fill、胜负、Chord 判定只在 `src/core/`
- **Renderer 无事件**：`src/ui/renderer/` 只做绘制与 hit-test
- **Canvas 编排**：生命周期、RAF、输入、HUD 编排在 `src/ui/game-canvas/`
- **MVP 默认**：9×9、10 雷、Vite + TS + Canvas 2D；含 Chord 双线
- **首次点击安全**：布雷 exclude 首格 + 8 邻格
- **插旗格左键**：无效果（SPEC §3.1）

### 单文件行数（硬性）

- **`src/**/*.ts` 每个文件 ≤ 800 行**，无例外
- 新增代码前若文件已 > 600 行，**先拆再写**
- 工厂入口（如 `create.ts`）目标 **≤ 200 行**；单职责子模块目标 **≤ 400 行**
- 提交前自检：

```bash
find src -name '*.ts' -exec wc -l {} + | awk '$1 > 800 {print}'
```

若有输出 → 必须拆分后才能合并。

### 禁止模式

- **上帝闭包**：禁止在单文件内堆积 40+ 闭包状态、80+ 嵌套函数
- **Lab 重复实现 Runtime**：Asset Gallery 必须复用 runtime drawer，不得复制 HUD/格子绘制逻辑
- **工具函数复制粘贴**：`clamp01`、`easeOutCubic`、`roundedRectPath`、`loadRuntimeImage` 等只放在 `src/ui/primitives/`
- **局部重复定义**：禁止在业务文件内再写 `function clamp01` 等（`rg 'function clamp01' src/` 仅应命中 `primitives/math.ts`）

### 重构 vs 功能

| 类型          | 要求                                                      |
| ------------- | --------------------------------------------------------- |
| **纯重构**    | 零行为变更；`npm run build` 通过；不改 SPEC 可见 UX       |
| **功能 / UX** | 先改对应 `docs/*.md`，再改代码；不与 refactor 混在同一 PR |

---

## 模块化规范

### 分层职责

| 层                                | 允许                             | 禁止                       |
| --------------------------------- | -------------------------------- | -------------------------- |
| `core/`                           | 纯函数、数据结构、模式规则       | DOM、Canvas                |
| `ui/primitives/`                  | 数学、路径、资源加载             | 游戏状态、业务逻辑         |
| `ui/renderer/`                    | 棋盘格绘制、hit-test             | 事件监听、计时器           |
| `ui/game-canvas/`                 | RAF、输入、HUD 编排、overlay     | 布雷、胜负                 |
| `ui/hud-feedback/`、`ui/cell-fx/` | 纯 Canvas drawer                 | 模块级可变状态             |
| `app/`                            | 路由、session 编排、Lab 面板注册 | 复杂绘制（应调 ui drawer） |

### 命名约定

- **Drawer**：`(ctx, …) => void`，无闭包状态
- **Runtime**：RAF / 队列 / cache；状态集中在 `CanvasRuntimeState`（`game-canvas/runtime/state.ts`）
- **Scene**：Lab 预览 `(ctx, w, h, tMs, …) => void`，内部只调 Drawer
- **薄 re-export**：旧路径保留 1 个迭代周期，注释 `@deprecated import from '…'`

### 拆分触发条件

文件出现以下任一情况时 **必须拆分**：

1. 超过 **800 行**
2. 同时承担 **布局 + 绘制 + 输入 + 状态机**
3. Asset Gallery 与 Runtime 出现 **同名/同责绘制函数**
4. 单文件 export 超过 **3 个不相关职责域**

### 推荐拆分方式

| 原集中区                        | 拆到                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `game-canvas/create.ts`         | `hud/`、`overlay/`、`runtime/`、`input/`、`shell/`、`layout/`                |
| `hud-feedback-fx.ts`            | `ui/hud-feedback/*`                                                          |
| `cell-fx.ts`                    | `ui/cell-fx/*` + `ui/cell-fx/gallery/*`                                      |
| `asset-gallery/cell-effects.ts` | `cell-effect-live-previews.ts`、`cell-effect-frame-grid.ts`、瘦入口          |
| `glyphs/geometry.ts`            | `shard-shapes.ts`、`solid-mesh.ts`、`glyph-canvas.ts`、`shard-motion.ts`     |
| `asset-gallery.ts`              | `asset-gallery-data.ts`、`asset-gallery-panels.ts`、`asset-gallery-shell.ts` |
| `core/ai/moves.ts`              | `core/ai/moves/*`                                                            |

### Runtime ↔ Lab 复用

- Gallery HUD 预览：调 `game-canvas/hud/score-hud.ts` → `drawScoreHud` 等
- 格子 / 板面预览：调 `ui/cell-fx/gallery/*` 或 runtime `cell-fx` drawer
- 禁止在 `app/asset-gallery/` 内维护第二套 Score/Combo/LifeLoss 绘制

### 状态管理

- `createGameCanvas()` 持有唯一 `CanvasRuntimeState` 实例
- 子模块以 `(rt, ctx, …)` 或 `(ctx, state, now)` 纯函数读写，**不**在 drawer 文件用模块级 `let`

---

## 目录速查

```
src/core/           → modes/endless, ai/moves, board, engine
src/ui/primitives/  → math, path, assets
src/ui/renderer/    → board, cells（纯绘制）
src/ui/game-canvas/ → create.ts, hud/, overlay/, runtime/, input/, shell/
src/ui/hud-feedback/→ score-pop, combo-burst, …
src/ui/cell-fx/     → board-overlays, gallery/
src/app/            → app.ts, game-session/, asset-gallery/
```

---

## 验收 Checklist（每次改动）

**构建：**

- [ ] `npm run build` 通过
- [ ] 无文件 > 800 行（见上方 `find` 命令）

**分层：**

- [ ] `core/` 无 DOM
- [ ] 规则变更只在 `core/`，且已同步 `SPEC.md` / `MODES.md`
- [ ] 接口变更已同步 `MODULES.md` / `ARCHITECTURE.md`

**重构额外：**

- [ ] 对外 API（`createGameCanvas`、`mountEffectPanels` 等）不变
- [ ] 无新增 Lab 独有 HUD 绘制
- [ ] 工具函数未在 `primitives/` 外重复定义

**玩法（Endless 手测，功能改动时）：**

- [ ] 开格、插旗、Chord、卷轴、踩雷、胜/负
- [ ] 移动端：单击 / 双击 Chord / 垂直滑插旗 / 卷屏按钮（见 `MOBILE-TOUCH-INPUT-PLAN.md`）

---

## 变更规则

- 改规则 → 先改 `SPEC.md` / `MODES.md` 版本表，再改代码
- 改接口 → 同步 `MODULES.md` 与 `ARCHITECTURE.md`
- 大文件拆分 → 对照 `CODE-OPTIMIZATION-PLAN.md`，完成后更新该文档勾选
- 不要跳过 Review 日志

---

## 详细参考

完整 Phase 计划、风险缓解与历史行数数据见 `docs/CODE-OPTIMIZATION-PLAN.md` v0.4。
