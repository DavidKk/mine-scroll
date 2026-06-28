import {
  ensureRankedLocalStore,
  getCachedDisplayName,
  getCachedLeaderboardSelfSnapshot,
  getCachedPlayerId,
  type LeaderboardSelfSnapshot,
  saveDisplayName,
  saveLeaderboardSelfSnapshot,
} from '../../storage/ranked-local-store.ts'
import { HUD_ICON_BASE } from '../../ui/boot/asset-registry.ts'
import { resolveRasterUrl } from '../../ui/boot/image-format.ts'
import { wrapWithCustomScrollbar } from '../../ui/custom-scrollbar.ts'
import { createHeroicon } from '../../ui/heroicons.ts'
import type { GameNotificationController } from '../../ui/notification.ts'

export interface LeaderboardEntryView {
  id: string
  playerId?: string
  name: string
  score: number
  depth?: number
  countryCode?: string
  submittedAt: number
}

export interface LeaderboardPanel {
  setOpen(open: boolean): void
  isOpen(): boolean
  /** Close rename overlay if open — returns true when handled. */
  dismissOverlay(): boolean
  refresh(): Promise<void>
  dispose(): void
}

export interface LeaderboardPanelOptions {
  isRankedMode?: () => boolean
  onClose: () => void
  notify?: Pick<GameNotificationController, 'success' | 'error'>
}

export type { LeaderboardSelfSnapshot } from '../../storage/ranked-local-store.ts'
export { ensureDisplayName, getCachedDisplayName, saveDisplayName as saveLeaderboardDisplayName } from '../../storage/ranked-local-store.ts'

/** @deprecated Use ensureDisplayName() */
export function resolveLeaderboardDisplayName(): string {
  return getCachedDisplayName() || 'Anonymous'
}

interface LeaderboardDisplayRow {
  entry: LeaderboardEntryView
  rank: number
  isSelf: boolean
  pinned?: boolean
}

interface LeaderboardViewModel {
  pinned: LeaderboardDisplayRow | null
  ranked: LeaderboardDisplayRow[]
}

function entryPlayerKey(entry: LeaderboardEntryView): string {
  return entry.playerId?.trim() || entry.id
}

function resolveSelfPlayerKey(snapshot: LeaderboardSelfSnapshot | null, playerId = getCachedPlayerId().trim()): string | null {
  if (!snapshot) return null
  if (playerId && (snapshot.id === playerId || entryPlayerKey(snapshot) === playerId)) {
    return playerId
  }
  return snapshot.id
}

function entryMatchesSelf(entry: LeaderboardEntryView, selfKey: string | null): boolean {
  if (!selfKey) return false
  return entryPlayerKey(entry) === selfKey || entry.id === selfKey
}

const LEADERBOARD_VISIBLE_ROWS = 10

/** Pinned self row + full ranked list (never dedupe the player from the list below). */
export function buildLeaderboardViewModel(
  entries: LeaderboardEntryView[],
  options: {
    selfSnapshot?: LeaderboardSelfSnapshot | null
    playerId?: string
  } = {}
): LeaderboardViewModel {
  const snapshot = options.selfSnapshot ?? getCachedLeaderboardSelfSnapshot()
  const selfKey = resolveSelfPlayerKey(snapshot, options.playerId)
  const serverSelf = entries.find((entry) => entryMatchesSelf(entry, selfKey))
  const ranked = entries.slice(0, LEADERBOARD_VISIBLE_ROWS).map((entry, index) => ({
    entry,
    rank: index + 1,
    isSelf: entryMatchesSelf(entry, selfKey),
  }))

  const pinned = snapshot
    ? {
        entry: serverSelf ? { ...serverSelf, name: snapshot.name } : snapshot,
        rank: serverSelf ? entries.findIndex((entry) => entryMatchesSelf(entry, selfKey)) + 1 : 1,
        isSelf: true,
        pinned: true as const,
      }
    : null

  return { pinned, ranked }
}

export function loadLeaderboardDisplayName(): string {
  return getCachedDisplayName()
}

function sanitizeDisplayName(name: string): string {
  return name
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 24)
}

function resolveSelfDisplayName(fallback: string): string {
  return getCachedDisplayName() || fallback
}

function formatScore(score: number): string {
  return score.toLocaleString('en-US')
}

function formatCountryCode(code: string | undefined): string {
  const normalized = code?.trim().toUpperCase()
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return '—'
  return normalized
}

function rankTrophySrc(rank: number): string | null {
  if (rank === 1) return resolveRasterUrl(`${HUD_ICON_BASE}/rank-trophy-gold.png`)
  if (rank === 2) return resolveRasterUrl(`${HUD_ICON_BASE}/rank-trophy-silver.png`)
  if (rank === 3) return resolveRasterUrl(`${HUD_ICON_BASE}/rank-trophy-bronze.png`)
  return null
}

function applyRankAccent(rankEl: HTMLElement, rank: number): void {
  if (rank === 1) rankEl.classList.add('leaderboard-modal__rank--gold')
  else if (rank === 2) rankEl.classList.add('leaderboard-modal__rank--silver')
  else if (rank === 3) rankEl.classList.add('leaderboard-modal__rank--bronze')
}

function createRankTrophyCell(rank: number): HTMLElement {
  const cell = document.createElement('span')
  cell.className = 'leaderboard-modal__cell leaderboard-modal__trophy'

  const inner = document.createElement('span')
  inner.className = 'leaderboard-modal__cell-inner'

  const trophySrc = rankTrophySrc(rank)
  if (trophySrc) {
    const trophy = document.createElement('img')
    trophy.className = 'leaderboard-modal__rank-trophy'
    trophy.src = trophySrc
    trophy.alt = ''
    trophy.width = 18
    trophy.height = 18
    trophy.decoding = 'async'
    trophy.setAttribute('aria-hidden', 'true')
    inner.append(trophy)
  }

  cell.append(inner)
  return cell
}

function createLeaderboardCell(className: string, text: string, options: { title?: string; hidden?: boolean; rank?: number } = {}): HTMLElement {
  const cell = document.createElement('span')
  cell.className = `leaderboard-modal__cell ${className}`

  const inner = document.createElement('span')
  inner.className = 'leaderboard-modal__cell-inner'

  const textEl = document.createElement('span')
  textEl.className = 'leaderboard-modal__cell-text'
  textEl.textContent = text
  inner.append(textEl)

  if (options.title) cell.title = options.title
  if (options.hidden) cell.hidden = options.hidden
  if (options.rank != null) applyRankAccent(cell, options.rank)

  cell.append(inner)
  return cell
}

function createSelfStatCell(label: string, value: string, score = false): HTMLElement {
  const cell = document.createElement('span')
  cell.className = `leaderboard-modal__cell leaderboard-modal__self-stat${score ? ' leaderboard-modal__self-stat--score' : ''}`

  const inner = document.createElement('span')
  inner.className = 'leaderboard-modal__cell-inner'

  const labelEl = document.createElement('span')
  labelEl.className = 'leaderboard-modal__self-stat-label'
  labelEl.textContent = label

  const valueEl = document.createElement('span')
  valueEl.textContent = value

  inner.append(labelEl, valueEl)
  cell.append(inner)
  return cell
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

function resolveSubtitle(storage: 'redis' | 'memory' | 'none' | undefined, ranked: boolean): string {
  const base = ranked ? 'Ranked endless · verified top 100' : 'Endless · top 100'
  if (storage === 'memory') return `${base} · local memory`
  return base
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
          <span class="leaderboard-modal__mark" aria-hidden="true"><img class="leaderboard-modal__mark-icon" src="${resolveRasterUrl(`${HUD_ICON_BASE}/leaderboard.png`)}" alt="" width="20" height="20" decoding="async" /></span>
          <div class="leaderboard-modal__titles">
            <h2 id="leaderboard-modal-title" class="leaderboard-modal__title">Leaderboard</h2>
            <p class="leaderboard-modal__subtitle" data-subtitle>Endless · top 100</p>
          </div>
        </div>
        <button type="button" class="leaderboard-modal__close leaderboard-modal__close--icon" aria-label="Close leaderboard"></button>
      </header>
      <p class="leaderboard-modal__status" hidden></p>
      <div class="leaderboard-modal__body" data-body>
        <section class="leaderboard-modal__self-zone" data-self-zone hidden>
          <div class="leaderboard-modal__self-head"></div>
          <div class="leaderboard-modal__pinned"></div>
        </section>
        <section class="leaderboard-modal__ranks-zone">
          <p class="leaderboard-modal__ranks-label">Rankings</p>
          <div class="leaderboard-modal__ranks-board">
            <div class="leaderboard-modal__table-head" aria-hidden="true">
              <span class="leaderboard-modal__cell leaderboard-modal__cell--head leaderboard-modal__trophy"><span class="leaderboard-modal__cell-inner"></span></span>
              <span class="leaderboard-modal__cell leaderboard-modal__cell--head leaderboard-modal__rank"><span class="leaderboard-modal__cell-inner">#</span></span>
              <span class="leaderboard-modal__cell leaderboard-modal__cell--head leaderboard-modal__country" data-country-head hidden><span class="leaderboard-modal__cell-inner">Region</span></span>
              <span class="leaderboard-modal__cell leaderboard-modal__cell--head leaderboard-modal__name"><span class="leaderboard-modal__cell-inner">Player</span></span>
              <span class="leaderboard-modal__cell leaderboard-modal__cell--head leaderboard-modal__depth" data-depth-head hidden><span class="leaderboard-modal__cell-inner">Depth</span></span>
              <span class="leaderboard-modal__cell leaderboard-modal__cell--head leaderboard-modal__score"><span class="leaderboard-modal__cell-inner">Score</span></span>
            </div>
            <ol class="leaderboard-modal__list"></ol>
            <p class="leaderboard-modal__empty" hidden>No scores yet.</p>
            <div class="leaderboard-modal__loading" hidden aria-live="polite">
              <span class="leaderboard-modal__loading-label">LOADING</span>
            </div>
          </div>
        </section>
      </div>
    </div>
    <div class="leaderboard-rename" hidden>
      <div class="leaderboard-rename__backdrop" data-rename-close aria-hidden="true"></div>
      <div class="leaderboard-rename__panel" role="dialog" aria-modal="true" aria-labelledby="leaderboard-rename-title" tabindex="-1">
        <h3 id="leaderboard-rename-title" class="leaderboard-rename__title">Rename operator</h3>
        <p class="leaderboard-rename__hint">Shown on the leaderboard and ranked runs.</p>
        <input
          class="leaderboard-rename__input"
          type="text"
          maxlength="24"
          autocomplete="off"
          spellcheck="false"
          placeholder="Operator name"
        />
        <div class="leaderboard-rename__actions">
          <button type="button" class="leaderboard-rename__btn leaderboard-rename__btn--ghost" data-rename-close>Cancel</button>
          <button type="button" class="leaderboard-rename__btn leaderboard-rename__btn--primary" data-rename-save>Save</button>
        </div>
      </div>
    </div>
  `

  const panel = shell.querySelector<HTMLElement>('.leaderboard-modal__panel')!
  const bodyEl = shell.querySelector<HTMLElement>('[data-body]')!
  const statusEl = shell.querySelector<HTMLElement>('.leaderboard-modal__status')!
  const selfZoneEl = shell.querySelector<HTMLElement>('[data-self-zone]')!
  const ranksZoneEl = shell.querySelector<HTMLElement>('.leaderboard-modal__ranks-zone')!
  const ranksBoardEl = shell.querySelector<HTMLElement>('.leaderboard-modal__ranks-board')!
  const loadingEl = shell.querySelector<HTMLElement>('.leaderboard-modal__loading')!
  const selfHeadEl = shell.querySelector<HTMLElement>('.leaderboard-modal__self-head')!
  const pinnedEl = shell.querySelector<HTMLElement>('.leaderboard-modal__pinned')!
  const listEl = shell.querySelector<HTMLOListElement>('.leaderboard-modal__list')!
  const tableHeadEl = shell.querySelector<HTMLElement>('.leaderboard-modal__table-head')!
  const emptyEl = shell.querySelector<HTMLElement>('.leaderboard-modal__empty')!
  const subtitleEl = shell.querySelector<HTMLElement>('[data-subtitle]')!
  const depthHeadEl = shell.querySelector<HTMLElement>('[data-depth-head]')!
  const countryHeadEl = shell.querySelector<HTMLElement>('[data-country-head]')!
  const renameShell = shell.querySelector<HTMLElement>('.leaderboard-rename')!
  const renamePanel = shell.querySelector<HTMLElement>('.leaderboard-rename__panel')!
  const renameInput = shell.querySelector<HTMLInputElement>('.leaderboard-rename__input')!

  shell.querySelector<HTMLButtonElement>('.leaderboard-modal__close')?.append(createHeroicon('x-mark', 'leaderboard-modal__icon'))

  const disposeScroll = wrapWithCustomScrollbar(listEl, 'scroll-host scroll-host--leaderboard')

  let open = false
  let renameOpen = false
  let loading = false
  let fetchGeneration = 0
  let lastEntries: LeaderboardEntryView[] = []

  function applyStatus(message: string, tone: 'idle' | 'error' = 'idle'): void {
    statusEl.hidden = !message
    statusEl.textContent = message
    statusEl.dataset.tone = tone
  }

  function setLoading(next: boolean): void {
    loading = next
    loadingEl.hidden = !next
    ranksBoardEl.classList.toggle('leaderboard-modal__ranks-board--loading', next)
  }

  function syncBodyLayout(hasPinnedSelf: boolean): void {
    bodyEl.classList.toggle('leaderboard-modal__body--with-self', hasPinnedSelf)
    ranksZoneEl.classList.toggle('leaderboard-modal__ranks-zone--solo', !hasPinnedSelf)
  }

  function resolveShowDepth(entries: LeaderboardEntryView[], rows: LeaderboardDisplayRow[]): boolean {
    if (options.isRankedMode?.()) return true
    return rows.some((row) => typeof row.entry.depth === 'number') || entries.some((entry) => typeof entry.depth === 'number')
  }

  function applyTableDepthLayout(showDepth: boolean): void {
    depthHeadEl.hidden = !showDepth
    tableHeadEl.classList.toggle('leaderboard-modal__table-head--with-depth', showDepth)
  }

  function applyTableCountryLayout(showCountry: boolean): void {
    countryHeadEl.hidden = !showCountry
    tableHeadEl.classList.toggle('leaderboard-modal__table-head--with-country', showCountry)
  }

  function resolveShowCountry(entries: LeaderboardEntryView[], rows: LeaderboardDisplayRow[]): boolean {
    return (
      rows.some((row) => typeof row.entry.countryCode === 'string' && row.entry.countryCode.length > 0) ||
      entries.some((entry) => typeof entry.countryCode === 'string' && entry.countryCode.length > 0)
    )
  }

  function populateSelfZoneHead(displayName: string): void {
    selfHeadEl.replaceChildren()

    const label = document.createElement('p')
    label.className = 'leaderboard-modal__self-label'
    label.textContent = 'You'

    const renameBtn = document.createElement('button')
    renameBtn.type = 'button'
    renameBtn.className = 'leaderboard-modal__rename'
    renameBtn.textContent = 'rename'
    renameBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      openRenameDialog(displayName)
    })

    selfHeadEl.append(label, renameBtn)
  }

  function createPinnedSelfCard(row: LeaderboardDisplayRow, showDepth: boolean, showCountry: boolean): HTMLElement {
    const displayName = resolveSelfDisplayName(row.entry.name)

    const card = document.createElement('div')
    card.className = 'leaderboard-modal__self-card'

    const rank = createLeaderboardCell('leaderboard-modal__rank', String(row.rank).padStart(2, '0'), { rank: row.rank })

    const stats = document.createElement('div')
    stats.className = 'leaderboard-modal__self-stats'
    if (showDepth) {
      stats.append(createSelfStatCell('Depth', String(row.entry.depth ?? 0)))
    }
    stats.append(createSelfStatCell('Score', formatScore(row.entry.score), true))

    card.append(createRankTrophyCell(row.rank), rank)
    if (showCountry) {
      card.append(createLeaderboardCell('leaderboard-modal__country', formatCountryCode(row.entry.countryCode)))
    }
    card.append(
      createLeaderboardCell('leaderboard-modal__self-name', displayName, {
        title: `${displayName} · ${formatSubmittedAt(row.entry.submittedAt)}`,
      }),
      stats
    )
    return card
  }

  function createEntryRow(row: LeaderboardDisplayRow, showDepth: boolean, showCountry: boolean): HTMLElement {
    const item = document.createElement('li')
    item.className = 'leaderboard-modal__entry'
    if (showDepth) item.classList.add('leaderboard-modal__entry--with-depth')
    if (showCountry) item.classList.add('leaderboard-modal__entry--with-country')
    if (row.isSelf) item.classList.add('leaderboard-modal__entry--self-in-list')

    const displayName = row.isSelf ? resolveSelfDisplayName(row.entry.name) : row.entry.name

    item.append(
      createRankTrophyCell(row.rank),
      createLeaderboardCell('leaderboard-modal__rank', String(row.rank).padStart(2, '0'), { rank: row.rank }),
      createLeaderboardCell('leaderboard-modal__country', formatCountryCode(row.entry.countryCode), { hidden: !showCountry }),
      createLeaderboardCell('leaderboard-modal__name', displayName, {
        title: `${displayName} · ${formatSubmittedAt(row.entry.submittedAt)}`,
      })
    )
    if (showDepth) {
      item.append(createLeaderboardCell('leaderboard-modal__depth', String(row.entry.depth ?? 0)))
    }
    item.append(createLeaderboardCell('leaderboard-modal__score', formatScore(row.entry.score)))
    return item
  }

  function renderEntries(entries: LeaderboardEntryView[]): void {
    lastEntries = entries
    const view = buildLeaderboardViewModel(entries)
    pinnedEl.replaceChildren()
    listEl.replaceChildren()

    const allRows = [...(view.pinned ? [view.pinned] : []), ...view.ranked]
    emptyEl.hidden = allRows.length > 0 || loading
    const showDepth = resolveShowDepth(entries, allRows)
    const showCountry = resolveShowCountry(entries, allRows)
    applyTableDepthLayout(showDepth)
    applyTableCountryLayout(showCountry)
    syncBodyLayout(Boolean(view.pinned))
    selfZoneEl.hidden = !view.pinned

    if (view.pinned) {
      const displayName = resolveSelfDisplayName(view.pinned.entry.name)
      populateSelfZoneHead(displayName)
      pinnedEl.append(createPinnedSelfCard(view.pinned, showDepth, showCountry))
    } else {
      selfHeadEl.replaceChildren()
    }

    view.ranked.forEach((row) => {
      listEl.append(createEntryRow(row, showDepth, showCountry))
    })
  }

  function primeSelfZoneFromCache(): void {
    const snapshot = getCachedLeaderboardSelfSnapshot()
    if (!snapshot) {
      syncBodyLayout(false)
      selfZoneEl.hidden = true
      return
    }

    const showDepth = options.isRankedMode?.() ?? typeof snapshot.depth === 'number'
    const showCountry = typeof snapshot.countryCode === 'string' && snapshot.countryCode.length > 0
    applyTableDepthLayout(showDepth)
    applyTableCountryLayout(showCountry)
    syncBodyLayout(true)
    selfZoneEl.hidden = false
    populateSelfZoneHead(resolveSelfDisplayName(snapshot.name))
    pinnedEl.replaceChildren(
      createPinnedSelfCard(
        {
          entry: snapshot,
          rank: 1,
          isSelf: true,
          pinned: true,
        },
        showDepth,
        showCountry
      )
    )
  }

  function closeRenameDialog(): void {
    if (!renameOpen) return
    renameOpen = false
    renameShell.hidden = true
  }

  function openRenameDialog(currentName: string): void {
    renameOpen = true
    renameShell.hidden = false
    renameInput.value = currentName
    renamePanel.focus()
    renameInput.focus()
    renameInput.select()
  }

  async function submitRename(): Promise<void> {
    const nextName = sanitizeDisplayName(renameInput.value)
    if (!nextName) {
      applyStatus('Enter a valid operator name.', 'error')
      renameInput.focus()
      return
    }

    await saveDisplayName(nextName)
    const snapshot = getCachedLeaderboardSelfSnapshot()
    if (snapshot) {
      await saveLeaderboardSelfSnapshot({ ...snapshot, name: nextName })
    }
    closeRenameDialog()
    options.notify?.success('Operator name updated.')
    renderEntries(lastEntries)
  }

  async function refresh(): Promise<void> {
    const generation = ++fetchGeneration
    setLoading(true)

    try {
      await ensureRankedLocalStore()
      const response = await fetch('/api/leaderboard', { method: 'GET' })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        entries?: LeaderboardEntryView[]
        configured?: boolean
        storage?: 'redis' | 'memory' | 'none'
      } | null

      if (generation !== fetchGeneration) return

      if (!response.ok) {
        throw new Error(body?.error ?? 'Failed to load leaderboard')
      }

      const rawEntries = body?.entries ?? []
      renderEntries(rawEntries)
      subtitleEl.textContent = resolveSubtitle(body?.storage, options.isRankedMode?.() ?? false)

      if (body?.storage === 'none') {
        applyStatus('Link a Vercel KV store to this project, then run vercel env pull.', 'error')
      } else {
        applyStatus('')
      }
    } catch (error) {
      if (generation !== fetchGeneration) return
      renderEntries([])
      applyStatus(error instanceof Error ? error.message : 'Failed to load leaderboard', 'error')
    } finally {
      if (generation !== fetchGeneration) return
      setLoading(false)
    }
  }

  function close(): void {
    options.onClose()
  }

  shell.querySelector('.leaderboard-modal__close')?.addEventListener('click', close)
  shell.querySelector('.leaderboard-modal__backdrop')?.addEventListener('click', close)
  renameShell.querySelectorAll('[data-rename-close]').forEach((el) => {
    el.addEventListener('click', closeRenameDialog)
  })
  renameShell.querySelector('[data-rename-save]')?.addEventListener('click', () => {
    void submitRename()
  })
  renameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void submitRename()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeRenameDialog()
    }
  })

  host.append(shell)

  return {
    setOpen(next) {
      open = next
      shell.hidden = !next
      host.classList.toggle('app--leaderboard-open', next)
      if (next) {
        subtitleEl.textContent = resolveSubtitle(undefined, options.isRankedMode?.() ?? false)
        applyTableDepthLayout(options.isRankedMode?.() ?? false)
        primeSelfZoneFromCache()
        setLoading(true)
        panel.focus()
        void refresh()
      } else {
        fetchGeneration += 1
        setLoading(false)
        closeRenameDialog()
        applyStatus('')
      }
    },
    isOpen() {
      return open
    },
    dismissOverlay() {
      if (!renameOpen) return false
      closeRenameDialog()
      return true
    },
    refresh,
    dispose() {
      disposeScroll()
      shell.remove()
      host.classList.remove('app--leaderboard-open')
    },
  }
}
