import { isAdminAuthConfigured, isJwtConfigured, isLocalLoginEnabled, isSignetLoginEnabled } from '@/lib/auth-config'

describe('lib/auth-config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.JWT_SECRET
    delete process.env.SIGNET_SDK_URL
    delete process.env.ACCESS_USERNAME
    delete process.env.ACCESS_PASSWORD
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('isJwtConfigured', () => {
    it('is false when JWT_SECRET is missing or blank', () => {
      expect(isJwtConfigured()).toBe(false)
      process.env.JWT_SECRET = '   '
      expect(isJwtConfigured()).toBe(false)
    })

    it('is true when JWT_SECRET is set', () => {
      process.env.JWT_SECRET = 'secret'
      expect(isJwtConfigured()).toBe(true)
    })
  })

  describe('isSignetLoginEnabled', () => {
    it('is false without SIGNET_SDK_URL', () => {
      expect(isSignetLoginEnabled()).toBe(false)
    })

    it('is true for signet-client.mjs URLs', () => {
      process.env.SIGNET_SDK_URL = 'https://auth.example.com/sdk/signet-client.mjs'
      expect(isSignetLoginEnabled()).toBe(true)
    })

    it('is false for non-signet SDK paths', () => {
      process.env.SIGNET_SDK_URL = 'https://auth.example.com/other.js'
      expect(isSignetLoginEnabled()).toBe(false)
    })
  })

  describe('isLocalLoginEnabled', () => {
    it('is false in production even with credentials', () => {
      process.env.NODE_ENV = 'production'
      process.env.ACCESS_USERNAME = 'admin'
      process.env.ACCESS_PASSWORD = 'pass'
      expect(isLocalLoginEnabled()).toBe(false)
    })

    it('is true in dev when username and password are set', () => {
      process.env.NODE_ENV = 'development'
      process.env.ACCESS_USERNAME = 'admin'
      process.env.ACCESS_PASSWORD = 'pass'
      expect(isLocalLoginEnabled()).toBe(true)
    })

    it('is false when only username is set', () => {
      process.env.NODE_ENV = 'development'
      process.env.ACCESS_USERNAME = 'admin'
      expect(isLocalLoginEnabled()).toBe(false)
    })
  })

  describe('isAdminAuthConfigured', () => {
    it('requires JWT plus Signet or local credentials', () => {
      process.env.JWT_SECRET = 'secret'
      expect(isAdminAuthConfigured()).toBe(false)

      process.env.SIGNET_SDK_URL = 'https://auth.example.com/sdk/signet-client.mjs'
      expect(isAdminAuthConfigured()).toBe(true)

      delete process.env.SIGNET_SDK_URL
      process.env.NODE_ENV = 'development'
      process.env.ACCESS_USERNAME = 'admin'
      process.env.ACCESS_PASSWORD = 'pass'
      expect(isAdminAuthConfigured()).toBe(true)
    })
  })
})
