import {
  canExchangeHeal,
  getMinesDefused,
  MINES_PER_LIFE,
} from '../mines-defused.ts';
import { ENDLESS_LIVES } from '../modes/endless.ts';
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

/** 底行临期确定步：回血 / 上移不应抢占 */
export function isUrgentBottomRowCertain(move: AiMove | null): boolean {
  if (!move || move.confidence !== 'certain') return false;
  if (move.kind === 'flag' || move.kind === 'reveal') {
    return move.reason.includes('底行');
  }
  if (move.kind === 'chord') {
    return move.reason.includes('底行');
  }
  return false;
}

function isRiskyMove(move: AiMove | null): boolean {
  if (!move) return true;
  if (move.confidence === 'guess') return true;
  return move.kind === 'reveal' && move.reason.includes('概率');
}

export { isRiskyMove };

/**
 * 无尽 AI 回血：消雷 ≥4 且未满命时，优先于猜格/空等；让位于底行确定步。
 */
export function pickHealMove(session: ModeSession, tactical: AiMove | null): AiMove | null {
  if (session.modeId !== 'endless' || !canExchangeHeal(session)) return null;

  const lives = session.lives ?? ENDLESS_LIVES;
  const bank = getMinesDefused(session);

  if (isUrgentBottomRowCertain(tactical)) return null;

  if (lives <= 2) {
    return createHealMove(`命数 ${lives} · 消雷 ${bank} 换 1 命`);
  }

  if (lives === 3 && isRiskyMove(tactical)) {
    return createHealMove(`命数 3 · 消雷 ${bank} 先回血`);
  }

  if (lives === 4) {
    if (isRiskyMove(tactical)) {
      return createHealMove(`消雷 ${bank} · 换 1 命（4→5）`);
    }
    if (bank >= MINES_PER_LIFE * 2) {
      return createHealMove(`消雷 ${bank} 充足 · 换 1 命`);
    }
  }

  return null;
}
