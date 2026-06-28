export type GameNotificationTone = 'success' | 'error' | 'warning'

export interface GameNotificationOptions {
  duration?: number
}

export interface GameNotificationStackOptions {
  maxNotifications?: number
}

export interface GameNotificationController {
  success(message: string, options?: GameNotificationOptions): void
  error(message: string, options?: GameNotificationOptions): void
  warning(message: string, options?: GameNotificationOptions): void
  clearAll(): void
  dispose(): void
}

const DEFAULT_DURATION: Record<GameNotificationTone, number> = {
  success: 2800,
  error: 4200,
  warning: 3600,
}

const TONE_LABEL: Record<GameNotificationTone, string> = {
  success: 'OK',
  error: 'ERR',
  warning: 'WARN',
}

interface StackEntry {
  id: string
  element: HTMLElement
}

function createNotificationId(): string {
  return `notify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createGameNotificationStack(host: HTMLElement, options: GameNotificationStackOptions = {}): GameNotificationController {
  const maxNotifications = options.maxNotifications ?? 10

  const stack = document.createElement('div')
  stack.className = 'game-notification-stack'
  stack.setAttribute('aria-live', 'polite')
  stack.setAttribute('aria-relevant', 'additions')
  host.append(stack)

  const entries: StackEntry[] = []
  const timers = new Map<string, number>()

  function removeFromStack(id: string): void {
    const index = entries.findIndex((entry) => entry.id === id)
    if (index >= 0) entries.splice(index, 1)
  }

  function removeItem(item: HTMLElement, animated = true): void {
    const id = item.dataset.notificationId
    if (!id) return

    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }

    removeFromStack(id)

    if (!item.isConnected) return

    if (animated) {
      item.classList.remove('game-notification--visible')
      item.classList.add('game-notification--leaving')
      window.setTimeout(() => item.remove(), 220)
      return
    }

    item.remove()
  }

  function pruneOverflow(): void {
    while (entries.length >= maxNotifications) {
      const oldest = entries[0]
      if (!oldest) break
      removeItem(oldest.element, false)
    }
  }

  function clearAll(): void {
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()
    entries.splice(0, entries.length)
    stack.replaceChildren()
  }

  function push(tone: GameNotificationTone, message: string, pushOptions: GameNotificationOptions = {}): void {
    pruneOverflow()

    const id = createNotificationId()
    const item = document.createElement('div')
    item.className = `game-notification game-notification--${tone}`
    item.dataset.notificationId = id
    item.innerHTML = `
      <div class="game-notification__inner">
        <span class="game-notification__mark" aria-hidden="true">${TONE_LABEL[tone]}</span>
        <div class="game-notification__message">${message}</div>
        <button type="button" class="game-notification__close" aria-label="Dismiss notification"></button>
      </div>
    `

    item.querySelector('.game-notification__close')?.addEventListener('click', () => removeItem(item))
    stack.append(item)
    entries.push({ id, element: item })

    requestAnimationFrame(() => {
      requestAnimationFrame(() => item.classList.add('game-notification--visible'))
    })

    const duration = pushOptions.duration ?? DEFAULT_DURATION[tone]
    if (duration > 0) {
      timers.set(
        id,
        window.setTimeout(() => removeItem(item), duration)
      )
    }
  }

  return {
    success(message, notifyOptions) {
      push('success', message, notifyOptions)
    },
    error(message, notifyOptions) {
      push('error', message, notifyOptions)
    },
    warning(message, notifyOptions) {
      push('warning', message, notifyOptions)
    },
    clearAll,
    dispose() {
      clearAll()
      stack.remove()
    },
  }
}
