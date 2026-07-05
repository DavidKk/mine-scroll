/**
 * Landing attract DEMO — see docs/LANDING-DEMO-SPEC.md
 *
 * Single session per cycle: opening → heal → difficulty → death → leaderboard → restart.
 */
import type { AiHintDisplay, AiMove } from '@shared/core/ai/types.ts'
import { countBankedMinesOnRow } from '@shared/core/mines-defused.ts'
import {
  endlessBeginRun,
  endlessScreenRowToLocal,
  getEndlessScrollProfileForSession,
  isBatchScrollSafe,
  resolveScrollBatchRowsForSession,
  sessionVisibleRows,
  viewStartForSession,
} from '@shared/core/modes/endless/index.ts'
import { EXPERT_PRESET } from '@shared/core/modes/endless/presets.ts'
import { createSessionWithSeed,MINES_PER_LIFE, revealAt, toggleMarkAt } from '@shared/core/modes/engine.ts'
import type { ModeSession } from '@shared/core/types.ts'

/** Fixed seed — choreographed attract demo. */
export const DEMO_SCRIPT_SEED = 0xdeadc0de

export const DEMO_LOST_HOLD_MS = 2_400
export const DEMO_LEADERBOARD_MS = 4_500

export const DEMO_START_STEP = 2
export const DEMO_SPEED_STEP = 3
export const DEMO_BATCH_STEP = 4

/** ~46s active demo + 6.9s end cards */
const DEMO_PACE = {
  openingPauseMs: 1_000,
  firstFlagHoldMs: 480,
  introPlayMs: 4_500,
  afterLifeLossMs: 1_200,
  burstScrollCount: 3,
  burstScrollGapMs: 420,
  afterBurstScrollMs: 1_200,
  bridgePlayMs: 3_500,
  afterSpeedBoostMs: 2_000,
  pressurePlayMs: 4_800,
  midDifficultyLifeLossGapMs: 600,
  afterBatchBoostMs: 2_000,
  climaxPlayMs: 3_800,
  /** Auto-scroll deferred while death script runs (headroom scrolls + drain + fatal). */
  endgameDeathScrollBudgetMs: 18_000,
  endgameHeadroomScrollCount: 3,
  endgameHeadroomScrollGapMs: 400,
  beforeFatalGuessMs: 420,
  lifeLossHesitationMs: [600, 950] as const,
  endgameRevealHesitationMs: [140, 240] as const,
  afterEndgameRevealMs: 180,
  endgameMineHesitationMs: [180, 280] as const,
  afterEndgameMineMs: 300,
  endgameSafeBurstPattern: [2, 2, 2, 2] as const,
  endgamePrepScrollMax: 3,
  endgamePrepScrollGapMs: 380,
  pollMs: 180,
} as const

const TOP_HEADROOM_ROWS = 4

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function humanPause([min, max]: readonly [number, number]): Promise<void> {
  const span = max - min
  return sleep(min + Math.floor(Math.random() * (span + 1)))
}

export type DemoPhase = 'playing' | 'lost' | 'leaderboard' | 'idle'

/** Ordered stage ids emitted via `onStageEnter` — used by tests and docs. */
export type DemoTimelineStage =
  | 'opening-pause'
  | 'mobile-flag'
  | 'intro-play'
  | 'life-loss'
  | 'heal-burst'
  | 'difficulty-bridge'
  | 'speed-up'
  | 'pressure-play'
  | 'difficulty-life-loss'
  | 'danger-rise'
  | 'climax-play'
  | 'death-drain'
  | 'fatal-guess'
  | 'lost-hold'
  | 'leaderboard'

/** Required stages in order (subsequence). `difficulty-life-loss` is conditional on lives > 2. */
export const REQUIRED_DEMO_TIMELINE_STAGES: readonly DemoTimelineStage[] = [
  'opening-pause',
  'mobile-flag',
  'intro-play',
  'life-loss',
  'heal-burst',
  'difficulty-bridge',
  'speed-up',
  'pressure-play',
  'danger-rise',
  'climax-play',
  'death-drain',
  'fatal-guess',
  'lost-hold',
  'leaderboard',
] as const

export interface DemoScriptCallbacks {
  onPhaseChange(phase: DemoPhase): void
  onRestart(): void
  onStageEnter?(stage: DemoTimelineStage): void
}

export interface DemoScriptController {
  readonly phase: DemoPhase
  start(): void
  stop(): void
}

export function setDemoElapsed(runtime: { scrollGameStartedAt: number }, elapsedMs: number): void {
  runtime.scrollGameStartedAt = Date.now() - Math.max(0, elapsedMs)
}

export function elapsedForScrollStep(step: number): number {
  return step * EXPERT_PRESET.scrollStepMs + 1_000
}

function cheatRevealBottomHalfOpen(session: ModeSession): ModeSession {
  let next = session
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const bottomHalfStart = Math.floor(visibleRows / 2)
  const board = next.state.board

  for (let pass = 0; pass < 16; pass += 1) {
    let changed = false
    for (let screenRow = visibleRows - 1; screenRow >= bottomHalfStart; screenRow -= 1) {
      const localRow = viewStart + screenRow
      if (localRow < 0 || localRow >= board.rows) continue
      for (let col = 0; col < board.cols; col += 1) {
        const cell = board.cells[localRow]![col]!
        if (cell.isMine || cell.revealed || cell.mark === 'flag') continue
        const updated = revealAt(next, localRow, col)
        if (updated !== next) {
          next = updated
          changed = true
        }
      }
    }
    if (!changed) break
  }

  return next
}

function findVisibleMine(session: ModeSession, preferMiddle = false, exclude?: { localRow: number; col: number }): { localRow: number; screenRow: number; col: number } | null {
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const board = session.state.board
  let picks: Array<{ localRow: number; screenRow: number; col: number }> = []

  for (let screenRow = 0; screenRow < visibleRows; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= board.rows) continue
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (cell.isMine && !cell.revealed && cell.mark !== 'flag') {
        if (exclude && exclude.localRow === localRow && exclude.col === col) continue
        picks.push({ localRow, screenRow, col })
      }
    }
  }

  if (picks.length === 0) return null
  if (!preferMiddle) return picks[picks.length - 1]!

  const mid = Math.floor(visibleRows / 2)
  picks.sort((a, b) => Math.abs(a.screenRow - mid) - Math.abs(b.screenRow - mid))
  return picks[0]!
}

function countUnflaggedVisibleMines(session: ModeSession, exclude?: { localRow: number; col: number }): number {
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const board = session.state.board
  let count = 0

  for (let screenRow = 0; screenRow < visibleRows; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= board.rows) continue
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (!cell.isMine || cell.revealed || cell.mark === 'flag') continue
      if (exclude && exclude.localRow === localRow && exclude.col === col) continue
      count += 1
    }
  }

  return count
}

function countRevealedNeighbors(session: ModeSession, localRow: number, col: number): number {
  const board = session.state.board
  let count = 0
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue
      const cell = board.cells[localRow + dr]?.[col + dc]
      if (cell?.revealed) count += 1
    }
  }
  return count
}

function findVisibleSafeCell(session: ModeSession, exclude?: { localRow: number; col: number }): { localRow: number; screenRow: number; col: number } | null {
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const board = session.state.board
  let best: { localRow: number; screenRow: number; col: number; score: number } | null = null

  for (let screenRow = 0; screenRow < visibleRows; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= board.rows) continue
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (cell.isMine || cell.revealed || cell.mark === 'flag') continue
      if (exclude && exclude.localRow === localRow && exclude.col === col) continue

      const neighborRevealed = countRevealedNeighbors(session, localRow, col)
      const score = neighborRevealed * 12 - Math.abs(screenRow - Math.floor(visibleRows / 3))
      if (!best || score > best.score) {
        best = { localRow, screenRow, col, score }
      }
    }
  }

  if (!best) return null
  return { localRow: best.localRow, screenRow: best.screenRow, col: best.col }
}

function findTopVisibleMine(session: ModeSession, maxScreenRow = TOP_HEADROOM_ROWS - 1): { localRow: number; screenRow: number; col: number } | null {
  const viewStart = viewStartForSession(session)
  const board = session.state.board
  for (let screenRow = 0; screenRow <= maxScreenRow; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= board.rows) continue
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (cell.isMine && !cell.revealed && cell.mark !== 'flag') {
        return { localRow, screenRow, col }
      }
    }
  }
  return null
}

function findDemoSwipeFlagTarget(session: ModeSession): { localRow: number; screenRow: number; col: number } | null {
  const viewStart = viewStartForSession(session)
  const visibleRows = sessionVisibleRows(session)
  const upperEnd = Math.floor(visibleRows / 2)
  const cols = session.state.board.cols
  const centerCol = Math.floor(cols / 2)
  const centerRow = Math.floor(upperEnd / 2)
  let best: { localRow: number; screenRow: number; col: number; score: number } | null = null

  for (let screenRow = 0; screenRow < upperEnd; screenRow += 1) {
    const localRow = viewStart + screenRow
    if (localRow < 0 || localRow >= session.state.board.rows) continue
    for (let col = 0; col < cols; col += 1) {
      const cell = session.state.board.cells[localRow]![col]!
      if (!cell.isMine || cell.revealed || cell.mark === 'flag') continue
      const score = Math.abs(screenRow - centerRow) + Math.abs(col - centerCol) * 0.55
      if (!best || score < best.score) best = { localRow, screenRow, col, score }
    }
  }

  if (!best) return null
  return { localRow: best.localRow, screenRow: best.screenRow, col: best.col }
}

function collectBottomMinesToFlag(session: ModeSession, max = MINES_PER_LIFE): Array<{ localRow: number; screenRow: number; col: number }> {
  const batchRows = resolveScrollBatchRowsForSession(session)
  const board = session.state.board
  const viewStart = viewStartForSession(session)
  const picks: Array<{ localRow: number; screenRow: number; col: number }> = []

  for (let offset = 0; offset < batchRows + 1 && picks.length < max; offset += 1) {
    const localRow = board.rows - 1 - offset
    if (localRow < 0) break
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[localRow]![col]!
      if (cell.isMine && cell.mark !== 'flag') {
        picks.push({ localRow, screenRow: localRow - viewStart, col })
        if (picks.length >= max) break
      }
    }
  }

  return picks
}

function prepareHealScrollReveals(session: ModeSession): ModeSession {
  let next = session
  const batchRows = resolveScrollBatchRowsForSession(next)
  const board = next.state.board

  for (let offset = 0; offset < batchRows; offset += 1) {
    const localRow = board.rows - 1 - offset
    if (localRow < 0) break
    for (let col = 0; col < board.cols; col += 1) {
      const cell = next.state.board.cells[localRow]![col]!
      if (!cell.isMine && !cell.revealed && cell.mark !== 'flag') {
        next = revealAt(next, localRow, col)
      }
    }
  }

  return next
}

function applyBottomMineFlags(session: ModeSession, mines: Array<{ localRow: number; col: number }>, flaggedTotal: number): ModeSession {
  let next = session
  for (const mine of mines) {
    next = toggleMarkAt(next, mine.localRow, mine.col)
  }
  // Script bookkeeping: 4 bottom flags → minesDefused 0 (ready to bank on scroll-off).
  return { ...next, minesDefused: Math.max(0, MINES_PER_LIFE - flaggedTotal), defuseCombo: next.defuseCombo ?? 0 }
}

function scrubWrongFlagsOnLeavingRows(session: ModeSession): ModeSession {
  let next = session
  const batchRows = resolveScrollBatchRowsForSession(next)
  const board = next.state.board

  for (let offset = 0; offset < batchRows + 1; offset += 1) {
    const localRow = board.rows - 1 - offset
    if (localRow < 0) break
    for (let col = 0; col < board.cols; col += 1) {
      const cell = next.state.board.cells[localRow]![col]!
      if (!cell.isMine && cell.mark === 'flag') {
        next = toggleMarkAt(next, localRow, col)
      }
    }
  }

  return next
}

function prepareHealScrollBoard(session: ModeSession): ModeSession {
  let next = scrubWrongFlagsOnLeavingRows(session)
  next = prepareHealScrollReveals(next)
  const mines = collectBottomMinesToFlag(next)
  return applyBottomMineFlags(next, mines, mines.length)
}

/** True when an upward scroll would bank enough flagged mines to trigger heal. */
function isScrollHealRisky(session: ModeSession): boolean {
  const batchRows = resolveScrollBatchRowsForSession(session)
  const board = session.state.board
  let flaggedOnExitRows = 0

  for (let offset = 0; offset < batchRows + 1; offset += 1) {
    const localRow = board.rows - 1 - offset
    if (localRow < 0) break
    flaggedOnExitRows += countBankedMinesOnRow(board, localRow)
  }

  return (session.minesDefused ?? 0) + flaggedOnExitRows >= MINES_PER_LIFE
}

function isEndgameScrollSafe(session: ModeSession): boolean {
  if (session.state.status !== 'playing') return false
  if (isScrollHealRisky(session)) return false
  const batchRows = resolveScrollBatchRowsForSession(session)
  return isBatchScrollSafe(session, batchRows)
}

function buildFatalGuessPlan(session: ModeSession): { move: AiMove; hint: AiHintDisplay; mine: { localRow: number; screenRow: number; col: number } } | null {
  const mine = findTopVisibleMine(session, TOP_HEADROOM_ROWS - 1) ?? findVisibleMine(session)
  if (!mine) return null

  const move: AiMove = {
    kind: 'reveal',
    row: mine.localRow,
    col: mine.col,
    confidence: 'guess',
    reason: 'Demo oracle · top-row trap read as safe',
  }
  const hint: AiHintDisplay = {
    row: mine.screenRow,
    col: mine.col,
    kind: 'reveal',
    confidence: 'guess',
  }
  return { move, hint, mine }
}

export function createScriptedOpeningSession(base: ModeSession): ModeSession {
  let session = endlessBeginRun(base)
  const visibleRows = sessionVisibleRows(session)
  const seedScreenRow = Math.max(Math.floor(visibleRows / 2), visibleRows - 3)
  const seedCol = 4
  session = revealAt(session, endlessScreenRowToLocal(session, seedScreenRow), seedCol)
  session = cheatRevealBottomHalfOpen(session)
  return {
    ...session,
    score: 1_420,
    scrollRowCount: 9,
    minesDefused: 1,
    defuseCombo: 2,
    lives: 5,
  }
}

export function createDemoScriptOpeningSession(): ModeSession {
  return createScriptedOpeningSession(createSessionWithSeed(DEMO_SCRIPT_SEED, 'expert'))
}

export function profileForDemoStep(session: ModeSession, step: number) {
  return getEndlessScrollProfileForSession(session, elapsedForScrollStep(step))
}

export interface DemoScriptContext {
  runtime: {
    session: ModeSession
    scrollGameStartedAt: number
    aiHint: AiHintDisplay | null
  }
  applySession(next: ModeSession, beforeLives?: number, context?: { trigger?: string }): void
  render(): void
  syncDifficultyStep(step: number): void
  resyncScrollTimer(): void
  startScrollAndAi(): void
  startAiOnly(): void
  stopScrollAndAi(): void
  stopAiOnly(): void
  postponeNextScroll(delayMs: number): void
  setDemoEndgameFastAi(fast: boolean): void
  performScrollTick(reason: string): void
  setDemoAiMove(move: AiMove | null): void
  playMobileFlagSwipe(screenRow: number, col: number, onSwipeCommit?: () => void): Promise<void>
  cancelFlagSwipePreview?(): void
}

export function createDemoScript(callbacks: DemoScriptCallbacks, ctx: DemoScriptContext): DemoScriptController {
  let phase: DemoPhase = 'idle'
  let stopped = false
  let runId = 0

  function markStage(stage: DemoTimelineStage): void {
    callbacks.onStageEnter?.(stage)
  }

  function setPhase(next: DemoPhase): void {
    phase = next
    callbacks.onPhaseChange(next)
  }

  async function waitMs(ms: number, runToken: number, opts?: { holdWhileLost?: boolean }): Promise<boolean> {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (stopped || runToken !== runId) return false
      if (!opts?.holdWhileLost && ctx.runtime.session.state.status === 'lost') return true
      await sleep(DEMO_PACE.pollMs)
    }
    return !stopped && runToken === runId
  }

  async function demoLifeLoss(
    runToken: number,
    opts?: {
      reserve?: { localRow: number; col: number }
      hesitationMs?: readonly [number, number]
      afterMs?: number
    }
  ): Promise<boolean> {
    if (ctx.runtime.session.state.status !== 'playing') return false
    if ((ctx.runtime.session.lives ?? 0) <= 1) return false

    const mine = findVisibleMine(ctx.runtime.session, true, opts?.reserve)
    if (!mine) return false

    ctx.runtime.aiHint = { row: mine.screenRow, col: mine.col, kind: 'reveal', confidence: 'guess' }
    ctx.render()
    await humanPause(opts?.hesitationMs ?? DEMO_PACE.lifeLossHesitationMs)
    if (stopped || runToken !== runId) return false
    ctx.runtime.aiHint = null

    const beforeLives = ctx.runtime.session.lives
    ctx.applySession(revealAt(ctx.runtime.session, mine.localRow, mine.col), beforeLives, {
      trigger: 'Demo life loss',
    })
    ctx.render()

    const afterMs = opts?.afterMs
    if (afterMs && afterMs > 0) {
      await waitMs(afterMs, runToken)
    }
    return !stopped && runToken === runId
  }

  /** Scroll up before drain — only when scroll would not bank a heal or cost lives. */
  async function scrollUpEndgameHeadroom(runToken: number): Promise<void> {
    if (!isEndgameScrollSafe(ctx.runtime.session)) return

    for (let i = 0; i < DEMO_PACE.endgameHeadroomScrollCount; i += 1) {
      if (ctx.runtime.session.state.status !== 'playing') return
      if (!isEndgameScrollSafe(ctx.runtime.session)) return
      ctx.performScrollTick(`Demo endgame headroom scroll ${i + 1}`)
      ctx.render()
      await waitMs(DEMO_PACE.endgameHeadroomScrollGapMs, runToken)
      if (stopped || runToken !== runId) return
    }
  }
  /** Scroll up to expose fresh unflagged mines if headroom scrolls were not enough. */
  async function ensureEndgameDrainHeadroom(runToken: number, reserve?: { localRow: number; col: number }): Promise<void> {
    const needed = Math.max(0, (ctx.runtime.session.lives ?? 0) - 1)
    if (needed === 0 || !isEndgameScrollSafe(ctx.runtime.session)) return

    let scrolls = 0
    while (
      countUnflaggedVisibleMines(ctx.runtime.session, reserve) < needed &&
      scrolls < DEMO_PACE.endgamePrepScrollMax &&
      ctx.runtime.session.state.status === 'playing' &&
      isEndgameScrollSafe(ctx.runtime.session)
    ) {
      ctx.performScrollTick(`Demo endgame prep scroll ${scrolls + 1}`)
      ctx.render()
      scrolls += 1
      await waitMs(DEMO_PACE.endgamePrepScrollGapMs, runToken)
      if (stopped || runToken !== runId) return
    }
  }

  async function demoScriptedSafeReveal(runToken: number, reserve?: { localRow: number; col: number }): Promise<boolean> {
    if (ctx.runtime.session.state.status !== 'playing') return false

    const cell = findVisibleSafeCell(ctx.runtime.session, reserve)
    if (!cell) return false

    ctx.runtime.aiHint = { row: cell.screenRow, col: cell.col, kind: 'reveal', confidence: 'certain' }
    ctx.render()
    await humanPause(DEMO_PACE.endgameRevealHesitationMs)
    if (stopped || runToken !== runId) return false
    ctx.runtime.aiHint = null

    ctx.applySession(revealAt(ctx.runtime.session, cell.localRow, cell.col), ctx.runtime.session.lives, {
      trigger: 'Demo endgame safe reveal',
    })
    ctx.render()
    await waitMs(DEMO_PACE.afterEndgameRevealMs, runToken)
    return !stopped && runToken === runId
  }

  /** Safe opens mixed with mine hits; scroll timer stays armed but deferred until budget elapses. */
  async function demoEndgamePressure(runToken: number, reserve?: { localRow: number; col: number }): Promise<void> {
    let burstIndex = 0
    let stallRounds = 0

    while ((ctx.runtime.session.lives ?? 0) > 1 && ctx.runtime.session.state.status === 'playing') {
      const livesBeforeRound = ctx.runtime.session.lives ?? 0
      const safeCount = DEMO_PACE.endgameSafeBurstPattern[burstIndex] ?? 2
      burstIndex += 1
      let safeOpened = 0

      for (let i = 0; i < safeCount; i += 1) {
        if (ctx.runtime.session.state.status !== 'playing') return
        if ((ctx.runtime.session.lives ?? 0) <= 1) return
        const revealed = await demoScriptedSafeReveal(runToken, reserve)
        if (!revealed) break
        safeOpened += 1
        if (stopped || runToken !== runId) return
      }

      if ((ctx.runtime.session.lives ?? 0) <= 1) return

      const lostLife = await demoLifeLoss(runToken, {
        reserve,
        hesitationMs: DEMO_PACE.endgameMineHesitationMs,
        afterMs: DEMO_PACE.afterEndgameMineMs,
      })
      if (stopped || runToken !== runId) return

      const livesAfterRound = ctx.runtime.session.lives ?? 0
      const progressed = safeOpened > 0 || lostLife || livesAfterRound < livesBeforeRound
      if (!progressed) {
        stallRounds += 1
        if (stallRounds === 1 && isEndgameScrollSafe(ctx.runtime.session)) {
          ctx.performScrollTick('Demo endgame refresh scroll')
          ctx.render()
          await waitMs(DEMO_PACE.endgamePrepScrollGapMs, runToken)
          if (stopped || runToken !== runId) return
          continue
        }
        if (stallRounds >= 2) break
        await sleep(DEMO_PACE.pollMs)
        continue
      }
      stallRounds = 0
    }

    ctx.runtime.aiHint = null
    ctx.render()
  }

  async function demoMobileFirstFlag(runToken: number): Promise<void> {
    if (ctx.runtime.session.state.status !== 'playing') return

    const target = findDemoSwipeFlagTarget(ctx.runtime.session)
    if (!target) return

    ctx.stopScrollAndAi()
    await ctx.playMobileFlagSwipe(target.screenRow, target.col, () => {
      ctx.applySession(toggleMarkAt(ctx.runtime.session, target.localRow, target.col), ctx.runtime.session.lives, {
        trigger: 'Demo mobile swipe flag',
      })
      ctx.render()
    })
    if (stopped || runToken !== runId) return
    if (!(await waitMs(DEMO_PACE.firstFlagHoldMs, runToken))) return
  }

  async function burstScrollAfterDamage(runToken: number): Promise<void> {
    if (ctx.runtime.session.state.status !== 'playing') return

    const livesBefore = ctx.runtime.session.lives ?? 0
    const prepared = prepareHealScrollBoard(ctx.runtime.session)
    ctx.applySession(prepared, prepared.lives, { trigger: 'Demo burst scroll prep' })
    ctx.render()
    await humanPause([400, 650])
    if (stopped || runToken !== runId) return

    for (let i = 0; i < DEMO_PACE.burstScrollCount; i += 1) {
      if (ctx.runtime.session.state.status !== 'playing') return
      const batchRows = resolveScrollBatchRowsForSession(ctx.runtime.session)
      if (!isBatchScrollSafe(ctx.runtime.session, batchRows)) break
      ctx.performScrollTick(`Demo AI manual scroll ${i + 1}/${DEMO_PACE.burstScrollCount}`)
      ctx.render()
      if ((ctx.runtime.session.lives ?? 0) > livesBefore) break
      await waitMs(DEMO_PACE.burstScrollGapMs, runToken)
      if (stopped || runToken !== runId) return
    }
  }

  /** Death segment: safe opens + mine hits until 1♥, then fatal guess. */
  async function runDeathDemonstration(runToken: number): Promise<void> {
    if (ctx.runtime.session.state.status !== 'playing') return

    markStage('death-drain')
    ctx.postponeNextScroll(DEMO_PACE.endgameDeathScrollBudgetMs)
    ctx.stopAiOnly()
    ctx.setDemoAiMove(null)
    ctx.runtime.aiHint = null
    ctx.render()

    await scrollUpEndgameHeadroom(runToken)
    if (stopped || runToken !== runId) return

    let plan = buildFatalGuessPlan(ctx.runtime.session)
    if (!plan) {
      const mine = findVisibleMine(ctx.runtime.session)
      if (!mine) return
      plan = {
        mine,
        move: {
          kind: 'reveal',
          row: mine.localRow,
          col: mine.col,
          confidence: 'guess',
          reason: 'Demo oracle · fatal guess fallback',
        },
        hint: { row: mine.screenRow, col: mine.col, kind: 'reveal', confidence: 'guess' },
      }
    }

    await ensureEndgameDrainHeadroom(runToken, plan.mine)
    if (stopped || runToken !== runId) return

    let drainPasses = 0
    while ((ctx.runtime.session.lives ?? 0) > 1 && ctx.runtime.session.state.status === 'playing' && drainPasses < 8) {
      await demoEndgamePressure(runToken, plan.mine)
      drainPasses += 1
      if (stopped || runToken !== runId) return
    }

    if (ctx.runtime.session.state.status === 'lost') {
      markStage('fatal-guess')
      return
    }
    if (ctx.runtime.session.state.status !== 'playing') return
    if ((ctx.runtime.session.lives ?? 0) > 1) return

    ctx.runtime.aiHint = plan.hint
    ctx.render()
    markStage('fatal-guess')
    await waitMs(DEMO_PACE.beforeFatalGuessMs, runToken)
    if (stopped || runToken !== runId) return

    const beforeLives = ctx.runtime.session.lives
    ctx.applySession(revealAt(ctx.runtime.session, plan.move.row, plan.move.col), beforeLives, {
      trigger: 'Demo fatal guess',
    })
    ctx.runtime.aiHint = null
    ctx.render()
  }

  async function ensureDemoDeath(runToken: number): Promise<void> {
    if (ctx.runtime.session.state.status === 'lost') return

    const plan = buildFatalGuessPlan(ctx.runtime.session)
    const mine = plan?.mine ?? findTopVisibleMine(ctx.runtime.session, TOP_HEADROOM_ROWS - 1) ?? findVisibleMine(ctx.runtime.session)
    if (!mine) return

    ctx.stopScrollAndAi()
    ctx.setDemoAiMove(null)

    let drainPasses = 0
    while ((ctx.runtime.session.lives ?? 0) > 1 && ctx.runtime.session.state.status === 'playing' && drainPasses < 8) {
      await demoEndgamePressure(runToken, plan?.mine)
      drainPasses += 1
      if (stopped || runToken !== runId) return
    }
    if (ctx.runtime.session.state.status !== 'playing') return
    if ((ctx.runtime.session.lives ?? 0) > 1) return

    if (plan) {
      ctx.runtime.aiHint = plan.hint
      ctx.render()
    }
    markStage('fatal-guess')
    if (plan) {
      await waitMs(DEMO_PACE.beforeFatalGuessMs, runToken)
      if (stopped || runToken !== runId) return
    }

    const beforeLives = ctx.runtime.session.lives
    ctx.applySession(revealAt(ctx.runtime.session, mine.localRow, mine.col), beforeLives, {
      trigger: 'Demo fatal fallback',
    })
    ctx.runtime.aiHint = null
    ctx.render()
  }

  async function runHealShowcase(runToken: number): Promise<void> {
    ctx.stopScrollAndAi()
    if (ctx.runtime.session.state.status !== 'playing') return

    markStage('life-loss')
    await demoLifeLoss(runToken)
    if (stopped || runToken !== runId) return
    await waitMs(DEMO_PACE.afterLifeLossMs, runToken)
    if (stopped || runToken !== runId) return

    markStage('heal-burst')
    await burstScrollAfterDamage(runToken)
    if (stopped || runToken !== runId) return
    await waitMs(DEMO_PACE.afterBurstScrollMs, runToken)
  }

  async function runDifficultyShowcase(runToken: number): Promise<void> {
    if (ctx.runtime.session.state.status !== 'playing') return

    ctx.startScrollAndAi()

    markStage('difficulty-bridge')
    await waitMs(DEMO_PACE.bridgePlayMs, runToken)
    if (stopped || runToken !== runId) return

    if (ctx.runtime.session.state.status === 'playing') {
      markStage('speed-up')
      ctx.syncDifficultyStep(DEMO_SPEED_STEP)
      ctx.resyncScrollTimer()
      ctx.render()
      await waitMs(DEMO_PACE.afterSpeedBoostMs, runToken)
    }
    if (stopped || runToken !== runId) return

    markStage('pressure-play')
    await waitMs(DEMO_PACE.pressurePlayMs, runToken)
    if (stopped || runToken !== runId) return

    if (ctx.runtime.session.state.status === 'playing' && (ctx.runtime.session.lives ?? 0) > 2) {
      markStage('difficulty-life-loss')
      ctx.stopAiOnly()
      await demoLifeLoss(runToken)
      if (stopped || runToken !== runId) return
      await waitMs(DEMO_PACE.midDifficultyLifeLossGapMs, runToken)
      if (stopped || runToken !== runId) return
      if (ctx.runtime.session.state.status === 'playing') {
        ctx.startScrollAndAi()
      }
    }
    if (stopped || runToken !== runId) return

    if (ctx.runtime.session.state.status === 'playing') {
      markStage('danger-rise')
      ctx.syncDifficultyStep(DEMO_BATCH_STEP)
      ctx.resyncScrollTimer()
      ctx.render()
      await waitMs(DEMO_PACE.afterBatchBoostMs, runToken)
    }
    if (stopped || runToken !== runId) return

    ctx.stopAiOnly()
    markStage('climax-play')
    await waitMs(DEMO_PACE.climaxPlayMs, runToken)
  }

  async function runTimeline(): Promise<void> {
    const id = runId
    setPhase('playing')
    ctx.syncDifficultyStep(DEMO_START_STEP)
    ctx.render()

    await waitMs(DEMO_PACE.openingPauseMs, id)
    if (stopped || id !== runId) return
    markStage('opening-pause')

    await demoMobileFirstFlag(id)
    if (stopped || id !== runId) return
    markStage('mobile-flag')

    ctx.startScrollAndAi()
    await waitMs(DEMO_PACE.introPlayMs, id)
    if (stopped || id !== runId) return
    markStage('intro-play')

    await runHealShowcase(id)
    if (stopped || id !== runId) return

    await runDifficultyShowcase(id)
    if (stopped || id !== runId) return

    if (ctx.runtime.session.state.status === 'playing') {
      await runDeathDemonstration(id)
    }
    if (stopped || id !== runId) return

    await ensureDemoDeath(id)
    if (stopped || id !== runId) return

    if (ctx.runtime.session.state.status !== 'lost') {
      setPhase('idle')
      callbacks.onRestart()
      return
    }

    setPhase('lost')
    ctx.render()
    markStage('lost-hold')
    await waitMs(DEMO_LOST_HOLD_MS, id, { holdWhileLost: true })
    if (stopped || id !== runId) return

    setPhase('leaderboard')
    ctx.render()
    markStage('leaderboard')
    await waitMs(DEMO_LEADERBOARD_MS, id, { holdWhileLost: true })
    if (stopped || id !== runId) return

    setPhase('idle')
    callbacks.onRestart()
  }

  return {
    get phase() {
      return phase
    },
    start() {
      stopped = false
      runId += 1
      void runTimeline()
    },
    stop() {
      stopped = true
      runId += 1
      ctx.stopScrollAndAi()
      ctx.setDemoAiMove(null)
      ctx.cancelFlagSwipePreview?.()
      setPhase('idle')
    },
  }
}
