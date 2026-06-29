import { bindBootScreen } from '../../ui/boot/boot-screen.ts'
import { createBootScreenElement } from '../../ui/boot/create-boot-screen-element.ts'
import type { BootProgressLabel, BootScreenController } from '../../ui/boot/types.ts'
import { createPanelHead } from './editor-shell.ts'

export type BootLoadingLabPanelId = 'loading'

const PHASES: BootProgressLabel[] = ['starting', 'tiles', 'ui', 'fx', 'ready']

function progressFor(percent: number, label: BootProgressLabel) {
  const ratio = Math.min(1, Math.max(0, percent / 100))
  return {
    ratio,
    displayPercent: percent,
    label,
    loaded: Math.round(ratio * 100),
    total: 100,
  }
}

function createToolbarButton(label: string, className = ''): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `asset-lab__boot-btn${className ? ` ${className}` : ''}`
  btn.textContent = label
  return btn
}

export function mountBootLoadingLabPanel(): { panel: HTMLElement; dispose: () => void } {
  const panel = document.createElement('section')
  panel.className = 'asset-lab__panel'

  panel.append(createPanelHead('Boot loading', 'Interactive boot overlay — progress phases, retry state, mini-board, and scan line. Matches /play startup UI.'))

  const workspace = document.createElement('div')
  workspace.className = 'asset-lab__boot-workspace'

  const controls = document.createElement('div')
  controls.className = 'asset-lab__boot-controls'

  const progressRow = document.createElement('label')
  progressRow.className = 'asset-lab__boot-progress'
  const progressLabel = document.createElement('span')
  progressLabel.textContent = 'Progress'
  const progressInput = document.createElement('input')
  progressInput.type = 'range'
  progressInput.min = '0'
  progressInput.max = '100'
  progressInput.value = '0'
  progressInput.className = 'asset-lab__boot-range'
  const progressValue = document.createElement('span')
  progressValue.className = 'asset-lab__boot-progress-value'
  progressValue.textContent = '0%'
  progressRow.append(progressLabel, progressInput, progressValue)

  const phaseRow = document.createElement('div')
  phaseRow.className = 'asset-lab__boot-phase-row'
  const phaseButtons = new Map<BootProgressLabel, HTMLButtonElement>()
  for (const phase of PHASES) {
    const btn = createToolbarButton(phase.toUpperCase(), 'asset-lab__boot-btn--ghost')
    phaseButtons.set(phase, btn)
    phaseRow.append(btn)
  }

  const actionRow = document.createElement('div')
  actionRow.className = 'asset-lab__boot-action-row'
  const autoBtn = createToolbarButton('Auto demo')
  const retryBtn = createToolbarButton('Simulate error', 'asset-lab__boot-btn--ghost')
  const resetBtn = createToolbarButton('Reset', 'asset-lab__boot-btn--ghost')
  const widthBtn = createToolbarButton('390px mobile', 'asset-lab__boot-btn--ghost')
  actionRow.append(autoBtn, retryBtn, resetBtn, widthBtn)

  controls.append(progressRow, phaseRow, actionRow)

  const previewWrap = document.createElement('div')
  previewWrap.className = 'asset-lab__boot-preview'
  const previewHost = document.createElement('div')
  previewHost.className = 'asset-lab__boot-preview-host asset-lab__boot-preview-host--mobile'
  previewWrap.append(previewHost)

  workspace.append(controls, previewWrap)
  panel.append(workspace)

  let controller: BootScreenController | null = null
  let screen: HTMLElement | null = null
  let activePhase: BootProgressLabel = 'starting'
  let autoTimer = 0
  let mobileWidth = true
  let mounted = false

  const syncPhaseButtons = () => {
    for (const [phase, btn] of phaseButtons) {
      btn.classList.toggle('asset-lab__boot-btn--active', phase === activePhase)
    }
  }

  const applyProgress = (percent: number, label = activePhase) => {
    activePhase = label
    progressInput.value = String(percent)
    progressValue.textContent = `${percent}%`
    syncPhaseButtons()
    controller?.update(progressFor(percent, label))
  }

  const mountScreen = () => {
    previewHost.replaceChildren()
    screen = createBootScreenElement({ embedded: true })
    previewHost.append(screen)
    controller = bindBootScreen(screen)
    applyProgress(Number(progressInput.value), activePhase)
    mounted = true
  }

  const stopAuto = () => {
    if (!autoTimer) return
    window.clearInterval(autoTimer)
    autoTimer = 0
    autoBtn.textContent = 'Auto demo'
  }

  const teardownScreen = () => {
    stopAuto()
    if (controller) {
      void controller.dismiss()
      controller = null
    }
    previewHost.replaceChildren()
    screen = null
    mounted = false
  }

  progressInput.addEventListener('input', () => {
    stopAuto()
    applyProgress(Number(progressInput.value))
  })

  for (const [phase, btn] of phaseButtons) {
    btn.addEventListener('click', () => {
      stopAuto()
      applyProgress(Number(progressInput.value), phase)
    })
  }

  autoBtn.addEventListener('click', () => {
    if (autoTimer) {
      stopAuto()
      return
    }
    autoBtn.textContent = 'Stop demo'
    let step = 0
    autoTimer = window.setInterval(() => {
      step = (step + 2) % 102
      const percent = step > 100 ? 100 : step
      const phase = PHASES[Math.min(PHASES.length - 1, Math.floor((percent / 100) * (PHASES.length - 1)))] ?? 'starting'
      applyProgress(percent, phase)
      if (percent >= 100) stopAuto()
    }, 80)
  })

  retryBtn.addEventListener('click', () => {
    stopAuto()
    controller?.showRetrying()
    window.setTimeout(() => {
      void controller?.waitForRetry('Load failed — check your connection').then(() => {
        controller?.clearRetryState()
        applyProgress(Number(progressInput.value), activePhase)
      })
    }, 200)
  })

  resetBtn.addEventListener('click', () => {
    teardownScreen()
    activePhase = 'starting'
    progressInput.value = '0'
    progressValue.textContent = '0%'
    mountScreen()
  })

  widthBtn.addEventListener('click', () => {
    mobileWidth = !mobileWidth
    previewHost.classList.toggle('asset-lab__boot-preview-host--mobile', mobileWidth)
    previewHost.classList.toggle('asset-lab__boot-preview-host--wide', !mobileWidth)
    widthBtn.textContent = mobileWidth ? '390px mobile' : '400px desktop'
  })

  mountScreen()

  return {
    panel,
    dispose: () => {
      if (!mounted) return
      teardownScreen()
    },
  }
}
