import {
  canExchangeHeal,
  getMinesDefused,
  MINES_PER_LIFE,
} from '../mines-defused.ts';
import { ENDLESS_LIVES } from '../modes/endless/index.ts';
import type { ModeSession } from '../types.ts';
import type { AiMove } from './types.ts';

export function createHealMove(reason: string): AiMove {
  return {
    kind: 'heal',
    row: -1,
    col: -1,
    confidence: 'certain',
    reason,
  };
}

/** Bottom-row urgent certain moves: heal / scroll must not preempt. */
export function isUrgentBottomRowCertain(move: AiMove | null): boolean {
  if (!move || move.confidence !== 'certain') return false;
  if (move.kind === 'flag' || move.kind === 'reveal') {
    return move.reason.includes('bottom row');
  }
  if (move.kind === 'chord') {
    return move.reason.includes('bottom row');
  }
  return false;
}

function isRiskyMove(move: AiMove | null): boolean {
  if (!move) return true;
  if (move.confidence === 'guess') return true;
  return move.kind === 'reveal' && move.reason.includes('prob');
}

export { isRiskyMove };

/**
 * Endless AI heal: when defused mines ≥ 4 and not full lives, prefer over guesses;
 * yields to urgent bottom-row certain moves.
 */
export function pickHealMove(session: ModeSession, tactical: AiMove | null): AiMove | null {
  if (session.modeId !== 'endless' || !canExchangeHeal(session)) return null;

  const lives = session.lives ?? ENDLESS_LIVES;
  const bank = getMinesDefused(session);

  if (isUrgentBottomRowCertain(tactical)) return null;

  if (lives <= 2) {
    return createHealMove(`Lives ${lives} · trade ${bank} defused for +1 life`);
  }

  if (lives === 3 && isRiskyMove(tactical)) {
    return createHealMove(`Lives 3 · heal early with ${bank} defused`);
  }

  if (lives === 4) {
    if (isRiskyMove(tactical)) {
      return createHealMove(`Defused ${bank} · trade for +1 life (4→5)`);
    }
    if (bank >= MINES_PER_LIFE * 2) {
      return createHealMove(`Defused ${bank} banked · trade for +1 life`);
    }
  }

  return null;
}
