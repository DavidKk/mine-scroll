# 扫雷 Web 游戏 — 项目迭代文档

> 本文档随项目持续更新。每次迭代只改「Current Task」与对应 TODO 状态，规范与模块描述在稳定后再冻结版本号。

---

## Current Task

**Canvas 迁移已完成 — MVP 可玩，等待 Phase 4 新玩法扩展**

运行：`npm run dev`

---

## TODO

### Phase 0 — 前置编排（已完成）

- [x] 0.1–0.5 → Review ✅

### Phase 1 — 规范与需求（已完成）

- [x] 1.1–1.5 → Review ✅

### Phase 2 — 项目脚手架（已完成）

- [x] 2.1 初始化前端工程（Vite 8 + TS 6）→ **Review** ✅
- [x] 2.2 建立目录结构 `src/core|ui|app|styles` → **Review** ✅
- [x] 2.3 lint/format → 跳过（MVP 可选，后续补）
- [x] 2.4 `npm run build` 通过 + README → **Review** ✅

### Phase 3 — MVP 实现（已完成）

- [x] 3.1 **Core** `board.ts`：生成、布雷、邻雷 → **Review** ✅
- [x] 3.2 **Game** `game.ts`：开格、flood fill、插旗、胜负、首击安全 → **Review** ✅
- [x] 3.3 **UI** `grid.ts`：网格、左键/右键 → **Review** ✅
- [x] 3.4 **Controls** 重开、初级 9×9/10 雷 → **Review** ✅
- [x] 3.5 **HUD** 计时、雷数、表情重开 → **Review** ✅
- [x] 3.6 构建验收 `tsc && vite build` → **Review** ✅

### Phase 4+ — 后续迭代（ backlog，MVP 后）

- [ ] 中级/自定义难度
- [ ] 移动端长按/触摸
- [ ] 本地最高分 / 最佳用时
- [ ] 音效与主题
- [ ] 单元测试覆盖 core（Vitest）
- [ ] ESLint / Prettier

---

## 规范定义（摘要 v0.1）

| 项 | 状态 | 说明 |
|----|------|------|
| 游戏规则 | **v0.1** | 见 `docs/SPEC.md` |
| 难度 MVP | **v0.1** | 9×9，10 雷 |
| 技术栈 | **v0.2** | Vite 8 + TS 6 + **Canvas 2D**（HUD+棋盘单 Canvas） |
| 迭代节奏 | **已确认** | 实现 → Review → 优化 → 下一项 |

---

## 模块描述（摘要 v0.1 — 已实现）

| 模块 | 路径 | 状态 |
|------|------|------|
| `ui/theme` | `src/ui/theme.ts` | ✅ |
| `ui/renderer` | `src/ui/renderer.ts` | ✅ |
| `ui/game-canvas` | `src/ui/game-canvas.ts` | ✅ |
| `core/*` | `src/core/` | ✅ 未改 |
| `app` | `src/app/app.ts` | ✅ |

---

## 迭代约定

1. **Current Task** 同时只允许一项「进行中」子任务。
2. **逐步 Review（强制）**：见 `docs/REVIEW-LOG.md`。
3. **MVP 决策**：无特殊要求时采用推荐默认方案。
4. Agent 优先读 `.cursor/skills/minesweeper/SKILL.md` 与本文档。

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-06-14 | Phase 0–1 文档与 Skill 完成 |
| 2026-06-14 | 经典 Chord 双线（双击 / 左右键同按）；SPEC v0.2 |
