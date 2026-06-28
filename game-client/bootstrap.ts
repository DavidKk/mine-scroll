import { type ClientRoute, mountClientRoute } from './app/mount-route.ts'
import {
  bindBootScreen,
  BOOT_AUTO_RETRY_DELAY_MS,
  BOOT_RETRY_UI_DELAY_MS,
  dismissBootScreen,
  preloadGameAudio,
  registerBootServiceWorker,
  resetBootSequence,
  retryBootSequence,
  runBootSequence,
} from './ui/boot/index.ts'
import { attachPageScrollbar } from './ui/custom-scrollbar.ts'
import { loadGameAssets } from './ui/game-assets.ts'
import { loadHudSprites } from './ui/hud-sprites.ts'
import { loadTileSprites } from './ui/tile-sprites.ts'

let bootPromise: Promise<void> | null = null
let clientBootFinished = false
let scrollbarAttached = false

export interface EnsureClientBootOptions {
  /** MineScroll boot overlay element; omit for admin silent boot. */
  bootScreenEl?: HTMLElement | null
  /** Load assets in the background without the game boot UI (admin). */
  silent?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function resolveBootBindRoot(bootScreenEl?: HTMLElement | null): HTMLElement | Document {
  return bootScreenEl ?? document
}

async function bootWithProgress(bootScreen: ReturnType<typeof bindBootScreen>) {
  resetBootSequence()
  return runBootSequence({
    onProgress: (progress) => bootScreen.update(progress),
  })
}

async function bootUntilReady(bootScreen: ReturnType<typeof bindBootScreen>) {
  let result = await bootWithProgress(bootScreen)
  let failureStartedAt = 0

  while (!result.ok) {
    if (failureStartedAt === 0) failureStartedAt = performance.now()
    const elapsed = performance.now() - failureStartedAt

    if (elapsed >= BOOT_RETRY_UI_DELAY_MS) {
      await bootScreen.waitForRetry('Load failed — check your connection')
      failureStartedAt = 0
    } else {
      bootScreen.showRetrying()
      await sleep(BOOT_AUTO_RETRY_DELAY_MS)
    }

    result = await bootWithProgress(bootScreen)
  }

  bootScreen.clearRetryState()
}

async function bootUntilReadySilent(): Promise<void> {
  const maxAttempts = 6
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    resetBootSequence()
    const result = await runBootSequence()
    if (result.ok) return
    if (attempt < maxAttempts - 1) {
      await sleep(BOOT_AUTO_RETRY_DELAY_MS)
    }
  }
  throw new Error('Failed to load game assets')
}

async function runClientBoot(options: EnsureClientBootOptions = {}): Promise<void> {
  const { bootScreenEl = null, silent = false } = options

  if (!scrollbarAttached) {
    attachPageScrollbar()
    scrollbarAttached = true
  }

  if (silent) {
    await bootUntilReadySilent()
    await Promise.all([loadTileSprites(), loadHudSprites(), loadGameAssets()])
    registerBootServiceWorker()
    clientBootFinished = true
    return
  }

  const bindRoot = resolveBootBindRoot(bootScreenEl)
  const bootScreen = bindBootScreen(bindRoot)
  await bootUntilReady(bootScreen)
  await Promise.all([loadTileSprites(), loadHudSprites(), loadGameAssets()])
  await bootScreen.dismiss()
  preloadGameAudio()
  registerBootServiceWorker()
  clientBootFinished = true
}

export function isClientBootFinished(): boolean {
  return clientBootFinished
}

export function ensureClientBoot(options: EnsureClientBootOptions = {}): Promise<void> {
  const { bootScreenEl = null, silent = false } = options
  const dismissForCaller = () => {
    if (!silent) dismissBootScreen(resolveBootBindRoot(bootScreenEl))
  }

  if (clientBootFinished) {
    dismissForCaller()
    return Promise.resolve()
  }

  if (!bootPromise) {
    bootPromise = runClientBoot({ bootScreenEl, silent }).catch(async (error) => {
      bootPromise = null
      console.error('Failed to start app', error)
      if (!silent) {
        try {
          const bootScreen = bindBootScreen(resolveBootBindRoot(bootScreenEl))
          await bootScreen.waitForRetry('Startup failed — refresh the page')
          void retryBootSequence().then(() => window.location.reload())
        } catch {
          // Boot shell missing — nothing else to show.
        }
      }
      throw error
    })
  }

  return bootPromise.then(dismissForCaller)
}

export function mountRoute(root: HTMLElement, route: ClientRoute): () => void {
  return mountClientRoute(root, route)
}

export { preloadGameAudio }

export type { ClientRoute }
