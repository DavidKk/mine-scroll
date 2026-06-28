export type BootTier = 1 | 2 | 3

export type BootAssetGroup = 'tiles' | 'hud-icons' | 'cutouts' | 'fx' | 'panels' | 'hud-feedback' | 'audio'

export interface BootAsset {
  id: string
  url: string
  tier: BootTier
  group: BootAssetGroup
  weight: number
  optional?: boolean
}

export type BootProgressLabel = 'starting' | 'tiles' | 'ui' | 'fx' | 'ready'

export interface BootProgress {
  ratio: number
  displayPercent: number
  label: BootProgressLabel
  loaded: number
  total: number
  currentGroup?: BootAssetGroup
}

export interface BootAssetResult {
  id: string
  url: string
  ok: boolean
}

export interface BootResult {
  ok: boolean
  loaded: number
  failed: BootAsset[]
  durationMs: number
}

export interface BootSequenceOptions {
  onProgress?: (progress: BootProgress) => void
  signal?: AbortSignal
  maxConcurrent?: number
}

export interface BootScreenController {
  update(progress: BootProgress): void
  /** Label-only retry state — no RETRY button. */
  showRetrying(): void
  /** Waits until delay elapsed, then shows RETRY; resolves on click. */
  waitForRetry(message: string): Promise<void>
  clearRetryState(): void
  dismiss(): Promise<void>
}

/** Show manual RETRY only after this many ms of cumulative boot failure. */
export const BOOT_RETRY_UI_DELAY_MS = 12_000

/** Delay between silent auto-retries before timeout. */
export const BOOT_AUTO_RETRY_DELAY_MS = 2_000

export interface GameAssetManifestSnapshot {
  cutouts?: {
    items?: Record<string, string>
  }
  fx?: {
    effects?: Record<
      string,
      {
        frames?: string[]
        blendMode?: GlobalCompositeOperation
        frameWidth?: number
        frameHeight?: number
      }
    >
  }
  uiPanels?: {
    items?: Record<
      string,
      {
        src?: string
        width?: number
        height?: number
      }
    >
  }
}
