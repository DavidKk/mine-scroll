import { wrapWithCustomScrollbar } from '../../ui/custom-scrollbar.ts'
import { createHeroicon } from '../../ui/heroicons.ts'

export interface LeaderboardEntryView {
  id: string
  name: string
  score: number
  depth?: number
  submittedAt: number
}

export interface LeaderboardPanel {
  setOpen(open: boolean): void
  isOpen(): boolean
  refresh(): Promise<void>
  dispose(): void
}

export interface LeaderboardPanelOptions {
  isRankedMode?: () => boolean
  onClose: () => void
}

const NAME_STORAGE_KEY = 'chill-leaderboard-name'
const ANON_NAME_KEY = 'chill-leaderboard-anon-id'

export function loadLeaderboardDisplayName(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(NAME_STORAGE_KEY)?.trim() ?? ''
}

export function saveLeaderboardDisplayName(name: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(NAME_STORAGE_KEY, name.trim().slice(0, 24))
}

/** Display name for ranked auto-submit — saved name or a stable anonymous callsign. */
export function resolveLeaderboardDisplayName(): string {
  const saved = loadLeaderboardDisplayName()
  if (saved) return saved

  if (typeof localStorage === 'undefined') return 'Anonymous'

  let anon = localStorage.getItem(ANON_NAME_KEY)?.trim() ?? ''
  if (!anon) {
    anon = `Pilot-${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(ANON_NAME_KEY, anon)
  }
  return anon
}

function formatScore(score: number): string {
  return score.toLocaleString('en-US')
}

function formatSubmittedAt(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function createLeaderboardPanel(host: HTMLElement, options: LeaderboardPanelOptions): LeaderboardPanel {
  const shell = document.createElement('div')
  shell.className = 'leaderboard-modal'
  shell.hidden = true
  shell.innerHTML = `
    <div class="leaderboard-modal__backdrop" data-close="true" aria-hidden="true"></div>
    <div class="leaderboard-modal__panel" role="dialog" aria-modal="true" aria-labelledby="leaderboard-modal-title" tabindex="-1">
      <div class="leaderboard-modal__glow" aria-hidden="true"></div>
      <div class="leaderboard-modal__frame" aria-hidden="true"></div>
      <header class="leaderboard-modal__head">
        <div class="leaderboard-modal__brand">
          <span class="leaderboard-modal__mark" aria-hidden="true">★</span>
          <div class="leaderboard-modal__titles">
            <h2 id="leaderboard-modal-title" class="leaderboard-modal__title">Leaderboard</h2>
            <p class="leaderboard-modal__subtitle" data-subtitle>Endless · top 100</p>
          </div>
        </div>
        <button type="button" class="leaderboard-modal__close leaderboard-modal__close--icon" aria-label="Close leaderboard"></button>
      </header>
      <p class="leaderboard-modal__status" hidden></p>
      <div class="leaderboard-modal__body">
        <div class="leaderboard-modal__table-head" aria-hidden="true">
          <span>#</span><span>Operator</span><span data-depth-head hidden>Depth</span><span>Score</span>
        </div>
        <ol class="leaderboard-modal__list"></ol>
        <p class="leaderboard-modal__empty" hidden>No scores yet.</p>
      </div>
      <footer class="leaderboard-modal__foot">
        <span>Tap TOP under audio to reopen</span>
        <span><kbd>Esc</kbd> close</span>
      </footer>
    </div>
  `

  const panel = shell.querySelector<HTMLElement>('.leaderboard-modal__panel')!
  const statusEl = shell.querySelector<HTMLElement>('.leaderboard-modal__status')!
  const listEl = shell.querySelector<HTMLOListElement>('.leaderboard-modal__list')!
  const emptyEl = shell.querySelector<HTMLElement>('.leaderboard-modal__empty')!
  const subtitleEl = shell.querySelector<HTMLElement>('[data-subtitle]')!
  const depthHeadEl = shell.querySelector<HTMLElement>('[data-depth-head]')!

  shell.querySelector<HTMLButtonElement>('.leaderboard-modal__close')?.append(createHeroicon('x-mark', 'leaderboard-modal__icon'))

  const disposeScroll = wrapWithCustomScrollbar(listEl, 'scroll-host scroll-host--leaderboard')

  let open = false
  let loading = false
  let fetchGeneration = 0

  function applyStatus(message: string, tone: 'idle' | 'error' = 'idle'): void {
    statusEl.hidden = !message
    statusEl.textContent = message
    statusEl.dataset.tone = tone
  }

  function renderEntries(entries: LeaderboardEntryView[]): void {
    listEl.replaceChildren()
    emptyEl.hidden = entries.length > 0
    const showDepth = entries.some((entry) => typeof entry.depth === 'number')
    depthHeadEl.hidden = !showDepth

    entries.forEach((entry, index) => {
      const item = document.createElement('li')
      item.className = 'leaderboard-modal__entry'
      if (showDepth) item.classList.add('leaderboard-modal__entry--with-depth')

      const rank = document.createElement('span')
      rank.className = 'leaderboard-modal__rank'
      rank.textContent = String(index + 1).padStart(2, '0')

      const name = document.createElement('span')
      name.className = 'leaderboard-modal__name'
      name.textContent = entry.name
      name.title = `${entry.name} · ${formatSubmittedAt(entry.submittedAt)}`

      const score = document.createElement('span')
      score.className = 'leaderboard-modal__score'
      score.textContent = formatScore(entry.score)

      item.append(rank, name)
      if (showDepth) {
        const depth = document.createElement('span')
        depth.className = 'leaderboard-modal__depth'
        depth.textContent = String(entry.depth ?? 0)
        item.append(depth)
      }
      item.append(score)
      listEl.append(item)
    })
  }

  async function refresh(): Promise<void> {
    const generation = ++fetchGeneration
    loading = true
    applyStatus('Loading ranks…')

    try {
      const response = await fetch('/api/leaderboard', { method: 'GET' })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        entries?: LeaderboardEntryView[]
        configured?: boolean
      } | null

      if (generation !== fetchGeneration) return

      if (!response.ok) {
        throw new Error(body?.error ?? 'Failed to load leaderboard')
      }

      renderEntries(body?.entries ?? [])
      if (body?.configured === false) {
        applyStatus('Leaderboard storage is not configured on this server.', 'error')
      } else {
        applyStatus('')
      }
    } catch (error) {
      if (generation !== fetchGeneration) return
      renderEntries([])
      applyStatus(error instanceof Error ? error.message : 'Failed to load leaderboard', 'error')
    } finally {
      if (generation !== fetchGeneration) return
      loading = false
    }
  }

  function close(): void {
    options.onClose()
  }

  shell.querySelector('.leaderboard-modal__close')?.addEventListener('click', close)
  shell.querySelector('.leaderboard-modal__backdrop')?.addEventListener('click', close)

  host.append(shell)

  return {
    setOpen(next) {
      open = next
      shell.hidden = !next
      host.classList.toggle('app--leaderboard-open', next)
      if (next) {
        subtitleEl.textContent = options.isRankedMode?.() ? 'Ranked endless · verified top 100' : 'Endless · top 100'
        panel.focus()
        if (!loading) {
          void refresh()
        }
      } else {
        fetchGeneration += 1
        applyStatus('')
      }
    },
    isOpen() {
      return open
    },
    refresh,
    dispose() {
      disposeScroll()
      shell.remove()
      host.classList.remove('app--leaderboard-open')
    },
  }
}
