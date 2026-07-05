import { isBatchScrollSafe, resolveScrollBatchRowsForSession } from '@shared/core/modes/endless/index.ts'
import { revealAt, toggleMarkAt } from '@shared/core/modes/engine.ts'

import {
  buildFatalGuessPlan,
  countUnflaggedVisibleMines,
  findDemoSwipeFlagTarget,
  findTopVisibleMine,
  findVisibleMine,
  findVisibleSafeCell,
  isEndgameScrollSafe,
  prepareHealScrollBoard,
  TOP_HEADROOM_ROWS,
} from './board.ts'
import {
  DEMO_BATCH_STEP,
  DEMO_LEADERBOARD_MS,
  DEMO_LOST_HOLD_MS,
  DEMO_PACE,
  DEMO_SPEED_STEP,
  DEMO_START_STEP,
  type DemoPhase,
  type DemoScriptCallbacks,
  type DemoScriptContext,
  type DemoScriptController,
  type DemoTimelineStage,
} from './config.ts'

function sessionStatus(ctx: DemoScriptContext) {
  return ctx.runtime.session.state.status
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function humanPause([min, max]: readonly [number, number]): Promise<void> {
  const span = max - min
  return sleep(min + Math.floor(Math.random() * (span + 1)))
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
      if (sessionStatus(ctx) === 'lost') {
        markStage('fatal-guess')
        return
      }
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
