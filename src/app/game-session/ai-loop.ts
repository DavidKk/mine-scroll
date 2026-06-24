import { applyAiMove, getAiAnalysis, MINES_PER_LIFE, toAiHintDisplay } from '../../core/modes/engine.ts';
import { aiPersistCellKey, isAiPersistBlocked } from '../../core/ai/ai-blocked.ts';
import { getEndlessAiStepMs } from '../../core/ai/solver.ts';
import type { ModeSession } from '../../core/types.ts';
import type { CanvasLogController, GameSessionRuntime, SessionApplyContext } from './types.ts';
import { formatCell, logAiMove } from './logging.ts';
import type { ScrollController } from './scroll.ts';

export interface AiControllerDeps {
  runtime: GameSessionRuntime;
  gameLog: CanvasLogController;
  scroll: ScrollController;
  applySession(next: ModeSession, beforeLives?: number, context?: SessionApplyContext): void;
  afterSessionChange(wasIdle?: boolean): void;
  render(): void;
}

export interface AiController {
  stopAiAuto(): void;
  scheduleAiStep(): void;
  refreshAiHint(): void;
  runAiStep(): boolean;
  toggleAiAuto(startArcadeRun: () => void): void;
}

export function createAiController(deps: AiControllerDeps): AiController {
  const { runtime, gameLog, scroll, applySession, afterSessionChange, render } = deps;

  function stopAiAuto(): void {
    runtime.aiAutoActive = false;
    runtime.aiHint = null;
    if (runtime.aiAutoId !== null) {
      window.clearTimeout(runtime.aiAutoId);
      runtime.aiAutoId = null;
    }
  }

  function refreshAiHint(): void {
    if (!runtime.aiAutoActive) {
      runtime.aiHint = null;
      return;
    }
    const analysis = getAiAnalysis(runtime.session, scroll.getElapsedMs());
    runtime.aiHint = toAiHintDisplay(runtime.session, analysis);
  }

  function scheduleAiStep(): void {
    if (!runtime.aiAutoActive) return;
    let delay = getEndlessAiStepMs(runtime.session, scroll.getElapsedMs());
    if (scroll.getScrollPressureState()?.urgent) delay = 0;
    runtime.aiAutoId = window.setTimeout(() => {
      runtime.aiAutoId = null;
      if (!runtime.aiAutoActive) return;
      if (!runAiStep()) {
        stopAiAuto();
        return;
      }
      scheduleAiStep();
    }, delay);
  }

  function runAiStep(): boolean {
    if (runtime.session.state.status === 'won' || runtime.session.state.status === 'lost') return false;
    const beforeLives = runtime.session.lives;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const analysis = getAiAnalysis(runtime.session, scroll.getElapsedMs());
      if (!analysis.move) {
        if (!runtime.aiWaitLogged && attempt === 0) {
          gameLog.append('AI waiting: no move available', 'ai');
          runtime.aiWaitLogged = true;
        }
        refreshAiHint();
        render();
        return true;
      }

      const move = analysis.move;

      if (move.kind === 'heal') {
        runtime.aiWaitLogged = false;
        const beforeMines = runtime.session.minesDefused ?? 0;
        logAiMove(gameLog, move, 0, 0);
        const next = applyAiMove(runtime.session, move);
        applySession(next, beforeLives);
        const afterMines = next.minesDefused ?? 0;
        if (afterMines < beforeMines) {
          gameLog.append(
            `−${MINES_PER_LIFE} defused · total ${afterMines} (${MINES_PER_LIFE}→1 life)`,
            'system',
          );
        }
        if ((next.lives ?? 0) > (beforeLives ?? 0)) {
          gameLog.append(`+1 life · now ${next.lives ?? 0} lives`, 'system');
        }
        afterSessionChange(false);
        return runtime.session.state.status === 'playing';
      }

      if (move.kind === 'scroll') {
        runtime.aiWaitLogged = false;
        logAiMove(gameLog, move, 0, 0);
        scroll.performScrollTick(true, move.reason);
        return runtime.session.state.status === 'playing';
      }

      const cellKeyStr = aiPersistCellKey(runtime.session.state.board, move.row, move.col);

      if (move.kind === 'flag' || move.kind === 'unflag') {
        if (isAiPersistBlocked(runtime.session, move.row, move.col)) {
          continue;
        }
        if (runtime.aiOscillationCell === cellKeyStr) {
          runtime.aiOscillationCount += 1;
        } else {
          runtime.aiOscillationCell = cellKeyStr;
          runtime.aiOscillationCount = 1;
        }
        if (runtime.aiOscillationCount >= 3) {
          const blocked = new Set(runtime.session.aiOscillationBlocked ?? []);
          if (!blocked.has(cellKeyStr)) {
            blocked.add(cellKeyStr);
            runtime.session = { ...runtime.session, aiOscillationBlocked: [...blocked] };
            const screenRow = move.row - (runtime.session.endlessViewStart ?? 0);
            gameLog.append(`AI skip oscillation cell ${formatCell(screenRow, move.col)} · trying another move`, 'ai');
          }
          runtime.aiOscillationCell = null;
          runtime.aiOscillationCount = 0;
          continue;
        }
      } else {
        runtime.aiOscillationCell = null;
        runtime.aiOscillationCount = 0;
      }

      runtime.aiWaitLogged = false;
      const wasIdle = runtime.session.state.status === 'idle';
      const screenRow = move.row - (runtime.session.endlessViewStart ?? 0);
      logAiMove(gameLog, move, screenRow, move.col);
      const triggerPrefix = move.confidence === 'guess' ? 'guess ' : '';
      const triggerKind =
        move.kind === 'chord'
          ? 'Chord'
          : move.kind === 'flag'
            ? 'flag'
            : move.kind === 'unflag'
              ? 'unflag'
              : 'reveal';
      const trigger = `AI ${triggerPrefix}${triggerKind} ${formatCell(screenRow, move.col)} · ${move.reason}`;
      let next = applyAiMove(runtime.session, move);
      if (move.kind === 'unflag' && (move.reason.includes('contradiction') || move.reason.includes('wrong flag'))) {
        const k = aiPersistCellKey(next.state.board, move.row, move.col);
        const contradicted = new Set(next.aiContradictedFlags ?? []);
        contradicted.add(k);
        next = { ...next, aiContradictedFlags: [...contradicted] };
      }
      applySession(next, beforeLives, { trigger });
      afterSessionChange(wasIdle);
      return runtime.session.state.status === 'playing' || runtime.session.state.status === 'idle';
    }

    refreshAiHint();
    render();
    return true;
  }

  function toggleAiAuto(startArcadeRun: () => void): void {
    if (runtime.aiAutoActive) {
      stopAiAuto();
      gameLog.append('AI auto stopped', 'ai');
      render();
      return;
    }
    runtime.aiAutoActive = true;
    runtime.aiWaitLogged = false;
    gameLog.append('AI auto started', 'ai');
    if (runtime.session.state.status === 'idle') {
      startArcadeRun();
    }
    scheduleAiStep();
    render();
  }

  return {
    stopAiAuto,
    scheduleAiStep,
    refreshAiHint,
    runAiStep,
    toggleAiAuto,
  };
}
