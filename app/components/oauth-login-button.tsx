'use client'

type OAuthLoginButtonProps = {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

export function OAuthLoginButton({ onClick, disabled = false, loading = false }: OAuthLoginButtonProps) {
  return (
    <button type="button" onClick={onClick} className="login-page__oauth-btn" disabled={disabled || loading} aria-busy={loading}>
      <span className="login-page__oauth-icon" aria-hidden="true">
        ⬡
      </span>
      <span className="login-page__oauth-text">{loading ? 'Redirecting…' : 'Sign in with Vercel 2FA'}</span>
    </button>
  )
}
