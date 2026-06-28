let appRoot: HTMLElement | null = null

export function setAppRoot(root: HTMLElement): void {
  appRoot = root
}

export function getAppRoot(): HTMLElement | null {
  return appRoot
}
