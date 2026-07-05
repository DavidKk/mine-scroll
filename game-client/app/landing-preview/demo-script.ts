/**
 * Landing attract DEMO — see docs/LANDING-DEMO-SPEC.md
 *
 * Single session per cycle: opening → heal → difficulty → death → leaderboard → restart.
 */
export {
  DEMO_BATCH_STEP,
  DEMO_LEADERBOARD_MS,
  DEMO_LOST_HOLD_MS,
  DEMO_PACE,
  DEMO_SCRIPT_SEED,
  DEMO_SPEED_STEP,
  DEMO_START_STEP,
  type DemoPhase,
  type DemoScriptCallbacks,
  type DemoScriptContext,
  type DemoScriptController,
  type DemoTimelineStage,
  elapsedForScrollStep,
  REQUIRED_DEMO_TIMELINE_STAGES,
  setDemoElapsed,
} from './demo-script/config.ts'
export { createScriptedOpeningSession } from './demo-script/session.ts'
export { createDemoScript } from './demo-script/timeline.ts'
