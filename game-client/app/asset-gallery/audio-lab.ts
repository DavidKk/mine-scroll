import {
  BGM_IDLE_SRC,
  createGameAudio,
  GAME_AUDIO_ASSETS,
  GAME_AUDIO_BGM_IDLE_VOLUME,
  GAME_AUDIO_MASTER_VOLUME,
  GAME_AUDIO_SFX_GAIN,
  type GameAudioId,
  getEffectiveSfxVolume,
} from '../../ui/game-audio.ts'
import { createPanelHead } from './editor-shell.ts'

export type AudioPanelId = 'overview' | 'bgm' | 'cells' | 'game' | 'ui'

export interface AudioLabEntry {
  id: GameAudioId
  label: string
  category: 'cell' | 'flag' | 'game' | 'scroll' | 'ui'
  fileName: string
  duration: string
  trigger: string
  codeHook: string
  status: 'ready' | 'planned'
}

const AUDIO_LAB_ENTRIES: AudioLabEntry[] = [
  {
    id: 'cellReveal',
    label: 'Cell reveal',
    category: 'cell',
    fileName: 'sfx-cell-reveal-01.wav',
    duration: '0.05–0.15 s',
    trigger: 'Left-click reveals exactly one new cell',
    codeHook: 'playRevealAudio → cellReveal',
    status: 'ready',
  },
  {
    id: 'cellFlood',
    label: 'Flood reveal',
    category: 'cell',
    fileName: 'sfx-cell-flood-reveal.wav',
    duration: '0.3–0.6 s',
    trigger: 'One action reveals two or more cells',
    codeHook: 'playRevealAudio → cellFlood',
    status: 'ready',
  },
  {
    id: 'flagPlace',
    label: 'Flag place',
    category: 'flag',
    fileName: 'sfx-flag-place.wav',
    duration: '0.08–0.12 s',
    trigger: 'Right-click places a flag on a hidden cell',
    codeHook: 'playFlagToggleAudio → flagPlace',
    status: 'ready',
  },
  {
    id: 'flagRemove',
    label: 'Flag remove',
    category: 'flag',
    fileName: 'sfx-flag-remove.wav',
    duration: '0.06–0.1 s',
    trigger: 'Right-click removes a flag',
    codeHook: 'playFlagToggleAudio → flagRemove',
    status: 'ready',
  },
  {
    id: 'chordAction',
    label: 'Chord action',
    category: 'game',
    fileName: 'sfx-chord-action.wav',
    duration: '0.15–0.25 s',
    trigger: 'Chord succeeds without hitting a mine',
    codeHook: 'onChord → chordAction',
    status: 'ready',
  },
  {
    id: 'mineHit',
    label: 'Mine hit',
    category: 'game',
    fileName: 'sfx-mine-hit.wav',
    duration: '0.4–0.8 s',
    trigger: 'Reveal or chord hits a mine and costs a life',
    codeHook: 'playLifeLossAudio → mineHit',
    status: 'ready',
  },
  {
    id: 'lifeWarning',
    label: 'Life warning',
    category: 'game',
    fileName: 'sfx-life-warning.wav',
    duration: '0.2–0.4 s',
    trigger: 'Scroll tick damages a life at the bottom row',
    codeHook: 'playLifeLossAudio → lifeWarning',
    status: 'ready',
  },
  {
    id: 'healReward',
    label: 'Heal reward',
    category: 'game',
    fileName: 'sfx-heal-reward.wav',
    duration: '0.4–0.7 s',
    trigger: 'Auto heal or exchange mines for +1 life',
    codeHook: 'playHealRewardAudio → healReward',
    status: 'ready',
  },
  {
    id: 'scrollUp',
    label: 'Scroll up',
    category: 'scroll',
    fileName: 'sfx-scroll-up.wav',
    duration: '0.3–0.5 s',
    trigger: 'Scroll timer advances the board upward',
    codeHook: 'onScrollTick → scrollUp',
    status: 'ready',
  },
  {
    id: 'uiHover',
    label: 'UI hover',
    category: 'ui',
    fileName: 'ui-hover.wav',
    duration: '0.03–0.08 s',
    trigger: 'Pointer enters canvas HUD hot zones',
    codeHook: 'onUiHover → uiHover',
    status: 'ready',
  },
  {
    id: 'startHover',
    label: 'Start hover',
    category: 'ui',
    fileName: 'ui-start-hover.wav',
    duration: '0.2–0.4 s',
    trigger: 'Pointer enters START panel',
    codeHook: 'onUiHover(start) → startHover',
    status: 'ready',
  },
  {
    id: 'retryHover',
    label: 'Retry hover',
    category: 'ui',
    fileName: 'ui-retry-hover.wav',
    duration: '0.2–0.4 s',
    trigger: 'Pointer enters RETRY button',
    codeHook: 'onUiHover(retry) → retryHover',
    status: 'ready',
  },
  {
    id: 'uiClick',
    label: 'UI click',
    category: 'ui',
    fileName: 'ui-click.wav',
    duration: '0.05–0.1 s',
    trigger: 'Click Start, Retry, Reset, or Dev Auto',
    codeHook: 'onUiClick → uiClick',
    status: 'ready',
  },
]

const PLANNED_AUDIO: Array<{ fileName: string; label: string; trigger: string }> = [
  { fileName: 'sfx-win.wav', label: 'Victory', trigger: 'Board cleared — status won' },
  { fileName: 'sfx-game-over.wav', label: 'Game over', trigger: 'Lives depleted — status lost' },
  { fileName: 'sfx-new-game.wav', label: 'New game', trigger: 'Start overlay or restart' },
]

const CATEGORY_LABEL: Record<AudioLabEntry['category'], string> = {
  cell: 'Cell',
  flag: 'Flag',
  game: 'Game',
  scroll: 'Scroll',
  ui: 'UI',
}

interface AudioLabContext {
  audio: ReturnType<typeof createGameAudio>
  bgmPlaying: boolean
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function createVolumeBar(effective: number, gain: number): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'asset-lab__audio-volume'
  wrap.title = `Master ${formatPct(GAME_AUDIO_MASTER_VOLUME)} × gain ${formatPct(gain)}`

  const track = document.createElement('div')
  track.className = 'asset-lab__audio-volume-track'
  const fill = document.createElement('div')
  fill.className = 'asset-lab__audio-volume-fill'
  fill.style.width = `${Math.round(effective * 100)}%`
  track.append(fill)

  const label = document.createElement('span')
  label.textContent = formatPct(effective)

  wrap.append(track, label)
  return wrap
}

function createAudioCard(entry: AudioLabEntry, ctx: AudioLabContext): HTMLElement {
  const card = document.createElement('article')
  card.className = 'asset-lab__audio-card'

  const head = document.createElement('div')
  head.className = 'asset-lab__audio-card-head'

  const playBtn = document.createElement('button')
  playBtn.type = 'button'
  playBtn.className = 'asset-lab__audio-play'
  playBtn.setAttribute('aria-label', `Play ${entry.label}`)
  playBtn.textContent = '▶'
  playBtn.addEventListener('click', () => {
    ctx.audio.unlock()
    ctx.audio.play(entry.id)
  })

  const titleWrap = document.createElement('div')
  titleWrap.className = 'asset-lab__audio-card-title'
  const title = document.createElement('strong')
  title.textContent = entry.label
  const badge = document.createElement('span')
  badge.className = 'asset-lab__audio-badge'
  badge.textContent = CATEGORY_LABEL[entry.category]
  titleWrap.append(title, badge)

  head.append(playBtn, titleWrap)

  const meta = document.createElement('dl')
  meta.className = 'asset-lab__audio-meta'
  const gain = GAME_AUDIO_SFX_GAIN[entry.id]
  const effective = getEffectiveSfxVolume(entry.id)
  meta.innerHTML = `
    <div><dt>File</dt><dd><code>${GAME_AUDIO_ASSETS[entry.id]}</code></dd></div>
    <div><dt>Duration</dt><dd>${entry.duration}</dd></div>
    <div><dt>Trigger</dt><dd>${entry.trigger}</dd></div>
    <div><dt>Code</dt><dd><code>${entry.codeHook}</code></dd></div>
  `
  meta.append(createVolumeRow('Output', effective, gain))

  card.append(head, meta)
  return card
}

function createVolumeRow(label: string, effective: number, gain: number): HTMLElement {
  const row = document.createElement('div')
  row.className = 'asset-lab__audio-meta-volume'
  const dt = document.createElement('dt')
  dt.textContent = label
  const dd = document.createElement('dd')
  dd.append(createVolumeBar(effective, gain))
  row.append(dt, dd)
  return row
}

function createAudioGrid(entries: AudioLabEntry[], ctx: AudioLabContext): HTMLElement {
  const grid = document.createElement('div')
  grid.className = 'asset-lab__audio-grid'
  for (const entry of entries) {
    grid.append(createAudioCard(entry, ctx))
  }
  return grid
}

function createPlannedSection(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'asset-lab__audio-planned'
  const h3 = document.createElement('h3')
  h3.textContent = 'Planned (not wired)'
  const list = document.createElement('ul')
  list.className = 'asset-lab__audio-planned-list'
  for (const item of PLANNED_AUDIO) {
    const li = document.createElement('li')
    li.innerHTML = `<code>${item.fileName}</code> — ${item.label} · ${item.trigger}`
    list.append(li)
  }
  section.append(h3, list)
  return section
}

function createOverviewPanel(ctx: AudioLabContext): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel'
  panel.dataset.panelId = 'overview'
  panel.append(
    createPanelHead('Sound effects catalog', `${AUDIO_LAB_ENTRIES.length} one-shots under public/assets/game/audio. Peak-normalized via MASTER × SFX_GAIN in game-audio.ts.`)
  )

  const toolbar = document.createElement('div')
  toolbar.className = 'asset-lab__audio-toolbar'
  const playAllBtn = document.createElement('button')
  playAllBtn.type = 'button'
  playAllBtn.className = 'asset-lab__audio-toolbar-btn'
  playAllBtn.textContent = 'Play all (sequential)'
  let playAllToken = 0
  playAllBtn.addEventListener('click', async () => {
    const token = ++playAllToken
    ctx.audio.unlock()
    playAllBtn.disabled = true
    for (const entry of AUDIO_LAB_ENTRIES) {
      if (token !== playAllToken) break
      ctx.audio.play(entry.id)
      await new Promise((r) => setTimeout(r, 420))
    }
    if (token === playAllToken) playAllBtn.disabled = false
  })
  const stopBtn = document.createElement('button')
  stopBtn.type = 'button'
  stopBtn.className = 'asset-lab__audio-toolbar-btn asset-lab__audio-toolbar-btn--ghost'
  stopBtn.textContent = 'Stop sequence'
  stopBtn.addEventListener('click', () => {
    playAllToken += 1
    playAllBtn.disabled = false
  })
  toolbar.append(playAllBtn, stopBtn)

  const busMeta = document.createElement('dl')
  busMeta.className = 'asset-lab__meta-list asset-lab__audio-bus'
  busMeta.innerHTML = `
    <div><dt>Master</dt><dd>${formatPct(GAME_AUDIO_MASTER_VOLUME)}</dd></div>
    <div><dt>Clips</dt><dd>${AUDIO_LAB_ENTRIES.length}</dd></div>
    <div><dt>Source</dt><dd><code>game-client/ui/game-audio.ts</code></dd></div>
  `

  panel.append(toolbar, busMeta, createAudioGrid(AUDIO_LAB_ENTRIES, ctx), createPlannedSection())
  return panel
}

function createCategoryPanel(id: AudioPanelId, title: string, description: string, filter: (entry: AudioLabEntry) => boolean, ctx: AudioLabContext): HTMLElement {
  const entries = AUDIO_LAB_ENTRIES.filter(filter)
  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel'
  panel.dataset.panelId = id
  panel.append(createPanelHead(title, description))
  panel.append(createAudioGrid(entries, ctx))
  return panel
}

function createBgmPanel(ctx: AudioLabContext): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel'
  panel.dataset.panelId = 'bgm'
  panel.append(createPanelHead('Idle background music', 'Loops while session status is idle (start screen and before the first reveal). Stops when playing begins.'))

  const workspace = document.createElement('div')
  workspace.className = 'asset-lab__audio-bgm-workspace'

  const player = document.createElement('div')
  player.className = 'asset-lab__audio-bgm-player'

  const art = document.createElement('div')
  art.className = 'asset-lab__audio-bgm-art'
  art.setAttribute('aria-hidden', 'true')
  art.textContent = '♫'

  const controls = document.createElement('div')
  controls.className = 'asset-lab__audio-bgm-controls'

  const toggleBtn = document.createElement('button')
  toggleBtn.type = 'button'
  toggleBtn.className = 'asset-lab__audio-bgm-toggle'
  toggleBtn.textContent = 'Play loop'

  const status = document.createElement('span')
  status.className = 'asset-lab__audio-bgm-status'
  status.textContent = 'Stopped'

  const syncToggle = (): void => {
    toggleBtn.textContent = ctx.bgmPlaying ? 'Stop loop' : 'Play loop'
    status.textContent = ctx.bgmPlaying ? 'Playing · loop' : 'Stopped'
    toggleBtn.classList.toggle('asset-lab__audio-bgm-toggle--active', ctx.bgmPlaying)
  }

  toggleBtn.addEventListener('click', () => {
    ctx.audio.unlock()
    ctx.bgmPlaying = !ctx.bgmPlaying
    ctx.audio.setIdleBgm(true)
    if (ctx.bgmPlaying && ctx.audio.isIdleBgmMuted()) {
      ctx.audio.toggleIdleBgmMuted()
    } else if (!ctx.bgmPlaying && !ctx.audio.isIdleBgmMuted()) {
      ctx.audio.toggleIdleBgmMuted()
    }
    syncToggle()
  })

  controls.append(toggleBtn, status)
  player.append(art, controls)

  const native = document.createElement('audio')
  native.className = 'asset-lab__audio-native'
  native.src = BGM_IDLE_SRC
  native.controls = true
  native.preload = 'metadata'
  native.loop = true

  const meta = document.createElement('dl')
  meta.className = 'asset-lab__meta-list'
  meta.innerHTML = `
    <div><dt>File</dt><dd><code>${BGM_IDLE_SRC}</code></dd></div>
    <div><dt>Volume</dt><dd>${formatPct(GAME_AUDIO_BGM_IDLE_VOLUME)}</dd></div>
    <div><dt>Loop</dt><dd>Yes</dd></div>
    <div><dt>When</dt><dd>status === idle</dd></div>
    <div><dt>Code</dt><dd><code>setIdleBgm · syncIdleBgm</code></dd></div>
  `

  const hint = document.createElement('p')
  hint.className = 'asset-lab__field-hint'
  hint.textContent = 'Lab toggle uses the same GameAudioController as the game. Native player below is for inspecting the raw asset.'

  workspace.append(player, meta, native, hint)
  panel.append(workspace)
  return panel
}

export function audioNavItems(): Array<{ id: AudioPanelId; label: string; count?: number }> {
  return [
    { id: 'overview', label: 'Overview', count: AUDIO_LAB_ENTRIES.length },
    { id: 'bgm', label: 'Background', count: 1 },
    { id: 'cells', label: 'Cell & flag', count: 4 },
    { id: 'game', label: 'Game & scroll', count: 5 },
    { id: 'ui', label: 'UI', count: 2 },
  ]
}

export function mountAudioPanels(): {
  panels: Record<AudioPanelId, HTMLElement>
  dispose: () => void
} {
  const ctx: AudioLabContext = {
    audio: createGameAudio(),
    bgmPlaying: false,
  }

  const panels: Record<AudioPanelId, HTMLElement> = {
    overview: createOverviewPanel(ctx),
    bgm: createBgmPanel(ctx),
    cells: createCategoryPanel(
      'cells',
      'Cell & flag',
      'Board interaction one-shots for reveal, flood, and flag toggles.',
      (e) => e.category === 'cell' || e.category === 'flag',
      ctx
    ),
    game: createCategoryPanel('game', 'Game & scroll', 'Life, chord, heal, and scroll pressure feedback.', (e) => e.category === 'game' || e.category === 'scroll', ctx),
    ui: createCategoryPanel('ui', 'UI', 'Canvas HUD hover and click feedback.', (e) => e.category === 'ui', ctx),
  }

  return {
    panels,
    dispose: () => {
      ctx.bgmPlaying = false
      ctx.audio.destroy()
    },
  }
}
