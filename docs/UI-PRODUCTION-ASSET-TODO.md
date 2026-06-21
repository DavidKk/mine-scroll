# UI Production Asset TODO

Goal: turn the approved endless arcade visual direction into assets that can actually be sliced, validated, and used by the game.

## Source References

- Main visual target: `docs/design-assets/reference/endless-arcade-visual-target-v1.png`
- Static-state concept: `docs/design-assets/generated/endless-static-states-v1.png`
- FX concept: `docs/design-assets/generated/endless-fx-sprite-concept-v1.png`
- HUD/popup concept: `docs/design-assets/generated/endless-hud-popups-v1.png`

## Generated Production Sheets

- Core cutouts: `docs/design-assets/production/core-cutouts-production-v1.png`
- FX additive sprites: `docs/design-assets/production/fx-additive-sprites-production-v1.png`
- UI panels and controls: `docs/design-assets/production/ui-panels-production-v1.png`

Runtime copies:

- `public/assets/production/core-cutouts-production-v1.png`
- `public/assets/production/fx-additive-sprites-production-v1.png`
- `public/assets/production/ui-panels-production-v1.png`

Sliced runtime assets:

- Manifest: `public/assets/game/manifest.json`
- Cutouts: `public/assets/game/cutouts/*.png`
- FX frames: `public/assets/game/fx/<effect-name>/frame-XX.png`
- Cutout preview: `public/assets/game/preview-cutouts.png`
- FX preview: `public/assets/game/preview-fx.png`

Sliced designer copies:

- Manifest: `docs/design-assets/sliced/manifest.json`
- Cutouts: `docs/design-assets/sliced/cutouts/*.png`
- FX frames: `docs/design-assets/sliced/fx/<effect-name>/frame-XX.png`
- Previews: `docs/design-assets/sliced/preview-cutouts.png`, `docs/design-assets/sliced/preview-fx.png`

## Production Sheet Targets

- [x] Core cutout sheet: mines, flags, hearts, warning/status badges, no labels, chroma-key background.
- [x] FX additive sprite sheet: explosion, combo burst, safe reveal, level up, heart refill, score pop, black additive background.
- [x] UI panel/control sheet: Space, Auto, Retry, Start, Game Over, log panel, countdown rings, no decorative showcase text.

## Sheet Notes

- Core cutouts are visually usable, but the source is `1254x1254`, not cleanly divisible by the intended `4x4` grid. Normalize/crop before slicing.
- FX additive sprites are `1536x1024`, cleanly divisible into `8x8` frames: `192x128` per frame.
- UI panels are reference/crop candidates. Most final panels should still be drawn in Canvas for responsive scaling.

## Acceptance Criteria

Core cutouts:

- [x] No labels or sample board text inside cuttable cells.
- [x] One element per grid cell.
- [ ] Consistent padding around each element.
- [x] Flat removable chroma-key background.
- [ ] No cast shadows touching the key background.
- [ ] Normalize to an integer grid before slicing.

FX sprites:

- [x] Equal-size frame cells.
- [x] Every animation row uses a fixed frame count.
- [x] Black background suitable for additive/lighten blending.
- [x] No labels inside frames.
- [x] Effects stay centered across frames.

UI panels:

- [x] Components are separated clearly enough to crop.
- [x] Text is limited to actual runtime labels: `SPACE`, `AUTO`, `START`, `RETRY`, `GAME OVER`, `LOG`.
- [ ] Panel sizes are consistent by component family.
- [x] Works as visual reference even if final panels are drawn in Canvas.

## Slice Plan

- [x] Create `scripts/slice-production-assets.py`.
- [x] Slice cutouts to `public/assets/game/cutouts/`.
- [x] Slice FX rows to `public/assets/game/fx/<effect-name>/frame-XX.png`.
- [ ] Slice panel references to `public/assets/game/ui/`.
- [x] Generate an asset manifest JSON.
- [x] Add UI Lab section for sliced assets.
- [x] Validate every output exists and has expected dimensions.

## Integration Plan

- [ ] Keep tiles, numbers, AI hints, HUD panels, and scroll overlays as Canvas-first.
- [x] Add runtime asset loader for `public/assets/game/manifest.json`.
- [x] Use cutouts for high-detail mines, flags, and hearts when available.
- [x] Use FX sprites for safe reveal, flag pop, mine explosion, and combo burst overlays.
- [x] Add runtime fallback to procedural Canvas if a sprite is missing.
- [ ] Evaluate whether status icons should replace current Canvas/HUD labels.
- [ ] Evaluate whether FX sprites should replace or only augment procedural Canvas effects.
- [ ] Keep tiles, numbers, AI hints, HUD panels, and scroll overlays as Canvas-first.
