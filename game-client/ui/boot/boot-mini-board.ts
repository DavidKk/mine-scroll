import { THEME } from '../theme.ts'

const GRID_SIZE = 3
const MINE_POSITIONS = new Set([1, 7])

const NUMBER_COLORS = THEME.numbers

type CellState = 'hidden' | 'revealed' | 'mine'

function indexAt(row: number, col: number): number {
  return row * GRID_SIZE + col
}

function neighbors(index: number): number[] {
  const row = Math.floor(index / GRID_SIZE)
  const col = index % GRID_SIZE
  const result: number[] = []
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue
      result.push(indexAt(nr, nc))
    }
  }
  return result
}

function adjacentMineCount(index: number): number {
  if (MINE_POSITIONS.has(index)) return 0
  return neighbors(index).filter((n) => MINE_POSITIONS.has(n)).length
}

function clearCellClasses(cell: HTMLElement): void {
  cell.classList.remove('boot-screen__cell--scan', 'boot-screen__cell--revealed', 'boot-screen__cell--mine', 'boot-screen__cell--zero', 'boot-screen__cell--pressed')
  for (let n = 1; n <= 8; n += 1) {
    cell.classList.remove(`boot-screen__cell--num-${n}`)
  }
  cell.removeAttribute('data-num')
  cell.textContent = ''
}

function renderCell(cell: HTMLElement, index: number, state: CellState): void {
  clearCellClasses(cell)
  if (state === 'hidden') return

  if (state === 'mine' || MINE_POSITIONS.has(index)) {
    cell.classList.add('boot-screen__cell--revealed', 'boot-screen__cell--mine')
    cell.textContent = '✦'
    cell.setAttribute('aria-label', 'Mine')
    return
  }

  const count = adjacentMineCount(index)
  cell.classList.add('boot-screen__cell--revealed')
  if (count === 0) {
    cell.classList.add('boot-screen__cell--zero')
    cell.setAttribute('aria-label', 'Empty')
    return
  }

  cell.classList.add(`boot-screen__cell--num-${count}`)
  cell.setAttribute('data-num', String(count))
  cell.textContent = String(count)
  cell.style.color = NUMBER_COLORS[count] ?? '#fafafa'
  cell.setAttribute('aria-label', `${count} adjacent mines`)
}

export function attachBootMiniBoard(cells: HTMLElement[], options: { onFirstInteract?: () => void } = {}): () => void {
  if (cells.length !== GRID_SIZE * GRID_SIZE) return () => {}

  const states: CellState[] = Array.from({ length: cells.length }, () => 'hidden')
  let interacted = false
  let resetTimer = 0
  let locked = false

  const noteInteract = () => {
    if (interacted) return
    interacted = true
    options.onFirstInteract?.()
  }

  const resetBoard = () => {
    locked = false
    states.fill('hidden')
    cells.forEach((cell) => {
      clearCellClasses(cell)
      cell.setAttribute('aria-label', 'Hidden cell')
    })
  }

  const revealAllMines = () => {
    cells.forEach((cell, index) => {
      if (MINE_POSITIONS.has(index)) renderCell(cell, index, 'mine')
    })
  }

  const floodReveal = (start: number) => {
    const queue = [start]
    const visited = new Set<number>()

    while (queue.length > 0) {
      const index = queue.shift()!
      if (visited.has(index) || MINE_POSITIONS.has(index)) continue
      visited.add(index)

      const count = adjacentMineCount(index)
      states[index] = 'revealed'
      renderCell(cells[index]!, index, 'revealed')

      if (count === 0) {
        neighbors(index).forEach((n) => {
          if (!visited.has(n) && states[n] === 'hidden') queue.push(n)
        })
      }
    }
  }

  const revealAt = (index: number) => {
    if (locked || states[index] === 'revealed') return

    noteInteract()

    if (MINE_POSITIONS.has(index)) {
      locked = true
      states[index] = 'mine'
      renderCell(cells[index]!, index, 'mine')
      cells[index]?.classList.add('boot-screen__cell--hit')
      cells[index]?.closest('.boot-screen__grid-wrap')?.classList.add('boot-screen__grid-wrap--shake')
      revealAllMines()
      window.clearTimeout(resetTimer)
      resetTimer = window.setTimeout(() => {
        cells.forEach((cell) => cell.classList.remove('boot-screen__cell--hit'))
        cells[index]?.closest('.boot-screen__grid-wrap')?.classList.remove('boot-screen__grid-wrap--shake')
        resetBoard()
      }, 900)
      return
    }

    floodReveal(index)
  }

  const handlers = cells.map((cell, index) => {
    cell.setAttribute('aria-label', 'Hidden cell')

    const onPointerDown = () => {
      if (states[index] === 'hidden' && !locked) cell.classList.add('boot-screen__cell--pressed')
    }
    const onPointerUp = () => cell.classList.remove('boot-screen__cell--pressed')
    const onClick = () => revealAt(index)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        revealAt(index)
      }
    }

    cell.addEventListener('pointerdown', onPointerDown)
    cell.addEventListener('pointerup', onPointerUp)
    cell.addEventListener('pointerleave', onPointerUp)
    cell.addEventListener('click', onClick)
    cell.addEventListener('keydown', onKeyDown)

    return () => {
      cell.removeEventListener('pointerdown', onPointerDown)
      cell.removeEventListener('pointerup', onPointerUp)
      cell.removeEventListener('pointerleave', onPointerUp)
      cell.removeEventListener('click', onClick)
      cell.removeEventListener('keydown', onKeyDown)
    }
  })

  return () => {
    window.clearTimeout(resetTimer)
    handlers.forEach((off) => off())
  }
}
