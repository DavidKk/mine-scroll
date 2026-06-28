import { headers } from 'next/headers'

/** Valid `host` / `x-forwarded-host` token (hostname or hostname:port, IPv6 bracket form). */
const HOST_PATTERN = /^(?:\[[0-9a-f:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::\d{1,5})?$/i

function localhostFallback(): URL {
  const port = process.env.PORT ?? '3000'
  return new URL(`http://localhost:${port}`)
}

function hostnameOf(host: string): string {
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    return end === -1 ? host : host.slice(1, end)
  }
  const colon = host.lastIndexOf(':')
  if (colon === -1) return host
  const port = host.slice(colon + 1)
  return /^\d{1,5}$/.test(port) ? host.slice(0, colon) : host
}

function isLocalHostname(host: string): boolean {
  const name = hostnameOf(host).toLowerCase()
  return name === 'localhost' || name === '127.0.0.1' || name === '::1'
}

function firstHeaderValue(raw: string | null): string | null {
  if (!raw) return null
  return raw.split(',')[0]?.trim() ?? null
}

/** Reject malformed or injectable host values before building canonical URLs. */
export function sanitizeRequestHost(raw: string | null | undefined): string | null {
  const candidate = firstHeaderValue(raw ?? null)?.toLowerCase()
  if (!candidate || candidate.includes('@') || !HOST_PATTERN.test(candidate)) {
    return null
  }
  return candidate
}

function resolveRequestProtocol(proto: string | null | undefined, host: string): 'http' | 'https' {
  const normalized = firstHeaderValue(proto ?? null)?.toLowerCase()
  if (normalized === 'http' || normalized === 'https') return normalized
  return isLocalHostname(host) ? 'http' : 'https'
}

/** Request-scoped site origin for SEO metadata (no `SITE_URL` env). */
export async function getRequestMetadataBase(): Promise<URL> {
  const headerStore = await headers()
  const host = sanitizeRequestHost(headerStore.get('x-forwarded-host')) ?? sanitizeRequestHost(headerStore.get('host'))

  if (!host) return localhostFallback()

  const protocol = resolveRequestProtocol(headerStore.get('x-forwarded-proto'), host)
  return new URL(`${protocol}://${host}`)
}
