import { endlessBeginRun, endlessScreenRowToLocal, sessionVisibleRows } from '@shared/core/modes/endless/index.ts'
import { revealAt } from '@shared/core/modes/engine.ts'
import type { ModeSession } from '@shared/core/types.ts'

import { cheatRevealBottomHalfOpen } from './board.ts'

export function createScriptedOpeningSession(base: ModeSession): ModeSession {
  let session = endlessBeginRun(base)
  const visibleRows = sessionVisibleRows(session)
  const seedScreenRow = Math.max(Math.floor(visibleRows / 2), visibleRows - 3)
  const seedCol = 4
  session = revealAt(session, endlessScreenRowToLocal(session, seedScreenRow), seedCol)
  session = cheatRevealBottomHalfOpen(session)
  return {
    ...session,
    score: 1_420,
    scrollRowCount: 9,
    minesDefused: 1,
    defuseCombo: 2,
    lives: 5,
  }
}
