import assert from 'node:assert/strict';
import { componentProbabilities } from '../src/core/ai/csp.ts';
import { deduce, key, type Deduction } from '../src/core/ai/deduction.ts';
import { solveBoard } from '../src/core/ai/moves.ts';
import { pickScrollMove } from '../src/core/ai/scroll-policy.ts';
import type { SolverBoard, SolverCell } from '../src/core/ai/session-board.ts';
import {
  applyMineDefuseOnRowScrollOff,
  BASE_MINE_SCORE,
  clearDefuseStreakOnMistake,
  MINES_PER_LIFE,
} from '../src/core/mines-defused.ts';
import {
  createEndlessSession,
  endlessRevealAt,
  endlessScrollTick,
  ENDLESS_MAX_MINES_PER_ROW,
  ENDLESS_PENDING_REVEAL_LOOKAHEAD_ROWS,
  ENDLESS_SCROLL_MS_MIN,
  ENDLESS_VISIBLE_ROWS,
  ENDLESS_WINDOW_ROWS,
  getEndlessMineRatio,
  getEndlessScrollProfile,
  SCROLL_BATCH_TIERS,
  SCROLL_INTERVAL_TIERS_MS,
} from '../src/core/modes/endless.ts';
import type { ModeSession } from '../src/core/types.ts';

interface FakeCell extends SolverCell {
  mine?: boolean;
}

function fakeBoard(
  rows: number,
  cols: number,
  cells: Record<string, FakeCell>,
  links: Record<string, Array<[number, number]>>,
  totalMines?: number,
  options?: {
    canAct?: (row: number, col: number) => boolean;
    endless?: SolverBoard['endless'];
  },
): SolverBoard {
  return {
    rows,
    cols,
    totalMines,
    inConstraints(row, col) {
      return row >= 0 && row < rows && col >= 0 && col < cols;
    },
    canAct(row, col) {
      if (options?.canAct) return options.canAct(row, col);
      return row >= 0 && row < rows && col >= 0 && col < cols;
    },
    neighbors(row, col) {
      return (links[key(row, col)] ?? []).map(([r, c]) => ({ row: r, col: c }));
    },
    cell(row, col) {
      return cells[key(row, col)] ?? { revealed: false, flagged: false, adjacentMines: null };
    },
    endless: options?.endless,
  };
}

function withSeed(session: ModeSession, worldSeed: number): ModeSession {
  return {
    ...session,
    state: {
      ...session.state,
      board: { ...session.state.board, worldSeed },
    },
  };
}

function testScrollProfile(): void {
  const start = getEndlessScrollProfile(0);
  assert.equal(start.intervalMs, SCROLL_INTERVAL_TIERS_MS[0]);
  assert.equal(start.batchRows, SCROLL_BATCH_TIERS[0]);

  const firstSpeedStep = getEndlessScrollProfile(50_000);
  assert.equal(firstSpeedStep.intervalMs, SCROLL_INTERVAL_TIERS_MS[1]);
  assert.equal(firstSpeedStep.batchRows, SCROLL_BATCH_TIERS[0]);

  const firstBatchStep = getEndlessScrollProfile(100_000);
  assert.equal(firstBatchStep.intervalMs, SCROLL_INTERVAL_TIERS_MS[1]);
  assert.equal(firstBatchStep.batchRows, SCROLL_BATCH_TIERS[1]);

  const maxed = getEndlessScrollProfile(1_000_000);
  assert.equal(maxed.intervalMs, ENDLESS_SCROLL_MS_MIN);
  assert.equal(maxed.batchRows, SCROLL_BATCH_TIERS.at(-1));
}

function testEndlessMineRatioRampsToClassicPlusHalf(): void {
  assert.equal(getEndlessMineRatio(0), 12 / 81);
  assert.equal(getEndlessMineRatio(40), 13.5 / 81);
  assert.equal(getEndlessMineRatio(80), 15 / 81);
  assert.equal(getEndlessMineRatio(999), 15 / 81);
}

function testEndlessGeneratedRowsCapMines(): void {
  let session = withSeed(createEndlessSession(), 3405691582);
  session = endlessRevealAt(session, 16, 4);

  for (let i = 0; i < 20; i += 1) {
    session = endlessScrollTick(session, 1);
  }

  for (const row of session.state.board.cells) {
    const mines = row.filter((cell) => cell.isMine).length;
    assert.ok(
      mines <= ENDLESS_MAX_MINES_PER_ROW,
      `expected row to have at most ${ENDLESS_MAX_MINES_PER_ROW} mines, got ${mines}`,
    );
  }
}

function createAllSafeEndlessSession(): ModeSession {
  const base = createEndlessSession();
  const board = {
    ...base.state.board,
    minesPlaced: true,
    cells: base.state.board.cells.map((row) =>
      row.map((cell) => ({
        ...cell,
        isMine: false,
        adjacentMines: 0,
        revealed: false,
        mark: 'none' as const,
      })),
    ),
  };
  return {
    ...base,
    state: { ...base.state, status: 'playing', board },
    endlessViewStart: Math.max(0, board.rows - ENDLESS_VISIBLE_ROWS),
  };
}

function testPendingRevealsDoNotLeakOffscreenUntilVisible(): void {
  let session = createAllSafeEndlessSession();
  const viewStart = session.endlessViewStart ?? 0;

  session = endlessRevealAt(session, viewStart, 4);

  assert.ok((session.pendingRevealKeys ?? []).length > 0);
  for (let row = 0; row < viewStart; row += 1) {
    assert.equal(
      session.state.board.cells[row]!.some((cell) => cell.revealed),
      false,
      `expected offscreen row ${row} to stay hidden`,
    );
  }

  session = endlessScrollTick(session, 1);
  const nextViewStart = session.endlessViewStart ?? 0;
  assert.equal(
    session.state.board.cells[nextViewStart]!.some((cell) => cell.revealed),
    true,
  );
}

function testEndlessMaintainsFutureBufferForBatchScrolls(): void {
  let session = createAllSafeEndlessSession();
  const initialViewStart = session.endlessViewStart ?? 0;

  session = endlessRevealAt(session, initialViewStart, 4);
  session = endlessScrollTick(session, 5);
  session = endlessScrollTick(session, 5);

  assert.ok(
    session.state.board.rows >= ENDLESS_WINDOW_ROWS,
    `expected buffered rows to be restored to ${ENDLESS_WINDOW_ROWS}`,
  );
  assert.equal(
    (session.endlessViewStart ?? 0) >= ENDLESS_PENDING_REVEAL_LOOKAHEAD_ROWS,
    true,
  );
  assert.equal(
    session.state.board.cells[session.endlessViewStart ?? 0]!.some((cell) => cell.revealed),
    true,
  );
}

function sessionWithFlaggedBottomMine(
  lives: number,
  minesDefused: number,
): { session: ModeSession; row: number } {
  const base = createEndlessSession();
  const board = {
    ...base.state.board,
    cells: base.state.board.cells.map((row) => row.map((cell) => ({ ...cell }))),
  };
  const row = board.rows - 1;
  board.cells[row]![0] = {
    ...board.cells[row]![0]!,
    isMine: true,
    mark: 'flag',
  };
  return {
    session: {
      ...base,
      state: { ...base.state, status: 'playing', board },
      lives,
      minesDefused,
    },
    row,
  };
}

function testDefusedMinesAutoHealWithoutStockpiling(): void {
  const almostHeal = sessionWithFlaggedBottomMine(4, MINES_PER_LIFE - 1);
  const healed = applyMineDefuseOnRowScrollOff(almostHeal.session, almostHeal.session.state.board, almostHeal.row);
  assert.equal(healed?.minesDefused, 0);
  assert.equal(healed?.lives, 5);
  assert.equal(healed?.lastAutoHeal?.livesGained, 1);
  assert.equal(healed?.defuseCombo, 1);
  assert.equal(healed?.score, BASE_MINE_SCORE);

  const fullHealth = sessionWithFlaggedBottomMine(5, MINES_PER_LIFE - 1);
  const settled = applyMineDefuseOnRowScrollOff(fullHealth.session, fullHealth.session.state.board, fullHealth.row);
  assert.equal(settled?.minesDefused, 0);
  assert.equal(settled?.lives, 5);
  assert.equal(settled?.lastAutoHeal?.groupsSpent, 1);
  assert.equal(settled?.lastAutoHeal?.livesGained, 0);
}

function testDefuseComboScoresAndBreaksOnMistake(): void {
  const base = sessionWithFlaggedBottomMine(5, 0);
  const scored = applyMineDefuseOnRowScrollOff(
    { ...base.session, score: 30, defuseCombo: 2 },
    base.session.state.board,
    base.row,
  );
  assert.equal(scored?.defuseCombo, 3);
  assert.equal(scored?.score, 30 + BASE_MINE_SCORE * 3);
  assert.equal(scored?.lastDefuseScore?.scoreAdded, BASE_MINE_SCORE * 3);

  const broken = clearDefuseStreakOnMistake({
    ...base.session,
    minesDefused: 3,
    score: 60,
    defuseCombo: 3,
  });
  assert.equal(broken.minesDefused, 0);
  assert.equal(broken.defuseCombo, 0);
  assert.equal(broken.score, 60);
  assert.equal(broken.lastDefuseBreak?.minesCleared, 3);
  assert.equal(broken.lastDefuseBreak?.comboCleared, 3);
}

function testSubsetDeductionDoesNotInferFromOverlaps(): void {
  const board = fakeBoard(
    2,
    3,
    {
      [key(1, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
      [key(1, 2)]: { revealed: true, flagged: false, adjacentMines: 1 },
    },
    {
      [key(1, 0)]: [
        [0, 0],
        [0, 1],
      ],
      [key(1, 2)]: [
        [0, 1],
        [0, 2],
      ],
    },
  );

  const result = deduce(board);
  assert.deepEqual([...result.safe], []);
  assert.deepEqual([...result.mines], []);
}

function testDirectDeductionStillWorks(): void {
  const safeBoard = fakeBoard(
    1,
    2,
    { [key(0, 0)]: { revealed: true, flagged: false, adjacentMines: 0 } },
    { [key(0, 0)]: [[0, 1]] },
  );
  assert.deepEqual([...deduce(safeBoard).safe], [key(0, 1)]);

  const mineBoard = fakeBoard(
    1,
    2,
    { [key(0, 0)]: { revealed: true, flagged: false, adjacentMines: 1 } },
    { [key(0, 0)]: [[0, 1]] },
  );
  assert.deepEqual([...deduce(mineBoard).mines], [key(0, 1)]);
}

function testRevealedMineCountsAsKnownConstraintMine(): void {
  const hidden = key(0, 1);
  const revealedMine = key(0, 0);
  const board = fakeBoard(
    2,
    2,
    {
      [revealedMine]: {
        revealed: true,
        flagged: false,
        adjacentMines: null,
        knownMine: true,
      },
      [key(1, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
    },
    {
      [key(1, 0)]: [
        [0, 0],
        [0, 1],
      ],
    },
  );

  const result = deduce(board);
  assert.equal(result.mines.has(revealedMine), true);
  assert.equal(result.safe.has(hidden), true);
  assert.equal(result.mines.has(hidden), false);
}

function testSolverExecutesDirectSafeMove(): void {
  const board = fakeBoard(
    1,
    2,
    { [key(0, 0)]: { revealed: true, flagged: false, adjacentMines: 0 } },
    { [key(0, 0)]: [[0, 1]] },
  );

  const { move } = solveBoard(board, 5, undefined);
  assert.equal(move?.kind, 'reveal');
  assert.equal(move?.confidence, 'certain');
  assert.equal(move?.row, 0);
  assert.equal(move?.col, 1);
}

function testGlobalMineCountMarksRestSafe(): void {
  const board = fakeBoard(
    1,
    2,
    {
      [key(0, 0)]: { revealed: false, flagged: false, adjacentMines: null },
      [key(0, 1)]: { revealed: false, flagged: false, adjacentMines: null },
    },
    {},
    2,
  );

  const { move } = solveBoard(board, 5, undefined);
  assert.equal(move?.kind, 'flag');
  assert.equal(move?.confidence, 'certain');
  assert.equal(move?.row, 0);
  assert.equal(move?.col, 0);
}

function testUntrustedFlagsRemainConstraintVariables(): void {
  const flagged = key(0, 0);
  const unknown = key(0, 1);
  const board = fakeBoard(
    2,
    2,
    {
      [flagged]: { revealed: false, flagged: true, adjacentMines: null },
      [key(1, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
    },
    {
      [key(1, 0)]: [
        [0, 0],
        [0, 1],
      ],
    },
  );

  const result = deduce(board);
  assert.equal(result.safe.has(unknown), false);
  assert.equal(result.mines.has(unknown), false);
}

function testFlaggedCellsDoNotSatisfyCluesByThemselves(): void {
  const unknown = key(0, 1);
  const board = fakeBoard(
    2,
    2,
    {
      [key(0, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
      [key(1, 1)]: { revealed: false, flagged: true, adjacentMines: null },
    },
    {
      [key(0, 0)]: [
        [0, 1],
        [1, 0],
        [1, 1],
      ],
    },
  );

  const result = deduce(board);
  assert.equal(result.safe.has(unknown), false);
}

function testCornerOneMarksDiagonalMine(): void {
  const mine = key(1, 1);
  const board = fakeBoard(
    2,
    2,
    {
      [key(0, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
      [key(0, 1)]: { revealed: true, flagged: false, adjacentMines: 1 },
      [key(1, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
    },
    {
      [key(0, 0)]: [
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      [key(0, 1)]: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [key(1, 0)]: [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    },
  );

  const { move } = solveBoard(board, 5, undefined);
  assert.equal(move?.kind, 'flag');
  assert.equal(move?.confidence, 'certain');
  assert.equal(move?.row, 1);
  assert.equal(move?.col, 1);
  assert.equal(deduce(board).mines.has(mine), true);
}

function testRingOnesPreferCenterMineOverLowerCell(): void {
  const center = key(1, 1);
  const lower = key(2, 1);
  const cells: Record<string, FakeCell> = {
    [key(0, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
    [key(0, 1)]: { revealed: true, flagged: false, adjacentMines: 1 },
    [key(0, 2)]: { revealed: true, flagged: false, adjacentMines: 1 },
    [key(1, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
    [key(1, 2)]: { revealed: true, flagged: false, adjacentMines: 1 },
    [key(2, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
    [key(2, 2)]: { revealed: true, flagged: false, adjacentMines: 1 },
  };
  const allNeighbors = {
    [key(0, 0)]: [
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    [key(0, 1)]: [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [key(0, 2)]: [
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    [key(1, 0)]: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    [key(1, 2)]: [
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [key(2, 0)]: [
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [key(2, 2)]: [
      [1, 1],
      [1, 2],
      [2, 1],
    ],
  };
  const board = fakeBoard(3, 3, cells, allNeighbors);

  const { move } = solveBoard(board, 5, undefined);
  assert.equal(move?.kind, 'flag');
  assert.equal(move?.row, 1);
  assert.equal(move?.col, 1);
  assert.equal(deduce(board).mines.has(center), true);
  assert.equal(deduce(board).mines.has(lower), false);
}

function testCspProjectsFullComponents(): void {
  const bottom = key(0, 0);
  const other = key(0, 1);
  const board = fakeBoard(
    2,
    2,
    { [key(1, 0)]: { revealed: true, flagged: false, adjacentMines: 1 } },
    {
      [key(1, 0)]: [
        [0, 0],
        [0, 1],
      ],
    },
  );
  const deduced: Deduction = { safe: new Set(), mines: new Set() };
  const projected = componentProbabilities(board, deduced, [bottom]);

  assert.equal(projected?.has(bottom), true);
  assert.equal(projected?.has(other), false);
  assert.equal(projected?.get(bottom), 0.5);
}

function testChordRequiresVisibleRevealTarget(): void {
  const offscreenSafe = key(0, 1);
  const board = fakeBoard(
    2,
    2,
    {
      [key(0, 0)]: { revealed: false, flagged: true, adjacentMines: null },
      [offscreenSafe]: { revealed: false, flagged: false, adjacentMines: null },
      [key(1, 0)]: { revealed: true, flagged: false, adjacentMines: 1 },
      [key(1, 1)]: { revealed: true, flagged: false, adjacentMines: 1 },
    },
    {
      [key(1, 0)]: [
        [0, 0],
        [0, 1],
      ],
      [key(1, 1)]: [[0, 0]],
    },
    undefined,
    {
      canAct(row, col) {
        return row >= 0 && row < 2 && col >= 0 && col < 2 && key(row, col) !== offscreenSafe;
      },
      endless: { bottomRow: 1, viewStart: 1 },
    },
  );

  const { chords, move } = solveBoard(board, 5, undefined);
  assert.equal(chords.length, 0);
  assert.notEqual(move?.kind, 'chord');
}

function testEndlessBreaksThroughFullyUnknownBoard(): void {
  const board = fakeBoard(
    3,
    3,
    {},
    {},
    undefined,
    { endless: { bottomRow: 2, viewStart: 0 } },
  );

  const criticalMove = solveBoard(board, 1, undefined, 5).move;
  assert.equal(criticalMove?.kind, 'reveal');
  assert.equal(criticalMove?.confidence, 'guess');
  assert.equal(criticalMove?.reason.startsWith('保命破局'), true);

  const lowLifeMove = solveBoard(board, 2, undefined).move;
  assert.equal(lowLifeMove?.kind, 'reveal');
  assert.equal(lowLifeMove?.confidence, 'guess');
  assert.equal(lowLifeMove?.reason.startsWith('破局 · 全未知'), true);

  const { move } = solveBoard(board, 5, undefined);
  assert.equal(move?.kind, 'reveal');
  assert.equal(move?.confidence, 'guess');
  assert.equal(move?.reason.startsWith('破局 · 全未知'), true);
}

function testBlankBottomRowsDoNotTriggerAiScroll(): void {
  const board = fakeBoard(
    3,
    3,
    {},
    {},
    undefined,
    { endless: { bottomRow: 2, viewStart: 0 } },
  );
  const session = {
    modeId: 'endless',
    state: { status: 'playing', board: createEndlessSession().state.board, modeId: 'endless' },
    lives: 5,
  } satisfies ModeSession;

  const move = pickScrollMove(session, null, board, new Set(), new Set(), 2);
  assert.equal(move, null);
}

function testBatchScrollMovesMultipleRowsAndCapsDamage(): void {
  let session = withSeed(createEndlessSession(), 2654435761);
  session = endlessRevealAt(session, 16, 4);
  assert.equal(session.state.status, 'playing');

  const beforeDepth = session.scrollRowCount ?? 0;
  const beforeLives = session.lives ?? 0;
  const next = endlessScrollTick(session, 5);

  assert.equal((next.scrollRowCount ?? 0) - beforeDepth, 5);
  assert.ok(beforeLives - (next.lives ?? 0) <= 1);
}

const tests: Array<[string, () => void]> = [
  ['scroll profile speeds up and increases batch size', testScrollProfile],
  ['endless mine ratio ramps to classic plus 50 percent density', testEndlessMineRatioRampsToClassicPlusHalf],
  ['endless generated rows cap local mine piles', testEndlessGeneratedRowsCapMines],
  ['pending reveals do not leak offscreen until visible', testPendingRevealsDoNotLeakOffscreenUntilVisible],
  ['endless maintains future buffer for batch scrolls', testEndlessMaintainsFutureBufferForBatchScrolls],
  ['defused mines auto-heal without stockpiling lives', testDefusedMinesAutoHealWithoutStockpiling],
  ['defuse combo scores and breaks on mistake', testDefuseComboScoresAndBreaksOnMistake],
  ['subset deduction ignores partial overlaps', testSubsetDeductionDoesNotInferFromOverlaps],
  ['direct deduction still works', testDirectDeductionStillWorks],
  ['revealed mine counts as known constraint mine', testRevealedMineCountsAsKnownConstraintMine],
  ['solver executes direct safe moves', testSolverExecutesDirectSafeMove],
  ['global mine count marks rest safe', testGlobalMineCountMarksRestSafe],
  ['untrusted flags remain constraint variables', testUntrustedFlagsRemainConstraintVariables],
  ['flagged cells do not satisfy clues by themselves', testFlaggedCellsDoNotSatisfyCluesByThemselves],
  ['corner one marks diagonal mine', testCornerOneMarksDiagonalMine],
  ['ring ones prefer center mine over lower cell', testRingOnesPreferCenterMineOverLowerCell],
  ['CSP projects probabilities from full components', testCspProjectsFullComponents],
  ['chord requires a visible reveal target', testChordRequiresVisibleRevealTarget],
  ['endless solver breaks through fully unknown board', testEndlessBreaksThroughFullyUnknownBoard],
  ['blank bottom rows do not trigger AI scroll', testBlankBottomRowsDoNotTriggerAiScroll],
  ['batch scroll moves multiple rows and caps damage', testBatchScrollMovesMultipleRowsAndCapsDamage],
];

for (const [name, run] of tests) {
  run();
  console.log(`ok - ${name}`);
}

console.log(`\n${tests.length} tests passed`);
