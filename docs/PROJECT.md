# 扫雷 Web 游戏 — 项目迭代文档

> 本文档随项目持续更新。每次迭代只改「Current Task」与对应 TODO 状态。

---

## Current Task

**新手教程 + 无尽难度预设** — 方案见 `docs/TUTORIAL-PLAN.md`、`docs/DIFFICULTY-PRESET-PLAN.md`。建议实施顺序：**P0 难度 preset** → **Phase A 教程 Step 1–4** → **Phase B 教程 Step 5**。

---

## TODO

### 新手教程 + 难度（待实施）

- [ ] P0：`shared/core/modes/endless/presets.ts` + Start 面板选档（见 `DIFFICULTY-PRESET-PLAN.md`）
- [ ] Phase A：教程 Step 1–4（见 `TUTORIAL-PLAN.md`）
- [ ] Phase B：教程 Step 5 + 完成后预选休闲难度
- [ ] P1：`simulate-endless-ai.ts --preset` 校准各档参数

### Phase 0–3 — MVP（已完成）

- [x] 经典扫雷 + Canvas + Chord + 可配置难度

### Phase 5 — 多模式原型（已完成）

- [x] 多模式试玩架构（mode-hub / engine / catalog）
- [x] hex 六边形扫雷

### Phase 5+ — 试玩结论（已完成）

- [x] `distance` 试玩 → 不采纳，已移除
- [x] question / daily / fog / lives / reverse → 不保留，已移除
- [x] `hunt` 寻雷挑战 DEMO → 试玩无解/过简，已移除
- [x] 最终保留：**classic + hex**
- [x] **endless** 无尽模式（向上扩盘、动态布雷）

---

## 文档索引

| 文档                                  | 内容                                    |
| ------------------------------------- | --------------------------------------- |
| `docs/SPEC.md`                        | 经典规则                                |
| `docs/MODES.md`                       | 两种模式说明                            |
| `docs/ARCHITECTURE.md`                | 当前 Vite SPA 技术架构                  |
| `docs/NEXTJS-PLATFORM-PLAN.md`        | Next.js 平台 + 独立游戏客户端（待实施） |
| `docs/ASSET-BOOT-LOADER-PLAN.md`      | 启动资源加载器（已完成）                |
| `docs/LEADERBOARD-ANTI-CHEAT-PLAN.md` | 天梯榜与反作弊（后续）                  |
| `docs/CODE-OPTIMIZATION-PLAN.md`      | 模块化重构方案与验收                    |
| `docs/TUTORIAL-PLAN.md`               | 新手教程（固定盘、Canvas 引导）         |
| `docs/DIFFICULTY-PRESET-PLAN.md`      | 无尽模式难度预设（四档 + 排位锁专家）   |

---

## 变更日志

| 日期       | 变更                                                           |
| ---------- | -------------------------------------------------------------- |
| 2026-06-14 | Phase 5：多模式原型完成                                        |
| 2026-06-18 | hex 加入；distance 移除                                        |
| 2026-06-18 | 精简为 classic + hex 两种模式                                  |
| 2026-06-18 | hunt 寻雷 DEMO 试玩后移除                                      |
| 2026-06-18 | endless 无尽模式                                               |
| 2026-06-28 | 代码模块化重构（见 CODE-OPTIMIZATION-PLAN v0.2）               |
| 2026-06-28 | 移除 Phase 6（GameMode API / 本地纪录 / logic 模式）           |
| 2026-06-28 | 移除棋盘/UI 位图资产 backlog（继续 Canvas 程序绘制）           |
| 2026-06-28 | 新增 Next.js 平台拆分方案（NEXTJS-PLATFORM-PLAN v0.1）         |
| 2026-06-29 | 新增新手教程与难度预设技术方案（TUTORIAL / DIFFICULTY-PRESET） |
