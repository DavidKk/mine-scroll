import assert from 'node:assert/strict';
import { cloneBoard } from '../src/core/board.ts';
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
  collectScrollLeavingMineCells,
  applyMinesFromSeed,
  createEndlessSession,
  endlessBeginRun,
  endlessRevealAt,
  endlessScrollTick,
  ENDLESS_COLS,
  ENDLESS_MAX_MINES_PER_ROW,
  ENDLESS_PENDING_REVEAL_LOOKAHEAD_ROWS,
  ENDLESS_PREVIEW_SOURCE_ROWS,
  ENDLESS_SCROLL_MS_MIN,
  ENDLESS_VISIBLE_ROWS,
  ENDLESS_WINDOW_ROWS,
  getEndlessMineRatio,
  getEndlessScrollProfile,
  isBatchScrollSafe,
  SCROLL_BATCH_TIERS,
  SCROLL_INTERVAL_TIERS_MS,
} from '../src/core/modes/endless/index.ts';
import type { ModeSession } from '../src/core/types.ts';
import { getBoardOnlyLayoutMetrics } from '../src/ui/renderer/index.ts';
import {
  computeGameStageLayout,
  getComboFeedbackAnchor,
  getBottomFeedbackSlots,
  getDifficultyAlertAnchor,
} from '../src/ui/game-stage-layout.ts';
import { isLoopingGameFx, resolveFxFrameIndex } from '../src/ui/game-assets.ts';
import { getComboFeedbackPalette, getComboHudTier } from '../src/ui/hud-feedback-fx.ts';

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
  const board = cloneBoard(session.state.board);
  board.worldSeed = worldSeed;
  applyMinesFromSeed(board);
  return {
    ...session,
    state: {
      ...session.state,
      board,
    },
  };
}

function endlessSessionWithUnsafeBottom(): ModeSession {
  for (let seed = 0; seed < 8000; seed += 1) {
    let session = withSeed(createEndlessSession(), seed);
    session = endlessBeginRun(session);
    if (session.state.status === 'playing' && !isBatchScrollSafe(session, 1)) {
      return session;
    }
  }
  throw new Error('no seed produced unsafe bottom after game start');
}

function endlessSessionWithLeavingMines(): ModeSession {
  for (let seed = 0; seed < 8000; seed += 1) {
    let session = withSeed(createEndlessSession(), seed);
    session = endlessBeginRun(session);
    const mines = collectScrollLeavingMineCells(session, 1);
    if (mines.length > 0) return session;
  }
  throw new Error('no seed produced leaving mines on bottom row after game start');
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
  const previewStart = Math.max(0, viewStart - ENDLESS_PREVIEW_SOURCE_ROWS);
  for (let row = 0; row < previewStart; row += 1) {
    assert.equal(
      session.state.board.cells[row]!.some((cell) => cell.revealed),
      false,
      `expected offscreen row ${row} to stay hidden`,
    );
  }

  session = endlessScrollTick(session, 1);
  const nextViewStart = session.endlessViewStart ?? 0;
  const nextPreviewStart = Math.max(0, nextViewStart - ENDLESS_PREVIEW_SOURCE_ROWS);
  const revealedNearTop = [nextPreviewStart, nextViewStart].some((row) =>
    session.state.board.cells[row]?.some((cell) => cell.revealed),
  );
  assert.equal(revealedNearTop, true);
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
  assert.ok(
    session.state.board.cells.some((row) => row.some((cell) => cell.revealed)),
    'expected scroll batch to preserve prior reveals on the board',
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
  assert.equal(criticalMove?.reason.startsWith('Emergency salvage'), true);

  const lowLifeMove = solveBoard(board, 2, undefined).move;
  assert.equal(lowLifeMove?.kind, 'reveal');
  assert.equal(lowLifeMove?.confidence, 'guess');
  assert.equal(lowLifeMove?.reason.startsWith('Breakthrough · all unknown'), true);

  const { move } = solveBoard(board, 5, undefined);
  assert.equal(move?.kind, 'reveal');
  assert.equal(move?.confidence, 'guess');
  assert.equal(move?.reason.startsWith('Breakthrough · all unknown'), true);
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

function testEndlessBeginRunStartsPlaying(): void {
  let session = withSeed(createEndlessSession(), 1);
  assert.equal(session.state.status, 'idle');
  assert.equal(session.state.board.minesPlaced, true);
  session = endlessBeginRun(session);
  assert.equal(session.state.status, 'playing');
  assert.equal(session.state.board.minesPlaced, true);
}

function testScrollAfterStartWithoutRevealEvaluatesMines(): void {
  const session = endlessSessionWithUnsafeBottom();
  const beforeLives = session.lives ?? 5;
  const next = endlessScrollTick(session, 1);
  assert.equal((next.scrollRowCount ?? 0) > (session.scrollRowCount ?? 0), true);
  assert.ok((next.lives ?? 0) <= beforeLives);
}

function testFirstRevealCanHitMineAndCostLife(): void {
  let found = false;
  for (let seed = 0; seed < 4000; seed += 1) {
    let session = withSeed(createEndlessSession(), seed);
    const beforeLives = session.lives ?? 5;
    session = endlessRevealAt(session, 16, 4);
    assert.equal(session.state.status, 'playing');
    assert.equal(session.state.board.minesPlaced, true);
    if ((session.lives ?? 0) < beforeLives) {
      found = true;
      break;
    }
  }
  assert.ok(found, 'expected some seeds to hit a mine on first reveal');
}

function testScrollLeavingMinesCollectedBeforeScroll(): void {
  const session = endlessSessionWithLeavingMines();
  assert.equal(isBatchScrollSafe(session, 1), false);
  const mines = collectScrollLeavingMineCells(session, 1);
  assert.ok(mines.length > 0, 'expected unflagged mines on leaving bottom row');
  for (const cell of mines) {
    assert.ok(cell.screenRow >= 0 && cell.col >= 0);
  }
}

function testScrollProceedsWhenBottomUnsafe(): void {
  const session = endlessSessionWithUnsafeBottom();
  assert.equal(isBatchScrollSafe(session, 1), false);
  const beforeDepth = session.scrollRowCount ?? 0;
  const next = endlessScrollTick(session, 1);
  assert.equal((next.scrollRowCount ?? 0) - beforeDepth, 1);
}

function testBatchScrollMovesMultipleRowsAndCapsDamage(): void {
  let session = endlessSessionWithUnsafeBottom();
  const beforeDepth = session.scrollRowCount ?? 0;
  const beforeLives = session.lives ?? 0;
  const next = endlessScrollTick(session, 5);

  assert.equal((next.scrollRowCount ?? 0) - beforeDepth, 5);
  assert.ok(beforeLives - (next.lives ?? 0) <= 1);
}

function comboAnchorInput(
  viewportW: number,
  viewportH: number,
  visibleRows = ENDLESS_VISIBLE_ROWS,
) {
  const boardLayout = getBoardOnlyLayoutMetrics(visibleRows, ENDLESS_COLS);
  const stage = computeGameStageLayout(viewportW, viewportH, boardLayout.width, boardLayout.height);
  return {
    stage,
    boardLayout,
    anchor: getComboFeedbackAnchor(viewportW, viewportH, {
      scale: stage.scale,
      boardOffsetY: stage.boardY,
      gridOriginY: boardLayout.gridOriginY,
      cellStep: boardLayout.grid.cellStep,
      cellSize: boardLayout.grid.cellSize,
      visibleRows,
      bottomRailY: stage.bottomRailRect.y,
    }),
  };
}

function testComboFeedbackAnchorCentersHorizontally(): void {
  const viewportW = 390;
  const viewportH = 844;
  const { anchor } = comboAnchorInput(viewportW, viewportH);
  assert.equal(anchor.x, viewportW / 2);
}

function testComboFeedbackAnchorAlignsWithBottomPlayableRow(): void {
  const viewportW = 390;
  const viewportH = 844;
  const { stage, boardLayout, anchor } = comboAnchorInput(viewportW, viewportH);

  const bottomRowCenterY =
    stage.boardY +
    boardLayout.gridOriginY +
    (ENDLESS_VISIBLE_ROWS - 1) * boardLayout.grid.cellStep +
    boardLayout.grid.cellSize * 0.42;
  const minY = stage.boardY + boardLayout.gridOriginY + boardLayout.grid.cellSize * 0.5;
  const expectedY = Math.max(
    minY,
    Math.min(bottomRowCenterY, stage.bottomRailRect.y - 28 * stage.scale),
  );
  assert.equal(anchor.y, expectedY);
}

function testComboFeedbackAnchorSitsBelowHudAndAboveBottomRail(): void {
  const viewportW = 1280;
  const viewportH = 800;
  const { stage, anchor } = comboAnchorInput(viewportW, viewportH);

  assert.ok(anchor.y > stage.hudY + stage.hudH + 40, 'combo anchor should sit below HUD');
  assert.ok(anchor.y < stage.bottomRailRect.y - 8, 'combo anchor should sit above bottom rail');
  assert.ok(anchor.y > stage.boardY, 'combo anchor should be within board band');
}

function testComboFeedbackAnchorFallbackWithoutLayout(): void {
  const viewportW = 360;
  const viewportH = 640;
  const scale = 1;
  const anchor = getComboFeedbackAnchor(viewportW, viewportH, null);
  assert.equal(anchor.x, viewportW / 2);
  assert.equal(anchor.y, viewportH - 72 * scale);
}

function testBottomFeedbackSlotsSeparateScoreAndCombo(): void {
  const viewportW = 390;
  const viewportH = 844;
  const { stage, boardLayout } = comboAnchorInput(viewportW, viewportH);
  const layout = {
    scale: stage.scale,
    boardOffsetY: stage.boardY,
    gridOriginY: boardLayout.gridOriginY,
    cellStep: boardLayout.grid.cellStep,
    cellSize: boardLayout.grid.cellSize,
    visibleRows: ENDLESS_VISIBLE_ROWS,
    bottomRailY: stage.bottomRailRect.y,
  };
  const slots = getBottomFeedbackSlots(viewportW, viewportH, layout);

  assert.equal(slots.comboBurst.x, viewportW / 2);
  assert.ok(slots.scorePop.y < slots.comboBurst.y, 'score pop should sit above combo burst');
  const minSep = 20 * stage.scale;
  const dx = Math.abs(slots.scorePop.x - slots.comboBurst.x);
  const dy = slots.comboBurst.y - slots.scorePop.y;
  assert.ok(dy >= minSep || dx >= 60 * stage.scale, 'score and combo slots should separate');
}

function testFxFrameIndexLoopAndOneshot(): void {
  assert.equal(resolveFxFrameIndex(0, 8, true), 0);
  assert.equal(resolveFxFrameIndex(0.999, 8, true), 7);
  assert.equal(resolveFxFrameIndex(0, 8, false), 0);
  assert.equal(resolveFxFrameIndex(1, 8, false), 7);
  assert.equal(resolveFxFrameIndex(0.875, 8, false), 7);
  assert.ok(isLoopingGameFx('digit-particles'));
  assert.ok(!isLoopingGameFx('mine-explosion'));
}

function testOrbitParticlesSeamAtLoopWrap(): void {
  const sample = (phase: number, i: number) => {
    const spin = phase * Math.PI * 2;
    const orbitDir = i % 2 === 0 ? 1 : -1;
    const angle = i * 2.399 + spin * orbitDir;
    const drift = Math.sin(spin + i * 1.7) * 0.035;
    const radius = 0.3 + (i % 5) * 0.03 + drift;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.72,
    };
  };
  for (let i = 0; i < 12; i += 1) {
    const a = sample(0, i);
    const b = sample(1, i);
    assert.ok(Math.abs(a.x - b.x) < 1e-10 && Math.abs(a.y - b.y) < 1e-10, `orbit ${i} should match at phase 0 and 1`);
  }
}

function testComboHudV3TierColors(): void {
  assert.equal(getComboHudTier(3), 0);
  assert.equal(getComboHudTier(9), 0);
  assert.equal(getComboHudTier(10), 1);
  assert.equal(getComboHudTier(19), 1);
  assert.equal(getComboHudTier(20), 2);
  assert.equal(getComboHudTier(49), 2);
  assert.equal(getComboHudTier(50), 3);
  assert.equal(getComboFeedbackPalette(8).digitColor, '#93c5fd');
  assert.equal(getComboFeedbackPalette(12).digitColor, '#facc15');
  assert.equal(getComboFeedbackPalette(24).digitColor, '#fb923c');
  assert.equal(getComboFeedbackPalette(50).digitColor, '#ef4444');
  assert.equal(getComboFeedbackPalette(50).text, '#fca5a5');
  assert.notEqual(getComboFeedbackPalette(20).digitColor, '#ef4444');
}

function testDifficultyAlertAnchorSitsAboveBoard(): void {
  const { stage } = comboAnchorInput(390, 844);
  const anchor = getDifficultyAlertAnchor(stage);
  const hudBottom = stage.hudY + stage.hudH;
  assert.ok(anchor.y > hudBottom + stage.scale * 8, 'alert should sit below top HUD');
  assert.ok(anchor.y < stage.boardY - stage.scale * 4, 'alert should stay above board top');
  assert.equal(anchor.x, stage.viewportW / 2);
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
  ['endless begin run starts playing without reveal', testEndlessBeginRunStartsPlaying],
  ['scroll after start without reveal evaluates mines', testScrollAfterStartWithoutRevealEvaluatesMines],
  ['first reveal can hit mine and cost life', testFirstRevealCanHitMineAndCostLife],
  ['scroll leaving mines collected before scroll', testScrollLeavingMinesCollectedBeforeScroll],
  ['scroll proceeds when bottom row is not safe', testScrollProceedsWhenBottomUnsafe],
  ['batch scroll moves multiple rows and caps damage', testBatchScrollMovesMultipleRowsAndCapsDamage],
  ['combo feedback anchor centers horizontally', testComboFeedbackAnchorCentersHorizontally],
  ['combo feedback anchor aligns with bottom playable row', testComboFeedbackAnchorAlignsWithBottomPlayableRow],
  ['combo feedback anchor sits below hud and above bottom rail', testComboFeedbackAnchorSitsBelowHudAndAboveBottomRail],
  ['combo feedback anchor fallback without layout', testComboFeedbackAnchorFallbackWithoutLayout],
  ['bottom feedback slots separate score and combo', testBottomFeedbackSlotsSeparateScoreAndCombo],
  ['combo hud v3 uses four escalating color tiers', testComboHudV3TierColors],
  ['difficulty alert anchor sits above board', testDifficultyAlertAnchorSitsAboveBoard],
  ['fx frame index loops and completes oneshots', testFxFrameIndexLoopAndOneshot],
  ['orbit particles match at loop wrap', testOrbitParticlesSeamAtLoopWrap],
];

for (const [name, run] of tests) {
  run();
  console.log(`ok - ${name}`);
}

console.log(`\n${tests.length} tests passed`);
