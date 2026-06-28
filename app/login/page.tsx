import type { Metadata } from 'next'

import { isAdminAuthConfigured, isJwtConfigured, isLocalLoginEnabled } from '@/lib/auth-config'
import { NOINDEX_ROBOTS } from '@/lib/seo'
import { getSignetAuthCenterOrigin, getSignetSdkModuleUrl } from '@/lib/signet-sdk-url'
import { checkUnAccess } from '@/services/auth/access'

import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: NOINDEX_ROBOTS,
}

type LoginPageProps = {
  searchParams: Promise<{ redirectUrl?: string; vf2fa_error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const redirectUrl = decodeURIComponent(params.redirectUrl ?? '/admin/assets/sources')
  await checkUnAccess({ redirectUrl, isApiRouter: false })

  if (!isAdminAuthConfigured()) {
    const missingJwt = !isJwtConfigured()
    return (
      <main className="login-page">
        <div className="login-page__panel login-page__panel--notice">
          <h1 className="login-page__title">Admin auth not configured</h1>
          <p className="login-page__subtitle">
            {missingJwt ? (
              <>
                Set <code>JWT_SECRET</code> to sign session cookies.
              </>
            ) : (
              <>
                Set <code>SIGNET_SDK_URL</code> for production, or <code>ACCESS_USERNAME</code> / <code>ACCESS_PASSWORD</code> for local dev.
              </>
            )}{' '}
            See <code>.env.example</code>.
          </p>
        </div>
      </main>
    )
  }

  const signetOrigin = getSignetAuthCenterOrigin()
  const signetSdkModuleUrl = getSignetSdkModuleUrl()

  return (
    <LoginForm
      redirectUrl={redirectUrl}
      enableSignet={signetOrigin !== null}
      signetOrigin={signetOrigin}
      signetSdkModuleUrl={signetSdkModuleUrl}
      enableLocalLogin={isLocalLoginEnabled()}
      enable2FA={Boolean(process.env.ACCESS_2FA_SECRET)}
      vf2faError={params.vf2fa_error ?? null}
    />
  )
}
