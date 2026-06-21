import { cloneBoard, type Coord } from '../board.ts';
import type {
  Board,
  Cell,
  CellView,
  GameStatus,
  LifeLossCell,
  LifeLossCellKind,
  LifeLossReport,
  ModeSession,
} from '../types.ts';
import {
  applyMineDefuseOnRowScrollOff,
  clearDefuseStreakOnMistake,
  formatMinesDefusedHud,
  isScrollPenaltyExempt,
  recordMineHitScrollExempt,
} from '../mines-defused.ts';
import { cellKey, isCellBlocked } from '../types.ts';

export const ENDLESS_COLS = 9;
/** 屏幕可见行数（竖长盘，类似俄罗斯方块井） */
export const ENDLESS_VISIBLE_ROWS = 20;
/** 内部缓冲行数（≥ 可见行 + 双轮最高批量上移余量） */
export const ENDLESS_WINDOW_BUFFER = 12;
export const ENDLESS_WINDOW_ROWS = ENDLESS_VISIBLE_ROWS + ENDLESS_WINDOW_BUFFER;
/** 开局卷轴间隔（毫秒） */
export const ENDLESS_SCROLL_MS_START = 9000;
/** 最快卷轴间隔（毫秒） */
export const ENDLESS_SCROLL_MS_MIN = 1500;
/** 每经过约一轮开局间隔的对局时间，卷轴倒数乘一次 ENDLESS_SCROLL_DECAY */
export const ENDLESS_SCROLL_DECAY = 0.94;
/** 双轨阶梯：每档间隔（毫秒） */
export const SCROLL_STEP_MS = 50_000;
/** 速度轨 11 档（秒） */
export const SCROLL_INTERVAL_TIERS_MS = [
  9000, 7500, 6300, 5300, 4500, 3800, 3200, 2700, 2300, 2000, 1500,
] as const;
/** 批量轨 5 档（行/次） */
export const SCROLL_BATCH_TIERS = [1, 2, 3, 4, 5] as const;
export const ENDLESS_SCROLL_BATCH_MAX = 5;
export const ENDLESS_LIVES = 5;
/** 无尽模式开局雷密度：9×9 / 12 雷，避免早期信息不足 */
export const ENDLESS_MINE_RATIO_START = 12 / 81;
/** 无尽模式最高雷密度：9×9 / 15 雷，约经典初级盘 1.5 倍 */
export const ENDLESS_MINE_RATIO_MAX = 15 / 81;
/** 经过多少行卷轴后达到最高雷密度 */
export const ENDLESS_MINE_RAMP_ROWS = 80;
/** 单行雷数上限，避免随机生成局部雷堆压过可操作空间 */
export const ENDLESS_MAX_MINES_PER_ROW = 3;
/** 屏幕外预展开最多向上看几行；覆盖两轮最高批量上移 */
export const ENDLESS_PENDING_REVEAL_LOOKAHEAD_ROWS = 12;
/** 每次根据顶部开放区预标记的安全格上限 */
export const ENDLESS_PENDING_REVEAL_MAX_PER_SYNC = 36;
/** 当前最高难度目标密度 */
export const ENDLESS_MINE_RATIO = ENDLESS_MINE_RATIO_MAX;

/** 按卷轴深度返回当前雷密度 */
export function getEndlessMineRatio(scrollDepth: number): number {
  const t = Math.min(1, Math.max(0, scrollDepth) / ENDLESS_MINE_RAMP_ROWS);
  return ENDLESS_MINE_RATIO_START + (ENDLESS_MINE_RATIO_MAX - ENDLESS_MINE_RATIO_START) * t;
}

function isMineAt(worldRow: number, col: number, seed: number, scrollDepth: number): boolean {
  const ratio = getEndlessMineRatio(scrollDepth);
  const score = hash01(worldRow, col, seed);
  if (score >= ratio) return false;

  const candidates: Array<{ col: number; score: number }> = [];
  for (let c = 0; c < ENDLESS_COLS; c += 1) {
    const candidateScore = hash01(worldRow, c, seed);
    if (candidateScore < ratio) candidates.push({ col: c, score: candidateScore });
  }

  if (candidates.length <= ENDLESS_MAX_MINES_PER_ROW) return true;
  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, ENDLESS_MAX_MINES_PER_ROW).some((candidate) => candidate.col === col);
}

function worldRowOf(board: Board, localRow: number): number {
  return board.minRow! + localRow;
}

function worldCellKey(board: Board, localRow: number, col: number): string {
  return `${worldRowOf(board, localRow)},${col}`;
}

function parseWorldCellKey(value: string): { worldRow: number; col: number } | null {
  const [rowPart, colPart] = value.split(',');
  const worldRow = Number(rowPart);
  const col = Number(colPart);
  if (!Number.isInteger(worldRow) || !Number.isInteger(col)) return null;
  return { worldRow, col };
}

function localRowFromWorld(board: Board, worldRow: number): number | null {
  if (board.minRow === undefined) return null;
  const row = worldRow - board.minRow;
  return row >= 0 && row < board.rows ? row : null;
}

function inLocalBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols;
}

function getLocalNeighbors(board: Board, row: number, col: number): Coord[] {
  const neighbors: Coord[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (inLocalBounds(board, nr, nc)) neighbors.push({ row: nr, col: nc });
    }
  }
  return neighbors;
}

function buildFirstClickSafeZone(board: Board, row: number, col: number): Coord[] {
  return [{ row, col }, ...getLocalNeighbors(board, row, col)];
}

function createEmptyCell(): Cell {
  return {
    isMine: false,
    adjacentMines: 0,
    revealed: false,
    mark: 'none',
  };
}

function hash01(worldRow: number, col: number, seed: number): number {
  let t = (seed ^ Math.imul(worldRow, 374761393) ^ Math.imul(col, 668265263)) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

function createCellForWorld(
  worldRow: number,
  col: number,
  seed: number,
  scrollDepth: number,
): Cell {
  const cell = createEmptyCell();
  cell.isMine = isMineAt(worldRow, col, seed, scrollDepth);
  return cell;
}

function recomputeAdjacentInRange(board: Board, startRow: number, endRow: number): void {
  const from = Math.max(0, startRow);
  const to = Math.min(board.rows - 1, endRow);

  for (let row = from; row <= to; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!;
      if (cell.isMine) {
        cell.adjacentMines = 0;
        continue;
      }
      cell.adjacentMines = getLocalNeighbors(board, row, col).filter(
        ({ row: nr, col: nc }) => board.cells[nr]![nc]!.isMine,
      ).length;
    }
  }
}

/** 顶行插入后：新行与紧邻下一行的邻雷数需重算 */
function recomputeAfterPrepend(board: Board): void {
  if (board.rows === 0) return;
  recomputeAdjacentInRange(board, 0, Math.min(1, board.rows - 1));
}

/** 底行移除后：新底行邻接格变化，已翻开数字需同步 */
function recomputeAfterBottomRemove(board: Board): void {
  if (board.rows === 0) return;
  recomputeAdjacentInRange(board, board.rows - 1, board.rows - 1);
}

function recomputeAllAdjacent(board: Board): void {
  recomputeAdjacentInRange(board, 0, board.rows - 1);
}

function applyMinesFromSeed(board: Board, forbidden: Coord[] = []): void {
  const forbiddenKeys = new Set(forbidden.map(({ row, col }) => cellKey(row, col)));
  const seed = board.worldSeed!;

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!;
      if (forbiddenKeys.has(cellKey(row, col))) {
        cell.isMine = false;
      } else {
        cell.isMine = isMineAt(worldRowOf(board, row), col, seed, 0);
      }
    }
  }

  recomputeAllAdjacent(board);
  board.minesPlaced = true;
}

function createInitialBoard(seed: number): Board {
  const minRow = 0;
  const rows = ENDLESS_WINDOW_ROWS;
  const cells: Cell[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: ENDLESS_COLS }, (__, col) => createCellForWorld(minRow + row, col, seed, 0)),
  );

  return {
    rows,
    cols: ENDLESS_COLS,
    mineCount: -1,
    cells,
    minesPlaced: false,
    topology: 'endless',
    minRow,
    maxRow: minRow + rows - 1,
    worldSeed: seed,
  };
}

export function createEndlessSession(): ModeSession {
  const seed = (Date.now() ^ (Math.random() * 0x1_0000_0000)) >>> 0;
  const board = createInitialBoard(seed);

  return {
    modeId: 'endless',
    state: {
      status: 'idle',
      board,
      modeId: 'endless',
    },
    lives: ENDLESS_LIVES,
    endlessOriginMinRow: board.minRow!,
    endlessViewStart: visibleViewStart(board),
    scrollRowCount: 0,
    revealedCount: 0,
    minesDefused: 0,
    score: 0,
    defuseCombo: 0,
    pendingRevealKeys: [],
    defusedMineKeys: [],
    exemptScrollPenaltyKeys: [],
  };
}

/** 顶部追加一行新内容（密度随 scrollDepth 升高） */
function prependRow(board: Board, scrollDepth: number): Board {
  const newMinRow = board.minRow! - 1;
  const seed = board.worldSeed!;
  const newRow = Array.from({ length: board.cols }, (_, col) =>
    createCellForWorld(newMinRow, col, seed, scrollDepth),
  );

  const next = cloneBoard(board);
  next.cells = [newRow, ...next.cells.map((row) => row.map((cell) => ({ ...cell })))];
  next.minRow = newMinRow;
  next.rows = next.cells.length;
  next.maxRow = newMinRow + next.rows - 1;
  recomputeAfterPrepend(next);
  return next;
}

/** 未翻开且未插旗的格（纯空白） */
function isBlankCell(cell: Cell): boolean {
  return !cell.revealed && cell.mark === 'none';
}

function isRowAllBlank(board: Board, localRow: number): boolean {
  for (let col = 0; col < board.cols; col += 1) {
    if (!isBlankCell(board.cells[localRow]![col]!)) return false;
  }
  return true;
}

/** 从底向上剔除连续纯空白行，保留至少可见行数 */
function compactTrailingBlankRows(board: Board): Board {
  let next = board;
  while (next.rows > ENDLESS_VISIBLE_ROWS && isRowAllBlank(next, next.rows - 1)) {
    next = removeBottomRow(next);
  }
  return next;
}

function ensureWindowRows(board: Board, scrollDepth: number): Board {
  let next = board;
  while (next.rows < ENDLESS_WINDOW_ROWS) {
    next = prependRow(next, scrollDepth);
  }
  return next;
}

function compactAndBufferBoard(board: Board, scrollDepth: number): Board {
  return ensureWindowRows(compactTrailingBlankRows(board), scrollDepth);
}

/** 底行离屏：存在任意未处置格扣 1 生命（每轮最多 −1）；已翻开或已踩雷扣过命的不重复扣 */
function isBottomCellScrollExempt(
  session: ModeSession,
  board: Board,
  localRow: number,
  col: number,
): boolean {
  const cell = board.cells[localRow]![col]!;
  if (cell.revealed) return true;
  if (isScrollPenaltyExempt(session, board, localRow, col)) return true;
  return false;
}

function bottomRowCellPenalty(
  session: ModeSession,
  board: Board,
  localRow: number,
  col: number,
): number {
  if (isBottomCellScrollExempt(session, board, localRow, col)) return 0;
  const cell = board.cells[localRow]![col]!;
  if (cell.isMine) {
    return cell.mark === 'flag' ? 0 : 1;
  }
  if (cell.mark === 'flag') return 1;
  return 1;
}

function countBottomRowPenalty(session: ModeSession, board: Board, localRow: number): number {
  for (let col = 0; col < board.cols; col += 1) {
    if (bottomRowCellPenalty(session, board, localRow, col) > 0) return 1;
  }
  return 0;
}

/** 底行是否全为未翻开未插旗（离屏免扣血） */
export function isBottomRowBlank(board: Board): boolean {
  if (board.rows === 0) return false;
  return isRowAllBlank(board, board.rows - 1);
}

/** 与 endlessScrollTick 一致的底行扣血预判（含空白底行免扣） */
export function computeBottomRowScrollDamage(
  session: ModeSession,
  board: Board,
  localRow = board.rows - 1,
): number {
  if (localRow < 0 || localRow >= board.rows) return 0;
  if (isRowAllBlank(board, localRow)) return 0;
  return countBottomRowPenalty(session, board, localRow);
}

/** 一次卷轴事件内 N 行离屏：任一行有漏格则扣 1 命（不叠成 −N） */
export function computeBatchScrollDamage(
  session: ModeSession,
  board: Board,
  batchRows: number,
): number {
  const n = Math.max(1, Math.min(batchRows, board.rows));
  for (let i = 0; i < n; i += 1) {
    const localRow = board.rows - 1 - i;
    if (computeBottomRowScrollDamage(session, board, localRow) > 0) return 1;
  }
  return 0;
}

/** 当前底行上移是否不会扣命 */
export function isBottomRowScrollSafe(session: ModeSession): boolean {
  if (session.modeId !== 'endless' || session.state.status !== 'playing') return false;
  return computeBottomRowScrollDamage(session, session.state.board) === 0;
}

/** 批量上移前：即将离屏的 N 行均不会扣命 */
export function isBatchScrollSafe(session: ModeSession, batchRows: number): boolean {
  if (session.modeId !== 'endless' || session.state.status !== 'playing') return false;
  return computeBatchScrollDamage(session, session.state.board, batchRows) === 0;
}

function penaltyCellKind(
  session: ModeSession,
  board: Board,
  localRow: number,
  col: number,
): LifeLossCellKind | null {
  if (isBottomCellScrollExempt(session, board, localRow, col)) return null;
  const cell = board.cells[localRow]![col]!;
  if (cell.isMine) {
    return cell.mark === 'flag' ? null : 'mine-unflagged';
  }
  if (cell.mark === 'flag') return 'wrong-flag';
  return 'unrevealed';
}

function toScreenRow(localRow: number, viewStart: number): number {
  return localRow - viewStart;
}

function cellKindLabel(kind: LifeLossCellKind): string {
  switch (kind) {
    case 'mine-hit':
      return '踩雷';
    case 'mine-unflagged':
      return '雷未插旗';
    case 'wrong-flag':
      return '错旗';
    case 'unrevealed':
      return '未翻开';
  }
}

function buildScrollLifeLoss(
  session: ModeSession,
  board: Board,
  localRow: number,
  viewStart: number,
): LifeLossReport {
  const cells: LifeLossCell[] = [];
  for (let col = 0; col < board.cols; col += 1) {
    const kind = penaltyCellKind(session, board, localRow, col);
    if (!kind) continue;
    cells.push({
      localRow,
      col,
      screenRow: toScreenRow(localRow, viewStart),
      kind,
    });
  }
  const cellDesc = cells
    .map((c) => `(${c.screenRow},${c.col})${cellKindLabel(c.kind)}`)
    .join(' ');
  return {
    cause: 'scroll-bottom',
    damage: 1,
    cells,
    boardChange: '底行离屏移除 · 顶行已补 1 行',
    reason: `卷轴底行扣血（每轮最多 −1 命）· 漏格：${cellDesc}`,
  };
}

function applyLifeLoss(
  session: ModeSession,
  board: Board,
  damage: number,
  status: GameStatus = 'playing',
  lifeLoss?: LifeLossReport,
): ModeSession {
  const lives = (session.lives ?? ENDLESS_LIVES) - damage;
  if (lives <= 0) {
    revealAllMines(board);
    return {
      ...session,
      state: { ...session.state, board, status: 'lost' },
      lives: 0,
      lastLifeLoss: damage > 0 ? lifeLoss : undefined,
    };
  }
  return {
    ...session,
    state: { ...session.state, board, status },
    lives,
    lastLifeLoss: damage > 0 ? lifeLoss : undefined,
  };
}

function removeBottomRow(board: Board): Board {
  const next = cloneBoard(board);
  next.cells = next.cells.slice(0, -1).map((row) => row.map((cell) => ({ ...cell })));
  next.rows = next.cells.length;
  next.maxRow = next.minRow! + next.rows - 1;
  recomputeAfterBottomRemove(next);
  return next;
}

/** 卷轴离屏底行：全空白则免扣血并一并剔除后续空白行 */
function scrollOffBottomRow(session: ModeSession, board: Board): { board: Board; damage: number } {
  const bottomRow = board.rows - 1;
  if (isRowAllBlank(board, bottomRow)) {
    return { board: compactTrailingBlankRows(removeBottomRow(board)), damage: 0 };
  }
  return {
    board: removeBottomRow(board),
    damage: countBottomRowPenalty(session, board, bottomRow),
  };
}

interface RevealBounds {
  startRow: number;
  endRow: number;
}

function visibleBounds(board: Board): RevealBounds {
  const startRow = visibleViewStart(board);
  return {
    startRow,
    endRow: Math.min(board.rows, startRow + ENDLESS_VISIBLE_ROWS),
  };
}

function inRevealBounds(row: number, bounds?: RevealBounds): boolean {
  if (!bounds) return true;
  return row >= bounds.startRow && row < bounds.endRow;
}

function canAutoRevealCell(cell: Cell): boolean {
  return !cell.revealed && !isCellBlocked(cell) && !cell.isMine;
}

function prunePendingRevealKeys(board: Board, keys: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) continue;
    const parsed = parseWorldCellKey(k);
    if (!parsed) continue;
    const localRow = localRowFromWorld(board, parsed.worldRow);
    if (localRow === null || parsed.col < 0 || parsed.col >= board.cols) continue;
    const cell = board.cells[localRow]?.[parsed.col];
    if (!cell || cell.revealed || cell.isMine || isCellBlocked(cell)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function applyPendingReveals(
  board: Board,
  pendingKeys: Iterable<string>,
): { pendingRevealKeys: string[]; revealed: number } {
  const bounds = visibleBounds(board);
  const before = cloneBoard(board);
  const remaining: string[] = [];

  for (const k of prunePendingRevealKeys(board, pendingKeys)) {
    const parsed = parseWorldCellKey(k)!;
    const localRow = localRowFromWorld(board, parsed.worldRow);
    if (localRow === null) continue;
    if (!inRevealBounds(localRow, bounds)) {
      remaining.push(k);
      continue;
    }
    const cell = board.cells[localRow]?.[parsed.col];
    if (!cell || !canAutoRevealCell(cell)) continue;
    revealSingle(board, localRow, parsed.col, bounds);
  }

  return {
    pendingRevealKeys: prunePendingRevealKeys(board, remaining),
    revealed: countNewlyRevealed(before, board),
  };
}

function collectPendingRevealsFromVisibleTop(
  board: Board,
  pendingKeys: Iterable<string>,
): string[] {
  const bounds = visibleBounds(board);
  const minPendingRow = Math.max(0, bounds.startRow - ENDLESS_PENDING_REVEAL_LOOKAHEAD_ROWS);
  const pending = new Set(prunePendingRevealKeys(board, pendingKeys));
  const queued = new Set<string>();
  const queue: Coord[] = [];
  let added = 0;

  function enqueue(row: number, col: number): void {
    if (row < minPendingRow || row >= bounds.startRow || col < 0 || col >= board.cols) return;
    const cell = board.cells[row]?.[col];
    if (!cell || !canAutoRevealCell(cell)) return;
    const k = cellKey(row, col);
    if (queued.has(k)) return;
    queued.add(k);
    queue.push({ row, col });
  }

  for (let row = bounds.startRow; row < bounds.endRow; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]?.[col];
      if (!cell?.revealed || cell.isMine || cell.adjacentMines !== 0) continue;
      for (const nb of getLocalNeighbors(board, row, col)) {
        enqueue(nb.row, nb.col);
      }
    }
  }

  queue.sort((a, b) => b.row - a.row || a.col - b.col);

  while (queue.length > 0 && added < ENDLESS_PENDING_REVEAL_MAX_PER_SYNC) {
    const { row, col } = queue.shift()!;
    const cell = board.cells[row]?.[col];
    if (!cell || !canAutoRevealCell(cell)) continue;
    const k = worldCellKey(board, row, col);
    if (!pending.has(k)) {
      pending.add(k);
      added += 1;
    }
    if (cell.adjacentMines === 0) {
      for (const nb of getLocalNeighbors(board, row, col)) {
        enqueue(nb.row, nb.col);
      }
    }
  }

  return prunePendingRevealKeys(board, pending);
}

function syncPendingReveals(
  session: ModeSession,
  board: Board,
): { pendingRevealKeys: string[]; revealed: number } {
  const applied = applyPendingReveals(board, session.pendingRevealKeys ?? []);
  return {
    pendingRevealKeys: collectPendingRevealsFromVisibleTop(board, applied.pendingRevealKeys),
    revealed: applied.revealed,
  };
}

function finalizeBoard(
  session: ModeSession,
  board: Board,
  status?: GameStatus,
): { session: ModeSession; autoRevealed: number } {
  const compacted = compactAndBufferBoard(board, session.scrollRowCount ?? 0);
  recomputeAllAdjacent(compacted);
  const pending = syncPendingReveals(session, compacted);
  return {
    session: {
      ...session,
      state: {
        ...session.state,
        board: compacted,
        status: status ?? session.state.status,
      },
      endlessViewStart: visibleViewStart(compacted),
      pendingRevealKeys: pending.pendingRevealKeys,
    },
    autoRevealed: pending.revealed,
  };
}

interface SingleRowScrollResult {
  session: ModeSession;
  damage: number;
  lifeLoss?: LifeLossReport;
  autoRevealed: number;
}

/** 单行卷轴（不扣命，由批量层统一结算） */
function performSingleRowScroll(session: ModeSession): SingleRowScrollResult {
  const scrollRowCount = (session.scrollRowCount ?? 0) + 1;
  let board = prependRow(session.state.board, scrollRowCount);
  const viewStart = visibleViewStart(board);
  const bottomLocal = board.rows - 1;
  const damage = computeBottomRowScrollDamage(session, board, bottomLocal);
  const banked = damage === 0 ? applyMineDefuseOnRowScrollOff(session, board, bottomLocal) : null;
  const sessionAfterBank = banked ? { ...session, ...banked } : session;
  const lifeLoss =
    damage > 0 ? buildScrollLifeLoss(sessionAfterBank, board, bottomLocal, viewStart) : undefined;

  const { board: afterScroll } = scrollOffBottomRow(sessionAfterBank, board);
  board = compactAndBufferBoard(afterScroll, scrollRowCount);
  recomputeAllAdjacent(board);
  const pending = syncPendingReveals(sessionAfterBank, board);

  const nextSession: ModeSession = {
    ...sessionAfterBank,
    state: { ...sessionAfterBank.state, board, status: 'playing' },
    endlessViewStart: visibleViewStart(board),
    scrollRowCount,
    revealedCount: (session.revealedCount ?? 0) + pending.revealed,
    pendingRevealKeys: pending.pendingRevealKeys,
  };

  return { session: nextSession, damage, lifeLoss, autoRevealed: pending.revealed };
}

/**
 * 传送带批量 tick：每次事件上移 batchRows 行；整事件最多 −1 命。
 */
export function endlessScrollBatch(session: ModeSession, batchRows = 1): ModeSession {
  if (session.state.status !== 'playing') return session;

  const rows = Math.max(
    1,
    Math.min(ENDLESS_SCROLL_BATCH_MAX, Math.floor(batchRows)),
  );
  let current = session;
  let eventDamage = 0;
  let eventLifeLoss: LifeLossReport | undefined;

  for (let i = 0; i < rows; i += 1) {
    const step = performSingleRowScroll(current);
    current = step.session;
    if (step.damage > 0) {
      eventDamage = 1;
      eventLifeLoss = step.lifeLoss ?? eventLifeLoss;
    }
  }

  if (eventDamage > 0 && eventLifeLoss) {
    const afterBreak = clearDefuseStreakOnMistake(current);
    return applyLifeLoss(afterBreak, afterBreak.state.board, 1, 'playing', eventLifeLoss);
  }
  return current;
}

/** @alias endlessScrollBatch(session, 1) */
export function endlessScrollTick(session: ModeSession, batchRows = 1): ModeSession {
  return endlessScrollBatch(session, batchRows);
}

function floodReveal(
  board: Board,
  startRow: number,
  startCol: number,
  bounds?: RevealBounds,
): void {
  const queue: Coord[] = [{ row: startRow, col: startCol }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    if (!inRevealBounds(row, bounds)) continue;
    const key = cellKey(row, col);
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = board.cells[row]![col]!;
    if (isCellBlocked(cell) || cell.revealed) continue;

    cell.revealed = true;
    if (cell.isMine) continue;

    if (cell.adjacentMines === 0) {
      for (const neighbor of getLocalNeighbors(board, row, col)) {
        if (inRevealBounds(neighbor.row, bounds)) queue.push(neighbor);
      }
    }
  }
}

function revealSingle(
  board: Board,
  row: number,
  col: number,
  bounds?: RevealBounds,
): 'mine' | 'safe' {
  if (!inRevealBounds(row, bounds)) return 'safe';
  const cell = board.cells[row]![col]!;
  if (cell.revealed || isCellBlocked(cell)) return 'safe';

  if (cell.isMine) {
    cell.revealed = true;
    return 'mine';
  }

  if (cell.adjacentMines === 0) {
    floodReveal(board, row, col, bounds);
  } else {
    cell.revealed = true;
  }

  return 'safe';
}

function countNewlyRevealed(before: Board, after: Board): number {
  let count = 0;
  for (let row = 0; row < after.rows; row += 1) {
    for (let col = 0; col < after.cols; col += 1) {
      if (after.cells[row]![col]!.revealed && !before.cells[row]![col]!.revealed) {
        count += 1;
      }
    }
  }
  return count;
}

function visibleViewStart(board: Board): number {
  return Math.max(0, board.rows - ENDLESS_VISIBLE_ROWS);
}

function revealAllMines(board: Board): void {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row]![col]!;
      if (cell.isMine) cell.revealed = true;
    }
  }
}

export function endlessRevealAt(session: ModeSession, row: number, col: number): ModeSession {
  const { state } = session;
  if (!inLocalBounds(state.board, row, col)) return session;
  const cell = state.board.cells[row]?.[col];
  if (!cell) return session;
  if (state.status === 'lost') return session;
  if (isCellBlocked(cell) || cell.revealed) return session;

  const before = state.board;
  const board = cloneBoard(state.board);
  let status: GameStatus = state.status;
  const isFirstClick = !board.minesPlaced;

  if (isFirstClick) {
    applyMinesFromSeed(board, buildFirstClickSafeZone(board, row, col));
    status = 'playing';
  } else if (status === 'idle') {
    status = 'playing';
  }

  const bounds = visibleBounds(board);
  const outcome = revealSingle(board, row, col, bounds);
  if (isFirstClick && outcome === 'mine') {
    throw new Error('First click must not hit a mine');
  }

  if (outcome === 'mine') {
    const revealedDelta = countNewlyRevealed(before, board);
    const viewStart = session.endlessViewStart ?? visibleViewStart(before);
    const screenRow = toScreenRow(row, viewStart);
    const lifeLoss: LifeLossReport = {
      cause: 'mine-reveal',
      damage: 1,
      cells: [{ localRow: row, col, screenRow, kind: 'mine-hit' }],
      boardChange: `(${screenRow},${col}) 由隐藏变为翻开（雷）`,
      reason: '开格踩雷 · 该格为雷且未插旗',
    };
    const afterBreak = clearDefuseStreakOnMistake(
      recordMineHitScrollExempt(session, board, [{ row, col }]),
    );
    const afterHit = applyLifeLoss(
      afterBreak,
      board,
      1,
      status,
      lifeLoss,
    );
    return {
      ...afterHit,
      revealedCount: (session.revealedCount ?? 0) + revealedDelta,
    };
  }

  const revealedDelta = countNewlyRevealed(before, board);

  const finalized = finalizeBoard(session, board, status);
  return {
    ...finalized.session,
    revealedCount: (session.revealedCount ?? 0) + revealedDelta + finalized.autoRevealed,
  };
}

export function endlessChordAt(session: ModeSession, row: number, col: number): ModeSession {
  const { state } = session;
  if (state.status !== 'playing' || !state.board.minesPlaced) return session;

  const cell = state.board.cells[row]?.[col];
  if (!cell?.revealed || cell.isMine || cell.adjacentMines === 0) return session;

  const neighbors = getLocalNeighbors(state.board, row, col);
  const flaggedCount = neighbors.filter(
    ({ row: nr, col: nc }) => state.board.cells[nr]![nc]!.mark === 'flag',
  ).length;

  if (flaggedCount !== cell.adjacentMines) return session;

  const before = state.board;
  const board = cloneBoard(state.board);
  const viewStart = session.endlessViewStart ?? visibleViewStart(before);
  const bounds = visibleBounds(board);
  let mineHits = 0;
  const mineCells: LifeLossCell[] = [];

  for (const { row: nr, col: nc } of neighbors) {
    if (!inRevealBounds(nr, bounds)) continue;
    const neighbor = board.cells[nr]![nc]!;
    if (neighbor.mark !== 'none' || neighbor.revealed) continue;
    if (revealSingle(board, nr, nc, bounds) === 'mine') {
      mineHits += 1;
      mineCells.push({
        localRow: nr,
        col: nc,
        screenRow: toScreenRow(nr, viewStart),
        kind: 'mine-hit',
      });
    }
  }

  const revealedDelta = countNewlyRevealed(before, board);

  if (mineHits > 0) {
    const chordScreen = toScreenRow(row, viewStart);
    const opened = mineCells
      .map((c) => `(${c.screenRow},${c.col})`)
      .join(' ');
    const lifeLoss: LifeLossReport = {
      cause: 'chord-mine',
      damage: mineHits,
      cells: mineCells,
      boardChange: `Chord (${chordScreen},${col}) 展开 · 翻开雷：${opened}`,
      reason:
        mineHits === 1
          ? `Chord 踩雷 1 颗 · 邻格插旗数已达数字但含未标记雷`
          : `Chord 踩雷 ${mineHits} 颗 · 邻格含 ${mineHits} 颗未标记雷`,
    };
    const afterBreak = clearDefuseStreakOnMistake(
      recordMineHitScrollExempt(
        session,
        board,
        mineCells.map((c) => ({ row: c.localRow, col: c.col })),
      ),
    );
    const afterHit = applyLifeLoss(
      afterBreak,
      board,
      mineHits,
      'playing',
      lifeLoss,
    );
    return {
      ...afterHit,
      revealedCount: (session.revealedCount ?? 0) + revealedDelta,
    };
  }

  const finalized = finalizeBoard(session, board, 'playing');
  return {
    ...finalized.session,
    revealedCount: (session.revealedCount ?? 0) + revealedDelta + finalized.autoRevealed,
  };
}

export function endlessToggleMarkAt(session: ModeSession, row: number, col: number): ModeSession {
  const { state } = session;
  if (state.status !== 'playing' && state.status !== 'idle') return session;
  if (!inLocalBounds(state.board, row, col)) return session;

  const cell = state.board.cells[row]?.[col];
  if (!cell || cell.revealed) return session;

  const board = cloneBoard(state.board);
  const current = board.cells[row]![col]!;
  current.mark = current.mark === 'flag' ? 'none' : 'flag';

  return finalizeBoard(session, board).session;
}

export function toEndlessCellViews(session: ModeSession): CellView[] {
  const { state } = session;
  const gameOver = state.status === 'lost';
  const viewStart = session.endlessViewStart ?? 0;
  const viewEnd = Math.min(viewStart + ENDLESS_VISIBLE_ROWS, state.board.rows);
  const views: CellView[] = [];

  for (let row = viewStart; row < viewEnd; row += 1) {
    for (let col = 0; col < state.board.cols; col += 1) {
      const cell = state.board.cells[row]![col]!;
      const showMine = (cell.revealed && cell.isMine) || (gameOver && cell.isMine);

      views.push({
        row: row - viewStart,
        col,
        revealed: cell.revealed,
        flagged: cell.mark === 'flag',
        adjacentMines: cell.revealed && !cell.isMine ? cell.adjacentMines : null,
        isMine: showMine ? true : null,
      });
    }
  }

  return views;
}

/** 将屏幕行索引转为棋盘本地行 */
export function endlessScreenRowToLocal(session: ModeSession, screenRow: number): number {
  return (session.endlessViewStart ?? 0) + screenRow;
}

export function getEndlessDepth(session: ModeSession): number {
  return session.scrollRowCount ?? 0;
}

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

/** 双轨阶梯：偶数步升速度、奇数步升批量（各 50s 一档） */
export function getEndlessScrollProfile(elapsedMs: number): EndlessScrollProfile {
  const elapsed = Math.max(0, elapsedMs);
  const step = Math.floor(elapsed / SCROLL_STEP_MS);
  const speedTier = Math.min(
    SCROLL_INTERVAL_TIERS_MS.length - 1,
    Math.floor((step + 1) / 2),
  );
  const batchTier = Math.min(
    SCROLL_BATCH_TIERS.length - 1,
    Math.floor(step / 2),
  );
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

/** 卷轴倒数间隔（来自速度轨） */
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
    const nextBatch = SCROLL_BATCH_TIERS[
      Math.min(profile.batchTier + 1, SCROLL_BATCH_TIERS.length - 1)
    ]!;
    return `下一档 ${nextSec}s · 批量 → ×${nextBatch} 行`;
  }
  const nextInterval = SCROLL_INTERVAL_TIERS_MS[
    Math.min(profile.speedTier + 1, SCROLL_INTERVAL_TIERS_MS.length - 1)
  ]!;
  return `下一档 ${nextSec}s · 加速 → ${(nextInterval / 1000).toFixed(1)}s`;
}

/** @deprecated 仅兼容旧逻辑；卷轴倒数请用 getEndlessScrollIntervalMsFromElapsed */
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

/** 准备上移倒数（含进度条用的 0→1） */
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

export function getEndlessHudLeft(session: ModeSession): string {
  const lives = session.lives ?? 0;
  const max = ENDLESS_LIVES;
  return `${'♥'.repeat(lives)}${'♡'.repeat(Math.max(0, max - lives))}`;
}

/** 顶栏独立胶囊：消雷入账 + 距下次回血进度 */
export function getEndlessHudDefusedDisplay(session: ModeSession): string | undefined {
  return formatMinesDefusedHud(session.minesDefused ?? 0);
}

export function getEndlessHudExtra(session: ModeSession): string {
  const depth = getEndlessDepth(session);
  const revealed = session.revealedCount ?? 0;
  if (session.state.status === 'lost') {
    const defused = session.minesDefused ?? 0;
    return defused > 0
      ? `💀 高度 ↑${depth} · 已开 ${revealed} 格 · 消雷 ${defused}`
      : `💀 高度 ↑${depth} · 已开 ${revealed} 格`;
  }
  const defused = session.minesDefused ?? 0;
  const score = session.score ?? 0;
  const combo = session.defuseCombo ?? 0;
  const defusedNote = defused > 0 ? ` · 消雷 ${defused}（满 4 自动回血）` : '';
  const comboNote = combo > 0 ? ` · 连击 ×${combo}` : '';
  return `卷轴 ↑${depth} · 分 ${score}${comboNote} · 已开 ${revealed} 格${defusedNote} · 双轨交替：50s 升速度/批量 · 空格上移/自动回血`;
}
