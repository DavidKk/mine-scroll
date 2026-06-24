export type AiMoveKind = 'reveal' | 'flag' | 'chord' | 'unflag' | 'heal' | 'scroll';

export type AiConfidence = 'certain' | 'guess';

export interface AiCoord {
  row: number;
  col: number;
}

export interface AiMove {
  kind: AiMoveKind;
  row: number;
  col: number;
  confidence: AiConfidence;
  reason: string;
  /** scroll: rows moved per tick (current batch tier) */
  batchRows?: number;
}

export interface AiAnalysis {
  safe: AiCoord[];
  mines: AiCoord[];
  chords: AiCoord[];
  move: AiMove | null;
}

export interface AiHintDisplay {
  row: number;
  col: number;
  kind: AiMoveKind;
  confidence: AiConfidence;
}
