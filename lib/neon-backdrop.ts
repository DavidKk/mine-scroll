/** Layer class names for the shared neon backdrop (see game-client/styles/neon-backdrop.css). */
export const NEON_BACKDROP = {
  root: 'neon-backdrop',
  aurora: 'neon-backdrop__aurora',
  orbs: 'neon-backdrop__orbs',
  orbA: 'neon-backdrop__orb neon-backdrop__orb--a',
  orbB: 'neon-backdrop__orb neon-backdrop__orb--b',
  orbC: 'neon-backdrop__orb neon-backdrop__orb--c',
  starsFar: 'neon-backdrop__stars neon-backdrop__stars--far',
  starsNear: 'neon-backdrop__stars neon-backdrop__stars--near',
  grid: 'neon-backdrop__grid',
  scan: 'neon-backdrop__scan',
  vignette: 'neon-backdrop__vignette',
} as const

export const NEON_BACKDROP_LAYERS_HTML = `
  <div class="${NEON_BACKDROP.aurora}"></div>
  <div class="${NEON_BACKDROP.orbs}">
    <span class="${NEON_BACKDROP.orbA}" aria-hidden="true"></span>
    <span class="${NEON_BACKDROP.orbB}" aria-hidden="true"></span>
    <span class="${NEON_BACKDROP.orbC}" aria-hidden="true"></span>
  </div>
  <div class="${NEON_BACKDROP.starsFar}"></div>
  <div class="${NEON_BACKDROP.starsNear}"></div>
  <div class="${NEON_BACKDROP.grid}"></div>
  <div class="${NEON_BACKDROP.scan}"></div>
  <div class="${NEON_BACKDROP.vignette}"></div>
`

/** Imperative backdrop for game-client admin shell. */
export function createNeonBackdropElement(): HTMLElement {
  const backdrop = document.createElement('div')
  backdrop.className = NEON_BACKDROP.root
  backdrop.setAttribute('aria-hidden', 'true')
  backdrop.innerHTML = NEON_BACKDROP_LAYERS_HTML
  return backdrop
}
