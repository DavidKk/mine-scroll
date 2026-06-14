export interface Cell {
  isMine: boolean;
  adjacentMines: number;
  revealed: boolean;
  flagged: boolean;
}

export interface Board {
  rows: number;
  cols: number;
  mineCount: number;
  cells: Cell[][];
  minesPlaced: boolean;
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface GameState {
  status: GameStatus;
  board: Board;
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
