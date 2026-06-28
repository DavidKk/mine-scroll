import { DEFAULT_SESSION_MAX_AGE, getRememberedSessionMaxAge, getSessionMaxAge } from '@/services/auth/session-duration'

describe('services/auth/session-duration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_EXPIRES_IN: '7d' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('uses 24h for non-remembered sessions', () => {
    expect(getSessionMaxAge(false)).toBe(DEFAULT_SESSION_MAX_AGE)
  })

  it('uses JWT_EXPIRES_IN for remembered sessions', () => {
    expect(getSessionMaxAge(true)).toBe(7 * 86400)
    expect(getRememberedSessionMaxAge()).toBe(7 * 86400)
  })
})
