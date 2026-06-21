export type CellMark = 'none' | 'flag';

export interface Cell {
  isMine: boolean;
  adjacentMines: number;
  revealed: boolean;
  mark: CellMark;
  /** 六边形盘外的占位格，不参与玩法 */
  inactive?: boolean;
}

export interface Board {
  rows: number;
  cols: number;
  mineCount: number;
  cells: Cell[][];
  minesPlaced: boolean;
  topology?: 'square' | 'hex' | 'endless';
  hexRadius?: number;
  /** endless：cells[0] 对应的世界行号 */
  minRow?: number;
  maxRow?: number;
  worldSeed?: number;
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export type GameModeId = 'classic' | 'hex' | 'endless';

export interface GameState {
  status: GameStatus;
  board: Board;
  modeId: GameModeId;
}

/** 无尽模式单次扣命说明（由 core 写入，UI 消费后清除） */
export type LifeLossCause = 'mine-reveal' | 'chord-mine' | 'scroll-bottom';

export type LifeLossCellKind = 'mine-hit' | 'mine-unflagged' | 'wrong-flag' | 'unrevealed';

export interface LifeLossCell {
  localRow: number;
  col: number;
  /** 扣命瞬间的屏幕行号（无尽模式） */
  screenRow: number;
  kind: LifeLossCellKind;
}

export interface LifeLossReport {
  cause: LifeLossCause;
  damage: number;
  cells: LifeLossCell[];
  /** 盘面变化摘要 */
  boardChange: string;
  /** 扣命规则说明 */
  reason: string;
}

export interface AutoHealReport {
  defusedAdded: number;
  groupsSpent: number;
  livesGained: number;
  minesBefore: number;
  minesAfter: number;
  livesBefore: number;
  livesAfter: number;
  scoreAdded: number;
  comboBefore: number;
  comboAfter: number;
}

export interface DefuseScoreReport {
  defusedAdded: number;
  scoreAdded: number;
  scoreAfter: number;
  comboBefore: number;
  comboAfter: number;
}

export interface DefuseBreakReport {
  minesCleared: number;
  comboCleared: number;
}

export interface Difficulty {
  id: string;
  rows: number;
  cols: number;
  mines: number;
}

export interface CellView {
  row: number;
  col: number;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number | null;
  isMine: boolean | null;
}

export interface ModeSession {
  modeId: GameModeId;
  state: GameState;
  /** endless：开局时的 minRow */
  endlessOriginMinRow?: number;
  /** endless：视窗顶行在 cells 中的索引 */
  endlessViewStart?: number;
  /** endless：卷轴已上移行数 */
  scrollRowCount?: number;
  /** endless：剩余生命 */
  lives?: number;
  /** endless：累计翻开的格数 */
  revealedCount?: number;
  /** 已入账消雷数（底行离屏的正确雷旗；4 颗可换 1 命） */
  minesDefused?: number;
  /** 无尽：总积分 */
  score?: number;
  /** 无尽：连续无错消雷连击数 */
  defuseCombo?: number;
  /** 无尽：屏幕外预展开安全格，进入可见区后才真正翻开 */
  pendingRevealKeys?: string[];
  /** 已计入消雷的雷格键（防重复计数） */
  defusedMineKeys?: string[];
  /** 已踩雷扣过命的世界格键（卷轴离屏不再重复扣血） */
  exemptScrollPenaltyKeys?: string[];
  /** AI 插旗/撤旗死循环格（cellKey），不再自动插/撤 */
  aiOscillationBlocked?: string[];
  /** 矛盾旗纠正后暂不再插/猜的格（cellKey） */
  aiContradictedFlags?: string[];
  /** 最近一次扣命详情（日志用，消费后清除） */
  lastLifeLoss?: LifeLossReport;
  /** 最近一次自动回血结算（日志用，消费后清除） */
  lastAutoHeal?: AutoHealReport;
  /** 最近一次消雷计分（日志用，消费后清除） */
  lastDefuseScore?: DefuseScoreReport;
  /** 最近一次失误清空消雷连击（日志用，消费后清除） */
  lastDefuseBreak?: DefuseBreakReport;
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function isCellBlocked(cell: Cell): boolean {
  return cell.mark !== 'none';
}
