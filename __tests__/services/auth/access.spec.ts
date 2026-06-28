import { cookies } from 'next/headers'

import { generateToken } from '@/lib/jwt'
import { validateCookie } from '@/services/auth/access'
import { AUTH_TOKEN_NAME } from '@/services/auth/constants'

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

const mockCookies = cookies as jest.MockedFunction<typeof cookies>

function mockAuthCookie(value: string | undefined): void {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === AUTH_TOKEN_NAME && value ? { value } : undefined),
  } as Awaited<ReturnType<typeof cookies>>)
}

describe('services/auth/access', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'access-test-secret' }
    mockCookies.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('validateCookie', () => {
    it('returns false when JWT_SECRET is missing', async () => {
      delete process.env.JWT_SECRET
      mockAuthCookie('anything')
      expect(await validateCookie()).toBe(false)
    })

    it('returns false when auth cookie is absent', async () => {
      mockAuthCookie(undefined)
      expect(await validateCookie()).toBe(false)
    })

    it('returns true for a valid authenticated session', async () => {
      const token = await generateToken({ authenticated: true, sub: 'alice' })
      mockAuthCookie(token)
      expect(await validateCookie()).toBe(true)
    })

    it('returns false when authenticated claim is missing', async () => {
      const token = await generateToken({ sub: 'alice' })
      mockAuthCookie(token)
      expect(await validateCookie()).toBe(false)
    })

    it('returns false for invalid tokens', async () => {
      mockAuthCookie('not.a.jwt')
      expect(await validateCookie()).toBe(false)
    })

    it('returns false for expired tokens', async () => {
      jest.useFakeTimers()
      const token = await generateToken({ authenticated: true }, { expiresIn: 1 })
      jest.advanceTimersByTime(2000)
      mockAuthCookie(token)
      expect(await validateCookie()).toBe(false)
      jest.useRealTimers()
    })
  })
})
