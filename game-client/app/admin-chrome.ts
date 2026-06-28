/** Shared admin chrome helpers (logout, nav). */

export async function performAdminLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Still redirect — user intent is to leave the session.
  }
  const redirectUrl = encodeURIComponent(window.location.pathname)
  window.location.assign(`/login?redirectUrl=${redirectUrl}`)
}

export function createAdminLogoutButton(className: string): HTMLButtonElement {
  const logout = document.createElement('button')
  logout.type = 'button'
  logout.className = className
  logout.textContent = 'Logout'
  logout.addEventListener('click', () => {
    void performAdminLogout()
  })
  return logout
}
