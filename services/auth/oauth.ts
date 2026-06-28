import { cookies } from 'next/headers'

import { generateToken, type JWTPayload, verifyJwtWithSecret } from '@/lib/jwt'

import { AUTH_TOKEN_NAME } from './constants'
import { getSessionMaxAge } from './session-duration'

interface ThirdPartyPayload extends JWTPayload {
  username?: string
  authenticated?: boolean
}

export async function exchangeOAuthSession(token: string): Promise<void> {
  if (!token) throw new Error('token is required')

  const payload = await verifyThirdPartyToken(token)
  const allowedUsername = process.env.ACCESS_USERNAME
  if (!allowedUsername) throw new Error('ACCESS_USERNAME is required to validate third-party tokens.')

  if (!payload.username || payload.username !== allowedUsername) {
    throw new Error('Third-party token does not match the configured ACCESS_USERNAME.')
  }

  if (!payload.authenticated) {
    throw new Error('Third-party token is not marked as authenticated.')
  }

  const maxAge = getSessionMaxAge(true)
  const sessionToken = await generateToken(
    {
      authenticated: true,
      provider: 'oauth',
      username: payload.username,
      sub: payload.username,
    },
    { expiresIn: maxAge }
  )

  const cookieStore = await cookies()
  cookieStore.set(AUTH_TOKEN_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    path: '/',
    sameSite: 'lax',
  })
}

async function verifyThirdPartyToken(token: string): Promise<ThirdPartyPayload> {
  const secret = process.env.OAUTH_JWT_SECRET || process.env.JWT_SECRET
  if (!secret) throw new Error('OAUTH_JWT_SECRET or JWT_SECRET is required to verify third-party tokens.')

  const payload = await verifyJwtWithSecret(token, secret)
  if (!payload) throw new Error('Invalid oauth token')
  return payload as ThirdPartyPayload
}
