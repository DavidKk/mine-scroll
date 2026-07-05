'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AdminBackdrop } from '@/app/components/admin-backdrop'
import { OAuthLoginButton } from '@/app/components/oauth-login-button'
import { SignetLoginButton } from '@/app/components/signet-login-button'
import { BRAND_NAME } from '@/lib/brand'
import { cn } from '@/lib/cn'
import { LOGIN_FIELD_LABEL, LOGIN_INPUT_CLASS, LOGIN_PAGE_SHELL, LOGIN_PANEL_SHELL } from '@/lib/login-shell'
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

function LoginPanelChrome() {
  return (
    <>
      <div className="pointer-events-none absolute -inset-px rounded-[inherit] bg-[radial-gradient(circle_at_50%_0%,rgba(45,236,255,0.16),transparent_58%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-2.5 rounded-[10px] border border-landing-cyan/[0.14]" aria-hidden="true" />
    </>
  )
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
  const [mounted, setMounted] = useState(false)

  const hasThirdPartyLogin = enableSignet || oauth.available
  const oauthBusy = oauth.status === 'launching' || oauth.status === 'redirecting'

  useEffect(() => {
    setMounted(true)
  }, [])

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
      <main className={LOGIN_PAGE_SHELL}>
        <AdminBackdrop />
        <div className={LOGIN_PANEL_SHELL}>
          <LoginPanelChrome />
          <h1 className="m-0 text-center text-[1.55rem] font-bold tracking-[0.04em] [text-shadow:0_0_18px_rgba(45,236,255,0.22)]">{BRAND_NAME}</h1>
          <p className="m-0 text-center font-mono text-[0.72rem] tracking-[0.14em] text-landing-cyan/80">VERIFYING THIRD-PARTY LOGIN</p>
          <p className="m-0 text-center text-[0.9rem] text-admin-muted">Completing sign-in…</p>
        </div>
      </main>
    )
  }

  return (
    <main className={LOGIN_PAGE_SHELL}>
      <AdminBackdrop />

      <div className={LOGIN_PANEL_SHELL}>
        <LoginPanelChrome />
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.08] [background:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.14)_2px,rgba(255,255,255,0.14)_3px)]"
          aria-hidden="true"
        />

        <div className="flex justify-center" aria-hidden="true">
          <div className="grid h-[52px] w-[52px] place-items-center rounded-[14px] border border-landing-cyan/[0.22] bg-landing-cyan/[0.14] text-[22px] text-admin-cyan shadow-[0_0_24px_rgba(45,236,255,0.18)]">
            ◫
          </div>
        </div>

        <h1 className="m-0 text-center text-[1.55rem] font-bold tracking-[0.04em] [text-shadow:0_0_18px_rgba(45,236,255,0.22)]">{BRAND_NAME}</h1>
        <p className="m-0 text-center font-mono text-[0.72rem] tracking-[0.14em] text-landing-cyan/80">ADMIN ACCESS</p>

        {mounted && enableSignet && signetOrigin ? (
          <SignetLoginButton authCenterOrigin={signetOrigin} signetSdkModuleUrl={signetSdkModuleUrl} postLoginPath={redirectUrl} rememberMe={rememberMe} />
        ) : null}

        {mounted && oauth.available ? (
          <div className="grid gap-2">
            <OAuthLoginButton
              onClick={() => {
                oauth.resetError()
                void oauth.launch()
              }}
              disabled={submitting}
              loading={oauthBusy}
            />
            {oauth.error ? (
              <p className="m-0 text-center text-[0.78rem] leading-snug text-red-200" role="alert">
                {oauth.error}
              </p>
            ) : null}
          </div>
        ) : null}

        {mounted && enableLocalLogin && hasThirdPartyLogin ? (
          <div
            className="my-1 flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.1em] text-admin-muted before:h-px before:flex-1 before:bg-landing-cyan/[0.12] after:h-px after:flex-1 after:bg-landing-cyan/[0.12]"
            role="separator"
          >
            <span>Local dev only</span>
          </div>
        ) : null}

        {enableLocalLogin ? (
          <form className="grid gap-3.5" onSubmit={handleSubmit}>
            <label className="grid gap-1.5">
              <span className={LOGIN_FIELD_LABEL}>Username</span>
              <input
                className={LOGIN_INPUT_CLASS}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="Operator ID"
                required
              />
            </label>

            <label className="grid gap-1.5">
              <span className={LOGIN_FIELD_LABEL}>Password</span>
              <div className="relative">
                <input
                  className={cn(LOGIN_INPUT_CLASS, 'pr-16')}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Access key"
                  required
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md border-0 bg-white/[0.06] px-2 py-1 font-[inherit] text-[0.72rem] font-bold tracking-[0.06em] text-admin-muted hover:bg-white/10 hover:text-admin-text"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {enable2FA ? (
              <label className="grid gap-1.5">
                <span className={LOGIN_FIELD_LABEL}>2FA Code</span>
                <input
                  className={cn(LOGIN_INPUT_CLASS, 'text-center font-mono tracking-[0.35em]')}
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

            <label className="flex items-center gap-2 text-[0.85rem] text-admin-muted [&_input]:accent-admin-cyan">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              <span>Remember session</span>
            </label>

            {error ? (
              <p className="m-0 rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2.5 text-[0.85rem] text-red-200" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="group relative mt-1 min-h-12 w-full cursor-pointer overflow-hidden rounded-[10px] border-0 bg-transparent disabled:cursor-wait disabled:opacity-65"
              disabled={submitting || oauthBusy}
            >
              <span
                className="absolute inset-0 rounded-[inherit] border border-landing-cyan/[0.22] bg-gradient-to-b from-landing-cyan/[0.22] to-landing-cyan/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_20px_rgba(45,236,255,0.16)] transition-[transform,box-shadow] duration-100 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_28px_rgba(45,236,255,0.28)] group-active:translate-y-px"
                aria-hidden="true"
              />
              <span className="relative z-[1] font-mono text-[0.82rem] font-bold tracking-[0.16em] text-admin-gold [text-shadow:0_0_12px_rgba(253,224,71,0.55)]">
                {submitting ? 'AUTHENTICATING…' : 'ENTER'}
              </span>
            </button>
          </form>
        ) : error ? (
          <p className="m-0 rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2.5 text-[0.85rem] text-red-200" role="alert">
            {error}
          </p>
        ) : null}

        <Link href="/" className="mt-0.5 justify-self-center text-[0.82rem] text-admin-muted no-underline hover:text-admin-cyan">
          ← Back to game
        </Link>
      </div>
    </main>
  )
}

export const LoginForm = withOAuthLogin(LoginFormInner)
