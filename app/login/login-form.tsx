'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { OAuthLoginButton } from '@/app/components/oauth-login-button'
import { SignetLoginButton } from '@/app/components/signet-login-button'
import { BRAND_NAME } from '@/lib/brand'
import { useOAuthLoginContext, withOAuthLogin } from '@/services/oauth-login/withOAuthLogin'

type LoginFormProps = {
  redirectUrl: string
  enableSignet: boolean
  signetOrigin: string | null
  signetSdkModuleUrl: string
  enableLocalLogin: boolean
  enable2FA: boolean
  vf2faError: string | null
}

function vf2faErrorMessage(code: string | null): string | null {
  if (!code) return null
  if (code === 'missing_token') return 'Signet login missing token. Try again.'
  if (code === 'invalid_state') return 'Signet login state check failed. Try signing in again.'
  if (code === 'verify_failed') return 'Could not verify login with the auth center. Check SIGNET_SDK_URL and auth center logs.'
  return `Signet login error: ${code}`
}

function LoginFormInner({ redirectUrl, enableSignet, signetOrigin, signetSdkModuleUrl, enableLocalLogin, enable2FA, vf2faError }: LoginFormProps) {
  const router = useRouter()
  const oauth = useOAuthLoginContext()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [access2FAToken, setAccess2FAToken] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(vf2faErrorMessage(vf2faError))
  const [submitting, setSubmitting] = useState(false)

  const hasThirdPartyLogin = enableSignet || oauth.available
  const oauthBusy = oauth.status === 'launching' || oauth.status === 'redirecting'

  useEffect(() => {
    const message = vf2faErrorMessage(vf2faError)
    if (!message) return
    setError(message)
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    params.delete('vf2fa_error')
    const qs = params.toString()
    const path = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, '', path)
  }, [vf2faError])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, token: access2FAToken, rememberMe }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Invalid username or password')
      }

      router.push(redirectUrl)
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (oauth.isHandlingCallback) {
    return (
      <main className="login-page">
        <div className="game-admin-backdrop" aria-hidden="true">
          <div className="game-admin-backdrop__aurora" />
          <div className="game-admin-backdrop__stars game-admin-backdrop__stars--far" />
          <div className="game-admin-backdrop__stars game-admin-backdrop__stars--near" />
          <div className="game-admin-backdrop__grid" />
          <div className="game-admin-backdrop__vignette" />
        </div>

        <div className="login-page__panel">
          <div className="login-page__panel-glow" aria-hidden="true" />
          <div className="login-page__panel-frame" aria-hidden="true" />
          <h1 className="login-page__title">{BRAND_NAME}</h1>
          <p className="login-page__label">VERIFYING THIRD-PARTY LOGIN</p>
          <p className="login-page__oauth-status">Completing sign-in…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="login-page">
      <div className="game-admin-backdrop" aria-hidden="true">
        <div className="game-admin-backdrop__aurora" />
        <div className="game-admin-backdrop__stars game-admin-backdrop__stars--far" />
        <div className="game-admin-backdrop__stars game-admin-backdrop__stars--near" />
        <div className="game-admin-backdrop__grid" />
        <div className="game-admin-backdrop__vignette" />
      </div>

      <div className="login-page__panel">
        <div className="login-page__panel-glow" aria-hidden="true" />
        <div className="login-page__panel-frame" aria-hidden="true" />
        <div className="login-page__panel-scanlines" aria-hidden="true" />

        <div className="login-page__brand" aria-hidden="true">
          <div className="login-page__brand-mark">◫</div>
        </div>

        <h1 className="login-page__title">{BRAND_NAME}</h1>
        <p className="login-page__label">ADMIN ACCESS</p>

        {enableSignet && signetOrigin ? (
          <SignetLoginButton authCenterOrigin={signetOrigin} signetSdkModuleUrl={signetSdkModuleUrl} postLoginPath={redirectUrl} rememberMe={rememberMe} />
        ) : null}

        {oauth.available ? (
          <div className="login-page__oauth">
            <OAuthLoginButton
              onClick={() => {
                oauth.resetError()
                void oauth.launch()
              }}
              disabled={submitting}
              loading={oauthBusy}
            />
            {oauth.error ? (
              <p className="login-page__oauth-error" role="alert">
                {oauth.error}
              </p>
            ) : null}
          </div>
        ) : null}

        {enableLocalLogin && hasThirdPartyLogin ? (
          <div className="login-page__divider" role="separator">
            <span>Local dev only</span>
          </div>
        ) : null}

        {enableLocalLogin ? (
          <form className="login-page__form" onSubmit={handleSubmit}>
            <label className="login-page__field">
              <span className="login-page__field-label">Username</span>
              <input
                className="login-page__input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="Operator ID"
                required
              />
            </label>

            <label className="login-page__field">
              <span className="login-page__field-label">Password</span>
              <div className="login-page__password-wrap">
                <input
                  className="login-page__input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Access key"
                  required
                />
                <button
                  type="button"
                  className="login-page__password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {enable2FA ? (
              <label className="login-page__field">
                <span className="login-page__field-label">2FA Code</span>
                <input
                  className="login-page__input login-page__input--otp"
                  value={access2FAToken}
                  onChange={(event) => setAccess2FAToken(event.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  pattern="\d{6}"
                  inputMode="numeric"
                  required
                />
              </label>
            ) : null}

            <label className="login-page__remember">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              <span>Remember session</span>
            </label>

            {error ? (
              <p className="login-page__error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="login-page__submit" disabled={submitting || oauthBusy}>
              <span className="login-page__submit-plate" aria-hidden="true" />
              <span className="login-page__submit-text">{submitting ? 'AUTHENTICATING…' : 'ENTER'}</span>
            </button>
          </form>
        ) : error ? (
          <p className="login-page__error" role="alert">
            {error}
          </p>
        ) : null}

        <Link href="/" className="login-page__back">
          ← Back to game
        </Link>
      </div>
    </main>
  )
}

export const LoginForm = withOAuthLogin(LoginFormInner)
