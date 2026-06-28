# MineScroll UI Asset TODO

Reference target:

- `docs/design-assets/reference/endless-arcade-visual-target-v1.png`
- Runtime copy: `public/assets/reference/endless-arcade-visual-target-v1.png`

Generated asset sheets:

- Static states: `docs/design-assets/generated/endless-static-states-v1.png`
- FX sprite concept: `docs/design-assets/generated/endless-fx-sprite-concept-v1.png`
- HUD and popups: `docs/design-assets/generated/endless-hud-popups-v1.png`

Runtime copies:

- `public/assets/generated/endless-static-states-v1.png`
- `public/assets/generated/endless-fx-sprite-concept-v1.png`
- `public/assets/generated/endless-hud-popups-v1.png`

## Coverage From Target Image

Already represented well enough to use as the visual baseline:

- Tile states: hidden, revealed, numbered, flagged, mine, wrong flag, exploded, dead.
- Numbers: 1-8 color language.
- Mine/flag variants: mine, exploded mine, safe flag, danger flag.
- HUD: score, depth, lives, countdown, danger, warning.
- Actions: Space key, dev-only Auto.
- Feedback FX: safe reveal, combo burst, score pop, mine explosion, level up.
- Popups: combo, defused progress, level up, game over/retry.

> **范围说明**：棋盘格内静态贴图与 FX 位图 backlog 已移出计划；生产 UI 继续以 Canvas 程序绘制为主（见下方 Implementation Plan）。

## Implementation Plan

- [x] Build a dev-only UI Lab page at `?ui=lab`.
- [x] Show the target reference image inside the UI Lab.
- [x] Add live Canvas previews for tile, click, flag, explosion, combo, scroll warning, life/heal, game-over modal.
- [x] Use UI Lab as the approval surface before changing the main game UI.
- [x] Keep static generated reference images in `docs/design-assets/reference`.
- [x] Keep runtime preview/static assets in `public/assets`.
- [x] Prefer Canvas vector/procedural rendering for production UI unless a sprite sheet is clearly better.
