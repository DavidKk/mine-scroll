import { wrapWithCustomScrollbar } from '../../ui/custom-scrollbar.ts'
import type { GameCanvasLogLine } from '../../ui/game-canvas/index.ts'
import { createHeroicon } from '../../ui/heroicons.ts'

const KIND_LABEL: Record<GameCanvasLogLine['kind'], string> = {
  ai: 'AI',
  player: 'PLY',
  scroll: 'SCR',
  danger: 'DMG',
  system: 'SYS',
}

export interface GameLogPanel {
  setOpen(open: boolean): void
  isOpen(): boolean
  sync(lines: GameCanvasLogLine[]): void
  dispose(): void
}

export interface GameLogPanelOptions {
  onClear: () => void
  onClose: () => void
}

export function createGameLogPanel(host: HTMLElement, options: GameLogPanelOptions): GameLogPanel {
  const shell = document.createElement('div')
  shell.className = 'game-log-modal'
  shell.hidden = true
  shell.innerHTML = `
    <div class="game-log-modal__backdrop" data-close="true" aria-hidden="true"></div>
    <div class="game-log-modal__panel" role="dialog" aria-modal="true" aria-labelledby="game-log-modal-title" tabindex="-1">
      <div class="game-log-modal__glow" aria-hidden="true"></div>
      <div class="game-log-modal__frame" aria-hidden="true"></div>
      <header class="game-log-modal__head">
        <div class="game-log-modal__brand">
          <span class="game-log-modal__mark" aria-hidden="true">◈</span>
          <div class="game-log-modal__titles">
            <h2 id="game-log-modal-title" class="game-log-modal__title">Operation Log</h2>
            <p class="game-log-modal__subtitle">Gameplay operations</p>
          </div>
        </div>
        <div class="game-log-modal__actions">
          <button type="button" class="game-log-modal__btn game-log-modal__btn--ghost game-log-modal__btn--icon" data-action="clear" aria-label="Clear log"></button>
          <button type="button" class="game-log-modal__btn game-log-modal__btn--icon" data-action="close" aria-label="Close log"></button>
        </div>
      </header>
      <div class="game-log-modal__body">
        <ol class="game-log-modal__list"></ol>
        <p class="game-log-modal__empty" hidden>No operations yet. Play a round to populate the log.</p>
      </div>
      <footer class="game-log-modal__foot">
        <span><kbd>\`</kbd> toggle</span>
        <span><kbd>Esc</kbd> close</span>
      </footer>
    </div>
  `

  const list = shell.querySelector<HTMLOListElement>('.game-log-modal__list')!
  const empty = shell.querySelector<HTMLElement>('.game-log-modal__empty')!

  shell.querySelector<HTMLButtonElement>('[data-action="clear"]')?.append(createHeroicon('trash', 'game-log-modal__icon'))
  shell.querySelector<HTMLButtonElement>('[data-action="close"]')?.append(createHeroicon('x-mark', 'game-log-modal__icon'))

  function close(): void {
    options.onClose()
  }

  shell.querySelector('[data-action="close"]')?.addEventListener('click', close)
  shell.querySelector('[data-action="clear"]')?.addEventListener('click', () => options.onClear())
  shell.querySelector('.game-log-modal__backdrop')?.addEventListener('click', close)

  host.append(shell)

  const disposeScroll = wrapWithCustomScrollbar(list, 'scroll-host scroll-host--game-log')

  let open = false

  function renderLines(lines: GameCanvasLogLine[]): void {
    list.replaceChildren()
    empty.hidden = lines.length > 0

    for (const line of lines) {
      const item = document.createElement('li')
      item.className = `game-log-modal__entry game-log-modal__entry--${line.kind}`

      const time = document.createElement('span')
      time.className = 'game-log-modal__time'
      time.textContent = line.time

      const badge = document.createElement('span')
      badge.className = 'game-log-modal__badge'
      badge.textContent = KIND_LABEL[line.kind]

      const text = document.createElement('span')
      text.className = 'game-log-modal__text'
      text.textContent = line.text

      item.append(time, badge, text)
      list.append(item)
    }

    if (open) {
      list.scrollTop = list.scrollHeight
    }
  }

  return {
    setOpen(next) {
      open = next
      shell.hidden = !next
      host.classList.toggle('app--log-open', next)
      if (next) {
        list.scrollTop = list.scrollHeight
        shell.querySelector<HTMLElement>('.game-log-modal__panel')?.focus()
      }
    },
    isOpen() {
      return open
    },
    sync(lines) {
      renderLines(lines)
    },
    dispose() {
      disposeScroll()
      shell.remove()
      host.classList.remove('app--log-open')
    },
  }
}
