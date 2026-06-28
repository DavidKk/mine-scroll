const DEFAULT_AUTH_CENTER_ORIGIN = 'https://vercel-2fa.vercel.app'

function getExplicitSignetSdkUrlFromEnv(): string | null {
  const v = process.env.SIGNET_SDK_URL?.trim()
  return v || null
}

/**
 * Signet auth center base URL (scheme + host, no trailing slash).
 * Returns `null` when `SIGNET_SDK_URL` is unset or not a `signet-client.mjs` URL.
 */
export function getSignetAuthCenterOrigin(): string | null {
  const sdkUrl = getExplicitSignetSdkUrlFromEnv()
  if (!sdkUrl) return null

  try {
    const u = new URL(sdkUrl)
    const path = u.pathname.replace(/\/+$/, '') || ''
    if (!path.endsWith('signet-client.mjs')) return null
    return u.origin
  } catch {
    return null
  }
}

function resolveAuthCenterBaseForSdkUrl(): string {
  return getSignetAuthCenterOrigin() || DEFAULT_AUTH_CENTER_ORIGIN
}

/** Full URL of the hosted Signet SDK (`signet-client.mjs`). */
export function getSignetSdkModuleUrl(): string {
  const explicit = getExplicitSignetSdkUrlFromEnv()
  if (explicit) return explicit
  const base = resolveAuthCenterBaseForSdkUrl()
  return `${base}/sdk/signet-client.mjs`
}
