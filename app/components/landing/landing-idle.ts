/** Wait for an idle slice before loading heavy landing attract assets. */
export function waitForLandingIdle(timeoutMs = 1800): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: timeoutMs })
      return
    }
    window.requestAnimationFrame(() => resolve())
  })
}
