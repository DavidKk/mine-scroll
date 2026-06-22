# 从 public/assets 迁出的未使用资源

这些文件曾位于 `public/assets/`，经源码引用审计后确认**当前无尽模式运行时未加载**，已移出部署目录以减小生产包体积。

完整切图与源图仍保留在：

- `docs/design-assets/sliced/` — 全部切图 + preview
- `docs/design-assets/production/` — 生产源图
- `docs/design-assets/generated/`、`reference/` — UI Lab 参考图

## 目录说明

| 子目录 | 内容 |
|--------|------|
| `production/` | 原 `public/assets/production/` 副本（与 docs 重复） |
| `generated/`、`reference/` | 原 public 副本，仅 UI Lab 使用 |
| `game/cutouts/` | 12 个未引用 cutout |
| `game/fx/` | `heart-refill`、`level-up` 动效 |
| `game/ui/` | 除 start/game-over 外的 UI 面板 |
| `game/previews/` | 切图预览拼板 |
| `hud/icons/` | 17 个未引用 HUD 图标 |

## 当前 runtime 保留（public/assets）

- **game**: 4 cutouts、6 FX 序列、2 UI 面板
- **hud**: 8 icons + heart fallback
- **tiles**: 12 格块图

重新启用某资源时：从本目录或 `docs/design-assets/sliced/` 拷回 `public/assets/`，并更新 `manifest.json` 与 `src/ui/game-assets.ts`（或 `hud-sprites.ts`）。
