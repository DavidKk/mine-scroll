# Endless HUD and Feedback UX Plan

Goal: reduce visual conflict in the current endless-mode HUD and feedback layer before changing implementation.

## Current Problems

1. Center combo popup feels wrong.
   - It uses a solid badge-like panel in the middle of the board.
   - It competes with the puzzle area and can feel like a modal instead of a momentary game effect.
   - The visual weight is similar to Start/Game Over, so the hierarchy is confusing.

2. Top combo and scroll countdown do not match score and lives.
   - Score and lives are lightweight floating HUD elements.
   - Combo and scroll are still heavy framed chips, so the top HUD looks like mixed systems.
   - The top numeric countdown pulls attention away from combo and feels more like a utility timer than game pressure.

3. Dev-only Auto is too large.
   - It currently has the same arcade-panel energy as a primary gameplay button.
   - Auto is a development control, not part of the player-facing game UI.
   - On mobile it visually competes with the Space key.

4. Top HUD density is uneven.
   - Score lives on the left, lives on the right, countdown in the middle.
   - Combo appears as another top chip only after scoring, which can shift attention and make the row feel crowded.
   - The row should read as one system: persistent stats first, urgent status second, transient feedback last.

5. Space is too heavy as a persistent control.
   - A large always-visible Space button makes the screen feel like an app UI.
   - Most of the time it is not actionable, so the disabled state becomes visual noise.
   - The game should teach Space early, then only surface it when the player can actually use it.

## Proposed Direction

Use three separate layers:

1. Persistent HUD
   - Score: top-left, text only.
   - Current combo: top-center, promoted to the main achievement HUD.
   - Lives: top-right, heart row only.
   - Depth/scroll count stays absent from the main HUD.
   - No framed boxes for score or lives.

2. Scroll pressure layer
   - Do not show numeric seconds in the top HUD.
   - Do not show batch row text such as `x2`, `x3`, or `x5`.
   - Put pressure at the bottom of the board, because the threat comes from below.
   - Use a pressure boundary line at the top edge of the danger-covered rows.
   - The line shrinks, pulses, or changes intensity as time runs out.
   - Color tiers:
     - safe: blue/cyan
     - warning: amber/orange
     - urgent: red pulse
   - The bottom row coverage itself communicates how much area will disappear.

3. Transient feedback layer
   - Combo should not permanently occupy top HUD space as a large chip.
   - Combo gain should still create strong momentary feedback.
   - Score pop should appear near score or upper-left of board, then travel/fade toward score.
   - Combo pop should be a short kinetic text burst around the board edge or above the board, not a large center badge.
   - Break feedback can briefly appear center-top because it is failure-related, but it should fade quickly.

4. Contextual action hints
   - Space is not a permanent bottom button.
   - Show `SPACE` or `PRESS SPACE` only when the bottom rows are clear and the action is useful.
   - First-time onboarding can briefly show a Space hint, then fade it away.
   - If Space becomes available while pressure is high, the hint can become brighter.
   - Disabled Space should not be shown.

## Concrete Changes

### 1. Promote Combo To The Top-Center Achievement HUD

Current behavior:

- When combo is greater than 0, a `COMBO xN` chip appears beside score.

New behavior:

- Do not render a separate persistent `COMBO xN` chip in the top row.
- Keep current combo visible in the top center:
  - Example: `COMBO x7` or simply `x7` with a small combo label.
  - It replaces the old top-center countdown as the emotional focus.
  - It should be more prominent than score/lives because combo is the achievement loop.
  - It should still be lighter than Start/Game Over panels and never cover the board.
- Combo changes also get transient feedback:
  - `+30`
  - `x3`
  - `DEFUSED +1`
- For high combo, add a thin side rail glow or small board-edge pulse.

Reason:

- Current combo is stable match state, so players must always be able to see it.
- The big chip treatment is the problem, not the combo information itself.
- Moving combo to top-center gives the player a constant achievement target.
- Removing numeric countdown from the same area frees this space for player motivation.

### 2. Replace Center Combo Badge

Current behavior:

- Large center badge with background panel, `Combo`, and `xN`.

New behavior:

- Use text-only burst:
  - `x3`
  - `COMBO`
  - optional `+90`
- The burst is celebration and change feedback, not the only place where combo count appears.
- Position:
  - default: above the board, centered
  - mobile fallback: just below top HUD, never covering top rows
- No filled rectangle behind it.
- Keep sprite burst and particles, but reduce opacity and size.

Tier targets:

- `x2-x4`: blue/white, small pop.
- `x5-x9`: green/cyan, stronger glow.
- `x10-x19`: gold, larger pop.
- `x20+`: orange/violet, stronger impact.
- `x50+`: fever/max styling, still short and non-blocking.

Size targets:

- Desktop: `xN` max 56px high.
- Mobile: `xN` max 42px high.
- Duration: 600-760ms.
- Should never block more than one row of the board visually.

### 3. Move Score Pop Toward Score

Current behavior:

- Score event appears near board/top-left area, with text and effect.

New behavior:

- Score pop starts near upper-left board edge or defused row source.
- It travels 24-40px toward the top-left score.
- Text:
  - primary: `+90`
  - secondary: `x3`
- Remove `DEFUSED +N` from the main score pop on small screens.
- Keep `DEFUSED +N` only in a small muted subline on desktop.

Reason:

- The user can understand that score increased without reading a long arcade label.
- Less visual clutter over the puzzle.

### 4. Replace Countdown Badge With Bottom Pressure

Current behavior:

- Rectangular framed `SCROLL ↑03`.

New behavior:

- No numeric countdown in the top HUD.
- No row count text in the pressure UI.
- Bottom danger coverage remains the source of truth for which area will disappear.
- Add a pressure boundary line at the top edge of the danger coverage:
  - It can shrink horizontally, brighten, or pulse as the scroll approaches.
  - Safe phase: low blue/cyan energy.
  - Warning phase: amber/orange.
  - Urgent phase: red pulse and stronger boundary glow.
- The danger overlay itself can intensify near the end.

Reason:

- The threat is spatial: the bottom of the board is going away.
- Putting pressure at the danger boundary reduces cross-screen interpretation.
- Players do not need exact seconds or row counts; they need to feel that the area is about to disappear.

### 5. Shrink Dev Auto

Current behavior:

- Large arcade Auto panel at bottom-right.

New behavior:

- Dev-only Auto becomes a small pill or corner tag:
  - 48-58px wide on mobile
  - 64px wide on desktop
  - text `AI` or `AUTO`
  - active state: green dot or thin green border
- It should sit behind Space in visual priority.

Reason:

- Auto is not part of the player UX.
- It should be discoverable for development, not visually dominant.

### 6. Replace Permanent Space Button With Contextual Hint

Current behavior:

- Space key uses the strongest bottom UI treatment.

New behavior:

- Remove the permanent large Space button.
- First-time onboarding:
  - briefly show a small keycap hint, such as `SPACE 上移` or `PRESS SPACE`, then fade.
  - do not keep it pinned forever.
- Actionable state:
  - when the bottom row group is fully resolved and Space can clear it, show a small keycap hint near the board bottom.
  - the hint should sit near the pressure boundary/danger area, not in a separate bottom toolbar.
  - use a light pulse so it reads as an opportunity.
- Non-actionable state:
  - show nothing.
- High-pressure actionable state:
  - make the hint brighter or gold-tinted.
  - do not add explanatory text.

Reason:

- This moves the UI closer to arcade/battle game language.
- The player sees the prompt only when it matters.
- The board and combo become the main visual objects again.

## Visual Hierarchy

1. Board
2. Top-center combo
3. Bottom pressure boundary and danger coverage
4. Score and lives
5. Contextual Space hint
6. Transient combo / score pop
7. Dev Auto

This order should hold on both desktop and mobile.

## Implementation Plan

1. Update `src/ui/game-canvas.ts`.
   - Move current combo to top-center and make it the main persistent achievement HUD.
   - Replace center combo badge with text burst.
   - Adjust score event text/position.
   - Remove top numeric countdown badge.
   - Add bottom pressure boundary rendering.
   - Replace permanent Space button with contextual Space hint.
   - Shrink dev-only Auto control and hitbox.

2. Keep `src/ui/renderer.ts` danger-row overlay as-is for now.
   - It already improved bottom-row pressure.
   - Revisit to integrate the pressure boundary line and remove row-count labels.

3. Update UI Lab after runtime behavior looks right.
   - Add preview variants for:
     - bottom pressure boundary
     - text-only combo burst
     - contextual Space hint
     - small dev Auto tag

4. Run validation.
   - `npm run build`
   - `npm test`
   - Playwright screenshots:
     - desktop idle
     - desktop playing with pressure
     - mobile playing with pressure
     - combo event if easy to trigger

## Acceptance Criteria

- Score and lives no longer look boxed.
- No persistent large combo chip appears in the top HUD.
- Current combo remains visible in the top-center HUD even when no burst is active.
- Combo burst no longer looks like a modal or button.
- No numeric countdown appears in the top HUD.
- Bottom pressure communicates urgency without exact seconds.
- Auto is visibly a dev helper, not a main game button.
- Space is shown only as a contextual hint when useful.
- On mobile, combo, score, and lives do not collide.
- Transient feedback does not obscure the player's next move for more than a brief moment.

## Asset Decision

No new bitmap assets are required for the first implementation pass.

Use Canvas first for:

- Bottom pressure boundary line.
- Pressure shrink/pulse/scan animation.
- Contextual `SPACE` keycap hint.
- Top-center combo text, glow, and tier colors.

Reuse existing assets for:

- `combo-burst` frames.
- Existing score/break/mine/flag/heart effects.
- Existing warning accents if a small icon is needed.

Only generate new image assets after screenshot review if the Canvas version feels too flat. Possible future assets:

- Thin electric pressure-line strip.
- Keyboard keycap sprite.
- Combo tier background accents.
- Urgent red scanline burst.

## Non-Goals

- Do not change game rules.
- Do not change AI solver behavior.
- Do not redesign board cells in this pass.
- Do not add sound yet.
- Do not add new generated image assets unless the Canvas version is clearly insufficient.
- Prefer Canvas-drawn pressure bars, boundary lines, and Space keycap hints before generating new bitmap assets.
