import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { verifyToken } from '@/lib/jwt'
import { validateCookie } from '@/services/auth/access'
import { AUTH_TOKEN_NAME } from '@/services/auth/constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await validateCookie())) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_NAME)?.value
  const payload = token ? await verifyToken(token) : null
  const fromJwt =
    (typeof payload?.preferred_username === 'string' && payload.preferred_username) ||
    (typeof payload?.username === 'string' && payload.username) ||
    (typeof payload?.sub === 'string' && payload.sub) ||
    null
  const username = fromJwt || process.env.ACCESS_USERNAME || 'Admin'

  return NextResponse.json({
    authenticated: true,
    username,
    provider: typeof payload?.provider === 'string' ? payload.provider : null,
  })
}
