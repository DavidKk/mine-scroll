import { cookies } from 'next/headers'

import { generateToken } from '@/lib/jwt'
import { verify2fa } from '@/services/2fa'

import { AUTH_TOKEN_NAME } from './constants'
import { getSessionMaxAge } from './session-duration'

export async function login(username: string, password: string, token = '', rememberMe = false): Promise<void> {
  if (!username) throw new Error('Username is required')
  if (!password) throw new Error('Password is required')

  const secureCookie = process.env.NODE_ENV === 'production'
  if (secureCookie) {
    throw new Error('Local login is disabled in production. Use Signet.')
  }

  if (process.env.ACCESS_USERNAME !== username || process.env.ACCESS_PASSWORD !== password) {
    throw new Error('Invalid username or password')
  }

  const secret = process.env.ACCESS_2FA_SECRET
  if (secret && !(token && (await verify2fa({ token, secret })))) {
    throw new Error('Invalid username or password')
  }

  const maxAge = getSessionMaxAge(rememberMe)
  const authToken = await generateToken({ authenticated: true, sub: username, provider: 'local' }, { expiresIn: maxAge })
  const cookieStore = await cookies()
  cookieStore.set(AUTH_TOKEN_NAME, authToken, {
    httpOnly: true,
    secure: secureCookie,
    maxAge,
    path: '/',
    sameSite: 'lax',
  })
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_TOKEN_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
  })
}
