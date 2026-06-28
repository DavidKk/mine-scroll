import { getSignetAuthCenterOrigin } from '@/lib/signet-sdk-url'

export function isJwtConfigured(): boolean {
  return Boolean(process.env.JWT_SECRET?.trim())
}

/** Local username/password login — development only; not used in production. */
export function isLocalLoginEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return Boolean(process.env.ACCESS_USERNAME?.trim() && process.env.ACCESS_PASSWORD)
}

export function isSignetLoginEnabled(): boolean {
  return getSignetAuthCenterOrigin() !== null
}

export function isAdminAuthConfigured(): boolean {
  return isJwtConfigured() && (isSignetLoginEnabled() || isLocalLoginEnabled())
}
