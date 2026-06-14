---
name: minesweeper
description: >-
  Shopline chill 扫雷 Web 游戏项目开发指南。修改代码、实现功能、修复 bug、
  或讨论架构时使用。先读 docs/PROJECT.md 的 Current Task 与 docs/REVIEW-LOG.md。
---

# 扫雷 Web 游戏 — 项目 Skill

## 文档索引（按优先级）

1. `docs/PROJECT.md` — Current Task、TODO、迭代约定
2. `docs/REVIEW-LOG.md` — 最近 Review 结论
3. `docs/SPEC.md` — 游戏规则（冲突时 SPEC 优先）
4. `docs/ARCHITECTURE.md` — 技术栈与分层
5. `docs/MODULES.md` — 模块接口

## 开发节奏

每个 TODO 子项：

1. 只做 **Current Task** 一项
2. 实现 → **Review**（范围、SPEC 一致、边界 case）→ 优化
3. 写入 `docs/REVIEW-LOG.md`
4. 更新 `docs/PROJECT.md` 勾选与 Current Task
5. Review 通过后进入下一项

## 硬性约束

- **Core 无 DOM**：`src/core/` 禁止 `document` / `window`
- **UI 无规则**：布雷、flood fill、胜负只在 `src/core/`
- **Canvas 分层**：绘制在 `renderer.ts`，事件在 `game-canvas.ts`；新玩法可换 renderer 或扩展 `RenderState`
- **MVP 默认**：9×9、10 雷、Vite + TS + Canvas 2D；含 Chord 双线
- **首次点击安全**：布雷 exclude 首格 + 8 邻格
- **插旗格左键**：无效果（SPEC §3.1）

## 目录速查

```
src/core/        → types, difficulty, board, game
src/ui/          → theme, renderer, game-canvas
src/app/         → app.ts
src/styles/      → main.css（页面布局，非棋盘）
```

## Phase 3 验收 Checklist

- [ ] 首点及周围无雷
- [ ] 0 区 flood fill 正确
- [ ] 左键开格 / 右键插旗 / Chord 双线
- [ ] 踩雷失败、清盘胜利
- [ ] 雷数显示、计时、重开
- [ ] 胜/负后格子不可再改局

## 变更规则

- 改规则 → 先改 `SPEC.md` 版本表，再改代码
- 改接口 → 同步 `MODULES.md` 与 `ARCHITECTURE.md`
- 不要跳过 Review 日志
