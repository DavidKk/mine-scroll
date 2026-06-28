# Review 日志

每完成一个子任务（TODO 项）后在此记录 Review，确认通过后再进入下一项。

---

## Review 模板（复制使用）

```markdown
### [Phase X.Y] 任务标题 — YYYY-MM-DD

**产出：**（文件/功能列表）

**做法摘要：**（当前方案 2–3 句）

**Review 检查项：**
- [ ] 与 SPEC / ARCHITECTURE 一致（Phase 3 起）
- [ ]  scope 未超出 Current Task
- [ ] 可维护性 / 边界 case 已考虑
- [ ] 文档 / TODO 已同步

**优化项：**（本次 Review 中已做或建议做的改进）

**结论：** ✅ 通过，进入下一项 / ⏸ 待用户确认 / ❌ 需返工
```

---

## 记录

### [Phase 0] 前置任务编排 — 2026-06-14

**产出：** `docs/PROJECT.md`、`docs/PHASE0-TASK-PLAN.md`、迭代流程约定

**做法摘要：** 分 Phase 0–4 编排任务；MVP 采用推荐默认（9×9/10 雷、Vite+TS、桌面优先）；引入逐步 Review Gate。

**Review 检查项：**
- [x] scope 未超出 Current Task
- [x] 文档结构支持持续迭代（Current Task + TODO + 规范摘要）
- [x] 每步 Review 流程已写入 PROJECT.md
- [x] MVP 默认值已采纳，无需额外确认项

**优化项：**
- 增加 `docs/REVIEW-LOG.md` 集中记录每步 Review
- TODO 子项统一后缀「→ Review → 下一项」
- Phase Gate 保留；子任务 Review 为默认节奏，Phase 边界仍需汇总 Review

**结论：** ✅ 通过，进入 Phase 1.1（编写 SPEC.md）

---

### [Phase 1.1] 编写 SPEC.md — 2026-06-14

**产出：** `docs/SPEC.md` v0.1

**做法摘要：** 按经典 Windows 扫雷冻结 MVP 规则：9×9/10 雷、左/右键、首次点击安全布雷、flood fill、HUD 最低要求；明确 MVP 不做 chord/问号/自定义尺寸。

**Review 检查项：**
- [x] scope 仅限 MVP，与 PROJECT 摘要一致
- [x] 首次点击安全、胜负、flood fill 均有定义
- [x] 边界 case 列表可指导实现
- [x] 插旗格左键行为已明确为「无效果」

**优化项：**
- 将插旗格左键从模糊表述改为明确「无效果」

**结论：** ✅ 通过，进入 Phase 1.2（编写 ARCHITECTURE.md）

---

### [Phase 1.2] 编写 ARCHITECTURE.md — 2026-06-14

**产出：** `docs/ARCHITECTURE.md` v0.1

**做法摘要：** Vite+TS 三层架构（core/ui/app）；定义 Cell/Board/GameState/CellView；数据流与算法归属表；CSS Grid + BEM。

**Review 检查项：**
- [x] 与 SPEC v0.1 一致（idle 首击布雷、flood fill、胜负）
- [x] core 无 DOM 约束明确
- [x] 目录树可直接指导 Phase 2 脚手架

**优化项：** 无

**结论：** ✅ 通过，进入 Phase 1.3

---

### [Phase 1.3] 编写 MODULES.md — 2026-06-14

**产出：** `docs/MODULES.md` v0.1

**做法摘要：** 各模块导出函数签名、依赖图、SPEC 章节映射。

**Review 检查项：**
- [x] 与 ARCHITECTURE 数据模型一致
- [x] game/board 职责边界清晰
- [x] UI 回调接口足够支撑 MVP

**优化项：** 无

**结论：** ✅ 通过，进入 Phase 1.4

---

### [Phase 1.4] 编写项目 Skill — 2026-06-14

**产出：** `.cursor/skills/minesweeper/SKILL.md`

**做法摘要：** 文档索引、Review 节奏、硬性约束、Phase 3 验收 checklist。

**Review 检查项：**
- [x] 触发场景与文档路径完整
- [x] 约束与 SPEC 一致

**优化项：** 无

**结论：** ✅ 通过，进入 Phase 1.5

---

### [Phase 1.5] 同步 PROJECT.md + Phase 1 汇总 — 2026-06-14

**产出：** 更新 `PROJECT.md` 规范/模块摘要；SPEC §2 措辞与 §3.1 对齐

**Review 检查项：**
- [x] 摘要与 SPEC/ARCHITECTURE/MODULES 一致
- [x] Phase 1 TODO 全部勾选
- [x] Gate B 通过 → 进入 Phase 2

**优化项：** SPEC §2 插旗左键描述与 §3.1 统一

**结论：** ✅ 通过，进入 Phase 2.1（初始化前端工程）

---

### [Phase 1.2–1.5] 规范/架构/模块/Skill — 2026-06-14

（详见上文各节）Phase 1 Gate B ✅

---

### [Phase 2.1] 初始化 Vite + TS — 2026-06-14

**产出：** `package.json`, `tsconfig.json`, `index.html`, 依赖安装

**Review：** ✅ 与 ARCHITECTURE 选型一致；`npm run build` 可执行

---

### [Phase 2.2] 目录结构 — 2026-06-14

**产出：** `src/core/`, `src/ui/`, `src/app/`, `src/styles/`

**Review：** ✅ 与 MODULES 规划一致

---

### [Phase 2.3] lint/format — 2026-06-14

**结论：** ⏭ 跳过（MVP 可选，记入 Phase 4 backlog）

---

### [Phase 2.4] 可运行验证 — 2026-06-14

**产出：** `README.md`；`tsc && vite build` 成功

**Review：** ✅ Gate C 通过

---

### [Phase 3.1–3.2] Core + Game — 2026-06-14

**产出：** `board.ts`, `game.ts`, `types.ts`, `difficulty.ts`

**Review 检查项：**
- [x] 首击 exclude 九宫格布雷
- [x] flood fill 0 区
- [x] 插旗格左键无效果（game.reveal 早退）
- [x] won/lost 判定

**结论：** ✅

---

### [Phase 3.3–3.5] UI + HUD + App — 2026-06-14

**产出：** `grid.ts`, `hud.ts`, `app.ts`, `main.css`

**Review：** ✅ 左键/右键/contextmenu 阻止；计时首击启动；雷数 `总数−旗数`

---

### [Phase 3.6] MVP 构建验收 — 2026-06-14

**产出：** 生产构建 `dist/` 成功

**结论：** ✅ Gate D 通过 — MVP 可交付；建议本地 `npm run dev` 手动玩一局确认手感

---

### [Phase 4+] UI 迁移 Canvas 2D — 2026-06-14

**产出：** `theme.ts`, `renderer.ts`, `game-canvas.ts`；删除 `grid.ts`, `hud.ts`

**Review 检查项：**
- [x] core 层零改动，规则行为不变
- [x] renderer 纯绘制 + hit-test，便于新玩法扩展
- [x] HiDPI、左键/右键/重开 hit-test 正常
- [x] `npm run build` 通过
- [x] ARCHITECTURE / MODULES / Skill 已同步 v0.2

**优化项：** 指针坐标改用 CSS 逻辑像素，与 `ctx.scale(dpr)` 一致

**结论：** ✅ 通过

---

### [样式] 现代化视觉刷新 — 2026-06-14

**产出：** `theme.ts`, `renderer.ts`, `main.css`

**变更：** 弃 Win95 凸起边框 → 暗色圆角卡片；格子间距；矢量旗/雷/状态图标；HUD 胶囊计数器；页面渐变背景

**结论：** ✅ build 通过

---

### [Phase 5+] distance 距离扫雷试玩 — 2026-06-18

**产出：** `numberMode: distance`、距离 Chord、AI solver + 执行日志

**试玩结论：❌ 不采纳，模式搁置**

**核心问题（信息论，非实现 bug）：**
- 数字 = 到**最近雷**的步数 → 约束为圆盘，不计数、不区分方向
- 可严格推导的只有：D≥2 安全盘（Chord）、D=1 邻圈 singleton 必雷
- 中后期大量「多格同属安全集、无 Chord、无唯一下一手」→ 不具备经典扫雷的推理链与唯一解感
- **无法做成「推到哪步是哪步」的推理向小游戏**；加 AI 只能减少误点，不能补信息

**日志佐证：**
- AI 连走 13 步后，无 Chord，从 17 个「必安全」中 arbitrary 开 (1,4) 踩雷
- 根因之一：错误规则「D=1 已插旗 → 邻格必安全」（邻圈可多雷）已从 solver 删除
- 修 bug 后仍会频繁「无确定性安全步」——玩法模型问题，非 AI 可修

**处置：**
- [x] `docs/MODES.md` 标 ❌ 不采纳
- [x] 试玩结论写入 REVIEW-LOG
- [x] **2026-06-18 后续：用户要求移除，distance 模式与 solver 已从代码删除**

---

### [Endless AI] 实机日志 Review（↑39 局）— 2026-06-19

**依据：** 用户实机日志（卷轴 ↑25→↑39，最终失败）

**表现（✅）：**
- 高速卷轴（1.5s/行）下撑到 **↑39**，底行 Chord/插旗流水线基本正常
- 无「前沿碰运气」盲猜；多数步为确定 Chord/开格

**问题（❌）：**

| # | 现象 | 根因 |
|---|------|------|
| 1 | 大量 `猜开格 · 概率猜雷 0%` | CSP 算出 0% 雷但 cell 未进 `safe` 集，仍标为 guess |
| 2 | `撤旗 (10,0) 矛盾旗纠正` → 下一步同格 `底行临期开格` 踩雷 | 撤旗后无冷却，临期策略立即再开同格 |
| 3 | ↑28 时 `33%` 猜雷 −1 命 | 命数≥4 时允许，属策略边界（可接受） |
| 4 | ↑38–39 连续卷轴 −1 命×2 无 AI 步 | 底行漏格 + AI 等待，被卷轴扣光最后 2 命 |

**已做优化：**
- [x] CSP `bestProb ≤ 0` → 改 **必安全开格**（不再显示「猜 0%」）
- [x] **矛盾/错旗撤除后** 该格加入 `aiContradictedFlags`，禁止再插/猜
- [x] 日志容量 **100 → 1000** 条，面板高度 **140 → 220px**

**待观察：**
- [ ] 极速卷轴下底行漏格仍可能纯扣命（需更强临期 CSP 或接受 −1/轮）
- [ ] `aiContradictedFlags` 是否需随卷轴滚动清理（当前仅新局重置）

**结论：** ⏸ 关键 bug 已修，需再跑 1–2 局长日志验证 0% 与撤旗后行为

---

### [Endless AI] 模拟验收迭代 — 2026-06-20

**依据：** `scripts/simulate-endless-ai.ts` 批量模拟 + `simulate-debug-trace.ts` 单局复盘

**验收标准：** ↑≥29 且未失败（否则 AI 不及格）

**模拟结果（8 局）：**
- 到达最快卷轴：**0/8**
- 平均卷轴深度：**~4.8**（单局最佳约 **↑9**）
- 平均空等：**~186 次/局**
- 猜雷踩雷率：**~40%**

**根因链（debug seed）：**
1. `尝试·插旗` 错旗污染 → 假「必安全」踩雷（已移除尝试插旗路径）
2. `absorbConsistentFlags` 把错旗吸进 `mines` 集（已禁用）
3. 底行临期空等 → 卷轴连扣命（已加 CSP 底行猜格 / 绝望开格）
4. 低命数仍大量 `move=null` 空等

**已做优化：**
- [x] 移除 `findEndlessAttemptMove` 插旗分支
- [x] `isClueForcedMine/Safe` + CSP 必雷验证（`isCspCertainMine`）
- [x] `mineSetConsistent` 未验证旗视为未知格
- [x] `findBottomForcedReveal` 改 CSP 选格
- [x] `findBottomDesperateGuess` 命≤2 底行宁可猜
- [x] `pickScrollMove` 空等时命≤3 可手动上移
- [x] 修复 `simulate-endless-ai.ts` 缺失 `MAX_SCROLL_TARGET`

**结论：** ❌ 未达 ↑29，AI 仍不及格；需继续优化底行 CSP 与空等破局

---

### [Endless AI] 完全重写 — 2026-06-20

**产出：** 模块化 AI（`deduction.ts` / `csp.ts` / `moves.ts` / `solver.ts`），保留 `heal-policy` / `scroll-policy` / `ai-blocked`

**架构：**
1. `deduction.ts` — 基础规则 + 子集推理 + 错旗纠正
2. `csp.ts` — 前沿组件枚举 + 雷率概率
3. `moves.ts` — 走子优先级：纠错 → 底行确定步 → CSP → 前沿/探路 → 开拓
4. `solver.ts` — 编排 + 回血/手动上移

**确定性规则：**
- 插旗仅 CSP 100% 必雷
- 开格须 CSP 0% 或邻线索 need===0 直接推出
- 禁止尝试插旗 / absorb 错旗

**模拟（5 局）：** 0/5 达 ↑29，均深 ~3.6（重写后稳定性待调）

**结论：** ⏸ 架构重写完成，性能未达标，需继续调参

---

### [Design Assets] tiles 切图 Review — 2026-06-21

**产出：** `docs/design-assets/tiles/*.png`（12 张 128×128 透明 PNG）

**Review 检查项：**
- [x] 透明底去除棋盘格（fringe 残留 ≤8px，可接受）
- [x] 数字 1–8 尺寸一致（bbox ~115×120，fill ~84%）
- [ ] 上排图标与数字格视觉占比一致（hidden/revealed/mine ~40% fill，flag ~29%）
- [ ] 旗子颜色与 theme 红旗一致（现为蓝色）
- [x] 玩法元素齐全（隐藏/翻开/雷/旗/数字）

**优化项：**
- 建议程序归一化：上排 4 图标放大至与数字格同外框占比后再接入 renderer
- 可选：num-8 边缘 8px 去 fringing；flag 改红旗或接受蓝旗
- 不必逐条重生成 §2.2–2.5；不满意再按 reference 重出一张 sheet

**结论：** ⏸ 可试接入；接入前建议做轻量精修（缩放归一），非必须整张重生成

---

### [Endless UX] HUD / Feedback / Responsive 调优 — 2026-06-22

**产出：** `src/ui/game-canvas.ts`、`src/ui/game-stage-layout.ts`、`src/ui/renderer.ts`、`src/app/responsive-matrix.ts`、`src/app/ui-lab.ts`

**做法摘要：** 顶部 HUD 改为 score 文本、score 旁紧凑 combo、heart-only lives、紧凑 countdown badge；Auto 改成 dev-only 小 `AI` tag。Combo/score/break 反馈改为短文本、低透明 FX、boardTop 附近显示，并新增 `?ui=responsive` 矩阵页覆盖关键尺寸和事件状态。

**Review 检查项：**
- [x] 不改变 core 规则与无尽模式机制
- [x] Space 仍是底部唯一主操作，Auto 不再抢视觉层级
- [x] 无持久大 combo chip，当前 combo 仍可见
- [x] revealed empty cell 改为扁平/内陷，hidden cell 保持可点击感
- [x] `360x640`、`390x844`、`768x1024`、`1280x900`、`1920x1080` 已有响应式矩阵检查入口

**优化项：**
- 将 cutout/FX/HUD 反馈关键参数集中到 `GAME_ASSET_TUNING`
- UI Lab tile 预览补齐 hidden / revealed empty / revealed number / flagged / mine
- `?ui=responsive` 增加 stage、board、Space、HUD anchor 辅助线和人工 Review checklist
- 用户反馈后将 Space 从大底部面板收为中等主按钮，保持主操作层级但降低压迫感
- 二次截图 Review 后继续调大棋盘基准格宽，并将 Start/Game Over 面板宽度改为跟棋盘联动；Space 进一步收为小主按钮
- 开发环境下 `AI` 与 `SPACE` 改为同尺寸并排按钮；正式环境仍隐藏 `AI`，`SPACE` 单独居中
- **2026-06-24 纠正**：SPACE **不得**使用按钮图（`space-active`/`space-disabled` 已删除）。固定为进度条（`bottomRailRect`）**上方居中**的 Canvas 文字 `SPACE`，正弦闪烁；详见 `ENDLESS-FULLSCREEN-LAYOUT.md` §8.1
- 后续 Review 改为全屏宽 HUD、`AI` 固定右下角开发入口，不为 `AI` 预留底部按钮区；无尽可见行数 `20 -> 22`，棋盘在可用区域内略向下放置
- 初始 combo 为 `0` 时不渲染顶部 combo，避免默认显示 `x0` / `x1` 造成误读；仅连击真正大于 1 时展示
- 棋盘下方加入低亮蓝紫底部能量轨/扫描线；滚动压力升高时转 amber/red，作为氛围反馈，不新增功能按钮
- `AI` dev 入口缩成右下角小 chip，并按棋盘右边界避让，避免覆盖棋盘格

**结论：** ✅ 进入用户视觉 Review；无需新增图片生成

---

### [Refactor] 代码模块化优化 — 2026-06-28

**产出：** `docs/CODE-OPTIMIZATION-PLAN.md` v0.2 全 Phase 落地；`ARCHITECTURE.md` / `MODULES.md` v0.3

**做法摘要：** 按方案拆 `game-canvas/create.ts`（3402→190 行）、`hud-feedback-fx`、`cell-fx`、`cell-effects`、`glyphs`、`ai/moves`；新建 `ui/primitives/` 统一工具函数；Asset Gallery HUD 复用 runtime drawer。

**Review 检查项：**
- [x] 单文件 ≤800 行（最大 777 行）
- [x] `npm run build` 通过
- [x] 对外 API（`createGameCanvas`, `mountEffectPanels` 等）不变
- [x] core 无 DOM 约束保持
- [ ] Endless 全流程手测回归（建议用户验证）

**优化项：**
- `game-canvas/` 36 子模块 + `CanvasRuntimeState`
- `cell-fx/gallery/` 8 预览场景模块
- 薄 re-export 保留旧 import 路径

**结论：** ✅ 构建通过，待运行时手测确认无视觉/行为回归

---
