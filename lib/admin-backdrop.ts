/** Tailwind class strings for the shared admin/login backdrop. */
export const ADMIN_BACKDROP = {
  root: 'pointer-events-none absolute inset-0 z-0 overflow-hidden [.admin-shell_&]:opacity-55',
  aurora: 'absolute -inset-[20%] animate-admin-aurora-drift bg-admin-aurora motion-reduce:animate-none',
  starsFar: 'absolute inset-0 animate-admin-star-twinkle bg-admin-stars-far opacity-45 motion-reduce:animate-none',
  starsNear: 'absolute inset-0 bg-admin-stars-near opacity-[0.28]',
  grid: 'absolute inset-0 bg-admin-grid bg-[length:40px_40px] [mask-image:radial-gradient(circle_at_50%_40%,black_15%,transparent_82%)]',
  vignette: 'absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,transparent_40%,rgba(0,0,0,0.45)_100%)]',
} as const

/** Imperative backdrop for game-client admin shell (plain CSS — no Tailwind runtime). */
export function createAdminBackdropElement(): HTMLElement {
  const backdrop = document.createElement('div')
  backdrop.className = 'game-admin-backdrop'
  backdrop.setAttribute('aria-hidden', 'true')
  backdrop.innerHTML = `
    <div class="game-admin-backdrop__aurora"></div>
    <div class="game-admin-backdrop__stars game-admin-backdrop__stars--far"></div>
    <div class="game-admin-backdrop__stars game-admin-backdrop__stars--near"></div>
    <div class="game-admin-backdrop__grid"></div>
    <div class="game-admin-backdrop__vignette"></div>
  `
  return backdrop
}
