import { getSignetAuthCenterOrigin, getSignetSdkModuleUrl } from '@/lib/signet-sdk-url'

describe('lib/signet-sdk-url', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.SIGNET_SDK_URL
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getSignetAuthCenterOrigin', () => {
    it('returns null when unset', () => {
      expect(getSignetAuthCenterOrigin()).toBeNull()
    })

    it('extracts origin from signet-client.mjs URL', () => {
      process.env.SIGNET_SDK_URL = 'https://vercel-2fa.vercel.app/sdk/signet-client.mjs'
      expect(getSignetAuthCenterOrigin()).toBe('https://vercel-2fa.vercel.app')
    })

    it('returns null for invalid URLs', () => {
      process.env.SIGNET_SDK_URL = 'not-a-url'
      expect(getSignetAuthCenterOrigin()).toBeNull()
    })
  })

  describe('getSignetSdkModuleUrl', () => {
    it('uses explicit SIGNET_SDK_URL when set', () => {
      const url = 'https://custom.example/sdk/signet-client.mjs'
      process.env.SIGNET_SDK_URL = url
      expect(getSignetSdkModuleUrl()).toBe(url)
    })

    it('falls back to default auth center SDK path', () => {
      expect(getSignetSdkModuleUrl()).toBe('https://vercel-2fa.vercel.app/sdk/signet-client.mjs')
    })
  })
})
