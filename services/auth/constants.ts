export const AUTH_TOKEN_NAME = 'auth_token'

/** Non-httpOnly cookie set before redirect to Signet; validated on `/auth/vercel-2fa/callback`. */
export const VF2FA_OAUTH_STATE_COOKIE = 'vf2fa_oauth_state'

/** Where to send the user after successful Signet login (relative path only). */
export const VF2FA_NEXT_COOKIE = 'vf2fa_next'

/** Whether Signet callback should mint a longer session. */
export const VF2FA_REMEMBER_ME_COOKIE = 'vf2fa_remember_me'
