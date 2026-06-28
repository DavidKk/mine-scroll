let navigateFn: ((path: string) => void) | null = null
let replaceFn: ((path: string) => void) | null = null

export function registerAppNavigator(push: (path: string) => void, replace?: (path: string) => void): void {
  navigateFn = push
  replaceFn = replace ?? push
}

export function unregisterAppNavigator(): void {
  navigateFn = null
  replaceFn = null
}

function normalizePath(path: string): string {
  return path.replace(/\/+$/, '') || '/'
}

export function navigateApp(path: string): void {
  const normalized = normalizePath(path)
  const current = normalizePath(window.location.pathname)
  if (normalized === current) return

  if (navigateFn) {
    navigateFn(path)
    return
  }

  window.location.assign(path)
}

export function replaceAppPath(path: string): void {
  const normalized = normalizePath(path)
  const current = normalizePath(window.location.pathname)
  if (normalized === current) return

  if (replaceFn) {
    replaceFn(path)
    return
  }

  window.history.replaceState(null, '', path)
}
