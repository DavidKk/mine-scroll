import {
  createDemoScript,
  createDemoScriptOpeningSession,
  DEMO_BATCH_STEP,
  DEMO_LEADERBOARD_MS,
  DEMO_LOST_HOLD_MS,
  DEMO_SCRIPT_SEED,
  DEMO_SPEED_STEP,
  DEMO_START_STEP,
  type DemoPhase,
  type DemoScriptContext,
  type DemoTimelineStage,
  profileForDemoStep,
  REQUIRED_DEMO_TIMELINE_STAGES,
} from '@game-client/app/landing-preview/demo-script.ts'
import type { AiHintDisplay , AiMove } from '@shared/core/ai/types.ts'
import { endlessScrollTick, resolveScrollBatchRowsForSession } from '@shared/core/modes/endless/index.ts'
import type { ModeSession } from '@shared/core/types.ts'

function assertSubsequence(actual: readonly string[], expected: readonly string[]): void {
  let cursor = 0
  for (const stage of actual) {
    if (stage === expected[cursor]) cursor += 1
    if (cursor === expected.length) return
  }
  throw new Error(`Timeline missing stages.\nExpected (in order): ${expected.join(' → ')}\nActual: ${actual.join(' → ')}`)
}

function installWindowTimers(): void {
  ;(globalThis as unknown as { window: typeof globalThis }).window = globalThis
}

function createTestContext(onRestart: () => void) {
  const stages: DemoTimelineStage[] = []
  const phases: DemoPhase[] = []
  const difficultySteps: number[] = []
  const scrollTicks: string[] = []
  const stageSnapshots: Partial<Record<DemoTimelineStage, { status: string; lives: number; hasAiHint: boolean }>> = {}
  let livesAtHealStart = 0

  const runtime: {
    session: ModeSession
    scrollGameStartedAt: number
    aiHint: AiHintDisplay | null
  } = {
    session: createDemoScriptOpeningSession(),
    scrollGameStartedAt: Date.now(),
    aiHint: null,
  }

  const ctx: DemoScriptContext = {
    runtime,
    applySession(next) {
      runtime.session = next
    },
    render() {},
    syncDifficultyStep(step) {
      difficultySteps.push(step)
      const profile = profileForDemoStep(runtime.session, step)
      runtime.scrollGameStartedAt = Date.now() - 10_000 * step
      runtime.session = { ...runtime.session, scrollBatchRows: profile.batchRows }
    },
    resyncScrollTimer() {},
    startScrollAndAi() {},
    startAiOnly() {},
    stopScrollAndAi() {},
    stopAiOnly() {},
    postponeNextScroll() {},
    setDemoEndgameFastAi() {},
    performScrollTick(reason) {
      scrollTicks.push(reason)
      const batchRows = resolveScrollBatchRowsForSession(runtime.session)
      runtime.session = endlessScrollTick(runtime.session, batchRows)
    },
    setDemoAiMove(_move: AiMove | null) {},
    playMobileFlagSwipe: async (_screenRow, _col, onSwipeCommit) => {
      onSwipeCommit?.()
    },
  }

  const demo = createDemoScript(
    {
      onPhaseChange(phase) {
        phases.push(phase)
      },
      onRestart() {
        onRestart()
      },
      onStageEnter(stage) {
        if (stage === 'heal-burst') livesAtHealStart = runtime.session.lives ?? 0
        stageSnapshots[stage] = {
          status: runtime.session.state.status,
          lives: runtime.session.lives ?? 0,
          hasAiHint: runtime.aiHint != null,
        }
        stages.push(stage)
      },
    },
    ctx
  )

  return {
    demo,
    ctx,
    runtime,
    stages,
    phases,
    difficultySteps,
    scrollTicks,
    stageSnapshots,
    getLivesAtHealStart: () => livesAtHealStart,
  }
}

describe('landing-preview/demo-script', () => {
  beforeEach(() => {
    installWindowTimers()
    jest.useFakeTimers({ now: 1_700_000_000_000 })
    jest.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('runs the full attract timeline and ends in lost + leaderboard', async () => {
    let restartCount = 0
    const { demo, runtime, stages, phases, difficultySteps, scrollTicks, stageSnapshots, getLivesAtHealStart } = createTestContext(() => {
      restartCount += 1
    })

    demo.start()

    for (let i = 0; i < 400 && restartCount === 0; i += 1) {
      await jest.advanceTimersByTimeAsync(300)
    }

    expect(restartCount).toBe(1)
    expect(runtime.session.state.status).toBe('lost')
    expect(runtime.session.lives ?? 0).toBeLessThanOrEqual(1)
    expect(phases).toEqual(expect.arrayContaining(['playing', 'lost', 'leaderboard', 'idle']))
    assertSubsequence(stages, REQUIRED_DEMO_TIMELINE_STAGES)

    expect(stages).toContain('life-loss')
    expect(stages).toContain('heal-burst')
    expect(stages).toContain('speed-up')
    expect(stages).toContain('danger-rise')
    expect(stages).toContain('death-drain')
    expect(stages).toContain('fatal-guess')
    expect(stages).toContain('leaderboard')

    expect(difficultySteps[0]).toBe(DEMO_START_STEP)
    expect(difficultySteps).toContain(DEMO_SPEED_STEP)
    expect(difficultySteps).toContain(DEMO_BATCH_STEP)

    expect(scrollTicks.some((reason) => reason.includes('manual scroll'))).toBe(true)
    expect(getLivesAtHealStart()).toBeLessThan(5)

    const stageIndex = (name: DemoTimelineStage) => stages.indexOf(name)
    expect(stageIndex('life-loss')).toBeLessThan(stageIndex('heal-burst'))
    expect(stageIndex('heal-burst')).toBeLessThan(stageIndex('speed-up'))
    expect(stageIndex('speed-up')).toBeLessThan(stageIndex('danger-rise'))
    expect(stageIndex('danger-rise')).toBeLessThan(stageIndex('death-drain'))
    expect(stageIndex('death-drain')).toBeLessThan(stageIndex('fatal-guess'))
    expect(stageIndex('fatal-guess')).toBeLessThan(stageIndex('lost-hold'))
    expect(stageIndex('lost-hold')).toBeLessThan(stageIndex('leaderboard'))

    expect(stageSnapshots['death-drain']?.status).toBe('playing')
    expect(stageSnapshots['fatal-guess']?.status).toBe('playing')
    expect(stageSnapshots['fatal-guess']?.lives).toBe(1)
    expect(stageSnapshots['fatal-guess']?.hasAiHint).toBe(true)
    expect(stageSnapshots['lost-hold']?.status).toBe('lost')
  })

  it('uses the choreographed demo seed for opening session', () => {
    const session = createDemoScriptOpeningSession()
    expect(session.lives).toBe(5)
    expect(session.score).toBe(1_420)
    expect(session.state.status).toBe('playing')
    expect(DEMO_SCRIPT_SEED).toBe(0xdeadc0de)
  })

  it('covers end-card timing budget', () => {
    expect(DEMO_LOST_HOLD_MS).toBeGreaterThan(0)
    expect(DEMO_LEADERBOARD_MS).toBeGreaterThan(0)
  })
})
