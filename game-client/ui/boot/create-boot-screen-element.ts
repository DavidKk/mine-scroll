export interface CreateBootScreenOptions {
  /** Embed inside asset lab instead of fullscreen overlay. */
  embedded?: boolean
  brandName?: string
}

export function createBootScreenElement(options: CreateBootScreenOptions = {}): HTMLElement {
  const brandName = options.brandName ?? 'MineScroll'
  const screen = document.createElement('div')
  screen.id = 'boot-screen'
  screen.className = options.embedded ? 'boot-screen boot-screen--embedded' : 'boot-screen'
  screen.setAttribute('role', 'status')
  screen.setAttribute('aria-live', 'polite')
  screen.setAttribute('aria-busy', 'true')

  screen.innerHTML = `
    <div class="boot-screen__backdrop">
      <div class="boot-screen__aurora"></div>
      <div class="boot-screen__stars boot-screen__stars--far"></div>
      <div class="boot-screen__stars boot-screen__stars--near"></div>
      <div class="boot-screen__grid-lines"></div>
      <div class="boot-screen__vignette"></div>
    </div>
    <div class="boot-screen__panel">
      <div class="boot-screen__panel-glow" aria-hidden="true"></div>
      <div class="boot-screen__panel-frame" aria-hidden="true"></div>
      <div class="boot-screen__panel-scanlines" aria-hidden="true"></div>
      <div class="boot-screen__grid-wrap">
        <div class="boot-screen__grid-stage">
          <div class="boot-screen__grid-scan" aria-hidden="true"></div>
          <div class="boot-screen__grid" role="group" aria-label="Mini ${brandName}">
            ${Array.from({ length: 9 }, () => '<button type="button" class="boot-screen__cell"></button>').join('')}
          </div>
        </div>
        <p class="boot-screen__grid-hint">Tap cells while loading</p>
      </div>
      <h1 class="boot-screen__title">${brandName}</h1>
      <p class="boot-screen__label" id="boot-label">INITIALIZING — 0%</p>
      <div class="boot-screen__rail-wrap">
        <div class="boot-screen__track-shell">
          <div class="boot-screen__track-clip">
            <div class="boot-screen__track-glow" aria-hidden="true"></div>
            <div class="boot-screen__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div class="boot-screen__fill" id="boot-fill">
                <div class="boot-screen__fill-spark" aria-hidden="true"></div>
                <div class="boot-screen__fill-head" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="boot-screen__error">
        <p class="boot-screen__error-msg"></p>
        <button type="button" class="boot-screen__action">
          <span class="boot-screen__action-plate" aria-hidden="true"></span>
          <span class="boot-screen__action-text">RETRY</span>
        </button>
      </div>
    </div>
  `

  return screen
}
