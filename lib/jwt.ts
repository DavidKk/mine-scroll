import { createHmac, timingSafeEqual } from 'node:crypto'

export type JWTPayload = Record<string, unknown>

export function parseExpirationSeconds(exp: string | number): number {
  if (typeof exp === 'number' && Number.isFinite(exp)) {
    return Math.max(1, Math.floor(exp))
  }
  const raw = String(exp).trim()
  if (/^\d+$/.test(raw)) {
    return Math.max(1, parseInt(raw, 10))
  }
  const m = raw.match(/^(\d+)\s*([smhd])$/i)
  if (m) {
    const n = parseInt(m[1], 10)
    const mult = { s: 1, m: 60, h: 3600, d: 86400 } as const
    const u = m[2].toLowerCase() as keyof typeof mult
    return Math.max(1, n * (mult[u] ?? 86400))
  }
  return 86400
}

function signHs256Jwt(header: object, payload: object, secret: Uint8Array): string {
  const h = Buffer.from(JSON.stringify(header)).toString('base64url')
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const data = `${h}.${p}`
  const sig = createHmac('sha256', Buffer.from(secret)).update(data, 'utf8').digest('base64url')
  return `${data}.${sig}`
}

function verifyHs256Jwt(token: string, secretKey: Uint8Array): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [a, b, c] = parts
    if (!a || !b || !c) return null
    const data = `${a}.${b}`
    const expectedSig = createHmac('sha256', Buffer.from(secretKey)).update(data, 'utf8').digest('base64url')
    const sigBuf = Buffer.from(c, 'base64url')
    const expBuf = Buffer.from(expectedSig, 'base64url')
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8')) as JWTPayload
    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp === 'number' && payload.exp < now) return null
    return payload
  } catch {
    return null
  }
}

function getJWTSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('process.env.JWT_SECRET is not defined')
  return new TextEncoder().encode(secret)
}

export async function generateToken(payload: object, options?: { expiresIn?: string | number }): Promise<string> {
  const secretKey = getJWTSecretKey()
  const rawExpiresIn = options?.expiresIn ?? (process.env.JWT_EXPIRES_IN || '1d')
  const seconds = parseExpirationSeconds(rawExpiresIn)
  const now = Math.floor(Date.now() / 1000)
  const body: Record<string, unknown> = {
    ...(payload as Record<string, unknown>),
    iat: now,
    exp: now + seconds,
  }
  return signHs256Jwt({ alg: 'HS256', typ: 'JWT' }, body, secretKey)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  return verifyHs256Jwt(token, getJWTSecretKey())
}

/** Verify HS256 JWT with an arbitrary secret (e.g. OAuth third-party token). */
export async function verifyJwtWithSecret(token: string, secret: string): Promise<JWTPayload | null> {
  return verifyHs256Jwt(token, new TextEncoder().encode(secret))
}
