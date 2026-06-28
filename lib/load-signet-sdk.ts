import { getSignetSdkModuleUrl } from '@/lib/signet-sdk-url'

export type SignetClientModule = {
  normalizeAuthCenterOrigin: (origin: string) => string
  getVerifyApiUrl: (authCenterOrigin: string) => string
  getOAuthPublicKeyUrl: (authCenterOrigin: string) => string
  buildLoginUrl: (options: { authCenterOrigin: string; redirectUrl: string; state?: string }) => string
  buildOAuthLoginUrl: (options: { authCenterOrigin: string; redirectUrl: string; state: string; clientPublicKey: string; callbackOrigin?: string }) => string
  parseLoginCallbackParams: (input: URLSearchParams | string) => { token: string | null; state: string | null }
  getLoginCallbackFromWindow: () => { token: string | null; state: string | null }
  stripLoginCallbackFromUrl: (href: string) => string
  isLoginCallbackTokenInHash: (href: string) => boolean
  verifyTokenAtAuthCenter: (options: {
    authCenterOrigin: string
    token: string
    audience?: string
    scope?: string
    fetch?: typeof fetch
  }) => Promise<{ ok: boolean; status: number; response: Record<string, unknown> | null; error?: string }>
}

const signetLoadPromises = new Map<string, Promise<SignetClientModule>>()

function isRemoteModuleUrl(moduleUrl: string): boolean {
  try {
    const u = new URL(moduleUrl)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

async function importSignetModule(moduleUrl: string): Promise<SignetClientModule> {
  const onServer = typeof window === 'undefined'
  if (!onServer || !isRemoteModuleUrl(moduleUrl)) {
    return import(/* webpackIgnore: true */ moduleUrl) as Promise<SignetClientModule>
  }

  const res = await fetch(moduleUrl)
  if (!res.ok) {
    throw new Error(`Signet SDK fetch failed (${res.status} ${res.statusText}): ${moduleUrl}`)
  }
  const source = await res.text()
  const dataUrl = `data:text/javascript;base64,${utf8ToBase64(source)}`
  return import(/* webpackIgnore: true */ dataUrl) as Promise<SignetClientModule>
}

export function loadSignetSdk(moduleUrl?: string): Promise<SignetClientModule> {
  const url = moduleUrl ?? getSignetSdkModuleUrl()
  let p = signetLoadPromises.get(url)
  if (!p) {
    p = importSignetModule(url).catch((err: unknown) => {
      signetLoadPromises.delete(url)
      throw err
    })
    signetLoadPromises.set(url, p)
  }
  return p
}
