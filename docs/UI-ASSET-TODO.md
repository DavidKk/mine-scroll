# Endless Minesweeper UI Asset TODO

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

## Missing Static States

- [ ] AI hint states: reveal suggestion, flag suggestion, unflag correction, chord target, guess warning.
- [ ] Hover and pressed states for a board cell.
- [ ] Selected/focused board cell for keyboard or AI highlight.
- [ ] Bottom danger overlay for 1/N rows, especially batch scroll `x2`, `x3`, `x5`.
- [ ] Mistake/break state: combo reset, defuse bank cleared, life lost.
- [ ] Heal state: `+1 life`, full-life auto settlement, defuse bank spend.
- [ ] Start/ready overlay matching the arcade style.
- [ ] Pause/log modal style matching the arcade style.
- [ ] Victory/clear state, even if endless rarely uses it.
- [ ] Disabled/locked button state for Space and Auto.

## Animation Needs

Best implemented as procedural Canvas first:

- [ ] Cell reveal: quick blue flash, tile scale pop, tiny sparks.
- [ ] Flag place: cloth pop, ring pulse.
- [ ] Flag remove/wrong flag: orange correction pulse.
- [ ] Mine explosion: red/orange radial shockwave, sparks, brief screen shake.
- [ ] Safe reveal chain: small blue wave across opened area.
- [ ] Scroll warning: bottom N rows glow, countdown pulse, danger rail.
- [ ] Combo increase: center `COMBO xN` scale pop, side rails, colored particles.
- [ ] High combo tiers: `x10`, `x20`, `x50`, `x99` with stronger color and impact.
- [ ] Score pop: `+10/+120` floating text near combo/score.
- [ ] Life loss: red vignette flash, heart shake/drop.
- [ ] Heal: heart refill pulse, green/blue sweep.
- [ ] Level up/depth increase: upward arrow burst.
- [ ] Game over: red scanline/screen dim, retry panel slam-in.

Frame sprites are only needed if procedural Canvas cannot give enough impact:

- [x] Mine explosion sprite sheet, 8-12 frames.
- [x] High-combo burst sprite sheet, 8-12 frames.
- [x] Level-up lightning sprite sheet, 6-8 frames.
- [x] Heart refill sprite sheet, 6-8 frames.

## Implementation Plan

- [x] Build a dev-only UI Lab page at `?ui=lab`.
- [x] Show the target reference image inside the UI Lab.
- [x] Add live Canvas previews for tile, click, flag, explosion, combo, scroll warning, life/heal, game-over modal.
- [x] Use UI Lab as the approval surface before changing the main game UI.
- [x] Keep static generated reference images in `docs/design-assets/reference`.
- [x] Keep runtime preview/static assets in `public/assets`.
- [x] Prefer Canvas vector/procedural rendering for production UI unless a sprite sheet is clearly better.
