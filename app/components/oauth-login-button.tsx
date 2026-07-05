'use client'

import { LOGIN_OAUTH_BUTTON_CLASS } from '@/lib/login-shell'

type OAuthLoginButtonProps = {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

export function OAuthLoginButton({ onClick, disabled = false, loading = false }: OAuthLoginButtonProps) {
  return (
    <button type="button" onClick={onClick} className={LOGIN_OAUTH_BUTTON_CLASS} disabled={disabled || loading} aria-busy={loading}>
      <span className="text-base text-admin-gold" aria-hidden="true">
        ⬡
      </span>
      <span>{loading ? 'Redirecting…' : 'Sign in with Vercel 2FA'}</span>
    </button>
  )
}
