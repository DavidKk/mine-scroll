# Endless Responsive UX Audit

Date: 2026-06-22

Scope: review endless-mode UI, animation placement, control scale, and cross-resolution consistency before implementation changes.

## Screenshots Reviewed

Generated via Playwright against the current local game page:

- `/tmp/chill-audit-small-360x640-playing.png`
- `/tmp/chill-audit-mobile-390x844-playing.png`
- `/tmp/chill-audit-tablet-768x1024-playing.png`
- `/tmp/chill-audit-desktop-1280x900-playing.png`
- `/tmp/chill-audit-wide-1920x1080-playing.png`

Smoke result: no runtime console/page errors were observed.

## Main Finding

The current UI is not using one unified fullscreen scale.

Instead, each layer computes size independently:

- Board cells scale through `computeViewportCellSize(...)`.
- Top HUD uses fixed heights and fixed chip widths.
- Space uses `min/max + viewport width` sizing.
- Auto uses fixed `74x78`.
- Combo, score pop, break pop, and scroll warning use hardcoded pixel sizes.
- UI Lab preview cards use fixed `220px` canvas previews and independent miniature drawing constants.

This is why different resolutions can look like different games: the board responds to viewport rules, but HUD, controls, and effects respond to their own rules.

## Current Issues

### 1. Ultra-wide Layout Breaks Stage Cohesion

Observed in `/tmp/chill-audit-wide-1920x1080-playing.png`.

- Score is anchored to the far left of the whole viewport.
- Lives are anchored to the far right of the whole viewport.
- Board, Space, and defuse text are centered.
- Auto sits in the far bottom-right corner.

Result: the play area feels like a narrow vertical game floating in a huge desktop wallpaper, while HUD belongs to the screen edge rather than the game.

Recommendation:

- Anchor HUD to a centered game stage, not to full viewport edges.
- On wide screens, keep the stage centered and reserve side space for future player/opponent panels later.
- Do not let current score/lives drift to the physical monitor corners.

### 2. Small Height Layout Is Too Crowded

Observed in `/tmp/chill-audit-small-360x640-playing.png`.

- Board still consumes most vertical space.
- Space and Auto are too visually close.
- Auto feels like part of primary controls.
- Danger band, defuse text, and Space compete at bottom.

Recommendation:

- Use a stage scale derived from available height.
- Shrink Auto sharply or move it to a tiny dev tag.
- Keep bottom area reserved for exactly one primary action: Space.

### 3. Standard Mobile Top HUD Still Feels Crowded

Observed in `/tmp/chill-audit-mobile-390x844-playing.png`.

- Score, countdown, and lives fit, but the row is tight.
- Countdown badge has heavier visual weight than score/lives.
- The top row is functional, but not yet elegant.

Recommendation:

- Implement the compact countdown badge from `ENDLESS-HUD-FEEDBACK-UX-PLAN.md`.
- Do not render a persistent combo chip in this row.
- Keep score and lives text-only.

### 4. Auto Is Oversized For Its Role

Current Auto sizing:

- `autoW = 74`
- `autoH = 78`

This is fixed regardless of viewport scale.

Problems:

- On small screens, it competes with Space.
- On wide screens, it is detached at the physical corner.
- It looks like a game control, but it is a development helper.

Recommendation:

- Replace it with a small dev-only tag.
- Size should be stage-scaled, around:
  - mobile: `44x28`
  - desktop: `56x32`
- Use `AI` or `AUTO` with a tiny active dot.

### 5. Center Combo Popup Blocks Puzzle Hierarchy

Current combo popup:

- Uses a large center badge.
- Has panel fill and border.
- Size is based on fixed badge dimensions, not stage scale.

Problems:

- It reads like a modal or button.
- It can cover the board.
- It conflicts with Start/Game Over visual language.

Recommendation:

- Replace with text-only burst near the board top edge.
- Use particles and sprite burst, but no filled panel.
- Scale it with the same stage scale.
- Duration should be shorter: around `600-760ms`.

### 6. Score Pop Contains Too Much Text

Current score event:

- Shows `+score`
- Shows `xN DEFUSED +N`
- Uses fixed `190x92` effect bounds.

Problems:

- Long English label is too much for small mobile.
- It appears visually separate from the score HUD.

Recommendation:

- Mobile: show only `+90` and small `x3`.
- Desktop: optional muted `DEFUSED +1`.
- Movement should travel toward score HUD.

### 7. UI Lab Is Not Yet A Responsive Review Tool

Current UI Lab is useful for asset previews, but it does not review the actual fullscreen layout.

Problems:

- Each preview card is a miniature isolated animation.
- It does not show the whole game shell at `360x640`, `390x844`, `768x1024`, `1280x900`, `1920x1080`.
- It does not compare stage scale, board scale, HUD scale, and control scale.

Recommendation:

- Add a dev-only `?ui=responsive` page or a UI Lab section called `Responsive Matrix`.
- It should render canned fullscreen states into multiple fixed-size canvas frames:
  - idle/start
  - playing normal
  - playing countdown urgent
  - batch scroll `x3`
  - combo event
  - score event
  - break event
  - game over
- Each frame should use the same runtime layout functions as the real game, not a separate miniature approximation.

### 8. Revealed Empty Cells Are Too Close To Hidden Cells

Observed during gameplay screenshots and manual review.

- Empty revealed cells have a dark fill and subtle border.
- Hidden cells are also dark, with only a slight top highlight and bevel.
- When a revealed cell has no number, it can still look clickable.

Result: the board state language is ambiguous. Players may waste attention re-reading already-open safe areas, especially during scroll pressure.

Current color relationship:

- hidden: `#27272a`
- revealed empty: `#141416`
- both use low-contrast borders and rounded tile shapes

Recommendation:

- Increase state contrast between hidden and revealed-empty cells.
- Hidden cells should remain raised/pressable.
- Revealed-empty cells should look flat, recessed, and settled into the board.
- Possible visual treatment:
  - revealed empty fill: darker or cooler matte floor
  - remove most bevel/highlight from revealed empty
  - use a thinner, lower-contrast inner grid line
  - optionally add a very subtle inset shadow
  - keep numbered revealed cells readable with existing number colors

Acceptance target:

- At a glance, empty revealed cells must read as "already opened, not clickable".
- Hidden cells must read as "closed, clickable".
- This distinction must hold on small cells around `18-23px`, not only on desktop.

## Root Cause

Current layout uses local formulas:

- `safe = clamp(16, 28, viewportW * 0.028)`
- `topBarH = 56/64`
- `keyW = clamp(210, 300, viewportW * 0.32)`
- `autoW = 74`
- `autoH = 78`
- board cell max = `23/25/28/30` based on viewport width
- hidden/revealed empty cell colors are close enough that state depends too much on subtle bevel
- combo badge max = `340`
- score pop effect = `190x92`
- break effect = `230x132`

These formulas are individually reasonable, but collectively they do not produce a single visual scale.

## Proposed Scaling Model

Introduce a `GameStageLayout` for fullscreen endless mode.

### Reference Stage

Use a portrait-first reference stage:

- `baseW = 390`
- `baseH = 844`

This matches the current target mobile viewport and the actual primary play style.

### Stage Scale

Compute one scale:

```ts
const stageScale = clamp(0.78, 1.18, Math.min(viewportW / baseW, viewportH / baseH))
```

Then compute the stage rect:

```ts
const stageW = baseW * stageScale
const stageH = baseH * stageScale
const stageX = (viewportW - stageW) / 2
const stageY = (viewportH - stageH) / 2
```

All gameplay UI should be positioned inside this stage:

- board
- score
- countdown
- lives
- Space
- Auto dev tag
- score pop
- combo pop
- break pop
- start/game-over overlays

### Wide Screens

For wide screens:

- Do not anchor HUD to viewport edges.
- Anchor to `stageX/stageW`.
- Leave outside space available for later battle royale/opponent UI.
- Optional later: show subtle side rails or empty panel placeholders.

### Board Scale

Board cell size should come from the stage scale, not only viewport size:

```ts
const baseCell = 23
const cellSize = Math.round(baseCell * stageScale)
```

Then apply min/max only for readability:

```ts
const cellSize = clamp(18, 30, Math.round(baseCell * stageScale))
```

### HUD Scale

HUD dimensions should also use `stageScale`:

- score font
- lives heart size
- countdown badge size
- Space key size
- Auto dev tag size
- popup font size
- effect bounds

## Recommended Implementation Order

1. Create `GameStageLayout`.
   - Add helper in `src/ui/game-canvas.ts` or a new `src/ui/game-stage-layout.ts`.
   - Return `stageX`, `stageY`, `stageW`, `stageH`, `scale`, and anchor points.

2. Route fullscreen shell through the stage layout.
   - Board offset uses stage coordinates.
   - HUD uses stage coordinates.
   - Space uses stage coordinates.
   - Auto uses stage coordinates.

3. Apply `ENDLESS-HUD-FEEDBACK-UX-PLAN.md`.
   - Remove top combo chip.
   - Convert combo popup to text burst.
   - Shrink Auto.
   - Compact countdown.

4. Improve board state contrast.
   - Make revealed empty cells flatter/recessed.
   - Keep hidden cells raised/pressable.
   - Verify at `360x640` and `390x844`, where cells are smallest.

5. Update UI Lab with a responsive matrix.
   - Make scaling bugs visible before manual testing.
   - Use canned game states.

6. Re-run Playwright screenshot audit.
   - Save updated screenshots for the same viewport matrix.

## Acceptance Criteria

- On `360x640`, Space and Auto do not compete.
- On `390x844`, score/countdown/lives form one coherent HUD row.
- On `768x1024`, UI does not become oversized relative to board.
- On `1280x900`, board and controls remain one centered game stage.
- On `1920x1080`, score/lives are not pinned to physical screen corners.
- Combo does not cover the board as a modal-like panel.
- Score pop is shorter and travels toward score.
- All visible gameplay UI elements scale from the same `stageScale`.
- Revealed empty cells are clearly flatter/darker/recessed than hidden clickable cells.
- Empty revealed cells do not look like unopened clickable tiles on mobile.

## Non-Goals

- Do not change mine generation.
- Do not change AI solver.
- Do not regenerate board tile art in this pass; board-state contrast should be improved with Canvas/theme first.
- Do not add sound.
- Do not implement battle royale side panels yet.
