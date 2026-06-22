# Endless UX Implementation TODO

Goal: fix the current endless-mode visual hierarchy and scaling issues without changing game rules or AI logic.

This TODO consolidates:

- `docs/ENDLESS-HUD-FEEDBACK-UX-PLAN.md`
- `docs/ENDLESS-RESPONSIVE-UX-AUDIT.md`

## Design Principles

1. One game stage, one scale.
   - Board, HUD, buttons, warnings, and feedback effects should all derive from the same `stageScale`.
   - Avoid separate viewport formulas for each UI element.

2. The board is the primary object.
   - Feedback can be energetic, but must not hide the player's next decision.
   - Empty revealed cells must look settled and non-clickable.

3. Space is a contextual action hint, not a permanent bottom button.
   - Show it only during onboarding or when the action is currently useful.
   - Auto is dev-only and should read as a small helper tag.

4. Persistent state and transient feedback are separate.
   - Score/lives/combo are persistent HUD.
   - Current combo is persistent state and should stay visible as the top-center achievement HUD.
   - Combo gain/score pop/break are short-lived feedback.
   - Combo should not occupy permanent top HUD space as a large chip.
   - Scroll pressure should live near the bottom danger area, not as a numeric top countdown.

5. Desktop should feel like a centered game stage.
   - HUD should not stick to physical screen corners on wide displays.
   - Extra width is reserved for future side panels, battle, or spectator information.

## Target Layout Model

### Reference Stage

- Reference size: `390x844`
- Primary orientation: portrait
- All gameplay UI is placed relative to this stage.

### Stage Scale

```ts
const scale = clamp(
  0.78,
  1.18,
  Math.min(viewportW / 390, viewportH / 844),
);
```

### Stage Rect

```ts
const stageW = 390 * scale;
const stageH = 844 * scale;
const stageX = (viewportW - stageW) / 2;
const stageY = (viewportH - stageH) / 2;
```

### Stage Anchors

Use these anchors instead of viewport corners:

- `topLeft`: score
- `topCenter`: combo
- `topRight`: lives
- `center`: board
- `bottomCenter`: contextual Space hint
- `bottomRight`: dev Auto tag
- `boardTop`: combo/score feedback
- `boardBottom`: danger coverage and pressure boundary

## P0: Unified Stage Scaling

Purpose: solve the biggest structural issue first, so later visual tuning does not fight layout math.

- [x] Create `src/ui/game-stage-layout.ts`.
- [x] Add `GameStageLayout` type:
  - [x] `stageX`
  - [x] `stageY`
  - [x] `stageW`
  - [x] `stageH`
  - [x] `scale`
  - [x] `safe`
  - [x] `hudY`
  - [x] `boardX`
  - [x] `boardY`
  - [x] `spaceRect`
  - [x] `autoRect`
  - [x] `scoreAnchor`
  - [x] `livesAnchor`
  - [x] `countdownAnchor`
- [x] Add `computeGameStageLayout(viewportW, viewportH, boardW, boardH)`.
- [x] Replace fullscreen HUD positioning in `src/ui/game-canvas.ts` with stage-relative coordinates.
- [x] Stop anchoring score/lives/Auto to physical viewport corners.
- [x] Make board offset stage-relative:
  - [x] Board remains centered in the stage.
  - [x] Board does not drift when viewport is ultra-wide.
- [x] Make Space position stage-relative.
- [x] Make Auto position stage-relative.
- [ ] Make Auto visually small. This remains in P2 so the hitbox and dev-only visual can change together.

Implementation note:

- P0 landed with a shared stage layout module and viewport screenshots at `360x640`, `390x844`, `768x1024`, `1280x900`, and `1920x1080`.

Acceptance:

- [x] On `1920x1080`, score/lives are near the centered stage, not screen corners.
- [x] On `360x640`, board/Space/Auto do not overlap.
- [x] On `390x844`, layout remains visually close to current target.

## P1: HUD Hierarchy Cleanup

Purpose: make top HUD read as one system and reduce visual competition.

Note: P1 describes the completed intermediate HUD pass. P7 supersedes its top countdown and permanent Space decisions.

- [x] Replace persistent top combo chip with compact score-side combo multiplier.
- [x] Keep score as text-only HUD.
- [x] Keep current combo visible as a compact score-side multiplier:
  - [x] Suggested text: `x7`.
  - [x] Place beside or under score, not as a separate large top chip.
  - [x] Low combo uses muted blue/white.
  - [x] Higher combo uses tiered color so the player feels progression.
- [x] Keep lives as heart-only HUD.
- [x] Replace rectangular countdown chip with compact instrument badge:
  - [x] Mobile width around `64-76px * scale`.
  - [x] Desktop width around `84-96px * scale`.
  - [x] Main value: `↑03`.
  - [x] Batch marker: `x2`, `x3`, `x5`.
  - [x] Normal color: amber.
  - [x] Urgent color: red/orange pulse.
- [x] Keep countdown stronger than score/lives, but weaker than modal/start/game-over panels.
- [x] Remove long `SCROLL` label on mobile if it crowds lives.

Acceptance:

- [x] Score, countdown, and lives fit in one coherent row on `390x844`.
- [x] Current combo remains visible without becoming a full HUD button.
- [x] Countdown and lives do not collide on `360x640`.
- [x] No large top combo chip appears when combo is active.

## P2: Dev Auto De-emphasis

Purpose: keep Auto useful for development without becoming part of player UX.

- [x] Replace arcade Auto panel with tiny dev tag.
- [x] Suggested text: `AI`.
- [x] Active state:
  - [x] green border or dot
  - [x] optional `ON` micro text
- [x] Inactive state:
  - [x] muted amber/gray
  - [x] optional `OFF` micro text
- [x] Suggested size:
  - [x] mobile: `44x28 * scale`
  - [x] desktop: `56x32 * scale`
- [x] Update hitbox to match the new visual rect.
- [x] Keep it dev-only.

Acceptance:

- [x] Auto no longer competes with Space.
- [x] Auto remains clickable in dev.
- [x] Auto does not appear in production.

## P3: Combo, Score, and Break Feedback

Purpose: keep the "爽感" while preventing feedback from becoming a modal over the board.

### Combo

- [x] Keep a persistent lightweight current-combo readout in the HUD.
- [x] Use the burst as a gain/change celebration, not the only source of combo information.
- [x] Replace center combo badge with text-only burst.
- [x] Remove filled rounded rectangle behind combo.
- [x] Use sprite burst/particles at lower opacity.
- [x] Position around `boardTop`, not center of board.
- [x] Duration: `600-760ms`.
- [x] Scale all fonts/effect bounds with `stageScale`.
- [x] Combo burst tiers:
  - [x] `x2-x4`: blue/white, small pop.
  - [x] `x5-x9`: green/cyan, stronger glow.
  - [x] `x10-x19`: gold, larger pop.
  - [x] `x20+`: orange/violet, stronger impact.
  - [x] `x50+`: fever/max styling, still short and non-blocking.
### Score Pop

- [x] Show short text on mobile:
  - [x] `+90`
  - [x] small `x3`
- [x] Desktop can show muted `DEFUSED +1`.
- [x] Move/fade toward score anchor.
- [x] Remove long `xN DEFUSED +N` text on mobile.
- [x] Scale effect bounds with `stageScale`.

### Break

- [x] Keep red flash but shorten duration if it blocks reading.
- [x] Show `BREAK xN` near board top or center-top.
- [x] Avoid long text on mobile.
- [x] Keep break visually stronger than score pop, weaker than Game Over.

Acceptance:

- [x] Combo does not cover more than one board row for more than a brief moment.
- [x] Player can always see the current combo count even when no burst is active.
- [x] Score pop is readable but does not obscure the next move.
- [x] Break communicates combo reset immediately.

## P4: Board State Contrast

Purpose: make empty revealed cells clearly non-clickable.

Current issue:

- Hidden cells and revealed-empty cells are both dark and rounded.
- Empty revealed cells can look clickable, especially at `18-23px`.

TODO:

- [x] Adjust `THEME.cellRevealed` and/or draw logic.
- [x] Make revealed empty cells flatter/recessed.
- [x] Keep hidden cells raised/pressable.
- [x] Remove or reduce bevel from revealed empty cells.
- [x] Add subtle inset shadow or matte floor treatment for revealed empty cells.
- [x] Keep numbered cells readable.
- [x] Check contrast on small cells:
  - [x] `360x640`
  - [x] `390x844`
- [x] Update UI Lab tile preview to show:
  - [x] hidden
  - [x] revealed empty
  - [x] revealed number
  - [x] flagged
  - [x] mine

Acceptance:

- [x] Empty revealed cells read as "already opened".
- [x] Hidden cells read as "clickable".
- [x] This distinction is visible on mobile screenshots without zooming.

## P5: Responsive Matrix Test Page

Purpose: make future visual regressions visible before gameplay testing.

Option A:

- Add `?ui=responsive` route.

Option B:

- Add a `Responsive Matrix` section inside `?ui=lab`.

Recommended: Option A if it keeps UI Lab lighter.

TODO:

- [x] Create canned visual states:
  - [x] idle/start
  - [x] playing normal
  - [x] playing countdown urgent
  - [x] batch scroll `x3`
  - [x] combo event
  - [x] score event
  - [x] break event
  - [x] game over
- [x] Render each state at:
  - [x] `360x640`
  - [x] `390x844`
  - [x] `768x1024`
  - [x] `1280x900`
  - [x] `1920x1080`
- [x] Reuse runtime stage layout.
- [x] Show overlay guides:
  - [x] stage rect
  - [x] board rect
  - [x] Space rect
  - [x] HUD anchors
- [x] Add manual review checklist below the matrix.

Acceptance:

- [x] A single page can reveal overlap, scaling, and position issues.
- [x] Screenshots are no longer the only way to catch responsive problems.

## P6: Validation And Regression Checks

Commands:

- [x] `npm run build`
- [x] `npm test`

Playwright screenshots:

- [ ] `360x640` playing normal
- [ ] `360x640` urgent pressure
- [ ] `390x844` playing normal
- [ ] `390x844` score/combo event
- [ ] `768x1024` playing normal
- [ ] `1280x900` playing normal
- [ ] `1920x1080` playing normal

Visual review checklist:

- [x] No UI element is pinned to physical screen corners unless intentionally outside the stage.
- [x] Space is the strongest bottom control.
- [x] Auto is small and dev-only.
- [x] Intermediate countdown is readable and compact.
- [x] No persistent large combo chip.
- [x] Combo/score/break do not block puzzle reading.
- [x] Revealed empty cells do not look clickable.
- [x] Danger rows are obvious for `x1`, `x2`, `x3`, and `x5`.

## P7: Bottom Pressure And Contextual Space

Purpose: remove utility-style timer/buttons and make scroll pressure feel spatial, while giving combo the emotional center.

### Top HUD

- [x] Remove top numeric countdown display.
- [x] Move current combo to top center.
- [x] Make combo more prominent than score/lives:
  - [x] `x1` or low combo: subtle blue/white.
  - [x] `x5+`: glow begins.
  - [x] `x10+`: gold/high-energy.
  - [x] `x20+`: orange/violet impact tier.
  - [x] `x50+`: fever/max treatment without covering the board.
- [x] Keep score top-left.
- [x] Keep lives top-right.
- [x] Ensure combo, score, and lives do not collide on `360x640`.

### Bottom Pressure

- [x] Remove exact seconds from scroll pressure UI.
- [x] Remove row-count/batch text from player-facing scroll pressure UI.
- [x] Keep danger coverage over the rows that will disappear.
- [x] Add pressure boundary line at the top edge of the covered rows.
- [x] Move the board closer to the bottom now that permanent bottom controls are gone.
- [x] Replace the full board frame with a vertical track treatment:
  - [x] no strong top border
  - [x] no strong bottom border
  - [x] subtle side rails
- [x] Pressure boundary states:
  - [x] safe: low blue/cyan energy.
  - [x] warning: amber/orange.
  - [x] urgent: red pulse/glow.
- [x] Pressure can shrink, brighten, pulse, or scan as time runs out.
- [x] Danger overlay intensity increases as the scroll approaches.
- [x] Do not obscure numbers/flags in the danger rows.

### Space Hint

- [x] Remove permanent large Space button.
- [x] Do not show disabled Space.
- [ ] Add first-time onboarding hint:
  - [ ] Show `SPACE` or `PRESS SPACE` briefly.
  - [ ] Fade out automatically.
- [x] Add actionable hint:
  - [x] Show only when Space can actually clear/advance resolved bottom rows.
  - [x] Position near the board bottom or pressure boundary.
  - [x] Use a tiny flashing pressure-line prompt, not a button or keycap panel.
- [x] High-pressure actionable state:
  - [x] Hint becomes brighter or gold-tinted.
  - [x] No extra explanatory sentence.

### Responsive Matrix

- [x] Add states for:
  - [x] pressure safe
  - [x] pressure warning
  - [x] pressure urgent
  - [x] Space available
  - [x] Space unavailable
  - [ ] onboarding hint
- [x] Remove countdown-number examples from matrix states.
- [x] Add visual checks for combo-centered HUD.

### Asset Decision

- [x] Prefer Canvas-drawn implementation first:
  - [x] pressure line
  - [x] scan pulse
  - [x] keycap Space hint
  - [x] combo top-center text/glow
- [x] Reuse existing assets:
  - [x] `combo-burst` FX
  - [x] `warning-badge` if a small warning accent is needed
  - [x] existing danger/mines/flags/hearts
- [x] Do not generate new bitmap assets for this pass unless Canvas-drawn pressure feels too flat in screenshot review.
- [ ] Potential future asset only if needed:
  - [ ] a thin electric pressure-line strip
  - [ ] a small keyboard keycap sprite
  - [ ] combo tier background accents
  - [ ] urgent red scanline burst

Acceptance:

- [x] No top numeric countdown remains.
- [x] Player can feel scroll urgency from the bottom pressure/danger area.
- [x] Player can see the current combo at a glance.
- [x] Space does not occupy permanent bottom UI.
- [x] Space hint appears only when useful or during onboarding.
- [x] The board remains the largest and clearest object.

## Suggested Build Order

1. P0 unified stage layout.
2. P1 HUD cleanup.
3. P2 Auto shrink.
4. P3 feedback tuning.
5. P4 board contrast.
6. P5 responsive matrix.
7. P6 validation pass.
8. P7 ambient life (see `docs/ENDLESS-AMBIENT-LIFE-PLAN.md`).

Reason:

- P0 prevents repeated retuning.
- P1/P2 fix the most visible UI hierarchy problems.
- P3 improves moment-to-moment game feel.
- P4 improves puzzle readability.
- P5 makes the review process sustainable.
- P7 adds continuous breathing on board/HUD elements without changing rules.
