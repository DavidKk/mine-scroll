# 扫雷 Web 游戏 — 项目迭代文档

> 本文档随项目持续更新。每次迭代只改「Current Task」与对应 TODO 状态。

---

## Current Task

**维护阶段** — 核心玩法（classic / hex / endless）已完成；后续工作见专项文档（天梯榜、资产加载等）。

---

## TODO

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

| 文档 | 内容 |
|------|------|
| `docs/SPEC.md` | 经典规则 |
| `docs/MODES.md` | 两种模式说明 |
| `docs/ARCHITECTURE.md` | 技术架构 |
| `docs/LEADERBOARD-ANTI-CHEAT-PLAN.md` | 天梯榜与反作弊技术方案（推荐） |
| `docs/CODE-OPTIMIZATION-PLAN.md` | 模块化重构方案与验收 |

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-06-14 | Phase 5：多模式原型完成 |
| 2026-06-18 | hex 加入；distance 移除 |
| 2026-06-18 | 精简为 classic + hex 两种模式 |
| 2026-06-18 | hunt 寻雷 DEMO 试玩后移除 |
| 2026-06-18 | endless 无尽模式 |
| 2026-06-28 | 代码模块化重构（见 CODE-OPTIMIZATION-PLAN v0.2） |
| 2026-06-28 | 移除 Phase 6（GameMode API / 本地纪录 / logic 模式） |
| 2026-06-28 | 移除棋盘/UI 位图资产 backlog（继续 Canvas 程序绘制） |
