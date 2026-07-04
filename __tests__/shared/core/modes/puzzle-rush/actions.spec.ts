import { isBoardCleared } from '@shared/core/modes/puzzle-rush/board.ts'
import {
  CLEAN_BOARDS_HEAL_EVERY,
  createPuzzleRushSession,
  PUZZLE_LIVES,
  puzzleRushBeginRun,
  puzzleRushCommitNextBoard,
  puzzleRushRevealAt,
} from '@shared/core/modes/puzzle-rush/index.ts'
import type { PuzzleRushSession } from '@shared/core/modes/puzzle-rush/types.ts'

function withOneCellLeft(session: PuzzleRushSession, row = 6, col = 6): PuzzleRushSession {
  return {
    ...session,
    state: {
      ...session.state,
      board: {
        ...session.state.board,
        minesPlaced: true,
        cells: session.state.board.cells.map((boardRow, r) =>
          boardRow.map((cell, c) => ({
            ...cell,
            isMine: false,
            revealed: !(r === row && c === col),
            adjacentMines: 0,
          }))
        ),
      },
    },
  }
}

function clearBoard(session: PuzzleRushSession, row = 6, col = 6): PuzzleRushSession {
  return puzzleRushRevealAt(withOneCellLeft(session, row, col), row, col)
}

function advanceToNextBoard(session: PuzzleRushSession): PuzzleRushSession {
  const cleared = clearBoard(session)
  const committed = puzzleRushCommitNextBoard(cleared)
  return puzzleRushRevealAt(committed, 3, 3)
}

describe('puzzle-rush', () => {
  it('creates a 7×7 board with 8 mines', () => {
    const session = createPuzzleRushSession(42)
    expect(session.state.board.rows).toBe(7)
    expect(session.state.board.cols).toBe(7)
    expect(session.state.board.mineCount).toBe(8)
    expect(session.lives).toBe(3)
    expect(session.streak).toBe(0)
  })

  it('first reveal is safe and places mines', () => {
    const session = puzzleRushBeginRun(createPuzzleRushSession(99))
    const next = puzzleRushRevealAt(session, 3, 3)
    expect(next.state.board.minesPlaced).toBe(true)
    expect(next.lives).toBe(3)
    const cell = next.state.board.cells[3]![3]!
    expect(cell.revealed).toBe(true)
    expect(cell.isMine).toBe(false)
  })

  it('first reveal on every cell never hits a mine or loses a life', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      for (let row = 0; row < 7; row += 1) {
        for (let col = 0; col < 7; col += 1) {
          const session = puzzleRushBeginRun(createPuzzleRushSession(seed))
          const next = puzzleRushRevealAt(session, row, col)
          expect(next.lives).toBe(3)
          expect(next.state.board.cells[row]![col]!.isMine).toBe(false)
          for (let r = 0; r < 7; r += 1) {
            for (let c = 0; c < 7; c += 1) {
              const cell = next.state.board.cells[r]![c]!
              if (cell.isMine) expect(cell.revealed).toBe(false)
            }
          }
        }
      }
    }
  })

  it('first reveal on a new board after clear is safe', () => {
    let session = puzzleRushBeginRun(createPuzzleRushSession(4242))
    session = puzzleRushRevealAt(session, 3, 3)
    session = {
      ...session,
      state: {
        ...session.state,
        board: {
          ...session.state.board,
          minesPlaced: true,
          cells: session.state.board.cells.map((row, r) =>
            row.map((cell, c) => ({
              ...cell,
              isMine: false,
              revealed: !(r === 6 && c === 6),
              adjacentMines: 0,
            }))
          ),
        },
      },
    }
    const cleared = puzzleRushRevealAt(session, 6, 6)
    expect(cleared.pendingNextSeed).toBeDefined()
    const committed = puzzleRushCommitNextBoard(cleared)
    expect(committed.state.board.minesPlaced).toBe(false)
    const firstOnNewBoard = puzzleRushRevealAt(committed, 1, 5)
    expect(firstOnNewBoard.lives).toBe(committed.lives)
    expect(firstOnNewBoard.state.board.cells[1]![5]!.isMine).toBe(false)
  })

  it('advances streak and score when board is cleared', () => {
    let session = puzzleRushBeginRun(createPuzzleRushSession(12345))
    session = {
      ...session,
      state: {
        ...session.state,
        board: {
          ...session.state.board,
          minesPlaced: true,
          cells: session.state.board.cells.map((row, r) =>
            row.map((cell, c) => ({
              ...cell,
              isMine: false,
              revealed: !(r === 6 && c === 6),
              adjacentMines: 0,
            }))
          ),
        },
      },
    }
    expect(isBoardCleared(session.state.board)).toBe(false)
    const next = puzzleRushRevealAt(session, 6, 6)
    expect(next.streak).toBe(1)
    expect(next.score).toBeGreaterThan(0)
    expect(next.boardIndex).toBe(1)
    expect(next.pendingNextSeed).toBeDefined()
    expect(next.state.board.minesPlaced).toBe(true)
    const committed = puzzleRushCommitNextBoard(next)
    expect(committed.pendingNextSeed).toBeUndefined()
    expect(committed.state.board.minesPlaced).toBe(false)
  })

  it('grants +1 life after 4 consecutive boards with no life lost', () => {
    let session = puzzleRushBeginRun(createPuzzleRushSession(9001))
    session = puzzleRushRevealAt(session, 3, 3)
    session = { ...session, lives: 1, livesAtBoardStart: 1 }

    for (let i = 0; i < CLEAN_BOARDS_HEAL_EVERY - 1; i += 1) {
      const cleared = advanceToNextBoard(session)
      expect(cleared.lives).toBe(1)
      expect(cleared.cleanBoards).toBe(i + 1)
      expect(cleared.lastBoardClear?.livesGained).toBeUndefined()
      session = cleared
    }

    const healed = clearBoard(session)
    expect(healed.cleanBoards).toBe(0)
    expect(healed.lives).toBe(2)
    expect(healed.lastBoardClear?.livesGained).toBe(1)
    expect(healed.lastBoardClear?.livesAfter).toBe(2)
  })

  it('does not heal after 3 clean boards', () => {
    let session = puzzleRushBeginRun(createPuzzleRushSession(9003))
    session = puzzleRushRevealAt(session, 3, 3)

    for (let i = 0; i < 3; i += 1) {
      session = advanceToNextBoard(session)
    }

    expect(session.cleanBoards).toBe(3)
    expect(session.lives).toBe(PUZZLE_LIVES)
  })

  it('does not overheal above max lives on clean-board milestone', () => {
    let session = puzzleRushBeginRun(createPuzzleRushSession(9002))
    session = puzzleRushRevealAt(session, 3, 3)

    for (let i = 0; i < CLEAN_BOARDS_HEAL_EVERY - 1; i += 1) {
      session = advanceToNextBoard(session)
    }

    const atFull = clearBoard(session)
    expect(atFull.lives).toBe(PUZZLE_LIVES)
    expect(atFull.cleanBoards).toBe(0)
    expect(atFull.lastBoardClear?.livesGained).toBeUndefined()
  })

  it('resets clean-board progress when life is lost', () => {
    let session = puzzleRushBeginRun(createPuzzleRushSession(777))
    session = puzzleRushRevealAt(session, 0, 0)
    session = { ...session, cleanBoards: 2 }

    const board = session.state.board
    let mineRow = -1
    let mineCol = -1
    for (let r = 0; r < board.rows; r += 1) {
      for (let c = 0; c < board.cols; c += 1) {
        if (board.cells[r]![c]!.isMine && !board.cells[r]![c]!.revealed) {
          mineRow = r
          mineCol = c
        }
      }
    }
    if (mineRow < 0) return
    const hit = puzzleRushRevealAt(session, mineRow, mineCol)
    expect(hit.lives).toBe(2)
    expect(hit.streak).toBe(0)
    expect(hit.cleanBoards).toBe(0)
    expect(hit.state.status).toBe('playing')
  })

  it('does not count a board toward clean streak if life was lost on that board', () => {
    let session = puzzleRushBeginRun(createPuzzleRushSession(888))
    session = puzzleRushRevealAt(session, 0, 0)
    session = { ...session, cleanBoards: 2 }

    const board = session.state.board
    let mineRow = -1
    let mineCol = -1
    for (let r = 0; r < board.rows; r += 1) {
      for (let c = 0; c < board.cols; c += 1) {
        if (board.cells[r]![c]!.isMine && !board.cells[r]![c]!.revealed) {
          mineRow = r
          mineCol = c
        }
      }
    }
    if (mineRow < 0) return

    session = puzzleRushRevealAt(session, mineRow, mineCol)
    expect(session.lives).toBe(2)
    expect(session.cleanBoards).toBe(0)

    const cleared = clearBoard(session)
    expect(cleared.cleanBoards).toBe(0)
    expect(cleared.lives).toBe(2)
  })
})
