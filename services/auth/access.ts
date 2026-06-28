import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { isJwtConfigured } from '@/lib/auth-config'
import { verifyToken } from '@/lib/jwt'

import { AUTH_TOKEN_NAME } from './constants'

export interface CheckAccessOptions {
  loginUrl?: string
  redirectUrl?: string
  isApiRouter?: boolean
}

export async function validateCookie(): Promise<boolean> {
  if (!isJwtConfigured()) return false

  try {
    const cookieStore = await cookies()
    const authInfo = cookieStore.get(AUTH_TOKEN_NAME)
    if (!authInfo?.value) return false
    const user = await verifyToken(authInfo.value)
    return Boolean(user && user.authenticated === true)
  } catch {
    return false
  }
}

export async function checkAccess(options?: CheckAccessOptions): Promise<true | false> {
  const { redirectUrl = '/admin/assets/sources', loginUrl = '/login', isApiRouter = true } = options ?? {}
  if (await validateCookie()) return true

  if (isApiRouter) return false

  const url = redirectUrl ? `${loginUrl}?redirectUrl=${encodeURIComponent(redirectUrl)}` : loginUrl
  redirect(url)
}

export interface CheckUnAccessOptions {
  redirectUrl?: string
  isApiRouter?: boolean
}

export async function checkUnAccess(options?: CheckUnAccessOptions): Promise<true | false> {
  const { redirectUrl = '/admin/assets/sources', isApiRouter = true } = options ?? {}
  if (!(await validateCookie())) return true
  if (isApiRouter) return false
  redirect(redirectUrl)
}
