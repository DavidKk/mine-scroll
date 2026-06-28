import { cookies } from 'next/headers'
import { authenticator } from 'otplib'

import { AUTH_TOKEN_NAME } from '@/services/auth/constants'
import { login, logout } from '@/services/auth/login'

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

const mockCookies = cookies as jest.MockedFunction<typeof cookies>
const mockSet = jest.fn()

describe('services/auth/login', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'login-test-secret',
      ACCESS_USERNAME: 'admin',
      ACCESS_PASSWORD: 'secret',
    }
    delete process.env.ACCESS_2FA_SECRET
    mockSet.mockReset()
    mockCookies.mockResolvedValue({ set: mockSet } as unknown as Awaited<ReturnType<typeof cookies>>)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('rejects empty credentials', async () => {
    await expect(login('', 'secret')).rejects.toThrow('Username is required')
    await expect(login('admin', '')).rejects.toThrow('Password is required')
  })

  it('rejects local login in production', async () => {
    process.env.NODE_ENV = 'production'
    await expect(login('admin', 'secret')).rejects.toThrow('Local login is disabled in production')
  })

  it('rejects invalid username or password', async () => {
    await expect(login('wrong', 'secret')).rejects.toThrow('Invalid username or password')
    await expect(login('admin', 'wrong')).rejects.toThrow('Invalid username or password')
  })

  it('sets auth cookie on successful login', async () => {
    await login('admin', 'secret', '', true)
    expect(mockSet).toHaveBeenCalledWith(
      AUTH_TOKEN_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      })
    )
  })

  it('requires valid 2FA when ACCESS_2FA_SECRET is set', async () => {
    const secret = authenticator.generateSecret()
    process.env.ACCESS_2FA_SECRET = secret
    await expect(login('admin', 'secret')).rejects.toThrow('Invalid username or password')

    const token = authenticator.generate(secret)
    await expect(login('admin', 'secret', token)).resolves.toBeUndefined()
    expect(mockSet).toHaveBeenCalled()
  })

  it('clears auth cookie on logout', async () => {
    await logout()
    expect(mockSet).toHaveBeenCalledWith(
      AUTH_TOKEN_NAME,
      '',
      expect.objectContaining({
        httpOnly: true,
        maxAge: 0,
        path: '/',
      })
    )
  })
})
