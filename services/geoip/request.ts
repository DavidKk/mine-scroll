/** ISO 3166-1 alpha-2 country code from an untrusted value. */
export function sanitizeCountryCode(value: unknown): string | undefined {
  const code = String(value ?? '')
    .trim()
    .toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return undefined
  return code
}

/** Vercel-injected country code for the incoming request (absent in local dev). */
export function readRequestCountryCode(request: Request): string | undefined {
  return sanitizeCountryCode(request.headers.get('x-vercel-ip-country'))
}
