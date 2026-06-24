import {
  ENDLESS_SCROLL_DECAY,
  ENDLESS_SCROLL_MS_MIN,
  ENDLESS_SCROLL_MS_START,
  SCROLL_BATCH_TIERS,
  SCROLL_INTERVAL_TIERS_MS,
  SCROLL_STEP_MS,
} from './constants.ts';

export type EndlessScrollStepKind = 'speed' | 'batch';

export interface EndlessScrollProfile {
  intervalMs: number;
  batchRows: number;
  step: number;
  nextStepKind: EndlessScrollStepKind;
  nextStepInMs: number;
  speedTier: number;
  batchTier: number;
}

export function getEndlessScrollProfile(elapsedMs: number): EndlessScrollProfile {
  const elapsed = Math.max(0, elapsedMs);
  const step = Math.floor(elapsed / SCROLL_STEP_MS);
  const speedTier = Math.min(
    SCROLL_INTERVAL_TIERS_MS.length - 1,
    Math.floor((step + 1) / 2),
  );
  const batchTier = Math.min(SCROLL_BATCH_TIERS.length - 1, Math.floor(step / 2));
  const nextStep = step + 1;
  const nextBatchTier = Math.min(
    SCROLL_BATCH_TIERS.length - 1,
    Math.floor(nextStep / 2),
  );
  const nextStepKind: EndlessScrollStepKind =
    nextBatchTier > batchTier ? 'batch' : 'speed';

  return {
    intervalMs: SCROLL_INTERVAL_TIERS_MS[speedTier]!,
    batchRows: SCROLL_BATCH_TIERS[batchTier]!,
    step,
    nextStepKind,
    nextStepInMs: SCROLL_STEP_MS - (elapsed % SCROLL_STEP_MS),
    speedTier,
    batchTier,
  };
}

export function getEndlessScrollIntervalMsFromElapsed(elapsedMs: number): number {
  return getEndlessScrollProfile(elapsedMs).intervalMs;
}

export function formatEndlessScrollHud(profile: EndlessScrollProfile): string {
  const sec = Math.ceil(profile.intervalMs / 1000);
  const batchNote = profile.batchRows > 1 ? `×${profile.batchRows}` : '';
  return `↑${String(sec).padStart(2, '0')}${batchNote}`;
}

export function formatEndlessScrollBadge(profile: EndlessScrollProfile): string {
  const nextSec = Math.ceil(profile.nextStepInMs / 1000);
  if (profile.nextStepKind === 'batch') {
    const nextBatch =
      SCROLL_BATCH_TIERS[Math.min(profile.batchTier + 1, SCROLL_BATCH_TIERS.length - 1)]!;
    return `Next tier ${nextSec}s · batch → ×${nextBatch} rows`;
  }
  const nextInterval =
    SCROLL_INTERVAL_TIERS_MS[
      Math.min(profile.speedTier + 1, SCROLL_INTERVAL_TIERS_MS.length - 1)
    ]!;
  return `Next tier ${nextSec}s · faster → ${(nextInterval / 1000).toFixed(1)}s`;
}

/** @deprecated */
export function getEndlessScrollIntervalMs(scrollRowCount: number): number {
  const depth = Math.max(0, scrollRowCount);
  const raw = ENDLESS_SCROLL_MS_START * ENDLESS_SCROLL_DECAY ** depth;
  return Math.max(ENDLESS_SCROLL_MS_MIN, Math.round(raw));
}

export function getEndlessScrollCountdownSeconds(deadlineAt: number, now = Date.now()): number {
  if (deadlineAt <= 0) return 0;
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

export interface EndlessScrollPressure {
  seconds: number;
  progress: number;
  urgent: boolean;
}

export function getEndlessScrollPressure(
  deadlineAt: number,
  intervalMs: number,
  now = Date.now(),
): EndlessScrollPressure | undefined {
  if (deadlineAt <= 0 || intervalMs <= 0) return undefined;
  const remainingMs = deadlineAt - now;
  if (remainingMs <= 0) return undefined;

  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / intervalMs));

  return {
    seconds,
    progress,
    urgent: remainingMs <= 3000,
  };
}
