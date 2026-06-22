/**
 * 无尽模式 AI 无头模拟 — 用于评估能否撑到最快卷轴速度
 * 运行: pnpm exec tsx scripts/simulate-endless-ai.ts [局数]
 */
import { applyAiMove, getAiAnalysis } from '../src/core/modes/engine.ts';
import { getEndlessAiStepMs } from '../src/core/ai/solver.ts';
import {
  createEndlessSession,
  endlessScrollTick,
  ENDLESS_SCROLL_MS_MIN,
  getEndlessScrollIntervalMsFromElapsed,
  getEndlessScrollProfile,
} from '../src/core/modes/endless/index.ts';
import type { ModeSession } from '../src/core/types.ts';

const SIM_TICK_MS = 50;
const MAX_SCROLL_TARGET = 40;
const MAX_SIM_ELAPSED_MS = 240_000;

function maxSpeedAt(elapsedMs: number): boolean {
  return getEndlessScrollIntervalMsFromElapsed(elapsedMs) <= ENDLESS_SCROLL_MS_MIN;
}

function bottomRowUnresolved(session: ModeSession): number {
  const board = session.state.board;
  const bottom = board.rows - 1;
  let n = 0;
  for (let col = 0; col < board.cols; col += 1) {
    const c = board.cells[bottom]![col]!;
    if (!c.revealed && c.mark !== 'flag') n += 1;
  }
  return n;
}

interface RunStats {
  seed: number;
  scrollDepth: number;
  lives: number;
  revealed: number;
  maxSpeedReached: boolean;
  lost: boolean;
  guessHits: number;
  guessTotal: number;
  waitTicks: number;
  bottomPenalties: number;
  reason: string;
}

function simulateOne(seedIndex: number): RunStats {
  let session: ModeSession = createEndlessSession();
  session = {
    ...session,
    state: {
      ...session.state,
      board: { ...session.state.board, worldSeed: (seedIndex + 1) * 2654435761 >>> 0 },
    },
  };

  let elapsed = 0;
  let nextAiAt = 0;
  let nextScrollAt = getEndlessScrollIntervalMsFromElapsed(0);
  let guessHits = 0;
  let guessTotal = 0;
  let waitTicks = 0;
  let bottomPenalties = 0;
  let lastMoveKind = '';

  while (session.state.status !== 'lost') {
    const depth = session.scrollRowCount ?? 0;
    if (depth >= MAX_SCROLL_TARGET) break;

    while (elapsed >= nextAiAt) {
      const beforeLives = session.lives;
      const analysis = getAiAnalysis(session, elapsed);
      if (!analysis.move) {
        waitTicks += 1;
      } else {
        if (analysis.move.confidence === 'guess') guessTotal += 1;
        session = applyAiMove(session, analysis.move);
        if (analysis.move.confidence === 'guess' && (session.lives ?? 5) < (beforeLives ?? 5)) {
          guessHits += 1;
        }
        lastMoveKind = analysis.move.reason;
      }
      nextAiAt += getEndlessAiStepMs(session, elapsed);
      if (session.state.status === 'lost') break;
    }

    if (session.state.status === 'lost') break;

    if (elapsed >= nextScrollAt) {
      const livesBefore = session.lives ?? 5;
      const unresolved = bottomRowUnresolved(session);
      const profile = getEndlessScrollProfile(elapsed);
      session = endlessScrollTick(session, profile.batchRows);
      const livesAfter = session.lives ?? 0;
      if (livesAfter < livesBefore) bottomPenalties += 1;
      if (session.state.status === 'lost') break;
      nextScrollAt += getEndlessScrollProfile(elapsed).intervalMs;
      if (unresolved > 0 && livesAfter < livesBefore) {
        lastMoveKind = `scroll penalty with ${unresolved} bottom cells`;
      }
    }

    elapsed += SIM_TICK_MS;
    if (elapsed > MAX_SIM_ELAPSED_MS) break;
  }

  const depth = session.scrollRowCount ?? 0;
  const maxSpeedReached = maxSpeedAt(elapsed) || depth >= 29;

  return {
    seed: seedIndex,
    scrollDepth: depth,
    lives: session.lives ?? 0,
    revealed: session.revealedCount ?? 0,
    maxSpeedReached,
    lost: session.state.status === 'lost',
    guessHits,
    guessTotal,
    waitTicks,
    bottomPenalties,
    reason: lastMoveKind,
  };
}

function main(): void {
  const runs = Number(process.argv[2] ?? 20);
  const results: RunStats[] = [];
  for (let i = 0; i < runs; i += 1) results.push(simulateOne(i));

  const reached = results.filter((r) => r.maxSpeedReached && !r.lost).length;
  const avgDepth = results.reduce((s, r) => s + r.scrollDepth, 0) / results.length;
  const avgPenalties = results.reduce((s, r) => s + r.bottomPenalties, 0) / results.length;
  const avgWaits = results.reduce((s, r) => s + r.waitTicks, 0) / results.length;
  const avgGuessHit =
    results.reduce((s, r) => s + r.guessHits, 0) /
    Math.max(1, results.reduce((s, r) => s + r.guessTotal, 0));

  console.log(`\n=== 无尽 AI 模拟 (${runs} 局) ===`);
  console.log(`到达最快卷轴(↑≥29): ${reached}/${runs}`);
  console.log(`平均卷轴深度: ${avgDepth.toFixed(1)}`);
  console.log(`平均底行扣血: ${avgPenalties.toFixed(2)}`);
  console.log(`平均 AI 空等次数: ${avgWaits.toFixed(1)}`);
  console.log(`猜雷踩雷率: ${(avgGuessHit * 100).toFixed(1)}%`);
  console.log('\n最差 5 局:');
  for (const r of [...results].sort((a, b) => a.scrollDepth - b.scrollDepth).slice(0, 5)) {
    console.log(
      `  seed=${r.seed} ↑${r.scrollDepth} 命=${r.lives} 扣血=${r.bottomPenalties} 等=${r.waitTicks} 猜=${r.guessTotal}/${r.guessHits} ${r.lost ? '失败' : '存活'}`,
    );
  }
}

main();
