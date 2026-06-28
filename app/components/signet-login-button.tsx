'use client'

import { useCallback, useEffect, useState } from 'react'

import { loadSignetSdk } from '@/lib/load-signet-sdk'
import { VF2FA_NEXT_COOKIE, VF2FA_OAUTH_STATE_COOKIE, VF2FA_REMEMBER_ME_COOKIE } from '@/services/auth/constants'

export type SignetLoginButtonProps = {
  authCenterOrigin: string
  signetSdkModuleUrl: string
  callbackPath?: string
  postLoginPath?: string
  rememberMe?: boolean
}

const COOKIE_MAX_AGE_SEC = 600

export function SignetLoginButton({
  authCenterOrigin,
  signetSdkModuleUrl,
  callbackPath = '/auth/vercel-2fa/callback',
  postLoginPath = '/admin/assets/sources',
  rememberMe = false,
}: SignetLoginButtonProps) {
  const [sdkError, setSdkError] = useState<string | null>(null)

  const ensureSdk = useCallback(async () => loadSignetSdk(signetSdkModuleUrl), [signetSdkModuleUrl])

  useEffect(() => {
    void ensureSdk()
      .then(() => setSdkError(null))
      .catch((error: unknown) => {
        setSdkError(error instanceof Error ? error.message : String(error))
      })
  }, [ensureSdk])

  function handleClick() {
    void ensureSdk()
      .then((module) => {
        const state = crypto.randomUUID()
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:'
        const cookieSuffix = `Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure ? '; Secure' : ''}`
        document.cookie = `${VF2FA_OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; ${cookieSuffix}`
        document.cookie = `${VF2FA_NEXT_COOKIE}=${encodeURIComponent(postLoginPath)}; ${cookieSuffix}`
        document.cookie = `${VF2FA_REMEMBER_ME_COOKIE}=${rememberMe ? '1' : '0'}; ${cookieSuffix}`

        const origin = window.location.origin
        const redirectUrl = `${origin}${callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`}`
        const url = module.buildLoginUrl({
          authCenterOrigin: authCenterOrigin.replace(/\/+$/, ''),
          redirectUrl,
          state,
        })
        window.location.href = url
      })
      .catch(() => {
        // sdkError set by prefetch effect
      })
  }

  return (
    <div className="login-page__signet">
      <button type="button" onClick={handleClick} className="login-page__signet-btn">
        <span className="login-page__signet-icon" aria-hidden="true">
          ◈
        </span>
        <span className="login-page__signet-text">Continue with Signet</span>
      </button>
      {sdkError ? <p className="login-page__signet-error">Could not load Signet SDK: {sdkError}</p> : null}
    </div>
  )
}
