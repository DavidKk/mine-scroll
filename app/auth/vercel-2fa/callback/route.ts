import { serialize } from 'cookie'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { generateToken } from '@/lib/jwt'
import { loadSignetSdk } from '@/lib/load-signet-sdk'
import { getSignetAuthCenterOrigin, getSignetSdkModuleUrl } from '@/lib/signet-sdk-url'
import { AUTH_TOKEN_NAME, VF2FA_NEXT_COOKIE, VF2FA_OAUTH_STATE_COOKIE, VF2FA_REMEMBER_ME_COOKIE } from '@/services/auth/constants'
import { safeRelativePath } from '@/services/auth/safe-relative-path'
import { getSessionMaxAge } from '@/services/auth/session-duration'

export const dynamic = 'force-dynamic'

const DEFAULT_POST_LOGIN = '/admin/assets/sources'

function loginErrorRedirect(origin: string, code: string): NextResponse {
  const target = new URL('/login', origin)
  target.searchParams.set('vf2fa_error', code)
  const headers = new Headers()
  headers.append('Set-Cookie', serialize(VF2FA_OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 }))
  headers.append('Set-Cookie', serialize(VF2FA_NEXT_COOKIE, '', { path: '/', maxAge: 0 }))
  headers.append('Set-Cookie', serialize(VF2FA_REMEMBER_ME_COOKIE, '', { path: '/', maxAge: 0 }))
  return NextResponse.redirect(target, { headers })
}

/** Signet unified login callback — register in auth center `ALLOWED_REDIRECT_URLS`. */
export async function GET(request: Request) {
  const url = new URL(request.url)

  try {
    const authCenterOrigin = getSignetAuthCenterOrigin()
    if (!authCenterOrigin) {
      return new NextResponse('Signet not configured: set SIGNET_SDK_URL to your hosted …/signet-client.mjs', {
        status: 503,
      })
    }

    const signet = await loadSignetSdk(getSignetSdkModuleUrl())
    const { token, state } = signet.parseLoginCallbackParams(url.searchParams)

    const cookieStore = await cookies()
    const expectedState = cookieStore.get(VF2FA_OAUTH_STATE_COOKIE)?.value
    const nextRaw = cookieStore.get(VF2FA_NEXT_COOKIE)?.value
    const rememberMe = cookieStore.get(VF2FA_REMEMBER_ME_COOKIE)?.value === '1'

    if (!state || !expectedState || state !== expectedState) {
      return loginErrorRedirect(url.origin, 'invalid_state')
    }

    if (!token) {
      return loginErrorRedirect(url.origin, 'missing_token')
    }

    const verified = await signet.verifyTokenAtAuthCenter({ authCenterOrigin, token })
    if (!verified.ok || !verified.response) {
      return loginErrorRedirect(url.origin, 'verify_failed')
    }

    const envelope = verified.response as Record<string, unknown>
    const data = envelope.data as Record<string, unknown> | undefined
    const user = data?.user as Record<string, unknown> | undefined
    const claimsFromApi = data?.claims as Record<string, unknown> | undefined
    const sub = typeof user?.sub === 'string' ? user.sub : 'signet'

    const displayUsername =
      (typeof user?.username === 'string' && user.username.trim()) ||
      (typeof claimsFromApi?.preferred_username === 'string' && claimsFromApi.preferred_username.trim()) ||
      (typeof claimsFromApi?.username === 'string' && claimsFromApi.username.trim()) ||
      undefined
    const displayEmail = (typeof user?.email === 'string' && user.email.trim()) || (typeof claimsFromApi?.email === 'string' && claimsFromApi.email.trim()) || undefined

    const sessionPayload: Record<string, unknown> = { authenticated: true, sub, provider: 'signet' }
    if (displayUsername) {
      sessionPayload.username = displayUsername
      sessionPayload.preferred_username = displayUsername
    }
    if (displayEmail) sessionPayload.email = displayEmail

    const maxAge = getSessionMaxAge(rememberMe)
    const authToken = await generateToken(sessionPayload, { expiresIn: maxAge })

    const headers = new Headers()
    headers.append('Set-Cookie', serialize(VF2FA_OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 }))
    headers.append('Set-Cookie', serialize(VF2FA_NEXT_COOKIE, '', { path: '/', maxAge: 0 }))
    headers.append('Set-Cookie', serialize(VF2FA_REMEMBER_ME_COOKIE, '', { path: '/', maxAge: 0 }))
    headers.append(
      'Set-Cookie',
      serialize(AUTH_TOKEN_NAME, authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge,
        path: '/',
        sameSite: 'lax',
      })
    )

    const nextPath = safeRelativePath(nextRaw, DEFAULT_POST_LOGIN)
    return NextResponse.redirect(new URL(nextPath, url.origin), { headers })
  } catch {
    return loginErrorRedirect(url.origin, 'verify_failed')
  }
}
