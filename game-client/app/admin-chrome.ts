/** Shared admin chrome helpers (user menu, logout, nav). */

const USER_ICON_SVG = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <circle cx="8" cy="5.25" r="2.5" stroke="currentColor" stroke-width="1.35"/>
  <path d="M3.25 13.25c.65-2.45 2.55-3.75 4.75-3.75s4.1 1.3 4.75 3.75" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>
</svg>`

type AuthMeResponse = {
  authenticated?: boolean
  username?: string
}

export async function performAdminLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Still redirect — user intent is to leave the session.
  }
  const redirectUrl = encodeURIComponent(window.location.pathname)
  window.location.assign(`/login?redirectUrl=${redirectUrl}`)
}

async function fetchAdminUsername(): Promise<string> {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (!response.ok) return 'User'
    const data = (await response.json()) as AuthMeResponse
    return data.username?.trim() || 'User'
  } catch {
    return 'User'
  }
}

export function createAdminUserMenu(): HTMLElement {
  const root = document.createElement('div')
  root.className = 'admin-shell__user-menu'

  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'admin-shell__user-trigger'
  trigger.setAttribute('aria-label', 'Account menu')
  trigger.setAttribute('aria-haspopup', 'menu')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.innerHTML = USER_ICON_SVG

  const menu = document.createElement('div')
  menu.className = 'admin-shell__user-dropdown'
  menu.setAttribute('role', 'menu')
  menu.hidden = true

  const nameRow = document.createElement('div')
  nameRow.className = 'admin-shell__user-dropdown-name'
  nameRow.setAttribute('role', 'presentation')
  nameRow.textContent = '…'

  const logout = document.createElement('button')
  logout.type = 'button'
  logout.className = 'admin-shell__user-dropdown-action'
  logout.setAttribute('role', 'menuitem')
  logout.textContent = 'Logout'

  menu.append(nameRow, logout)
  root.append(trigger, menu)

  let outsideListener: ((event: PointerEvent) => void) | null = null
  let keydownListener: ((event: KeyboardEvent) => void) | null = null

  const closeMenu = (): void => {
    menu.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    root.classList.remove('admin-shell__user-menu--open')
    if (outsideListener) document.removeEventListener('pointerdown', outsideListener)
    if (keydownListener) document.removeEventListener('keydown', keydownListener)
    outsideListener = null
    keydownListener = null
  }

  const openMenu = (): void => {
    menu.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    root.classList.add('admin-shell__user-menu--open')

    outsideListener = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && root.contains(target)) return
      closeMenu()
    }

    keydownListener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeMenu()
      trigger.focus()
    }

    document.addEventListener('pointerdown', outsideListener)
    document.addEventListener('keydown', keydownListener)
  }

  logout.addEventListener('click', () => {
    closeMenu()
    void performAdminLogout()
  })

  void fetchAdminUsername().then((username) => {
    nameRow.textContent = username
    trigger.setAttribute('aria-label', `Account menu for ${username}`)
  })

  trigger.addEventListener('click', () => {
    if (menu.hidden) {
      openMenu()
      return
    }
    closeMenu()
  })

  return root
}
